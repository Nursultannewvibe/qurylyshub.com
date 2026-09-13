#!/usr/bin/env bash
# Создаёт роли и базу для локальной разработки. Требует запущенного PostgreSQL и доступа суперпользователя.
set -e
PSQL="${PSQL:-psql}"
DB="${PGDATABASE_ADMIN:-postgres}"
$PSQL -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='qurylys') THEN
    CREATE ROLE qurylys WITH LOGIN PASSWORD 'qurylys' CREATEDB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='qurylys_app') THEN
    CREATE ROLE qurylys_app WITH LOGIN PASSWORD 'qurylys_app';
  END IF;
END $$;
SQL
if ! $PSQL -d "$DB" -tAc "SELECT 1 FROM pg_database WHERE datname='qurylys'" | grep -q 1; then
  $PSQL -d "$DB" -c "CREATE DATABASE qurylys OWNER qurylys;"
fi
echo "DB roles/database ready: qurylys (owner), qurylys_app (app, append-only activity_log)"
