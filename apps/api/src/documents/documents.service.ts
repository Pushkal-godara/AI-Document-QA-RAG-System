import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { schema } from '@rag/db';
import { StorageService } from '../storage/storage.service';
import { RlsDbService } from '../db/rls-db.service';
import { SUPPORTED_MIME_TYPES } from '../ingestion/parsing';
import type { JwtPayload } from '../auth/types';
import type { IngestionJobData } from '../ingestion/ingestion.processor';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

@Injectable()
export class DocumentsService {
  constructor(
    private readonly storage: StorageService,
    private readonly rlsDb: RlsDbService,
    @InjectQueue('ingestion') private readonly ingestionQueue: Queue<IngestionJobData>,
  ) {}

  async upload(file: Express.Multer.File | undefined, user: JwtPayload) {
    if (!file) throw new BadRequestException('file is required');
    if (!SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 50MB limit');
    }

    const s3Key = `${user.tenantId}/${randomUUID()}-${file.originalname}`;
    await this.storage.upload(s3Key, file.buffer, file.mimetype);

    const document = await this.rlsDb.run(async (tx) => {
      const [doc] = await tx
        .insert(schema.documents)
        .values({
          tenantId: user.tenantId,
          filename: file.originalname,
          s3Key,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          status: 'pending',
          createdBy: user.sub,
        })
        .returning();
      return doc;
    });

    await this.ingestionQueue.add(
      'ingest',
      { documentId: document.id, tenantId: user.tenantId },
      {
        jobId: document.id, // one job per document - retries dedupe naturally
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return document;
  }

  list() {
    // No explicit tenant filter needed here - RLS already restricts every row
    // read through rag_app to the current request's tenant (see rls-db.service.ts).
    return this.rlsDb.run((tx) =>
      tx.select().from(schema.documents).orderBy(desc(schema.documents.createdAt)),
    );
  }

  async getOne(id: string) {
    const [document] = await this.rlsDb.run((tx) =>
      tx.select().from(schema.documents).where(eq(schema.documents.id, id)),
    );
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }
}
