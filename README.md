# Smart Control Security

Sistema de control de asistencia empresarial para guardias de seguridad, **offline-first** y con estrictas medidas **anti-fraude** (suplantación de identidad, fotos de galería, GPS falso).

> **Estado actual:** 🏗️ Fase 1, Sprint 1.1 completado. Scaffolds de los 3 componentes (backend, mobile, admin-web) + 1 demo web para cliente listos en `main` para desarrollo paralelo.

---

## 🎯 ¿Qué es este proyecto?

Una solución integral compuesta por:

1. **App móvil Android** (Flutter) — Usada por los guardias en terreno para marcar asistencia con foto + GPS, funciona sin internet.
2. **Backend API** (Python + FastAPI) — Recibe marcas, almacena evidencia en S3, valida fraude.
3. **Panel administrativo web** (Next.js 15) — Para supervisores y administradores.
4. **Capa de Inteligencia Artificial** — AWS Rekognition para validación biométrica (Liveness Detection).
5. **Analítica** (Pandas + PostGIS) — Detección de patrones fraudulentos, cálculo de horas, reportes.
6. **Sistema de alertas** (SendGrid) — Notifica a supervisores ante eventos sospechosos.

---

## 📚 Documentación

Toda la documentación viva del proyecto está en [`docs/`](./docs/). Lee en este orden:

| # | Documento | ¿De qué trata? |
|---|---|---|
| 1 | [`docs/PLAN.md`](./docs/PLAN.md) | **Plan maestro:** visión, alcance, objetivos, riesgos. Empieza aquí. |
| 2 | [`docs/arquitectura.md`](./docs/arquitectura.md) | Arquitectura técnica, diagramas, flujos clave, stack tecnológico |
| 3 | [`docs/funcionalidades-app-movil.md`](./docs/funcionalidades-app-movil.md) | Detalle exhaustivo de la app Android |
| 4 | [`docs/funcionalidades-backend.md`](./docs/funcionalidades-backend.md) | Endpoints, servicios e integraciones del backend |
| 5 | [`docs/funcionalidades-admin-web.md`](./docs/funcionalidades-admin-web.md) | Pantallas, flujos y permisos del panel web |
| 6 | [`docs/modelo-datos.md`](./docs/modelo-datos.md) | Entidades, esquema SQL, relaciones, índices |
| 7 | [`docs/seguridad.md`](./docs/seguridad.md) | Modelo de amenazas, defensa en profundidad, cumplimiento legal |
| 8 | [`docs/roadmap-fases.md`](./docs/roadmap-fases.md) | Plan de fases con tareas detalladas y criterios de aceptación |
| 9 | [`docs/decisiones-tecnicas.md`](./docs/decisiones-tecnicas.md) | ADRs — registro de decisiones arquitectónicas tomadas |
| 10 | [`docs/demo-web-plan.md`](./docs/demo-web-plan.md) | Plan del **demo web** para presentar al cliente antes de la app nativa |

### Documentos originales de contexto (briefs iniciales)

- [`contexto.md`](./contexto.md) — Prompt maestro original con reglas de negocio
- [`diseño_inicial.md`](./diseño_inicial.md) — Diagrama inicial de la arquitectura conceptual

### Para contribuir

- 🤝 [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Convenciones de commits, flujo de PRs, estándares de calidad

---

## 🗂️ Estructura del repo

```text
smart_control_security/
├── backend/                  # Python + FastAPI ✅ Scaffold listo
│   ├── app/                  # Código de la aplicación (FastAPI)
│   ├── database/             # Migraciones + vistas + seeds + manual_ops
│   │   ├── migrations/       # Alembic (estructura del schema)
│   │   ├── views/            # CREATE OR REPLACE VIEW (idempotente)
│   │   ├── analytics/        # MATERIALIZED VIEW para reportes
│   │   ├── seeds/            # INSERTs idempotentes (catálogos)
│   │   ├── init/             # Extensiones de Postgres
│   │   ├── manual_ops/       # DML destructivo (manual con aprobación)
│   │   └── explore/          # Sandbox local del dev
│   ├── tests/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── requirements.txt
│   └── README.md             # Cómo correr el backend (con y sin Docker)
│
├── mobile/                   # Flutter Android ✅ Scaffold listo
│   ├── lib/
│   │   ├── core/
│   │   ├── features/
│   │   └── main.dart
│   ├── test/
│   ├── pubspec.yaml
│   └── README.md             # Cómo correr la app móvil
│
├── admin-web/                # Next.js 15 + TypeScript ✅ Scaffold listo
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   ├── tailwind.config.ts
│   └── README.md             # Cómo correr el panel web
│
├── demo-web/                 # 🎬 DEMO web mobile-first para cliente
│   ├── prisma/               # Schema Prisma + seed (3 usuarios, 2 puestos)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (guardia)/    # Vista mobile del guardia
│   │   │   ├── (supervisor)/ # Vista desktop del supervisor
│   │   │   └── api/          # API routes
│   │   ├── components/
│   │   └── lib/              # auth, prisma, s3, geofence
│   ├── package.json
│   └── README.md             # Setup completo (Neon + S3 + Vercel)
│
├── docs/                     # Documentación viva (ver índice arriba)
├── .github/
│   ├── workflows/            # CI para los 4 componentes + 2 de BD
│   │   ├── backend-ci.yml
│   │   ├── mobile-ci.yml
│   │   ├── admin-web-ci.yml
│   │   ├── demo-web-ci.yml
│   │   ├── database-auto-migrate.yml      # 🤖 Aplica migraciones + vistas + seeds
│   │   └── database-manual-ops.yml        # 👤 Ejecuta scripts destructivos con aprobación
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── contexto.md               # Brief original
├── diseño_inicial.md         # Brief original
├── CONTRIBUTING.md
├── .gitignore
└── README.md                 # Este archivo
```

---

## 🚀 Cómo empezar (por componente)

Cada componente tiene su propio README detallado con instalación y troubleshooting.

### Backend (Python + FastAPI)

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload
# Abrir: http://localhost:8000/api/docs
```

→ Detalle completo en [`backend/README.md`](./backend/README.md).

### Mobile (Flutter)

```bash
cd mobile
flutter create . --org com.balcuapps.smartcontrolsecurity --platforms=android  # solo primera vez
flutter pub get
flutter run    # con device Android conectado por USB
```

→ Detalle completo en [`mobile/README.md`](./mobile/README.md).

### Admin Web (Next.js)

```bash
cd admin-web
npm install
copy .env.example .env.local
npm run dev
# Abrir: http://localhost:3000
```

→ Detalle completo en [`admin-web/README.md`](./admin-web/README.md).

### 🎬 Demo Web (Next.js + Vercel + Neon Postgres) — para presentar al cliente

```bash
cd demo-web
npm install
copy .env.example .env
# Editar .env con credenciales de Neon + AWS S3
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
# Abrir: http://localhost:3000
```

> Pensado para mostrar al cliente el flujo de la app móvil mientras se construye la app nativa real.
> Usuarios precargados: `guardia1@demo.com`, `guardia2@demo.com`, `supervisor@demo.com` (password: `demo1234`).

→ Detalle completo en [`demo-web/README.md`](./demo-web/README.md) y [plan completo](./docs/demo-web-plan.md).

---

## 🧩 Stack tecnológico (resumen)

| Capa | Tecnología |
|---|---|
| App móvil | Flutter 3.24+ (Dart) — Android first, iOS futuro |
| Backend API | Python 3.11+ con FastAPI + Pydantic 2 |
| Base de datos | PostgreSQL 16 + extensión PostGIS |
| ORM / Migraciones | SQLAlchemy 2.x async + Alembic |
| Almacenamiento de archivos | Amazon S3 (SSE-KMS) |
| Cola / Cache | Redis + Arq (background jobs) |
| Liveness facial | AWS Rekognition Face Liveness |
| Notificaciones push | Firebase Cloud Messaging |
| Email transaccional | SendGrid (evaluar AWS SES) |
| Observabilidad | structlog + Sentry |
| CI/CD | GitHub Actions |
| Panel admin | Next.js 15 + React 19 + TypeScript + Tailwind |

Ver justificaciones técnicas detalladas en [`docs/decisiones-tecnicas.md`](./docs/decisiones-tecnicas.md).

---

## 🛡️ Seguridad y cumplimiento

Este sistema procesa **datos biométricos** (fotos faciales) y **datos de ubicación**, por lo que aplica:

- 🇨🇴 Ley 1581 de Habeas Data (Colombia)
- 🇧🇷 LGPD (Brasil)
- 🇪🇺 GDPR (Unión Europea)

Ver detalles completos en [`docs/seguridad.md`](./docs/seguridad.md).

---

## 📊 Estado de avance

| Fase | Estado | Detalle |
|---|---|---|
| Fase 0 — Setup inicial | ✅ Completada | Docs + estructura del monorepo + .gitignore + CONTRIBUTING |
| **Fase 1, Sprint 1.1** | ✅ Completada | Scaffold backend (FastAPI + logging + CI) |
| **Demo Web** | 🚀 En progreso | Scaffold listo, sprints Demo 0-5 (1-2 sem) — ver [`docs/demo-web-plan.md`](./docs/demo-web-plan.md) |
| Fase 1, Sprint 1.2 | ⏳ Siguiente | Persistencia (SQLAlchemy + Alembic + modelos) |
| Fase 1, Sprint 1.3–1.6 | ⏳ Pendiente | Auth, CRUDs, S3, Rekognition stubs |
| Fase 2 — App móvil completa | ⏳ Scaffold listo | Solo falta `flutter create .` y empezar a implementar features |
| Fase 3 — IA biométrica | ⏳ Pendiente | |
| Fase 4 — Analítica + alertas | ⏳ Pendiente | |
| Fase 5 — Panel admin completo | ⏳ Scaffold listo | Solo falta `npm install` y empezar a implementar features |

---

## 📝 Licencia

_(Pendiente de definir — privada por defecto hasta nuevo aviso.)_

---

**Autor / Mantenedor:** Balcuapps
**Última actualización del plan:** Junio 2026
