import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations always run as the table-owning admin role, never rag_app.
    url: process.env.DATABASE_URL ?? 'postgresql://rag:rag_dev_password@localhost:5433/rag',
  },
});
