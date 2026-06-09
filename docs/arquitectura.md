# 🏛️ Arquitectura Técnica — Smart Control Security

> Documento técnico detallado de la arquitectura del sistema. Asume familiaridad con el [`PLAN.md`](./PLAN.md).

---

## 1. Vista general

Smart Control Security es una **arquitectura cliente-servidor distribuida** con énfasis en:

- **Defensa en profundidad** (múltiples capas de seguridad)
- **Tolerancia a fallos de red** (offline-first en el cliente)
- **Validación server-side autoritativa** (nunca confiar en el cliente)
- **Separación de responsabilidades** (API, procesamiento IA, analítica, storage independientes)

---

## 2. Diagrama de arquitectura completo

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     🏢 DISPOSITIVOS DE USUARIOS                       │
│                                                                      │
│  ┌──────────────────┐                       ┌──────────────────┐    │
│  │ 📱 App Guardia   │                       │ 🖥 Panel Admin   │    │
│  │ Flutter Android  │                       │ Next.js (Fase 5) │    │
│  │ - Cámara nativa  │                       │ - Reportes       │    │
│  │ - GPS + offline  │                       │ - Gestión users  │    │
│  │ - SQLite local   │                       │ - Alertas        │    │
│  └────────┬─────────┘                       └────────┬─────────┘    │
└───────────┼──────────────────────────────────────────┼──────────────┘
            │ HTTPS + Cert Pinning                     │ HTTPS
            │ HMAC Signing + JWT                       │ JWT
            ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        ☁️ INFRAESTRUCTURA CLOUD                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🚪 NGINX / API Gateway                                        │   │
│  │   - SSL termination                                          │   │
│  │   - Rate limiting (Redis-backed)                             │   │
│  │   - Request logging                                          │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ⚙️  BACKEND FastAPI (Python 3.11+)                           │   │
│  │                                                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │   Auth   │ │ Marcas   │ │ Usuarios │ │ Puestos  │  ...   │   │
│  │  │  Module  │ │  Module  │ │  Module  │ │  Module  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ Services Layer                                       │    │   │
│  │  │ - S3Service · RekognitionService · SendGridService  │    │   │
│  │  │ - FCMService · PlayIntegrityService · GeofenceService│   │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────┬────────────┬─────────────┬───────────┬─────────┬──────┘   │
│        │            │             │           │         │           │
│        ▼            ▼             ▼           ▼         ▼           │
│   ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────┐ ┌─────────┐    │
│   │ 🗃️ RDS  │ │ 📦 S3    │ │ ⚡ Redis   │ │ 🧠   │ │ ⚙️ Arq  │    │
│   │ Postgres│ │  + KMS   │ │  + Cache   │ │Rekog.│ │ Workers │    │
│   │ +PostGIS│ │          │ │ + Sessions │ │Live- │ │ (jobs)  │    │
│   │         │ │          │ │ + Rate-lim │ │ness  │ │         │    │
│   └─────────┘ └──────────┘ └────────────┘ └──────┘ └────┬────┘    │
│                                                          │          │
│                                                          ▼          │
│                                              ┌─────────────────┐    │
│                                              │ Background jobs:│    │
│                                              │ - Pandas ETL    │    │
│                                              │ - Sync alerts   │    │
│                                              │ - Reportes      │    │
│                                              └─────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
            │                                          │
            ▼                                          ▼
┌──────────────────────────┐              ┌──────────────────────────┐
│ ✉️ SendGrid              │              │ 🔔 Firebase Cloud Msg    │
│   Alertas a supervisores │              │   Push al guardia        │
└──────────────────────────┘              └──────────────────────────┘
            │
            ▼
┌──────────────────────────┐
│ 📊 Observabilidad         │
│   - Sentry (errores)     │
│   - CloudWatch (logs)    │
│   - structlog            │
└──────────────────────────┘
```

---

## 3. Componentes principales

### 3.1 App móvil (Cliente)

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| UI | Flutter widgets | Pantallas, navegación, formularios |
| Estado | Riverpod (por confirmar) | Manejo reactivo del estado |
| Persistencia | sqflite (SQLite) | Cola offline de marcas + fotos |
| Almacenamiento seguro | flutter_secure_storage | JWT, refresh token, clave HMAC |
| HTTP | dio + dio_certificate_pinning | Comunicación con backend |
| Cámara | camera (oficial) | Captura nativa frontal |
| GPS | geolocator | Coordenadas + detección Mock Location |
| Liveness on-device | google_mlkit_face_detection | Challenge-response (pre-validación) |
| Background sync | workmanager | Sincronización con backoff exponencial |
| Push | firebase_messaging | Notificaciones push |
| Attestation | play_integrity_flutter | Token de integridad del device |
| Root detection | flutter_jailbreak_detection | Detecta devices rooteados |

### 3.2 Backend API

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Framework | FastAPI | Endpoints REST, async, OpenAPI auto |
| Validación | Pydantic v2 | DTOs entrada/salida fuertemente tipados |
| ORM | SQLAlchemy 2.x (async) | Acceso a PostgreSQL |
| Migraciones | Alembic | Versionado del schema |
| Auth | python-jose + passlib + bcrypt | JWT + hash de passwords |
| Storage | boto3 | Subida/lectura S3 |
| Background jobs | Arq (Redis-based) | Tareas asíncronas |
| Cache / Rate limiting | Redis (redis-py async) | Cache + sesiones + nonces |
| Logs | structlog | Logs estructurados JSON |
| Errores | sentry-sdk | Captura de excepciones |
| Tests | pytest + httpx + factory-boy | Unit + integration |
| Linter | ruff + mypy | Calidad de código |

### 3.3 Base de datos

| Componente | Detalle |
|---|---|
| Motor | PostgreSQL 16 (managed via AWS RDS) |
| Extensiones | PostGIS (geoespacial), pg_trgm (búsqueda fuzzy), uuid-ossp |
| Backups | Automáticos diarios en RDS + retención 7 días |
| Réplicas | Read replica para reportes/analítica (Fase 4) |
| Conexiones | Pool de conexiones via SQLAlchemy + PgBouncer si escala |

### 3.4 Almacenamiento de archivos (S3)

| Aspecto | Configuración |
|---|---|
| Encriptación | SSE-KMS con clave propia |
| Estructura de paths | `s3://smart-control-security/fotos/{año}/{mes}/{guardia_id}/{marca_id}.jpg` |
| Acceso | URLs pre-firmadas con expiración (5-15 min) — no acceso público |
| Lifecycle | Glacier a los 90 días, eliminación a 1 año (configurable) |
| Versioning | Activado para auditoría |

### 3.5 Servicios externos (SaaS)

| Servicio | Uso | Plan estimado |
|---|---|---|
| **AWS Rekognition** | Face Liveness + Face Matching | Pay-per-call (~$0.001 por check) |
| **SendGrid** | Emails de alerta a supervisores | Free tier inicial → Essentials después |
| **Firebase FCM** | Push notifications al guardia | Gratis (sin límite práctico para MVP) |
| **Sentry** | Error tracking | Free tier inicial |

---

## 4. Flujos clave (sequence diagrams en texto)

### 4.1 Flujo de marca de asistencia (online, exitosa)

```text
Guardia        App Flutter       Backend          PostgreSQL      S3      Rekognition
   │                │                 │                │            │           │
   │ tap "Marcar"   │                 │                │            │           │
   ├───────────────▶│                 │                │            │           │
   │                │ valida pre-condiciones           │            │           │
   │                │ (GPS ok, no mock, no root)       │            │           │
   │                │                 │                │            │           │
   │ open camera    │                 │                │            │           │
   │◀───────────────┤                 │                │            │           │
   │ challenge ML Kit│                │                │            │           │
   │ (parpadea/gira) │                │                │            │           │
   ├───────────────▶│                 │                │            │           │
   │                │ Play Integrity  │                │            │           │
   │                │ token + HMAC sign│               │            │           │
   │                ├────────────────▶│                │            │           │
   │                │ POST /api/marcas │               │            │           │
   │                │                 │ verifica:      │            │           │
   │                │                 │ - JWT          │            │           │
   │                │                 │ - HMAC sig     │            │           │
   │                │                 │ - Nonce único  │            │           │
   │                │                 │ - Play Integ   │            │           │
   │                │                 ├────────────────────────────▶│           │
   │                │                 │ sube foto S3                │           │
   │                │                 │◀────────────────────────────┤           │
   │                │                 │   URL          │            │           │
   │                │                 ├────────────────────────────────────────▶│
   │                │                 │ Face Liveness + Matching                │
   │                │                 │◀────────────────────────────────────────┤
   │                │                 │   confidence_score              │      │
   │                │                 ├───────────────▶│                        │
   │                │                 │ INSERT marca + foto_url + flags        │
   │                │                 │  validación PostGIS geofence + velocidad│
   │                │                 │◀───────────────┤                        │
   │                │                 │   ID marca     │                        │
   │                │ 201 Created     │                │                        │
   │                │◀────────────────┤                │                        │
   │ ✅ "Marca OK"   │                 │                │                        │
   │◀───────────────┤                 │                │                        │
```

### 4.2 Flujo de marca offline → sync diferido

```text
Guardia        App Flutter         SQLite local       Backend
   │                │                    │                │
   │ tap "Marcar"   │                    │                │
   ├───────────────▶│                    │                │
   │                │ valida pre-cond + foto + GPS         │
   │                │ intenta POST                         │
   │                ├──────────────X (sin red)             │
   │                │                    │                │
   │                │ INSERT en SQLite   │                │
   │                ├───────────────────▶│                │
   │                │ marca pending      │                │
   │ ⏳ "Pendiente"  │                    │                │
   │◀───────────────┤                    │                │
   │                │                    │                │
   │   ... más tarde, vuelve la red ...                    │
   │                │                    │                │
   │                │ workmanager dispara sync             │
   │                │◀───────────────────┤                │
   │                │ SELECT marcas pendientes             │
   │                │ por cada una:      │                │
   │                ├──────────────────────────────────▶  │
   │                │ POST /api/marcas con backoff exp.   │
   │                │◀──────────────────────────────────  │
   │                │ 201 Created       │                 │
   │                │ DELETE marca local│                 │
   │                ├───────────────────▶│                │
   │                │                    │                │
   │  🔔 push: "5 marcas sincronizadas" │                │
   │◀───────────────────────────────────────────────────  │
```

### 4.3 Flujo de detección de fraude GPS (server-side)

```text
Backend                 PostgreSQL+PostGIS              Background Worker        SendGrid
   │                          │                              │                     │
   │ INSERT marca             │                              │                     │
   ├─────────────────────────▶│                              │                     │
   │                          │ calcula:                     │                     │
   │                          │ - distancia a marca anterior │                     │
   │                          │ - velocidad implícita        │                     │
   │                          │ - dentro de geofence puesto? │                     │
   │                          │                              │                     │
   │                          │ si velocidad > 200 km/h:     │                     │
   │                          │ UPDATE flag alerta_fraude_gps│                     │
   │                          │                              │                     │
   │                          │ encola job alerta            │                     │
   │                          ├─────────────────────────────▶│                     │
   │                          │                              │ procesa job         │
   │                          │                              ├────────────────────▶│
   │                          │                              │ envía email al sup. │
```

---

## 5. Stack tecnológico completo

### 5.1 Cliente móvil

```yaml
flutter: ">=3.16.0"
dart: ">=3.2.0"

dependencies:
  # Estado
  flutter_riverpod: ^2.x

  # HTTP
  dio: ^5.x
  dio_certificate_pinning: ^6.x

  # Cámara y GPS
  camera: ^0.10.x
  geolocator: ^11.x

  # Liveness on-device
  google_mlkit_face_detection: ^0.10.x

  # Almacenamiento
  sqflite: ^2.x
  path_provider: ^2.x
  flutter_secure_storage: ^9.x

  # Background
  workmanager: ^0.5.x

  # Seguridad
  flutter_jailbreak_detection: ^1.x
  play_integrity_flutter: ^x.x

  # Firebase
  firebase_core: ^2.x
  firebase_messaging: ^14.x

  # Utils
  freezed_annotation: ^2.x
  json_annotation: ^4.x
  intl: ^0.18.x
```

### 5.2 Backend Python

```text
fastapi[standard] >= 0.110.0
uvicorn[standard] >= 0.29.0
pydantic >= 2.6.0
pydantic-settings >= 2.2.0

# DB
sqlalchemy[asyncio] >= 2.0.28
asyncpg >= 0.29.0
alembic >= 1.13.0
geoalchemy2 >= 0.14.0     # soporte PostGIS

# Auth
python-jose[cryptography] >= 3.3.0
passlib[bcrypt] >= 1.7.4
python-multipart >= 0.0.9

# AWS
boto3 >= 1.34.0

# Background jobs + cache
arq >= 0.25.0
redis >= 5.0.0

# Analytics
pandas >= 2.2.0
openpyxl >= 3.1.0           # export Excel

# Email
sendgrid >= 6.11.0

# Push notifications
firebase-admin >= 6.5.0

# Observabilidad
structlog >= 24.1.0
sentry-sdk[fastapi] >= 1.40.0

# Validación criptográfica
cryptography >= 42.0.0

# Dev
pytest >= 8.0.0
pytest-asyncio >= 0.23.0
pytest-cov >= 4.1.0
httpx >= 0.27.0
factory-boy >= 3.3.0
ruff >= 0.3.0
mypy >= 1.9.0
```

---

## 6. Decisiones arquitectónicas clave

Resumen — detalle completo en [`decisiones-tecnicas.md`](./decisiones-tecnicas.md).

| ADR | Decisión | Por qué |
|---|---|---|
| ADR-001 | Flutter en vez de Kotlin nativo | Cross-platform + opcionalidad iOS futura; seguridad real está en backend |
| ADR-002 | AWS Rekognition en vez de OpenCV | OpenCV puro es bypasseable; Rekognition es estado del arte |
| ADR-003 | PostGIS en vez de Pandas para validación GPS real-time | Pandas es batch; PostGIS valida fraude en el INSERT |
| ADR-004 | Monorepo (backend + mobile + admin) | Atómico para cambios cross-stack; menor fricción al inicio |
| ADR-005 | JWT + Refresh tokens | Estándar industria, sin estado en server (excepto blacklist en Redis) |
| ADR-006 | HMAC request signing | Anti-replay robusto independiente de JWT |
| ADR-007 | Async SQLAlchemy + asyncpg | FastAPI es async; aprovecha I/O concurrente |
| ADR-008 | Arq en vez de Celery | Más liviano, async-nativo, suficiente para volumen esperado |
| ADR-009 | structlog en vez de logging stdlib | Logs JSON estructurados, fácil parsing en CloudWatch/Datadog |
| ADR-010 | Server timestamp como verdad absoluta | Cliente puede manipular su reloj |

---

## 7. Despliegue (visión preliminar)

### 7.1 Entornos

| Entorno | Propósito | Datos |
|---|---|---|
| `local` | Desarrollo en máquina del dev | Docker Compose (Postgres+PostGIS+Redis) |
| `staging` | QA y demos con clientes | RDS pequeño + S3 bucket separado |
| `production` | Operación real | RDS Multi-AZ + S3 con backups |

### 7.2 Opciones de hosting (decisión pendiente)

| Opción | Pros | Contras |
|---|---|---|
| **AWS App Runner** | Simple, sin manejo de servidores, autoscaling | Costo medio, menos control |
| **AWS ECS Fargate** | Control total, sin servidores | Más complejidad de configuración |
| **Fly.io** | Muy simple, cercano al usuario, barato | Lock-in fuera de AWS, menos servicios complementarios |
| **AWS EC2 + Docker** | Máximo control, predecible | Hay que mantener servidores |

**Recomendación inicial:** Empezar con **AWS App Runner** en staging y reevaluar a producción según costos y tráfico.

### 7.3 CI/CD pipeline

```text
GitHub push → GitHub Actions
                ├── Lint (ruff + mypy)
                ├── Tests (pytest)
                ├── Build Docker image
                ├── Push to ECR
                └── Deploy to App Runner (auto-deploy en main, manual en prod)

Flutter:
GitHub push → GitHub Actions
                ├── Lint (dart analyze)
                ├── Tests (flutter test)
                ├── Build APK (signed, obfuscated)
                └── Upload artifact / Firebase App Distribution
```

---

## 8. Consideraciones de escalabilidad

- **Backend**: stateless → escala horizontal trivial detrás del API Gateway
- **DB**: vertical scaling en RDS hasta cierto punto; read replicas para reportes; particionar tabla `marcas` por fecha si supera 50M filas
- **S3**: prácticamente infinito, sin preocupación
- **Background jobs**: Arq escala con más workers (cada uno consume de Redis)
- **Cuello de botella anticipado**: Rekognition tiene rate limits → implementar cola con prioridad si llegamos a >100 req/seg

---

## 9. Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md) — Plan maestro
- 📱 [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md)
- ⚙️ [`funcionalidades-backend.md`](./funcionalidades-backend.md)
- 🗃️ [`modelo-datos.md`](./modelo-datos.md)
- 🛡️ [`seguridad.md`](./seguridad.md)
- 🧠 [`decisiones-tecnicas.md`](./decisiones-tecnicas.md)
