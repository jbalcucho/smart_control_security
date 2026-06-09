# 🗃️ Modelo de Datos — Smart Control Security

> Esquema completo de la base de datos PostgreSQL + PostGIS. Esta es la fuente de verdad para crear los modelos SQLAlchemy y las migraciones Alembic.

---

## 1. Visión general

El modelo se organiza alrededor de **5 dominios**:

1. **Identidad y acceso** — Usuarios, roles, devices, sesiones
2. **Organización** — Empresas, supervisores, guardias
3. **Operación** — Puestos, turnos, asignaciones
4. **Registro** — Marcas de asistencia, fotos
5. **Auditoría y alertas** — Audit log, alertas, telemetría

---

## 2. Diagrama de relaciones (ERD textual)

```text
┌───────────┐         ┌─────────────┐         ┌──────────────┐
│ Empresas  │ 1───*  │ Supervisores│ 1───*  │   Guardias   │
└───────────┘         └─────────────┘         └──────┬───────┘
      │                                              │
      │ 1                                            │ 1
      *                                              │
┌───────────┐                                        │
│  Puestos  │ ─────────────────────────┐             │
└───┬───────┘                          │             │
    │ 1                                │             │
    │                                  │             │
    *                                  │             │
┌───────────────┐                      │             │
│   Turnos      │                      │             │
└───┬───────────┘                      │             │
    │ 1                                │             │
    │                                  │             │
    *                                  *             *
┌────────────────────────────────────────────────────┐
│              Asignaciones (M:N)                    │
│  (guardia, puesto, turno, fecha_inicio, fecha_fin) │
└────────────────────────────────────────────────────┘
                                       │
                                       │
                                       ▼
┌────────────────────┐         ┌────────────────────┐
│      Marcas        │ *───1  │    Devices         │
│  (foto en S3 url)  │         │  (1 por guardia)   │
└─────────┬──────────┘         └────────────────────┘
          │
          │ 1
          *
┌──────────────────┐
│    Alertas       │
└──────────────────┘


┌──────────────────────────────────────┐
│  Tablas transversales:               │
│  - Users (auth)                      │
│  - Audit_log                         │
│  - Telemetria                        │
│  - Refresh_tokens                    │
└──────────────────────────────────────┘
```

---

## 3. Convenciones del schema

- Todas las tablas tienen `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Todas las tablas tienen `created_at`, `updated_at` (TIMESTAMPTZ)
- Soft delete con `deleted_at` (nullable TIMESTAMPTZ)
- Strings cortos: `VARCHAR(255)`. Strings largos: `TEXT`
- Coordenadas GPS: `GEOGRAPHY(POINT, 4326)` (PostGIS)
- Polígonos (geofences): `GEOGRAPHY(POLYGON, 4326)`
- Monedas/decimales: `NUMERIC(15, 2)`
- JSON: `JSONB` (no JSON)
- Naming: snake_case en SQL, PascalCase en modelos SQLAlchemy

---

## 4. Tablas

### 4.1 `users` — Cuenta de acceso al sistema

Representa **cualquier persona** que se autentica (guardia, supervisor, admin).

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `dni` | VARCHAR(20) | UNIQUE NOT NULL | Documento de identidad |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt |
| `email` | VARCHAR(255) | UNIQUE | Opcional para guardias |
| `nombres` | VARCHAR(120) | NOT NULL | |
| `apellidos` | VARCHAR(120) | NOT NULL | |
| `rol` | VARCHAR(20) | NOT NULL | enum: `guardia`, `supervisor`, `admin`, `superadmin` |
| `activo` | BOOLEAN | NOT NULL DEFAULT true | |
| `ultimo_login_at` | TIMESTAMPTZ | | |
| `password_changed_at` | TIMESTAMPTZ | | |
| `password_reset_token` | VARCHAR(255) | | |
| `password_reset_expires_at` | TIMESTAMPTZ | | |
| `empresa_id` | UUID | FK → empresas.id | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `deleted_at` | TIMESTAMPTZ | | |

**Índices:**
- `UNIQUE INDEX idx_users_dni ON users(dni) WHERE deleted_at IS NULL;`
- `INDEX idx_users_empresa ON users(empresa_id);`
- `INDEX idx_users_rol ON users(rol);`

---

### 4.2 `empresas` — Empresa cliente que usa el sistema

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `nombre` | VARCHAR(255) | NOT NULL | |
| `nit` | VARCHAR(50) | UNIQUE NOT NULL | |
| `direccion` | TEXT | | |
| `telefono` | VARCHAR(50) | | |
| `email_contacto` | VARCHAR(255) | | |
| `pais` | VARCHAR(3) | NOT NULL | ISO 3166-1 alpha-3 (ej. `COL`) |
| `zona_horaria` | VARCHAR(50) | NOT NULL DEFAULT `'America/Bogota'` | |
| `configuracion` | JSONB | DEFAULT `'{}'` | Settings por empresa (umbrales, etc.) |
| `activo` | BOOLEAN | NOT NULL DEFAULT true | |
| `created_at`, `updated_at`, `deleted_at` | | | estándar |

---

### 4.3 `guardias` — Datos específicos de guardia

Extiende a `users` con datos operativos.

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | UNIQUE FK → users.id, NOT NULL | |
| `codigo_empleado` | VARCHAR(50) | UNIQUE NOT NULL | Código interno |
| `empresa_id` | UUID | FK → empresas.id, NOT NULL | |
| `supervisor_id` | UUID | FK → supervisores.id | |
| `foto_referencia_url` | TEXT | | URL S3 de la foto base para Face Matching |
| `foto_referencia_uploaded_at` | TIMESTAMPTZ | | |
| `telefono` | VARCHAR(50) | | |
| `fecha_ingreso` | DATE | | |
| `fecha_terminacion` | DATE | | nullable |
| `cargo` | VARCHAR(120) | | ej. "Guardia nivel 2" |
| `created_at`, `updated_at`, `deleted_at` | | | |

**Índices:**
- `INDEX idx_guardias_empresa ON guardias(empresa_id);`
- `INDEX idx_guardias_supervisor ON guardias(supervisor_id);`

---

### 4.4 `supervisores` — Supervisor a cargo de N guardias

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | UNIQUE FK → users.id, NOT NULL | |
| `empresa_id` | UUID | FK → empresas.id, NOT NULL | |
| `email_alertas` | VARCHAR(255) | NOT NULL | Para recibir alertas de fraude |
| `telefono` | VARCHAR(50) | | |
| `created_at`, `updated_at`, `deleted_at` | | | |

---

### 4.5 `puestos` — Lugar físico donde un guardia presta servicio

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `empresa_id` | UUID | FK → empresas.id, NOT NULL | |
| `nombre` | VARCHAR(255) | NOT NULL | ej. "Centro Comercial Plaza Mayor - Entrada Sur" |
| `codigo` | VARCHAR(50) | UNIQUE | Código interno del puesto |
| `direccion` | TEXT | | |
| `ubicacion` | GEOGRAPHY(POINT, 4326) | NOT NULL | Punto central del puesto |
| `geofence` | GEOGRAPHY(POLYGON, 4326) | NOT NULL | Perímetro válido para marcar |
| `radio_geofence_m` | INTEGER | DEFAULT 50 | Radio fallback si no hay polígono |
| `notas` | TEXT | | |
| `activo` | BOOLEAN | NOT NULL DEFAULT true | |
| `created_at`, `updated_at`, `deleted_at` | | | |

**Índices PostGIS:**
- `CREATE INDEX idx_puestos_ubicacion ON puestos USING GIST(ubicacion);`
- `CREATE INDEX idx_puestos_geofence ON puestos USING GIST(geofence);`

---

### 4.6 `turnos` — Definición de turnos (templates)

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `empresa_id` | UUID | FK → empresas.id, NOT NULL | |
| `nombre` | VARCHAR(100) | NOT NULL | ej. "Diurno 8h" |
| `hora_inicio` | TIME | NOT NULL | ej. `06:00:00` |
| `hora_fin` | TIME | NOT NULL | ej. `14:00:00` |
| `cruza_medianoche` | BOOLEAN | DEFAULT false | true si el turno termina al día siguiente |
| `duracion_minutos` | INTEGER | NOT NULL | calculado |
| `tiene_refrigerio` | BOOLEAN | DEFAULT true | |
| `duracion_refrigerio_minutos` | INTEGER | DEFAULT 30 | |
| `tolerancia_tardanza_minutos` | INTEGER | DEFAULT 10 | |
| `dias_semana` | INTEGER[] | DEFAULT `'{1,2,3,4,5}'` | 1=Lun, 7=Dom |
| `activo` | BOOLEAN | DEFAULT true | |
| `created_at`, `updated_at`, `deleted_at` | | | |

---

### 4.7 `asignaciones` — Guardia × Puesto × Turno × Rango fechas

Tabla muchos-a-muchos con metadata.

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `guardia_id` | UUID | FK → guardias.id, NOT NULL | |
| `puesto_id` | UUID | FK → puestos.id, NOT NULL | |
| `turno_id` | UUID | FK → turnos.id, NOT NULL | |
| `fecha_inicio` | DATE | NOT NULL | |
| `fecha_fin` | DATE | | NULL = indefinida |
| `notas` | TEXT | | |
| `creado_por_user_id` | UUID | FK → users.id | quien la creó |
| `created_at`, `updated_at`, `deleted_at` | | | |

**Constraints:**
- No puede haber 2 asignaciones activas (sin fecha_fin) del mismo guardia + turno superpuestas en fecha
- `INDEX idx_asignaciones_guardia ON asignaciones(guardia_id, fecha_inicio);`
- `INDEX idx_asignaciones_puesto ON asignaciones(puesto_id, fecha_inicio);`

---

### 4.8 `marcas` — **Tabla principal del sistema**

El registro de cada asistencia.

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `guardia_id` | UUID | FK → guardias.id, NOT NULL | |
| `puesto_id` | UUID | FK → puestos.id | NULL si no estaba en geofence |
| `turno_id` | UUID | FK → turnos.id | NULL si fuera de turno |
| `asignacion_id` | UUID | FK → asignaciones.id | trazabilidad |
| `tipo_evento` | VARCHAR(30) | NOT NULL | enum: `entrada`, `salida`, `refrigerio_inicio`, `refrigerio_fin`, `ronda`, `incidente` |
| `timestamp_server` | TIMESTAMPTZ | NOT NULL DEFAULT now() | **Verdad absoluta** |
| `timestamp_device` | TIMESTAMPTZ | NOT NULL | Solo informativo |
| `ubicacion` | GEOGRAPHY(POINT, 4326) | NOT NULL | |
| `latitud` | NUMERIC(10, 7) | NOT NULL | Redundante con ubicacion para queries simples |
| `longitud` | NUMERIC(10, 7) | NOT NULL | |
| `precision_gps_m` | NUMERIC(6, 2) | | |
| `altitud_m` | NUMERIC(8, 2) | | |
| `foto_principal_url` | TEXT | NOT NULL | URL S3 del primer frame |
| `foto_urls` | JSONB | NOT NULL | array con las 3 URLs |
| `device_id` | UUID | FK → devices.id | |
| `device_info` | JSONB | | modelo, OS, versión app |
| `nonce` | VARCHAR(40) | NOT NULL | UUID enviado por cliente |
| `hmac_signature` | VARCHAR(128) | NOT NULL | Para auditoría |
| `play_integrity_verified` | BOOLEAN | DEFAULT false | |
| `play_integrity_details` | JSONB | | response de Google |
| `liveness_score` | NUMERIC(5, 2) | | 0-100 |
| `liveness_pasado` | BOOLEAN | | |
| `face_match_score` | NUMERIC(5, 2) | | 0-100 |
| `face_match_pasado` | BOOLEAN | | |
| `en_geofence` | BOOLEAN | | |
| `distancia_al_puesto_m` | NUMERIC(10, 2) | | calculada |
| `distancia_a_marca_anterior_m` | NUMERIC(12, 2) | | |
| `tiempo_a_marca_anterior_s` | INTEGER | | |
| `velocidad_implicita_kmh` | NUMERIC(8, 2) | | |
| `alerta_fraude_gps` | BOOLEAN | DEFAULT false | |
| `alerta_mock_location` | BOOLEAN | DEFAULT false | |
| `alerta_rooted_device` | BOOLEAN | DEFAULT false | |
| `alerta_emulador` | BOOLEAN | DEFAULT false | |
| `estado` | VARCHAR(20) | NOT NULL DEFAULT `'registrada'` | enum: `registrada`, `validada`, `rechazada`, `revisar` |
| `motivo_rechazo` | TEXT | | |
| `validada_por_user_id` | UUID | FK → users.id | supervisor que validó manualmente |
| `validada_at` | TIMESTAMPTZ | | |
| `sincronizada_desde_offline` | BOOLEAN | DEFAULT false | |
| `sync_attempt_count` | INTEGER | DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | = `timestamp_server` |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Constraints:**
- `UNIQUE (guardia_id, nonce)` — anti-replay a nivel DB
- `UNIQUE (guardia_id, timestamp_device, tipo_evento)` — anti-duplicado por sync repetido

**Índices:**
- `INDEX idx_marcas_guardia_timestamp ON marcas(guardia_id, timestamp_server DESC);`
- `INDEX idx_marcas_timestamp ON marcas(timestamp_server DESC);`
- `INDEX idx_marcas_puesto ON marcas(puesto_id);`
- `INDEX idx_marcas_estado ON marcas(estado);`
- `INDEX idx_marcas_alertas ON marcas(timestamp_server DESC) WHERE alerta_fraude_gps OR NOT en_geofence OR NOT liveness_pasado OR NOT face_match_pasado;`
- `INDEX idx_marcas_ubicacion ON marcas USING GIST(ubicacion);`

**Particionado (futuro si volumen grande):**
- Particionar por `timestamp_server` mensual cuando supere 10M filas

---

### 4.9 `devices` — Dispositivo vinculado a un guardia

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `guardia_id` | UUID | UNIQUE FK → guardias.id, NOT NULL | un guardia = un device |
| `device_fingerprint` | VARCHAR(255) | UNIQUE NOT NULL | hash único del device |
| `device_secret_hash` | VARCHAR(255) | NOT NULL | bcrypt del secret HMAC (no guardar plano) |
| `modelo` | VARCHAR(120) | | |
| `marca` | VARCHAR(80) | | |
| `os` | VARCHAR(50) | | "Android 13" |
| `os_version` | VARCHAR(20) | | |
| `app_version` | VARCHAR(20) | | |
| `fcm_token` | TEXT | | actualizable |
| `fcm_token_actualizado_at` | TIMESTAMPTZ | | |
| `bloqueado` | BOOLEAN | DEFAULT false | |
| `motivo_bloqueo` | TEXT | | |
| `bloqueado_por_user_id` | UUID | FK → users.id | |
| `bloqueado_at` | TIMESTAMPTZ | | |
| `ultimo_uso_at` | TIMESTAMPTZ | | |
| `vinculado_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `created_at`, `updated_at` | | | |

---

### 4.10 `alertas` — Alertas de fraude o anomalía

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `marca_id` | UUID | FK → marcas.id | nullable (alertas no asociadas a marca) |
| `guardia_id` | UUID | FK → guardias.id, NOT NULL | |
| `tipo` | VARCHAR(50) | NOT NULL | enum: `fraude_gps`, `mock_location`, `rooted_device`, `liveness_failed`, `face_mismatch`, `fuera_geofence`, `marca_no_realizada`, `device_mismatch` |
| `severidad` | VARCHAR(20) | NOT NULL | enum: `info`, `warning`, `critical` |
| `descripcion` | TEXT | NOT NULL | |
| `datos` | JSONB | | metadata específica del tipo |
| `estado` | VARCHAR(20) | NOT NULL DEFAULT `'pendiente'` | enum: `pendiente`, `atendida`, `descartada` |
| `notificada_a_supervisor` | BOOLEAN | DEFAULT false | |
| `notificada_at` | TIMESTAMPTZ | | |
| `atendida_por_user_id` | UUID | FK → users.id | |
| `atendida_at` | TIMESTAMPTZ | | |
| `nota_supervisor` | TEXT | | |
| `created_at`, `updated_at` | | | |

**Índices:**
- `INDEX idx_alertas_guardia ON alertas(guardia_id, created_at DESC);`
- `INDEX idx_alertas_estado ON alertas(estado);`
- `INDEX idx_alertas_pendientes ON alertas(created_at DESC) WHERE estado = 'pendiente';`

---

### 4.11 `refresh_tokens` — Refresh tokens activos

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `token_hash` | VARCHAR(255) | UNIQUE NOT NULL | sha256 del token (no plano) |
| `device_id` | UUID | FK → devices.id | |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `revoked_at` | TIMESTAMPTZ | | |
| `ip_address` | INET | | |
| `user_agent` | TEXT | | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Índices:**
- `INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;`
- `INDEX idx_refresh_tokens_cleanup ON refresh_tokens(expires_at);`

---

### 4.12 `audit_log` — Bitácora de cambios

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id | quien hizo la acción |
| `accion` | VARCHAR(50) | NOT NULL | ej. `create_guardia`, `update_puesto`, `validate_marca` |
| `entidad_tipo` | VARCHAR(50) | | ej. `guardia`, `puesto` |
| `entidad_id` | UUID | | ID afectado |
| `cambios` | JSONB | | `{before: {...}, after: {...}}` |
| `ip_address` | INET | | |
| `user_agent` | TEXT | | |
| `request_id` | VARCHAR(50) | | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Índices:**
- `INDEX idx_audit_user ON audit_log(user_id, created_at DESC);`
- `INDEX idx_audit_entidad ON audit_log(entidad_tipo, entidad_id, created_at DESC);`

---

### 4.13 `telemetria` — Eventos de telemetría del cliente

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `device_id` | UUID | FK → devices.id | |
| `guardia_id` | UUID | FK → guardias.id | |
| `evento` | VARCHAR(80) | NOT NULL | ej. `app_open`, `sync_completed`, `crash` |
| `datos` | JSONB | | |
| `timestamp_device` | TIMESTAMPTZ | | |
| `timestamp_server` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Particionar por mes (volumen alto esperado).**

---

### 4.14 `reportes_generados` — Tracking de reportes en curso

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | = job_id de Arq |
| `tipo` | VARCHAR(50) | NOT NULL | `horas_trabajadas`, `asistencia`, `fraude` |
| `parametros` | JSONB | NOT NULL | filtros usados |
| `solicitado_por_user_id` | UUID | FK → users.id | |
| `estado` | VARCHAR(20) | NOT NULL | `pending`, `processing`, `done`, `failed` |
| `progreso_porcentaje` | INTEGER | | |
| `url_descarga` | TEXT | | URL pre-firmada S3 |
| `url_expira_at` | TIMESTAMPTZ | | |
| `error_mensaje` | TEXT | | |
| `created_at`, `updated_at` | | | |

---

### 4.15 `notificaciones` — Bandeja de notificaciones push

| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `guardia_id` | UUID | FK → guardias.id, NOT NULL | |
| `tipo` | VARCHAR(50) | NOT NULL | |
| `titulo` | VARCHAR(255) | NOT NULL | |
| `cuerpo` | TEXT | NOT NULL | |
| `datos_extra` | JSONB | | |
| `accion_url` | VARCHAR(255) | | deep link al tap |
| `enviada_at` | TIMESTAMPTZ | | |
| `entregada_at` | TIMESTAMPTZ | | confirmado por FCM |
| `leida_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

---

## 5. Vistas materializadas (Fase 4)

### 5.1 `mv_horas_trabajadas_diarias`

Agregado precalculado para reportes rápidos.

```sql
CREATE MATERIALIZED VIEW mv_horas_trabajadas_diarias AS
SELECT
    g.id AS guardia_id,
    DATE(m.timestamp_server AT TIME ZONE 'America/Bogota') AS fecha,
    SUM(...) AS horas_trabajadas,
    SUM(...) AS horas_refrigerio,
    COUNT(*) AS num_marcas,
    SUM(CASE WHEN alerta_fraude_gps THEN 1 ELSE 0 END) AS marcas_con_fraude
FROM marcas m
JOIN guardias g ON m.guardia_id = g.id
GROUP BY g.id, fecha;

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_horas_trabajadas_diarias;
```

Refresh diario via cron de Arq.

---

## 6. Datos seed iniciales (Fase 1)

Para desarrollo y testing inicial, seed con:

- 1 empresa demo
- 1 admin (DNI 99999999, password `Admin123!`)
- 1 supervisor (DNI 88888888)
- 3 guardias de prueba
- 2 puestos con geofences reales (ej. coordenadas de Bogotá)
- 3 turnos (mañana, tarde, noche)
- Asignaciones de cada guardia a un puesto/turno

Catálogos idempotentes (roles, tipos_alerta, etc.) viven en `backend/database/seeds/` y se re-aplican en cada deploy.
Los datos de demo de QA viven en `backend/tests/fixtures/`.

---

## 7. Organización del código de BD

Toda la gestión de base de datos vive en `backend/database/` siguiendo la **estructura híbrida** definida en [ADR-020](./decisiones-tecnicas.md). La fuente de verdad de la convención es `backend/database/README.md`.

```text
backend/database/
├── README.md         ← guía maestra
├── migrations/       ← Alembic (estructura del schema) — auto en CI/CD
├── views/            ← CREATE OR REPLACE VIEW (idempotente) — auto en CI/CD
├── analytics/        ← MATERIALIZED VIEW (drop+create) — auto en CI/CD
├── seeds/            ← INSERT ... ON CONFLICT (catálogos) — auto en CI/CD
├── init/             ← Extensiones de Postgres — una vez por DB
├── manual_ops/       ← DML destructivo / backfills — manual con aprobación
└── explore/          ← Sandbox del dev — solo local
```

### Migraciones (Alembic)

- Una migración inicial con todo el schema base (Sprint 1.2)
- A partir de ahí, una migración por cambio lógico atómico
- Toda migración debe tener `upgrade()` Y `downgrade()` funcionales
- Tests de migraciones en CI (downgrade + upgrade limpio)
- Naming auto-generado por Alembic: `YYYY_MM_DD_HHMM-<rev>_<slug>.py`

### Cuándo usar migrations vs manual_ops

| Caso | Va en |
|---|---|
| Crear tabla nueva | `migrations/` |
| Crear columna nueva (NULL) | `migrations/` |
| Crear índice | `migrations/` |
| Backfill rápido (<30s) | `migrations/` |
| Backfill lento (>30s) | `manual_ops/` después de migración estructural |
| `DROP COLUMN` / `DROP TABLE` | `manual_ops/` con 2 aprobaciones |
| `UPDATE` masivo de fix | `manual_ops/` |
| Crear vista expuesta al admin | `views/` |
| Crear materialized view para reportes | `analytics/` |
| Insertar rol / tipo / catálogo | `seeds/` |

### CI/CD

- `.github/workflows/database-auto-migrate.yml`: aplica migrations + views + analytics + seeds al hacer push a `main` (primero staging, luego production con approval).
- `.github/workflows/database-manual-ops.yml`: ejecuta un script de `manual_ops/` bajo `workflow_dispatch` con dry-run obligatorio antes del run real.

---

## 8. Extensiones PostgreSQL requeridas

Definidas en `backend/database/init/01_extensions.sql` y aplicadas automáticamente al crear la BD:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- bcrypt, hashes
CREATE EXTENSION IF NOT EXISTS postgis;        -- geo
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- búsqueda fuzzy (search guardias)
CREATE EXTENSION IF NOT EXISTS btree_gist;     -- exclusion constraints
```

---

## 9. Estimación de volumen y crecimiento

Asumiendo cliente promedio:
- 100 guardias
- 4 marcas/día por guardia
- 360 días/año

→ **144,000 marcas/año por cliente**
→ Con 50 clientes = **7.2M marcas/año**

A 3 años → 21M filas en `marcas`. Aún manejable sin particionar. **Particionado por mes** se vuelve obligatorio si superamos 50M filas.

**Almacenamiento S3:**
- ~200KB por foto × 3 frames = 600KB por marca
- 7.2M marcas × 600KB = **4.3 TB/año**
- Lifecycle a Glacier reduce ~80% del costo después de 90 días

---

## 10. Consideraciones de privacidad y retención

| Tabla | Política |
|---|---|
| `marcas` (fotos) | Glacier 90 días, eliminar a 1 año (configurable por cliente) |
| `marcas` (registro) | Mantener 3 años para auditoría legal |
| `audit_log` | 3 años |
| `telemetria` | 90 días |
| `refresh_tokens` (revocados/expirados) | Limpieza diaria de los > 30 días |
| `notificaciones` (leídas) | 30 días |
| Datos de guardias dados de baja | Anonimizar después de 1 año del despido |

---

## 11. Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md)
- 🏛️ [`arquitectura.md`](./arquitectura.md)
- ⚙️ [`funcionalidades-backend.md`](./funcionalidades-backend.md)
- 🛡️ [`seguridad.md`](./seguridad.md)
