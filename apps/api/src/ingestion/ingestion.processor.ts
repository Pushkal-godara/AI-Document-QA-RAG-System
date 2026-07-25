import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { schema, withTenant } from '@rag/db';
import { DbService } from '../db/db.service';
import { StorageService } from '../storage/storage.service';
import { OllamaService } from '../llm/ollama.service';
import { MetricsService } from '../metrics/metrics.service';
import { extractText } from './parsing';
import { chunkByTokens, countTokens } from './tokenizer';

export interface IngestionJobData {
  documentId: string;
  tenantId: string;
}

@Processor('ingestion', { concurrency: 2 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly dbService: DbService,
    private readonly storage: StorageService,
    private readonly ollama: OllamaService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<void> {
    const { documentId, tenantId } = job.data;
    const db = this.dbService.db;
    const start = Date.now();

    try {
      const [document] = await withTenant(db, tenantId, async (tx) => {
        await tx
          .update(schema.documents)
          .set({ status: 'processing', updatedAt: new Date() })
          .where(eq(schema.documents.id, documentId));
        return tx.select().from(schema.documents).where(eq(schema.documents.id, documentId));
      });
      if (!document) throw new Error(`Document ${documentId} not found`);

      const buffer = await this.storage.download(document.s3Key);
      const text = await extractText(buffer, document.mimeType);
      const textChunks = chunkByTokens(text, 500, 50);
      if (textChunks.length === 0) {
        throw new Error('No extractable text content in document');
      }

      const embeddings = await this.ollama.embed(textChunks.map((c) => c.text));

      await withTenant(db, tenantId, async (tx) => {
        await tx.insert(schema.chunks).values(
          textChunks.map((chunk, i) => ({
            tenantId,
            documentId,
            chunkIndex: chunk.index,
            content: chunk.text,
            embedding: embeddings[i],
            tokenCount: countTokens(chunk.text),
            // officeparser's chunker (which reports page numbers) proved
            // unreliable - see parsing.ts. No per-chunk page for now.
            page: null,
          })),
        );
        await tx
          .update(schema.documents)
          .set({ status: 'ready', failureReason: null, updatedAt: new Date() })
          .where(eq(schema.documents.id, documentId));
      });

      this.metrics.recordIngestion('ready', Date.now() - start);
      this.logger.log(`Ingested document ${documentId}: ${textChunks.length} chunks`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ingestion failed for document ${documentId}: ${message}`);
      this.metrics.recordIngestion('failed', Date.now() - start);
      await withTenant(db, tenantId, (tx) =>
        tx
          .update(schema.documents)
          .set({ status: 'failed', failureReason: message, updatedAt: new Date() })
          .where(eq(schema.documents.id, documentId)),
      );
      throw err; // rethrow so BullMQ applies the retry/backoff policy
    }
  }
}
