# ⚙️ Funcionalidades del Backend — Smart Control Security

> Detalle exhaustivo de los endpoints, servicios e integraciones del backend FastAPI. Fuente de verdad para Fases 1, 3 y 4.

---

## Índice

1. [Módulos del backend](#1-módulos-del-backend)
2. [Endpoints REST (catálogo completo)](#2-endpoints-rest-catálogo-completo)
3. [Servicios internos](#3-servicios-internos)
4. [Integraciones externas](#4-integraciones-externas)
5. [Background jobs (Arq)](#5-background-jobs-arq)
6. [Capa de analítica](#6-capa-de-analítica)
7. [Validaciones críticas](#7-validaciones-críticas)
8. [Manejo de errores](#8-manejo-de-errores)
9. [Observabilidad](#9-observabilidad)

---

## 1. Módulos del backend

El backend está organizado en **módulos verticales** (por dominio de negocio), no horizontales:

```text
backend/app/
├── main.py                  # Entry point FastAPI
├── core/
│   ├── config.py            # Settings (Pydantic Settings)
│   ├── security.py          # JWT, password hashing, HMAC verify
│   ├── logging.py           # structlog config
│   └── exceptions.py        # Exception handlers globales
│
├── db/
│   ├── base.py              # SQLAlchemy Base + session
│   ├── session.py           # async_session, get_db
│   └── postgis.py           # helpers PostGIS
│
├── modules/
│   ├── auth/
│   │   ├── router.py        # /api/auth/*
│   │   ├── service.py
│   │   ├── schemas.py       # Pydantic DTOs
│   │   └── dependencies.py  # get_current_user, etc.
│   │
│   ├── users/
│   │   └── ...
│   │
│   ├── guardias/
│   │   └── ...
│   │
│   ├── puestos/
│   │   └── ...
│   │
│   ├── turnos/
│   │   └── ...
│   │
│   ├── marcas/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   ├── validators.py    # validaciones específicas
│   │   └── models.py
│   │
│   ├── alertas/
│   │   └── ...
│   │
│   ├── reportes/
│   │   └── ...
│   │
│   └── devices/
│       └── ...
│
├── services/                # Servicios cross-cutting
│   ├── s3_service.py
│   ├── rekognition_service.py
│   ├── sendgrid_service.py
│   ├── fcm_service.py
│   ├── play_integrity_service.py
│   └── geofence_service.py
│
├── models/                  # SQLAlchemy models (todos centralizados)
│   ├── __init__.py
│   ├── user.py
│   ├── guardia.py
│   ├── empresa.py
│   ├── puesto.py
│   ├── turno.py
│   ├── marca.py
│   ├── alerta.py
│   └── device.py
│
├── workers/                 # Arq background jobs
│   ├── main.py              # Worker entry
│   ├── tasks/
│   │   ├── send_alert_email.py
│   │   ├── send_push.py
│   │   ├── process_fraud_check.py
│   │   ├── generate_report.py
│   │   └── cleanup_expired_data.py
│   └── settings.py
│
├── analytics/
│   ├── horas_trabajadas.py  # cálculo de horas
│   ├── fraud_gps.py         # análisis GPS
│   ├── reportes.py          # generación Excel
│   └── kpis.py              # métricas para dashboard
│
└── alembic/
    └── versions/            # Migraciones
```

---

## 2. Endpoints REST (catálogo completo)

> Todos los endpoints retornan JSON. Auth via JWT Bearer salvo los marcados como públicos.
> Todos los endpoints (excepto login) requieren además HMAC signing válido y headers de seguridad.

### 2.1 Autenticación (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | Login con DNI + password. Retorna access_token, refresh_token, device_secret |
| POST | `/api/auth/refresh` | refresh_token | Renueva access_token |
| POST | `/api/auth/logout` | JWT | Invalida refresh_token actual |
| POST | `/api/auth/change-password` | JWT | Cambio de contraseña |
| POST | `/api/auth/forgot-password` | público | Solicita reset (envía email — Fase 4) |
| POST | `/api/auth/reset-password` | token email | Restablece password con token |

### 2.2 Guardias (`/api/guardias`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/guardias/me` | JWT (guardia) | Perfil del guardia logueado |
| GET | `/api/guardias/me/dashboard` | JWT (guardia) | Datos para Home: puesto, turno, próximo evento |
| PATCH | `/api/guardias/me` | JWT (guardia) | Actualiza datos editables (foto perfil) |
| GET | `/api/guardias` | JWT (admin/sup) | Lista de guardias con filtros |
| POST | `/api/guardias` | JWT (admin) | Crear guardia |
| GET | `/api/guardias/{id}` | JWT (admin/sup) | Detalle |
| PATCH | `/api/guardias/{id}` | JWT (admin) | Actualizar |
| DELETE | `/api/guardias/{id}` | JWT (admin) | Desactivar (soft delete) |
| POST | `/api/guardias/{id}/foto-referencia` | JWT (admin) | Sube foto de referencia para Face Matching |

### 2.3 Marcas (`/api/marcas`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/marcas` | JWT (guardia) + HMAC | **Registra una marca de asistencia (endpoint crítico)** |
| GET | `/api/marcas/mias` | JWT (guardia) | Historial propio (paginado) |
| GET | `/api/marcas/mias/{id}` | JWT (guardia) | Detalle de una marca propia |
| GET | `/api/marcas` | JWT (admin/sup) | Listado con filtros (guardia, fecha, puesto, alertas) |
| GET | `/api/marcas/{id}` | JWT (admin/sup) | Detalle completo |
| POST | `/api/marcas/{id}/validar` | JWT (sup) | Aprueba/rechaza una marca dudosa |
| GET | `/api/marcas/{id}/foto` | JWT | URL pre-firmada de S3 para ver la foto |

### 2.4 Puestos (`/api/puestos`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/puestos` | JWT (admin/sup) | Lista de puestos |
| POST | `/api/puestos` | JWT (admin) | Crear puesto con geofence (polígono) |
| GET | `/api/puestos/{id}` | JWT | Detalle |
| PATCH | `/api/puestos/{id}` | JWT (admin) | Actualizar |
| DELETE | `/api/puestos/{id}` | JWT (admin) | Eliminar |

### 2.5 Turnos (`/api/turnos`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/turnos` | JWT (admin/sup) | Lista de turnos |
| POST | `/api/turnos` | JWT (admin) | Crear turno (recurrente o puntual) |
| GET | `/api/turnos/{id}` | JWT | Detalle |
| PATCH | `/api/turnos/{id}` | JWT (admin) | Actualizar |
| DELETE | `/api/turnos/{id}` | JWT (admin) | Eliminar |
| POST | `/api/turnos/asignar` | JWT (admin/sup) | Asignar guardia a puesto/turno |

### 2.6 Devices (`/api/devices`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/devices/mio` | JWT (guardia) | Info del device vinculado |
| POST | `/api/devices/fcm-token` | JWT (guardia) | Actualiza token FCM |
| GET | `/api/devices` | JWT (admin) | Lista todos los devices |
| POST | `/api/devices/{id}/bloquear` | JWT (admin) | Bloquea un device |
| POST | `/api/devices/{id}/liberar` | JWT (admin) | Libera un device (para reasignar a otro guardia) |

### 2.7 Alertas (`/api/alertas`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/alertas` | JWT (admin/sup) | Lista de alertas con filtros |
| GET | `/api/alertas/{id}` | JWT (admin/sup) | Detalle |
| POST | `/api/alertas/{id}/atender` | JWT (sup) | Marcar como atendida (con nota) |

### 2.8 Reportes (`/api/reportes`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/reportes/horas-trabajadas` | JWT (admin/sup) | Genera reporte de horas (encola job, retorna job_id) |
| POST | `/api/reportes/asistencia` | JWT (admin/sup) | Reporte de asistencia |
| POST | `/api/reportes/fraude` | JWT (admin) | Reporte de marcas con alertas |
| GET | `/api/reportes/{job_id}` | JWT | Estado del job (pending/done/failed) |
| GET | `/api/reportes/{job_id}/download` | JWT | Descarga el Excel cuando esté listo |

### 2.9 Empresas (`/api/empresas`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/empresas/mia` | JWT (admin) | Datos de la empresa propia |
| PATCH | `/api/empresas/mia` | JWT (admin) | Actualizar datos |

### 2.10 Sistema (`/api/system`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/system/health` | público | Health check (DB, Redis, S3) |
| GET | `/api/system/version` | público | Versión del API |
| GET | `/api/system/version-mobile` | JWT | Versión mínima requerida de la app móvil |
| POST | `/api/system/telemetria` | JWT | Recibe eventos de telemetría del cliente |

### 2.11 Convenciones

- **Paginación:** `?page=1&size=20` con respuesta `{items: [...], total, page, size}`
- **Filtros:** query params estándar `?desde=2026-01-01&hasta=2026-12-31&estado=ok`
- **Ordenamiento:** `?sort=fecha&order=desc`
- **Idempotencia (POST de marcas):** header `Idempotency-Key` opcional adicional al nonce
- **Códigos de error:** estándar HTTP + body con `{error_code, message, details}`

---

## 3. Servicios internos

### 3.1 AuthService

Responsable de:
- Validar credenciales (DNI + password con bcrypt)
- Generar JWT (access + refresh)
- Validar HMAC signature de cada request crítica
- Validar nonces (Redis con TTL 5 min)
- Generar `device_secret` aleatorio en primer login

**Métodos clave:**
```python
async def login(dni: str, password: str, device_fp: str, fcm: str) -> LoginResult
async def refresh(refresh_token: str) -> AuthTokens
async def verify_hmac(request: Request, device_secret: str) -> bool
async def verify_nonce(nonce: str) -> bool  # rechaza si ya existe
```

### 3.2 MarcaService

El servicio más crítico del sistema. Orquesta:

1. Validación de payload (Pydantic)
2. Verificación HMAC + nonce
3. Verificación Play Integrity (delega a `PlayIntegrityService`)
4. Subida de fotos a S3 (delega a `S3Service`)
5. Validación de Liveness (delega a `RekognitionService`)
6. Face Matching contra foto de referencia (delega a `RekognitionService`)
7. Validación de geofencing (delega a `GeofenceService`)
8. Cálculo de distancia/velocidad vs marca anterior (PostGIS)
9. Persistencia en DB
10. Encolado de alertas si aplica (Arq job)
11. Respuesta al cliente

**Pseudocódigo:**

```python
async def registrar_marca(payload: MarcaCreate, guardia: Guardia, request: Request) -> MarcaResponse:
    # 1. Verificación de seguridad
    await auth_service.verify_hmac(request, guardia.device_secret)
    await auth_service.verify_nonce(payload.nonce)
    await play_integrity_service.verify(payload.play_integrity_token)

    # 2. Subir fotos a S3
    foto_urls = await s3_service.upload_marca_photos(payload.fotos, guardia.id)

    # 3. Liveness + Face Matching
    liveness_result = await rekognition_service.check_liveness(foto_urls)
    if not liveness_result.is_live:
        raise LivenessFailedException()

    match_result = await rekognition_service.match_face(foto_urls[0], guardia.foto_referencia_url)

    # 4. Validaciones geográficas
    puesto = await puestos_service.get_by_id(guardia.puesto_actual_id)
    en_geofence = geofence_service.is_inside(payload.latitud, payload.longitud, puesto.geofence)

    marca_anterior = await marca_service.get_ultima(guardia.id)
    if marca_anterior:
        distancia, velocidad = postgis.calc_distance_velocity(
            (payload.latitud, payload.longitud),
            (marca_anterior.latitud, marca_anterior.longitud),
            payload.timestamp_device - marca_anterior.timestamp_server
        )
        alerta_velocidad = velocidad > UMBRAL_VELOCIDAD_MAX  # ej. 150 km/h

    # 5. Persistir marca
    marca = await marca_repo.create(
        guardia_id=guardia.id,
        timestamp_server=datetime.utcnow(),
        timestamp_device=payload.timestamp_device,
        tipo_evento=payload.tipo_evento,
        latitud=payload.latitud,
        longitud=payload.longitud,
        precision_gps=payload.precision_gps_m,
        puesto_id=puesto.id,
        foto_urls=foto_urls,
        liveness_score=liveness_result.confidence,
        face_match_score=match_result.similarity,
        en_geofence=en_geofence,
        velocidad_implicita_kmh=velocidad if marca_anterior else None,
        alerta_fraude_gps=alerta_velocidad if marca_anterior else False,
    )

    # 6. Encolar alertas si aplica
    if not en_geofence or alerta_velocidad or match_result.similarity < UMBRAL_MATCH:
        await arq_pool.enqueue_job("process_fraud_alert", marca.id)

    return MarcaResponse(id=marca.id, validacion="ok", alertas=marca.alertas)
```

### 3.3 GuardiaService, PuestoService, TurnoService, etc.

CRUD estándar con lógica de negocio específica:
- Validaciones de unicidad
- Verificación de permisos según rol
- Cascadas y soft deletes

### 3.4 ReporteService

- Encola jobs en Arq (no procesa síncrono)
- Retorna `job_id` al cliente
- Cliente hace polling de estado vía `GET /api/reportes/{job_id}`

---

## 4. Integraciones externas

### 4.1 Amazon S3 (`S3Service`)

**Operaciones:**
- Subir fotos de marca (3 frames por marca)
- Subir foto de referencia del guardia
- Generar URLs pre-firmadas para descarga (validez 5-15 min)
- Aplicar lifecycle (Glacier a 90 días, delete a 1 año)

**Configuración:**
- Bucket único: `smart-control-security-{env}`
- Encriptación SSE-KMS
- Acceso solo vía credenciales IAM (no public)

### 4.2 AWS Rekognition (`RekognitionService`)

**Face Liveness:**
- API: `CreateFaceLivenessSession` + `GetFaceLivenessSessionResults`
- Input: 3+ frames del challenge
- Output: `{is_live: bool, confidence: float}`
- Threshold mínimo: 80 (configurable)

**Face Matching:**
- API: `CompareFaces`
- Input: foto de marca + foto de referencia del guardia
- Output: `{similarity: float, match: bool}`
- Threshold mínimo: 90 (configurable)

**Costos estimados:**
- Liveness: ~$0.005 por sesión
- Face Compare: ~$0.001 por comparación
- → ~$0.006 por marca → ~$60 por guardia/mes (con 10 marcas/día)

### 4.3 SendGrid (`SendGridService`)

**Templates a crear:**
- `alerta_fraude` — notifica al supervisor de marca sospechosa
- `marca_rechazada` — notifica al guardia de marca rechazada
- `password_reset` — link para resetear password
- `bienvenida` — al crear cuenta de guardia
- `reporte_semanal` — resumen semanal para admins

### 4.4 Firebase Cloud Messaging (`FCMService`)

- Usa `firebase-admin` SDK
- Envía push notifications a tokens FCM
- Soporta data messages (no solo notification) para que el cliente personalice
- Manejo de tokens inválidos (cleanup automático)

### 4.5 Google Play Integrity API (`PlayIntegrityService`)

- Recibe el token del cliente
- Llama a Google API para verificar
- Retorna `{device_integrity, app_integrity, account_details}`
- Si alguno falla → marca como sospechosa pero NO bloquea (configurable)

---

## 5. Background jobs (Arq)

### 5.1 Jobs definidos

| Job | Disparado por | Función |
|---|---|---|
| `process_fraud_alert` | Marca con flag | Genera alerta + envía email + push |
| `send_alert_email` | `process_fraud_alert` | Llama a SendGrid |
| `send_push_notification` | Múltiples | Envía push vía FCM |
| `generate_report_horas` | Endpoint reportes | Procesa con Pandas, sube Excel a S3 |
| `generate_report_asistencia` | Endpoint reportes | Idem |
| `generate_report_fraude` | Endpoint reportes | Idem |
| `cleanup_expired_data` | Cron diario | Borra fotos expiradas, marcas viejas, sesiones |
| `recalc_fraud_flags` | Manual / cron | Reevalúa flags de fraude tras cambio de umbrales |
| `reminder_marca` | Cron por minuto | Envía recordatorios de turnos próximos |
| `verify_no_marca` | Cron cada 15min | Detecta guardias que no marcaron entrada esperada |

### 5.2 Configuración Arq

- Worker corre como proceso separado (`arq workers.main.WorkerSettings`)
- 4 workers concurrentes por defecto
- Reintentos con backoff exponencial
- Dead letter queue para jobs que fallan >5 veces

---

## 6. Capa de analítica

### 6.1 Cálculos en tiempo real (en cada marca, vía PostGIS)

- **Distancia geodésica** a marca anterior: `ST_Distance(geography_a, geography_b)`
- **Dentro del geofence?**: `ST_Contains(puesto.geofence, ST_MakePoint(lon, lat))`
- **Velocidad implícita**: `distancia / tiempo_segundos * 3.6` km/h
- **Flag fraude GPS**: `velocidad > umbral` (default 150 km/h)

### 6.2 Procesamiento batch (Pandas, vía Arq)

Para reportes mensuales / semanales:

- **Horas trabajadas**: sumatoria de pares (entrada, salida) descontando refrigerios
- **Días faltantes**: comparar turnos asignados vs marcas reales
- **Tardanzas**: comparar hora de entrada vs hora pactada
- **Análisis de patrones de fraude**: clustering de marcas sospechosas por guardia/puesto
- **Exportación Excel**: con `openpyxl`, formato corporativo

### 6.3 KPIs disponibles (para dashboard futuro)

- Tasa de marcas con alerta de fraude por empresa/mes
- Promedio de horas trabajadas por guardia
- Tasa de cumplimiento de turnos
- Puestos con mayor índice de fraude
- Devices más bloqueados

---

## 7. Validaciones críticas

### 7.1 En `POST /api/marcas`

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. JWT válido y guardia activo                                  │
│ 2. HMAC signature válida con device_secret correcto            │
│ 3. X-Timestamp dentro de ±5 minutos del server time            │
│ 4. X-Nonce no visto en últimos 5 min (Redis)                   │
│ 5. Play Integrity token verificado contra Google               │
│ 6. Schema Pydantic correcto (lat/lon rangos válidos, etc.)     │
│ 7. Guardia tiene puesto asignado                                │
│ 8. Tipo de evento coincide con el esperado del turno actual    │
│ 9. Foto pasa Liveness Detection (Rekognition)                  │
│ 10. Foto matchea con foto de referencia (similarity ≥ 90)      │
│ 11. (warning) Coordenadas dentro del geofence del puesto       │
│ 12. (warning) Velocidad vs marca anterior < umbral             │
└─────────────────────────────────────────────────────────────────┘
```

Las validaciones 1-10 son **bloqueantes** (rechazan la marca).
Las 11-12 son **flags de advertencia** (la marca se acepta pero se alerta al supervisor).

### 7.2 Reglas de negocio adicionales

- Una marca de "salida" requiere una "entrada" previa abierta del mismo turno
- Un guardia no puede tener dos marcas de "entrada" sin "salida" entre ellas
- Refrigerio solo válido si hay entrada activa del turno
- Tiempo mínimo entre marcas del mismo tipo: 5 minutos (anti-doble-tap)

---

## 8. Manejo de errores

### 8.1 Códigos de error custom

```python
class ErrorCode(str, Enum):
    INVALID_CREDENTIALS = "invalid_credentials"
    DEVICE_MISMATCH = "device_mismatch"
    DEVICE_BLOCKED = "device_blocked"
    USER_DISABLED = "user_disabled"
    HMAC_INVALID = "hmac_invalid"
    NONCE_REUSED = "nonce_reused"
    TIMESTAMP_SKEW = "timestamp_skew"
    PLAY_INTEGRITY_FAILED = "play_integrity_failed"
    LIVENESS_FAILED = "liveness_failed"
    FACE_MISMATCH = "face_mismatch"
    OUT_OF_GEOFENCE = "out_of_geofence"
    DUPLICATE_MARCA = "duplicate_marca"
    INVALID_TURNO = "invalid_turno"
    # ...
```

### 8.2 Formato uniforme de respuesta de error

```json
{
  "error_code": "liveness_failed",
  "message": "No se detectó persona viva en la foto",
  "details": {
    "liveness_score": 42.1,
    "threshold": 80
  },
  "request_id": "abc-123"
}
```

### 8.3 Exception handlers globales

- `RequestValidationError` → 422 con detalle de campo
- `IntegrityError` (Postgres) → 409 con mensaje genérico
- `Exception` no manejada → 500 + log a Sentry con stacktrace

---

## 9. Observabilidad

### 9.1 Logging (`structlog`)

- Todos los logs en JSON estructurado
- Cada request tiene `request_id` (UUID) propagado en headers
- Logs de marca incluyen: `marca_id`, `guardia_id`, `puesto_id`, `liveness_score`, `match_score`, `latencia_ms`

### 9.2 Métricas (futuro: Prometheus)

- Latencia por endpoint (p50, p95, p99)
- Tasa de marcas/min
- Tasa de fraude detectado/hora
- Errores 5xx por endpoint
- Uso de Rekognition (rate limits)

### 9.3 Errores (Sentry)

- Todas las excepciones no manejadas
- Breadcrumbs con últimos eventos
- Integración con FastAPI middleware

### 9.4 Auditoría

Tabla `audit_log` con cada acción crítica:
- Login/logout
- Cambio de password
- Creación/edición/eliminación de guardias, puestos, turnos
- Validación manual de marcas dudosas
- Bloqueo/liberación de devices

---

## 10. Criterios de aceptación (Fases 1, 3 y 4)

### Fase 1 (Backend base)
- [ ] FastAPI corriendo con OpenAPI auto-generada en `/docs`
- [ ] PostgreSQL + PostGIS conectado, migraciones Alembic funcionales
- [ ] Modelos SQLAlchemy de todas las entidades
- [ ] Endpoints de auth completos (login, refresh, logout, change-password)
- [ ] Endpoint `POST /api/marcas` funcional (con stubs de Rekognition)
- [ ] Subida real a S3 funcionando
- [ ] HMAC signing validado
- [ ] Tests con ≥ 70% cobertura
- [ ] Docker + docker-compose con Postgres+PostGIS+Redis para dev
- [ ] CI con GitHub Actions

### Fase 3 (Seguridad biométrica)
- [ ] Integración real con AWS Rekognition Face Liveness
- [ ] Integración real con Face Compare
- [ ] Integración con Play Integrity API
- [ ] Umbrales configurables vía settings
- [ ] Tests con casos reales (foto fija = rechazada, persona real = aceptada)

### Fase 4 (Analítica y alertas)
- [ ] Cálculo de horas trabajadas con Pandas
- [ ] Detección de fraude GPS en cada marca vía PostGIS
- [ ] Workers Arq corriendo
- [ ] Templates SendGrid configurados y envío real funcionando
- [ ] Push notifications via FCM funcionando
- [ ] Generación de reportes Excel descargables

---

## 11. Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md)
- 🏛️ [`arquitectura.md`](./arquitectura.md)
- 📱 [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md)
- 🗃️ [`modelo-datos.md`](./modelo-datos.md)
- 🛡️ [`seguridad.md`](./seguridad.md)
- 🗓️ [`roadmap-fases.md`](./roadmap-fases.md)
