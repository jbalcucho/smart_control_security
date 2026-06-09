# `database/` — Gestión de la Base de Datos

> Este directorio agrupa **todo el código SQL y de migraciones** de Smart Control Security.
> Está organizado siguiendo una convención **híbrida** inspirada en patrones de data engineering
> (explore / build / publish, separación DDL/DML) y adaptada a un sistema **OLTP transaccional**
> con FastAPI + SQLAlchemy + Alembic + PostgreSQL/PostGIS.
>
> **ADR de referencia:** [`docs/decisiones-tecnicas.md` → ADR-020](../../docs/decisiones-tecnicas.md)

---

## Tabla de contenidos

1. [Filosofía](#filosofía)
2. [Estructura de carpetas](#estructura-de-carpetas)
3. [Flujo de trabajo](#flujo-de-trabajo)
4. [Reglas de oro](#reglas-de-oro)
5. [Cómo ejecutar localmente](#cómo-ejecutar-localmente)
6. [Cómo se ejecuta en CI/CD](#cómo-se-ejecuta-en-cicd)
7. [FAQ](#faq)

---

## Filosofía

Separamos los cambios de base de datos en **dos categorías** según su riesgo:

| Categoría | Riesgo | Ejecución |
|---|---|---|
| **Idempotente / Reversible** (migrations Alembic, `CREATE OR REPLACE VIEW`, seeds con `ON CONFLICT`) | Bajo | 🤖 Automática vía CI/CD en cada merge a `main` |
| **Destructiva / Con efectos colaterales** (`DROP COLUMN`, `UPDATE` masivos, `DELETE`, backfills) | Alto | 👤 Manual con `workflow_dispatch` + aprobación de 2 reviewers |

Esto se inspira en el patrón **explore / build / publish + ddl/dml** usado en data warehousing
(Snowflake, BigQuery, Databricks), pero adaptado a un OLTP donde:

- Las **migraciones de schema** son versionadas y secuenciales (Alembic, no scripts sueltos).
- Las **vistas y materialized views** son idempotentes y se re-aplican en cada deploy.
- Los **seeds** son idempotentes y se aplican en cada deploy.
- Las **operaciones manuales** se versionan en Git pero requieren gate humano para ejecutarse.

---

## Estructura de carpetas

```text
backend/database/
├── README.md                     ← este archivo
│
├── init/                         ← Scripts de bootstrap (extensiones de Postgres)
│   └── 01_extensions.sql         ← Se ejecuta UNA VEZ al crear el contenedor
│
├── migrations/                   ← Alembic (estructura del schema OLTP)
│   ├── README.md
│   ├── alembic.ini
│   ├── env.py                    ← Configurado para async SQLAlchemy
│   ├── script.py.mako            ← Plantilla de nuevas migraciones
│   └── versions/                 ← Migraciones versionadas (1 archivo = 1 cambio atómico)
│       ├── 001_initial_schema.py
│       └── ...
│
├── views/                        ← CREATE OR REPLACE VIEW (idempotentes)
│   ├── README.md
│   └── *.sql                     ← Vistas expuestas al panel admin y consumidores
│
├── analytics/                    ← MATERIALIZED VIEWS para reportes
│   ├── README.md
│   └── *.sql                     ← Drop-and-create (no afectan OLTP en tiempo real)
│
├── seeds/                        ← Datos iniciales idempotentes (catálogos, roles)
│   ├── README.md
│   └── *.sql                     ← INSERT ... ON CONFLICT DO NOTHING
│
├── manual_ops/                   ← Operaciones manuales (NO se ejecutan en CI/CD automático)
│   ├── README.md
│   └── YYYY-MM-DD_descripcion.sql
│
└── explore/                      ← Sandbox local. NUNCA se ejecuta en ambientes compartidos
    ├── README.md
    └── *.sql                     ← Solo para experimentos del dev
```

### Equivalencia con el patrón "explore / build / publish"

| Patrón empresarial | Aquí | Tipo de cambio | Ejecución |
|---|---|---|:---:|
| `explore/` | `explore/` | Experimentos del dev | 🏠 Solo local |
| `build/ddl/` | `migrations/` | Estructura del schema | 🤖 Auto |
| `build/dml/` | `seeds/` | Datos catálogo | 🤖 Auto |
| `publish/ddl/` | `views/` + `analytics/` | Capa expuesta | 🤖 Auto |
| `publish/dml/` | `manual_ops/` | Cambios sensibles | 👤 Manual |

---

## Flujo de trabajo

### A) Agregar una tabla nueva o columna nueva

1. Modifica el modelo en `backend/app/models/<modulo>.py`.
2. Genera la migración:
   ```bash
   cd backend
   alembic revision --autogenerate -m "agregar columna fecha_baja a guardias"
   ```
3. Revisa el archivo generado en `database/migrations/versions/`.
4. Pruébala localmente: `alembic upgrade head` y `alembic downgrade -1`.
5. Commit + PR. Al hacer merge a `main`, el workflow `database-auto-migrate.yml` la aplica
   en el ambiente correspondiente.

### B) Agregar o modificar una vista expuesta

1. Edita el archivo SQL en `database/views/<nombre_vista>.sql`.
2. **Siempre** usa `CREATE OR REPLACE VIEW` para que sea idempotente.
3. Commit + PR. Al hacer merge, el workflow auto la re-aplica.

### C) Agregar un seed (catálogo nuevo)

1. Crea/edita archivo en `database/seeds/<orden>_<nombre>.sql`.
2. **Siempre** usa `ON CONFLICT DO NOTHING` o `ON CONFLICT (...) DO UPDATE SET ...`.
3. Commit + PR. Al hacer merge, se re-aplica automáticamente.

### D) Operación manual (UPDATE masivo, backfill, fix de datos)

1. Crea archivo en `database/manual_ops/YYYY-MM-DD_descripcion.sql`.
2. **Obligatorio:** incluir cabecera con justificación, autor, ticket asociado y plan de rollback.
3. PR + review (2 aprobaciones mínimo).
4. Una vez en `main`, ve a GitHub Actions → `database-manual-ops` → "Run workflow" →
   selecciona el archivo + ambiente. Requiere aprobación adicional del workflow.

### E) Experimentar localmente

1. Pon tus scripts en `database/explore/`.
2. Estos archivos están en `.gitignore` (excepto README) — no se versionan.
3. **Nunca** se ejecutan en CI/CD ni en ambientes compartidos.

---

## Reglas de oro

### ✅ Sí

- **Migraciones pequeñas:** un cambio lógico por migración.
- **Idempotencia donde aplica:** vistas con `CREATE OR REPLACE`, seeds con `ON CONFLICT`.
- **Migraciones reversibles:** implementa `downgrade()` en cada Alembic revision.
- **Tests:** antes de mergear, corre `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`.
- **Document migrations destructivas:** si una migración borra columnas o datos, escribe el riesgo
  en el docstring del archivo.

### ❌ No

- **No edites una migración ya mergeada en `main`** (crea una nueva que la corrija).
- **No mezcles cambios de schema con backfill de datos en la misma migración Alembic** si el backfill
  es lento (>30s). Separa: migración estructural en `migrations/` + backfill en `manual_ops/`.
- **No uses `DROP TABLE` ni `DROP COLUMN` sin pasar por `manual_ops/`** con aprobación humana.
- **No ejecutes scripts de `explore/` en ningún ambiente que no sea tu máquina.**
- **No commitees credenciales** en ningún archivo SQL (usa variables de entorno).

---

## Cómo ejecutar localmente

### Setup inicial (una vez)

```bash
cd backend
docker-compose up -d postgres redis      # Levanta Postgres con PostGIS
pip install -r requirements-dev.txt
```

### Aplicar todo el estado de DB

```bash
cd backend
alembic upgrade head                      # Aplica migraciones
python -m database.tools.apply_views      # Aplica vistas (script helper, Sprint 1.2)
python -m database.tools.apply_seeds      # Aplica seeds
```

### Generar una migración nueva

```bash
cd backend
alembic revision --autogenerate -m "descripción corta"
```

### Rollback de la última migración

```bash
cd backend
alembic downgrade -1
```

### Conectarte a la BD para inspeccionar

```bash
docker exec -it scs-postgres psql -U scs_user -d scs_db
```

---

## Cómo se ejecuta en CI/CD

### Workflow automático: `.github/workflows/database-auto-migrate.yml`

- **Trigger:** push a `main` con cambios en `backend/database/migrations/**`, `views/**`, `analytics/**` o `seeds/**`.
- **Pasos:**
  1. Checkout
  2. Conecta a la BD del ambiente target (variables/secrets de GitHub)
  3. `alembic upgrade head`
  4. Aplica todos los archivos `.sql` de `views/`
  5. Aplica todos los archivos `.sql` de `analytics/`
  6. Aplica todos los archivos `.sql` de `seeds/`
  7. Reporta status en el PR / commit

### Workflow manual: `.github/workflows/database-manual-ops.yml`

- **Trigger:** `workflow_dispatch` (botón "Run workflow" en GitHub).
- **Inputs:**
  - `script_name`: nombre del archivo en `manual_ops/` a ejecutar
  - `environment`: `staging` | `production`
  - `dry_run`: si `true`, hace `EXPLAIN` sin commitear
- **Aprobación:** requiere GitHub Environment con required reviewers (mínimo 2).
- **Auditoría:** el output del script se guarda como artifact con timestamp.

---

## FAQ

**¿Por qué no scripts SQL puros en lugar de Alembic?**
Alembic versiona linealmente, soporta downgrade, autogenera migraciones desde los modelos y es el
estándar para FastAPI+SQLAlchemy. Para OLTP donde el orden importa, es más seguro que scripts sueltos.

**¿Por qué no usar Liquibase / Flyway?**
Ambos son excelentes pero requieren JVM o configuración adicional. Alembic ya viene en el stack Python.
Si en el futuro escalamos a multi-equipo con DBAs dedicados, podemos reevaluar.

**¿Qué pasa si dos PRs crean migraciones en paralelo?**
Alembic detecta el conflicto (dos migraciones con el mismo `down_revision`). El segundo PR debe hacer
`alembic merge` para resolverlo antes de mergear.

**¿Las vistas en `views/` pueden depender unas de otras?**
Sí, pero deben ordenarse alfabéticamente para que el dependencias se respeten. Si una `vista_b`
depende de `vista_a`, nómbralas como `10_vista_a.sql` y `20_vista_b.sql`.

**¿Cómo se aplica esto al ambiente de cada dev?**
Cada dev tiene su propio Docker local. Al correr `alembic upgrade head` aplica todo. Las vistas y
seeds las aplica con los comandos `python -m database.tools.apply_views` y `apply_seeds`
(disponibles a partir de Sprint 1.2).

---

## Referencias

- [ADR-013: Alembic para migraciones](../../docs/decisiones-tecnicas.md)
- [ADR-020: Estructura híbrida de database/](../../docs/decisiones-tecnicas.md)
- [docs/modelo-datos.md](../../docs/modelo-datos.md) — Schema detallado
- [Documentación oficial de Alembic](https://alembic.sqlalchemy.org/)
