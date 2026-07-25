import { and, cosineDistance, eq, exists, notExists, or } from 'drizzle-orm';
import { schema, type Db } from '@rag/db';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentFilename: string;
  page: number | null;
  content: string;
}

/**
 * Tenant scoping comes from RLS (the caller must run this inside
 * withTenant/RlsDbService) - this function only adds the document-level ACL
 * on top: a document with no document_permissions rows is tenant-wide
 * visible; one with rows is restricted to the users listed there.
 */
export async function retrieveRelevantChunks(
  tx: Db,
  userId: string,
  queryEmbedding: number[],
  limit = 5,
): Promise<RetrievedChunk[]> {
  const hasNoRestrictions = notExists(
    tx
      .select({ one: schema.documentPermissions.id })
      .from(schema.documentPermissions)
      .where(eq(schema.documentPermissions.documentId, schema.documents.id)),
  );

  const userIsAllowed = exists(
    tx
      .select({ one: schema.documentPermissions.id })
      .from(schema.documentPermissions)
      .where(
        and(
          eq(schema.documentPermissions.documentId, schema.documents.id),
          eq(schema.documentPermissions.userId, userId),
        ),
      ),
  );

  return tx
    .select({
      chunkId: schema.chunks.id,
      documentId: schema.chunks.documentId,
      documentFilename: schema.documents.filename,
      page: schema.chunks.page,
      content: schema.chunks.content,
    })
    .from(schema.chunks)
    .innerJoin(schema.documents, eq(schema.documents.id, schema.chunks.documentId))
    .where(and(eq(schema.documents.status, 'ready'), or(hasNoRestrictions, userIsAllowed)))
    .orderBy(cosineDistance(schema.chunks.embedding, queryEmbedding))
    .limit(limit);
}
