-- Права роли приложения. activity_log — append-only: только INSERT/SELECT.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='qurylys_app') THEN
    CREATE ROLE qurylys_app WITH LOGIN PASSWORD 'qurylys_app';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO qurylys_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qurylys_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qurylys_app;
ALTER DEFAULT PRIVILEGES FOR ROLE qurylys IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qurylys_app;
ALTER DEFAULT PRIVILEGES FOR ROLE qurylys IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO qurylys_app;
REVOKE UPDATE, DELETE, TRUNCATE ON activity_log FROM qurylys_app;
