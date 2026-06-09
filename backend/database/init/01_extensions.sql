-- ============================================================
-- Smart Control Security - Bootstrap de extensiones
-- ============================================================
-- Este script se ejecuta automáticamente la PRIMERA vez que se
-- crea el contenedor de PostgreSQL (docker-compose).
--
-- En ambientes cloud (AWS RDS, etc.) las extensiones se crean
-- manualmente al provisionar la BD por primera vez.
--
-- Para correrlo manualmente en una BD existente:
--   psql -U scs_user -d scs_db -f 01_extensions.sql
-- ============================================================

-- UUIDs para PKs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Funciones criptográficas (hashing, random bytes)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Soporte geoespacial (puntos, polígonos, distancias)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Búsqueda por similitud de texto (autocompletar nombres)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices GiST para tipos como ranges + exclusión
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Verificación
SELECT
    'PostgreSQL ' || version() AS postgres_version,
    PostGIS_Version()          AS postgis_version;
