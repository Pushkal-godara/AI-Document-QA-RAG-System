-- Run once against the DB as the admin/owner role, before the first migration.
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rag_app') THEN
    CREATE ROLE rag_app LOGIN PASSWORD 'rag_app_dev_password';
  END IF;
END $$;
