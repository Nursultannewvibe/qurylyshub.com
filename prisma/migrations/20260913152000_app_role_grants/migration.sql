-- Права роли приложения. activity_log — append-only: только INSERT/SELECT.
-- Локально (владелец qurylys) роль qurylys_app создаётся автоматически с dev-паролем.
-- На managed-хостингах (Neon и т.п.) роль нужно создать вручную с сильным паролем ДО этой миграции,
-- иначе блок с правами пропускается (см. README «Развёртывание»).
DO $$ BEGIN
  IF current_user = 'qurylys' AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='qurylys_app') THEN
    CREATE ROLE qurylys_app WITH LOGIN PASSWORD 'qurylys_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='qurylys_app') THEN
    GRANT USAGE ON SCHEMA public TO qurylys_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qurylys_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qurylys_app;
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qurylys_app', current_user);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO qurylys_app', current_user);
    REVOKE UPDATE, DELETE, TRUNCATE ON activity_log FROM qurylys_app;
  ELSE
    RAISE NOTICE 'qurylys_app role absent: grants skipped';
  END IF;
END $$;
