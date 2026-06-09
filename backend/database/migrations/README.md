# `migrations/` — Alembic

Migraciones versionadas de schema OLTP gestionadas con [Alembic](https://alembic.sqlalchemy.org/).

## Estructura

```text
backend/
├── alembic.ini                ← Configuración (raíz, lo lee `alembic` automáticamente)
└── database/migrations/
    ├── env.py                 ← Conexión async + carga de settings de la app
    ├── script.py.mako         ← Plantilla para nuevas migraciones
    └── versions/              ← Archivos de migración (uno por cambio)
```

## Estado actual

> **Sprint 1.1 (actual):** estructura lista, sin migraciones aún.
> **Sprint 1.2:** se crearán los modelos SQLAlchemy y la primera migración inicial.

## Comandos básicos

Desde `backend/`:

```bash
# Aplicar todas las migraciones pendientes
alembic upgrade head

# Generar una nueva migración (autogenerate desde modelos)
alembic revision --autogenerate -m "descripción corta del cambio"

# Crear una migración vacía manual
alembic revision -m "descripción"

# Bajar una migración
alembic downgrade -1

# Ver el historial
alembic history --verbose

# Ver la versión actual de la BD
alembic current
```

## Reglas

1. **Una migración = un cambio lógico atómico.** No mezcles "agregar tabla X" y "modificar tabla Y" en la misma migración.
2. **Siempre implementa `downgrade()`.** Si no es reversible (ej. DROP COLUMN), documenta el porqué en el docstring.
3. **No edites migraciones ya mergeadas en `main`.** Crea una nueva que corrija.
4. **Prueba localmente:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`.
5. **Migraciones largas (>30s):** separa en una migración estructural (rápida) + un script en `manual_ops/` para el backfill.

## Convención de nombres

Alembic genera nombres con hash + descripción. Acepta los autogenerados pero asegúrate que la
descripción sea clara:

```text
versions/
├── 001_a1b2c3d4_initial_schema.py
├── 002_e5f6g7h8_add_geofence_to_puestos.py
├── 003_i9j0k1l2_add_indices_marcas.py
└── ...
```

## Estructura interna de un archivo de migración

```python
"""descripción corta

Revision ID: a1b2c3d4
Revises: <previa o None>
Create Date: 2026-06-09 12:00:00
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography  # si se usan tipos geoespaciales

revision = "a1b2c3d4"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ejemplo",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("nombre", sa.String(100), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ejemplo")
```
