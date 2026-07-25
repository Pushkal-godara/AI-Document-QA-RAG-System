import type { ChunkCitationDto } from '@rag/shared';
import type { RetrievedChunk } from './retrieval';

/** Parses [1], [2] style markers the LLM was instructed to emit (see prompt.ts). */
export function extractCitations(answerText: string, chunks: RetrievedChunk[]): ChunkCitationDto[] {
  const cited = new Set<number>();
  for (const match of answerText.matchAll(/\[(\d+)\]/g)) {
    cited.add(Number(match[1]));
  }

  return [...cited]
    .filter((n) => n >= 1 && n <= chunks.length)
    .sort((a, b) => a - b)
    .map((n) => {
      const chunk = chunks[n - 1];
      return {
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentFilename: chunk.documentFilename,
        page: chunk.page ?? undefined,
        snippet: chunk.content.slice(0, 240),
      };
    });
}
