#!/bin/sh
# Runs once, as the postgres superuser, when the data volume is first initialized.
#  - shop      : application role (NOT superuser), owns the schema via Alembic
#  - detector  : log collector role; its own statements are NOT logged, otherwise every
#                insert into attack_logs would be logged and re-analyzed (feedback loop)
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE shop LOGIN PASSWORD '${APP_DB_PASSWORD}';
CREATE ROLE detector LOGIN PASSWORD '${DETECTOR_DB_PASSWORD}';
ALTER ROLE detector SET log_statement = 'none';
CREATE DATABASE shop OWNER shop;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname shop <<SQL
GRANT CONNECT ON DATABASE shop TO detector;
GRANT USAGE ON SCHEMA public TO detector;
-- Table-level grants (least privilege) are applied by the Alembic migration that creates the tables.
SQL
