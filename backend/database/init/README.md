# `init/` — Bootstrap de PostgreSQL

Scripts que se ejecutan **una sola vez** al provisionar una nueva base de datos.

## Contenido

- `01_extensions.sql` — Habilita las extensiones de PostgreSQL que la aplicación necesita
  (`uuid-ossp`, `pgcrypto`, `postgis`, `pg_trgm`, `btree_gist`).

## Cuándo se ejecuta

- **Localmente:** automáticamente por Docker Compose al crear el volumen de PostgreSQL
  por primera vez (montado en `/docker-entrypoint-initdb.d/`).
- **AWS RDS / cloud:** manualmente la primera vez que se provisiona la instancia,
  por el equipo de infraestructura.

## ⚠️ NO modificar después del primer deploy

Estos scripts solo se ejecutan en la inicialización del contenedor. Si necesitas agregar
una extensión nueva más adelante, hazlo desde una migración Alembic con:

```python
def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "nueva_extension";')
```
