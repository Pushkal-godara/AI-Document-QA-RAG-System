import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Runtime connection pool, authenticated as `rag_app` (never the admin/owner
 * role) so RLS policies always apply. Created once per process.
 */
export function createAppPool(connectionString: string) {
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}

/**
 * Every tenant-scoped query MUST go through this. It runs `fn` inside a
 * transaction with `app.tenant_id` set via SET LOCAL, which Postgres resets
 * at transaction end — so a leaked/pooled connection can never carry one
 * request's tenant into another's query. RLS policies (see schema.ts) key
 * off this same session variable.
 */
export async function withTenant<T>(
  db: Db,
  tenantId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Db);
  });
}
