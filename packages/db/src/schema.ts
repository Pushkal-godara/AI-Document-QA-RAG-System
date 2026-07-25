import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
  pgPolicy,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Every tenant-scoped table gets the same RLS policy: rows are only visible
 * to the `rag_app` runtime role when tenant_id matches the session variable
 * set per-request via `withTenant()` (see client.ts). `rag_admin` (migrations,
 * table owner) bypasses RLS entirely and is never used at request time.
 */
const tenantPolicy = (tableName: string) =>
  pgPolicy(`${tableName}_tenant_isolation`, {
    for: 'all',
    to: 'rag_app',
    using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('free'), // 'free' | 'paid'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // Local dev-only credential. Removed once Clerk is wired in.
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('member'), // 'admin' | 'member'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_tenant_email_idx').on(t.tenantId, t.email),
    index('users_tenant_idx').on(t.tenantId),
    tenantPolicy('users'),
  ],
).enableRLS();

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    s3Key: text('s3_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: text('status').notNull().default('pending'), // pending | processing | ready | failed
    failureReason: text('failure_reason'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('documents_tenant_idx').on(t.tenantId), tenantPolicy('documents')],
).enableRLS();

/**
 * Presence of ANY row for a document means the document is restricted to the
 * listed users; absence means every user in the tenant can see it. Keeps the
 * common case (open document) free of extra rows.
 */
export const documentPermissions = pgTable(
  'document_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('document_permissions_doc_user_idx').on(t.documentId, t.userId),
    index('document_permissions_tenant_idx').on(t.tenantId),
    tenantPolicy('document_permissions'),
  ],
).enableRLS();

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    tokenCount: integer('token_count').notNull(),
    page: integer('page'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('chunks_tenant_idx').on(t.tenantId),
    index('chunks_document_idx').on(t.documentId),
    // Not .concurrently(): our migration runner wraps each file in a
    // transaction, and CREATE INDEX CONCURRENTLY can't run inside one.
    // Fine at this dataset size; revisit if migrating on a large live table.
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    tenantPolicy('chunks'),
  ],
).enableRLS();

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('conversations_tenant_idx').on(t.tenantId),
    index('conversations_user_idx').on(t.userId),
    tenantPolicy('conversations'),
  ],
).enableRLS();

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    citations: jsonb('citations'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_tenant_idx').on(t.tenantId),
    index('messages_conversation_idx').on(t.conversationId),
    tenantPolicy('messages'),
  ],
).enableRLS();

export const queryLogs = pgTable(
  'query_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    question: text('question').notNull(),
    model: text('model').notNull(),
    cacheHit: boolean('cache_hit').notNull().default(false),
    latencyMs: integer('latency_ms').notNull(),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('query_logs_tenant_idx').on(t.tenantId), tenantPolicy('query_logs')],
).enableRLS();
