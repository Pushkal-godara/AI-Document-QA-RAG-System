import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

async function main() {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('DATABASE_URL is not set');

  const bootstrapSql = postgres(adminUrl, { max: 1 });
  console.log('Running bootstrap.sql (extension + rag_app role)...');
  await bootstrapSql.file(path.join(__dirname, '../sql/bootstrap.sql'));
  await bootstrapSql.end();

  const migrationSql = postgres(adminUrl, { max: 1 });
  const db = drizzle(migrationSql);
  console.log('Applying migrations...');
  await migrate(db, { migrationsFolder: path.join(__dirname, '../migrations') });
  await migrationSql.end();

  const grantsSql = postgres(adminUrl, { max: 1 });
  console.log('Running grants.sql (rag_app privileges + FORCE RLS)...');
  await grantsSql.file(path.join(__dirname, '../sql/grants.sql'));
  await grantsSql.end();

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
