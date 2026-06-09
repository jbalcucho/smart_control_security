# Backend — Smart Control Security

Backend FastAPI del sistema de control de asistencia para guardias de seguridad.

> 📚 **Documentación del proyecto completo:** [`../docs/`](../docs/)
> 🏛️ **Arquitectura técnica:** [`../docs/arquitectura.md`](../docs/arquitectura.md)
> ⚙️ **Funcionalidades del backend:** [`../docs/funcionalidades-backend.md`](../docs/funcionalidades-backend.md)
> 🗓️ **Roadmap por fases:** [`../docs/roadmap-fases.md`](../docs/roadmap-fases.md)

---

## 🎯 Estado actual

**Sprint 1.1 completado** — Scaffolding básico con FastAPI + endpoint `/api/system/health` funcional.

**Próximos sprints:** ver [`../docs/roadmap-fases.md`](../docs/roadmap-fases.md).

---

## 🧱 Stack

- **Python 3.11+**
- **FastAPI** + Pydantic 2
- **SQLAlchemy 2.x async** + asyncpg + Alembic (Sprint 1.2)
- **PostgreSQL 16** + extensión **PostGIS**
- **Redis 7** (cache, nonces, jobs)
- **structlog** (logs estructurados JSON)
- **Sentry** (error tracking)
- **pytest** + **ruff** + **mypy**

---

## 🚀 Cómo correr en local

Tienes **dos caminos**: con Docker (recomendado) o sin Docker (solo si todavía no instalaste Docker).

### Camino A — Con Docker (recomendado)

**Requisitos:**
- Docker Desktop instalado y corriendo
- Git

```bash
# 1) Clonar el repo (si no lo tienes ya)
git clone <repo-url>
cd smart_control_security/backend

# 2) Crear archivo de variables de entorno
cp .env.example .env
# (opcional) editar .env con tus valores

# 3) Levantar todo el stack (backend + Postgres + Redis)
docker-compose up --build

# 4) Verificar que funciona
# Abrir en el navegador:
#   http://localhost:8000/api/system/health     -> {"status":"ok",...}
#   http://localhost:8000/api/docs              -> Swagger UI
```

Para detener: `Ctrl+C` o `docker-compose down`.
Para borrar también los volúmenes (datos de Postgres): `docker-compose down -v`.

### Camino B — Sin Docker (solo Python)

En esta etapa el endpoint `/health` **no necesita** Postgres ni Redis, así que puedes probar el backend con solo Python.

**Requisitos:**
- Python 3.11+ instalado (verifica con `python --version`)
- Git

```bash
cd smart_control_security/backend

# 1) Crear entorno virtual
python -m venv .venv

# 2) Activar el entorno (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Si PowerShell te bloquea por política de ejecución, abre PowerShell como admin y ejecuta:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Luego vuelve a activar el venv.

# En Git Bash o WSL:
#   source .venv/bin/activate

# 3) Instalar dependencias de desarrollo
pip install --upgrade pip
pip install -r requirements-dev.txt

# 4) Crear archivo .env
copy .env.example .env

# 5) Correr el backend
uvicorn app.main:app --reload

# 6) Abrir en el navegador:
#   http://localhost:8000/api/system/health
#   http://localhost:8000/api/docs
```

> ⚠️ **A partir del Sprint 1.2** necesitarás PostgreSQL+PostGIS y Redis corriendo. Para entonces te conviene instalar Docker Desktop o, alternativamente, instalar PostgreSQL local con la extensión PostGIS y Redis para Windows.

---

## 🧪 Correr los tests

```bash
# Desde backend/, con el venv activado:
pytest

# Con cobertura HTML:
pytest --cov-report=html
# Abre backend/htmlcov/index.html en el navegador

# Solo un test específico:
pytest tests/test_health.py::test_health_endpoint_returns_200 -v
```

---

## 🛠️ Comandos útiles de desarrollo

```bash
# Formatear código
ruff format .

# Linter (auto-fix donde se pueda)
ruff check . --fix

# Type checker
mypy app

# Todo junto (pre-push)
ruff check . && ruff format --check . && mypy app && pytest
```

### Comandos de base de datos (a partir de Sprint 1.2)

```bash
# Aplicar todas las migraciones pendientes
alembic upgrade head

# Generar migración nueva desde modelos
alembic revision --autogenerate -m "descripción del cambio"

# Bajar una migración
alembic downgrade -1

# Ver historial y versión actual
alembic history --verbose
alembic current

# Conectarse a Postgres local (con docker-compose corriendo)
docker exec -it scs-postgres psql -U scs_user -d scs_db
```

Ver la guía completa en [`database/README.md`](./database/README.md).

---

## 📁 Estructura del proyecto

```text
backend/
├── app/
│   ├── core/                # Config, logging, exceptions, middleware
│   ├── modules/             # Módulos verticales por dominio
│   │   └── system/          # health check, versión
│   ├── db/                  # SQLAlchemy + sesiones (Sprint 1.2)
│   ├── models/              # Modelos SQLAlchemy (Sprint 1.2)
│   ├── services/            # S3, Rekognition, SendGrid, ... (Sprints 1.5, 3.x, 4.x)
│   ├── workers/             # Background jobs con Arq (Fase 4)
│   ├── analytics/           # Pandas (Fase 4)
│   └── main.py              # Entry point FastAPI
├── database/                # Gestión de la BD — ver database/README.md
│   ├── migrations/          # Alembic (estructura del schema) — auto en CI/CD
│   ├── views/               # CREATE OR REPLACE VIEW (idempotente) — auto
│   ├── analytics/           # MATERIALIZED VIEW (drop+create) — auto
│   ├── seeds/               # INSERT ... ON CONFLICT (catálogos) — auto
│   ├── init/                # Extensiones Postgres — una vez por DB
│   ├── manual_ops/          # DML destructivo — manual con aprobación
│   └── explore/             # Sandbox del dev — solo local
├── tests/
│   ├── conftest.py          # Fixtures globales
│   └── test_health.py       # Tests del scaffold
├── alembic.ini              # Atajo en raíz (apunta a database/migrations/)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt         # Deps de producción
├── requirements-dev.txt     # Deps de desarrollo (incluye prod)
├── pyproject.toml           # Config de ruff, mypy, pytest
├── .env.example             # Plantilla de variables
└── README.md                # Este archivo
```

> 💡 **Nota:** la organización de `database/` sigue el patrón híbrido descrito en
> [`database/README.md`](./database/README.md) y [ADR-020](../docs/decisiones-tecnicas.md):
> separación clara entre cambios **auto-aplicables** (migrations, views, seeds) y
> **manuales con aprobación** (manual_ops).

---

## 🔐 Variables de entorno importantes

Ver [`.env.example`](./.env.example) para la lista completa. Las críticas:

| Variable | Para qué sirve | ¿Obligatoria? |
|---|---|---|
| `ENVIRONMENT` | `local` / `staging` / `production` | Sí |
| `DATABASE_URL` | Conexión a PostgreSQL | Desde Sprint 1.2 |
| `REDIS_URL` | Conexión a Redis | Desde Sprint 1.3 |
| `JWT_SECRET_KEY` | Firma de tokens JWT (regenerar en prod) | Desde Sprint 1.3 |
| `AWS_*` | Credenciales para S3 | Desde Sprint 1.5 |
| `SENDGRID_API_KEY` | Envío de emails | Desde Fase 4 |
| `SENTRY_DSN` | Error tracking | Opcional, recomendado |

---

## 📦 Endpoints actuales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Info del API + links |
| GET | `/api/system/health` | Health check |
| GET | `/api/system/version` | Versión |
| GET | `/api/docs` | Swagger UI interactivo |
| GET | `/api/redoc` | ReDoc (docs alternativos) |

---

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'app'"
Asegúrate de correr `uvicorn` desde la carpeta `backend/` (donde está la carpeta `app/`), no desde dentro de `app/`.

### "ImportError: cannot import name X from pydantic"
Estás usando Pydantic v1. Este proyecto requiere Pydantic v2: `pip install --upgrade pydantic pydantic-settings`.

### "Permission denied" al activar venv en PowerShell
Ejecuta una vez como admin: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

### docker-compose falla con "port already in use"
Algo está usando el puerto 5432 (Postgres), 6379 (Redis) u 8000 (backend). Detén el proceso o cambia los puertos en `docker-compose.yml`.

### "connection refused" al conectar a Postgres
Asegúrate de que el contenedor de Postgres esté listo: `docker-compose ps` debe mostrar `(healthy)` antes de que el backend inicie.

---

## 🤝 Contribuir

1. Crear branch desde `main`: `git checkout -b feat/mi-feature`
2. Hacer cambios + tests
3. `ruff check . && ruff format . && mypy app && pytest` antes del push
4. Abrir PR
