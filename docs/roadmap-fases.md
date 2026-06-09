# 🗓️ Roadmap de Fases — Smart Control Security

> Plan detallado de ejecución del proyecto, dividido en 4 fases más una fase futura. Cada fase tiene objetivos claros, tareas accionables, dependencias y criterios de aceptación.

---

## Resumen ejecutivo del roadmap

```text
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  FASE 1   ▶ Backend base + infraestructura datos    (2-3 semanas)     │
│           ▶ FastAPI, PostgreSQL+PostGIS, S3, Auth, CI                 │
│           ▼                                                           │
│  FASE 2   ▶ App móvil Flutter Android                (3-4 semanas)    │
│           ▶ Captura, offline, sync, seguridad cliente                 │
│           ▼                                                           │
│  FASE 3   ▶ Capa de seguridad biométrica (IA)        (2 semanas)      │
│           ▶ AWS Rekognition Liveness + Face Match                     │
│           ▼                                                           │
│  FASE 4   ▶ Analítica + alertas + reportes           (2 semanas)      │
│           ▶ Pandas + PostGIS analytics + SendGrid + Reportes Excel    │
│           ▼                                                           │
│  ─────── MVP COMPLETO (9-11 semanas totales) ───────                  │
│                                                                       │
│  FASE 5   ▶ Panel admin web (futuro)                 (3-4 semanas)    │
│           ▶ Next.js dashboard supervisores                            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Fase 0 — Setup inicial (pre-Fase 1)

**Objetivo:** Tener la base del repo lista para empezar a desarrollar.

### Tareas

- [x] Crear estructura del repo
- [x] Documentación completa (este folder `docs/`)
- [ ] Definir convenciones de commits (sugerido: Conventional Commits)
- [ ] Definir flujo de branching (sugerido: trunk-based con feature branches cortas)
- [ ] Crear template de PR en `.github/pull_request_template.md`
- [ ] Crear `.gitignore` raíz cubriendo Python, Flutter, IDE, secretos
- [ ] Crear `LICENSE` (decidir tipo: propietaria, MIT, Apache 2)
- [ ] Definir versionamiento (sugerido: semver)

**Duración estimada:** 1-2 días
**Criterio de salida:** El repo está limpio, documentado, y un dev nuevo puede onboarding leyendo `docs/PLAN.md`.

---

## Fase 1 — Backend base + Infraestructura de datos

**Objetivo:** Tener un backend FastAPI funcional con todos los endpoints CRUD básicos, conexión a PostgreSQL+PostGIS, subida real a S3, autenticación JWT, y pipeline de CI funcionando.

**Duración estimada:** 2-3 semanas

### Sprint 1.1 — Scaffolding del backend (3-4 días)

- [ ] Crear estructura de carpetas `backend/` según `arquitectura.md`
- [ ] `requirements.txt` con todas las deps listadas en `arquitectura.md`
- [ ] `pyproject.toml` con configuración de `ruff`, `mypy`, `pytest`
- [ ] `Dockerfile` para el backend
- [ ] `docker-compose.yml` para dev local con PostgreSQL+PostGIS+Redis
- [ ] `.env.example` con todas las variables esperadas
- [ ] `app/core/config.py` con Pydantic Settings
- [ ] `app/main.py` con FastAPI corriendo + endpoint `/health`
- [ ] Configuración de structlog
- [ ] Configuración de Sentry SDK (env-conditional)

**Criterio:** `docker-compose up` → backend responde 200 en `/api/system/health`.

### Sprint 1.2 — Capa de persistencia (3-4 días)

- [ ] `app/db/base.py` con SQLAlchemy async + sesiones
- [ ] Crear todos los modelos SQLAlchemy según `modelo-datos.md`:
  - [ ] `User`
  - [ ] `Empresa`
  - [ ] `Guardia`
  - [ ] `Supervisor`
  - [ ] `Puesto` (con PostGIS GEOGRAPHY)
  - [ ] `Turno`
  - [ ] `Asignacion`
  - [ ] `Device`
  - [ ] `Marca` (con todos los campos críticos)
  - [ ] `Alerta`
  - [ ] `RefreshToken`
  - [ ] `AuditLog`
  - [ ] `Telemetria`
  - [ ] `ReporteGenerado`
  - [ ] `Notificacion`
- [ ] Configurar Alembic + migración inicial con todo el schema
- [ ] Script de seed para datos demo
- [ ] Helpers de PostGIS (`app/db/postgis.py`)

**Criterio:** `alembic upgrade head` crea todo el schema; seed funciona.

### Sprint 1.3 — Autenticación y seguridad (3-4 días)

- [ ] `app/core/security.py` — JWT, password hashing, HMAC verify
- [ ] `app/modules/auth/`
  - [ ] `POST /api/auth/login`
  - [ ] `POST /api/auth/refresh`
  - [ ] `POST /api/auth/logout`
  - [ ] `POST /api/auth/change-password`
- [ ] Middleware HMAC signing verification
- [ ] Middleware nonce verification (Redis)
- [ ] Dependency `get_current_user` con verificación de rol
- [ ] Generación de `device_secret` en primer login
- [ ] Tests de auth (login OK, password incorrecto, token expirado, etc.)

**Criterio:** Suite de tests de auth pasa al 100%; endpoint de marca requiere JWT + HMAC válidos.

### Sprint 1.4 — Endpoints CRUD básicos (4-5 días)

- [ ] `app/modules/empresas/` con endpoints
- [ ] `app/modules/users/` con endpoints
- [ ] `app/modules/guardias/` con endpoints
- [ ] `app/modules/supervisores/` con endpoints
- [ ] `app/modules/puestos/` con endpoints (incluye creación con polígono geofence)
- [ ] `app/modules/turnos/` con endpoints
- [ ] `app/modules/asignaciones/` con endpoints
- [ ] `app/modules/devices/` con endpoints

Cada módulo debe tener:
- `router.py`, `service.py`, `schemas.py` (Pydantic), tests

**Criterio:** Todos los CRUD funcionan; se pueden crear desde Postman datos de prueba completos.

### Sprint 1.5 — Endpoint de marcas + S3 + Storage (3-4 días)

- [ ] `app/services/s3_service.py` con boto3
- [ ] `POST /api/marcas` con:
  - [ ] Validación HMAC y nonce
  - [ ] Subida de 3 fotos a S3 con SSE-KMS
  - [ ] Persistencia en DB
  - [ ] **Stubs** de Rekognition y Play Integrity (retornan OK por ahora)
  - [ ] Cálculo de geofence con PostGIS
  - [ ] Cálculo de distancia/velocidad vs marca anterior
- [ ] `GET /api/marcas/mias` (historial)
- [ ] `GET /api/marcas/mias/{id}` (detalle)
- [ ] `GET /api/marcas/{id}/foto` (URL pre-firmada)
- [ ] Tests E2E del flujo completo de marca

**Criterio:** Una marca creada vía API queda en DB con foto en S3, accesible vía URL pre-firmada, y con geofence calculado correctamente.

### Sprint 1.6 — CI/CD y observabilidad (2-3 días)

- [ ] `.github/workflows/backend-ci.yml`:
  - [ ] Lint (`ruff check`)
  - [ ] Type check (`mypy`)
  - [ ] Tests (`pytest` con coverage)
  - [ ] Build de imagen Docker
  - [ ] Push a ECR (opcional para Fase 1)
- [ ] Pre-commit hooks (`pre-commit` con ruff + mypy)
- [ ] Configurar Sentry con sourcemaps
- [ ] Logs estructurados con request_id propagation

**Criterio:** PR a `main` ejecuta CI completo; tests con cobertura ≥ 70%.

### Criterios de aceptación de Fase 1 (Definition of Done)

- [ ] OpenAPI auto-generada accesible en `/docs`
- [ ] Todos los endpoints documentados con descripciones y ejemplos
- [ ] Migración Alembic funcional (upgrade + downgrade)
- [ ] `docker-compose up` levanta todo el stack en local
- [ ] Test E2E: crear empresa → guardia → puesto → turno → asignación → marca (con foto a S3)
- [ ] Cobertura de tests ≥ 70%
- [ ] CI verde en `main`
- [ ] README de `backend/` documenta cómo correrlo en local
- [ ] Demo grabado mostrando el flujo completo

### Riesgos específicos de Fase 1

| Riesgo | Mitigación |
|---|---|
| PostGIS extensión no disponible en RDS sin permisos extra | Pre-validar con `CREATE EXTENSION postgis;` en RDS de staging antes de desarrollar |
| AWS credentials para S3 no disponibles | Usar MinIO en docker-compose para dev; S3 real solo en staging+ |
| Tiempo de aprendizaje SQLAlchemy 2.x async | Spike inicial de 1-2 días si el equipo no lo conoce |

---

## Fase 2 — App móvil Flutter Android

**Objetivo:** Tener una APK instalable en device físico Android que cumple TODOS los requisitos definidos en `funcionalidades-app-movil.md`, con todas las protecciones cliente, modo offline-first robusto, y conexión real al backend de Fase 1.

**Duración estimada:** 3-4 semanas

### Sprint 2.1 — Scaffolding Flutter (2-3 días)

- [ ] `flutter create mobile --org com.balcuapps.smartcontrolsecurity`
- [ ] Estructura de carpetas según `funcionalidades-app-movil.md` sección 14
- [ ] Agregar todas las dependencias de `pubspec.yaml`
- [ ] Configurar `Riverpod` + `freezed` + `build_runner`
- [ ] Configurar tema (Light + alto contraste)
- [ ] Configurar `flutter_localizations` (español)
- [ ] Configurar `dio` con interceptores base (auth, logging, errors)
- [ ] Configurar pre-commit hooks (`dart format`, `dart analyze`)

**Criterio:** `flutter run` muestra pantalla "Hello World" con tema custom.

### Sprint 2.2 — Autenticación + sesión persistente (3-4 días)

- [ ] Pantalla Splash con verificación de sesión
- [ ] Pantalla Login
- [ ] `AuthRepository` + provider Riverpod
- [ ] `flutter_secure_storage` para tokens
- [ ] Interceptor de refresh token automático
- [ ] Logout completo
- [ ] Manejo de errores de auth (mostrando mensajes según `funcionalidades-app-movil.md` sección 12)
- [ ] Tests de widgets

**Criterio:** Login funcional contra backend de Fase 1; sesión persiste tras cerrar/abrir app.

### Sprint 2.3 — Pantalla Home + Perfil (2-3 días)

- [ ] Pantalla Home con todos los elementos definidos en sección 3.1
- [ ] Bottom navigation
- [ ] Pantalla Perfil
- [ ] Pantalla Configuración
- [ ] Cambio de password
- [ ] Política de privacidad + Términos + Acerca de

**Criterio:** Navegación fluida entre pantallas; datos del guardia se cargan del backend.

### Sprint 2.4 — Captura de marca: cámara + GPS + Liveness on-device (4-5 días)

- [ ] Pantalla de captura con preview de cámara frontal
- [ ] Validación de pre-condiciones (permisos, GPS, mock, root)
- [ ] Captura de coordenadas GPS con `geolocator`
- [ ] Detección de Mock Location
- [ ] Integración `google_mlkit_face_detection`
- [ ] Challenge-response (parpadeo / sonrisa / giro)
- [ ] Captura de 3 frames
- [ ] Compresión de imágenes (~200KB cada una)
- [ ] Pantalla de confirmación
- [ ] Tests de integración (con mock de cámara)

**Criterio:** Marca capturada con foto + GPS válido + challenge completado, enviada exitosamente al backend.

### Sprint 2.5 — Modo offline + sync (4-5 días)

- [ ] Configurar `sqflite` con schema local para marcas pendientes
- [ ] Almacenamiento cifrado de fotos en directorio interno
- [ ] `MarcaRepository` con lógica online/offline transparente
- [ ] Configurar `workmanager` para sync periódico
- [ ] Listener de `connectivity_plus` para sync inmediato al volver red
- [ ] Algoritmo de retry con backoff exponencial
- [ ] Pantalla "Cola de pendientes"
- [ ] Indicador visual de estado de conexión + contador de pendientes
- [ ] Tests E2E offline → online

**Criterio:** Registrar 10 marcas sin red, recuperar red, todas se sincronizan correctamente (verificable en DB del backend).

### Sprint 2.6 — Seguridad cliente avanzada (3-4 días)

- [ ] Integrar `flutter_jailbreak_detection` + bloqueo si root
- [ ] Detección de emulador (heurísticas)
- [ ] Integrar `play_integrity_flutter` + envío de token al backend
- [ ] Implementar HMAC signing en interceptor de `dio`
- [ ] Configurar certificate pinning con fingerprint del cert de staging
- [ ] Generación y manejo de nonces UUID v4
- [ ] Telemetría de eventos de seguridad
- [ ] Tests de seguridad (mock device rooteado, mock signature inválida)

**Criterio:** App rechaza correctamente en device rooteado / emulador / con fake GPS; backend recibe y verifica HMAC + Play Integrity.

### Sprint 2.7 — Historial + Push notifications (3-4 días)

- [ ] Pantalla Historial con filtros + paginación
- [ ] Pantalla Detalle de marca con foto + minimapa
- [ ] Cache local de últimas 100 marcas
- [ ] Integración Firebase + `firebase_messaging`
- [ ] Manejo de push en foreground / background / tap
- [ ] Bandeja de notificaciones in-app
- [ ] Deep linking desde notificación

**Criterio:** Push recibido del backend, tap abre la pantalla correcta.

### Sprint 2.8 — Pulido + build de producción (2-3 días)

- [ ] Build con `--obfuscate --split-debug-info`
- [ ] Firmar APK con keystore real
- [ ] Optimización de tamaño (< 30MB)
- [ ] Modo alto contraste verificado
- [ ] Pruebas en 5+ devices Android distintos (gama baja, media, alta)
- [ ] Pruebas en condiciones reales (sin luz, exterior, etc.)
- [ ] Documentar proceso de build y distribución

**Criterio:** APK de release instalable, todas las protecciones activas, sin crashes en 1 día de uso real.

### Criterios de aceptación de Fase 2 (Definition of Done)

- [ ] Todos los items del checklist de "Criterios de aceptación" de `funcionalidades-app-movil.md` sección 15
- [ ] Cobertura de tests unitarios ≥ 70%
- [ ] Integration tests en 3+ flujos críticos (login, marcar, sync offline)
- [ ] APK release < 30MB, obfuscado, firmado
- [ ] Pruebas de campo: 1 día completo con guardia real, sin crashes
- [ ] Documentación de uso para el guardia (manual PDF)

---

## Fase 3 — Capa de seguridad biométrica (IA)

**Objetivo:** Reemplazar los stubs de Rekognition y Play Integrity por integraciones reales, alcanzando validación biométrica end-to-end de calidad producción.

**Duración estimada:** 2 semanas

### Sprint 3.1 — Integración AWS Rekognition (3-4 días)

- [ ] Configurar IAM role con permisos `rekognition:CreateFaceLivenessSession`, `rekognition:GetFaceLivenessSessionResults`, `rekognition:CompareFaces`
- [ ] `app/services/rekognition_service.py`:
  - [ ] `check_liveness(s3_uris: list[str]) -> LivenessResult`
  - [ ] `compare_faces(source_s3: str, target_s3: str) -> MatchResult`
- [ ] Manejo de errores (rate limit, timeout, low quality)
- [ ] Configuración de umbrales en Settings
- [ ] Persistencia de scores en `marcas`
- [ ] Tests con fotos reales (positivo y negativo)

**Criterio:** Foto en vivo → pasa; foto impresa → rechazada; foto de otra persona → rechazada por face match.

### Sprint 3.2 — Integración Play Integrity (2-3 días)

- [ ] Configurar Google Cloud Project con Play Integrity API habilitada
- [ ] `app/services/play_integrity_service.py`:
  - [ ] `verify_token(token: str, expected_nonce: str) -> IntegrityResult`
- [ ] Verificación de nonce embebido en el token
- [ ] Manejo de devices que reportan integrity issues (configurable: bloqueo total vs warning)
- [ ] Tests con tokens reales de devices físicos

**Criterio:** Token válido → marca aceptada; token de device modificado → rechazada.

### Sprint 3.3 — Foto de referencia + lifecycle (2-3 días)

- [ ] Endpoint `POST /api/guardias/{id}/foto-referencia` (admin)
- [ ] Validación de calidad de foto referencia (Rekognition `DetectFaces` antes de aceptarla)
- [ ] Política de actualización (warning si la foto es >12 meses vieja)
- [ ] Pantalla en panel admin (placeholder por ahora, completa en Fase 5)

**Criterio:** Admin sube foto referencia, foto pasa validación de calidad, queda disponible para Face Match.

### Sprint 3.4 — Casos edge + fallbacks (2-3 días)

- [ ] Fallback cuando Rekognition está caído (encolar para validación diferida)
- [ ] Manejo de quotas alcanzadas (alerta al admin)
- [ ] Tabla `marcas_pendientes_validacion` para casos edge
- [ ] Job de Arq para reintentar validaciones fallidas
- [ ] Métricas: tasa de liveness pasado, score promedio, falsos positivos sospechosos

**Criterio:** Sistema operativo aún con Rekognition intermitente; supervisor puede validar manualmente desde el panel.

### Sprint 3.5 — Tests end-to-end + tuning (2-3 días)

- [ ] Dataset de 50+ fotos reales: 25 legítimas + 25 fraude (foto impresa, video pantalla, otra persona)
- [ ] Medición de tasa de detección
- [ ] Tuning de umbrales según resultados
- [ ] Documentar tasas obtenidas en `docs/seguridad.md`
- [ ] Test de carga: 100 marcas/min, verificar latencia y costos

**Criterio:** Tasa de detección ≥ 95% en dataset propio; latencia p95 de Rekognition < 3s.

### Criterios de aceptación de Fase 3

- [ ] AWS Rekognition Face Liveness operativo en producción
- [ ] Face Compare operativo, ≥ 95% accuracy en dataset propio
- [ ] Play Integrity verificado server-side
- [ ] Umbrales configurables por empresa
- [ ] Fallback robusto cuando IA falla
- [ ] Costos AWS monitoreados y dentro de presupuesto
- [ ] Documentación actualizada con tasas reales

---

## Fase 4 — Analítica + Alertas + Reportes

**Objetivo:** Procesar las marcas recolectadas para generar valor de negocio (horas trabajadas, detección de patrones de fraude, alertas a supervisores, reportes exportables).

**Duración estimada:** 2 semanas

### Sprint 4.1 — Background jobs con Arq (2-3 días)

- [ ] `backend/app/workers/main.py` configurado
- [ ] `WorkerSettings` con conexión a Redis
- [ ] Dockerfile para worker (separado del API)
- [ ] docker-compose con servicio worker
- [ ] Helper para encolar jobs desde la API
- [ ] Jobs base: `send_email`, `send_push`

**Criterio:** Worker corriendo, procesa jobs encolados desde la API, monitoring básico funcional.

### Sprint 4.2 — Detección de fraude GPS en tiempo real (2-3 días)

- [ ] Helper `postgis.calc_distance_velocity()`
- [ ] Integrar en `MarcaService.registrar_marca()`
- [ ] Configurar umbrales por empresa en `empresas.configuracion`
- [ ] Job `process_fraud_alert` (encolado tras marca con flag)
- [ ] Generación de registro en tabla `alertas`
- [ ] Tests con casos: salto de 200km entre marcas → flag; trayecto normal → OK

**Criterio:** Marca con velocidad imposible queda con `alerta_fraude_gps=true` y genera registro en `alertas`.

### Sprint 4.3 — Templates SendGrid + envío de alertas (2-3 días)

- [ ] Configurar cuenta SendGrid + Sender Authentication
- [ ] Crear templates:
  - [ ] `alerta_fraude_supervisor`
  - [ ] `marca_rechazada_guardia`
  - [ ] `bienvenida_guardia`
  - [ ] `password_reset`
- [ ] `app/services/sendgrid_service.py`
- [ ] Job `send_alert_email` integrado con SendGrid
- [ ] Logging de emails enviados + manejo de bounces
- [ ] Tests con sandbox de SendGrid

**Criterio:** Marca con fraude detectado → supervisor recibe email en < 1 min con detalle y link al panel.

### Sprint 4.4 — Push notifications FCM (2-3 días)

- [ ] Configurar Firebase + descargar credenciales
- [ ] `app/services/fcm_service.py` con `firebase-admin`
- [ ] Job `send_push_notification`
- [ ] Generación de notificaciones para todos los casos de `funcionalidades-app-movil.md` sección 8.1
- [ ] Persistencia en tabla `notificaciones`
- [ ] Cron de Arq para recordatorios de turno (cada minuto)
- [ ] Manejo de tokens FCM inválidos (auto-cleanup)

**Criterio:** Cliente Android recibe push de prueba del backend; recordatorio de turno se dispara correctamente.

### Sprint 4.5 — Cálculo de horas trabajadas con Pandas (2-3 días)

- [ ] `app/analytics/horas_trabajadas.py`:
  - [ ] Función que recibe DataFrame de marcas, retorna horas por día por guardia
  - [ ] Pareo de marcas entrada/salida
  - [ ] Descuento de refrigerios
  - [ ] Detección de pares incompletos (warning)
- [ ] Vista materializada `mv_horas_trabajadas_diarias`
- [ ] Cron diario de refresh
- [ ] Tests con datasets sintéticos

**Criterio:** Reporte de horas mensuales correcto para guardia con turnos típicos y atípicos.

### Sprint 4.6 — Generación de reportes Excel (2-3 días)

- [ ] `app/analytics/reportes.py` con `openpyxl`
- [ ] Templates de reporte: horas trabajadas, asistencia, fraude
- [ ] Endpoints `POST /api/reportes/*` que encolan job
- [ ] Job `generate_report_*` que procesa y sube a S3
- [ ] Endpoint de status y descarga
- [ ] Estilo corporativo (logo, colores, formato profesional)

**Criterio:** Admin solicita reporte mensual de 100 guardias → recibe link descargable a Excel formateado en < 2 min.

### Sprint 4.7 — Validación manual de marcas + admin endpoints (2-3 días)

- [ ] `POST /api/marcas/{id}/validar` (aprobar/rechazar marca dudosa)
- [ ] `GET /api/alertas` con filtros
- [ ] `POST /api/alertas/{id}/atender`
- [ ] Endpoint de KPIs para dashboard futuro
- [ ] Tests E2E del flujo de alerta → email → validación manual

**Criterio:** Supervisor puede listar alertas pendientes, ver detalle de marca, marcarla como válida o fraude.

### Criterios de aceptación de Fase 4 (MVP completo)

- [ ] Workers Arq operativos con monitoring
- [ ] Detección de fraude GPS funciona en cada marca (real-time)
- [ ] Alertas por email recibidas en supervisores
- [ ] Push notifications recibidas en guardias
- [ ] Reportes Excel descargables y bien formateados
- [ ] Cálculo de horas trabajadas correcto y validado contra casos reales
- [ ] Cron jobs (recordatorios, no-marca, cleanup) funcionando
- [ ] KPIs disponibles vía API para dashboard futuro
- [ ] **DEMO completo MVP a stakeholders**: guardia marca con fraude → supervisor recibe alerta → valida desde API → reporte mensual generado

---

## Fase 5 — Panel admin web (Futura)

**Objetivo:** Dashboard web para supervisores y administradores, completando la experiencia de uso del sistema.

**Duración estimada:** 3-4 semanas

### Funcionalidades core

- [ ] Login + roles (supervisor / admin / superadmin)
- [ ] Dashboard con KPIs en tiempo real
- [ ] Mapa con marcas geolocalizadas (Leaflet o Mapbox)
- [ ] Listado y CRUD de guardias, puestos, turnos
- [ ] Gestión de asignaciones (calendario visual)
- [ ] Bandeja de alertas con filtros
- [ ] Validación manual de marcas (con foto + datos)
- [ ] Generador de reportes con preview
- [ ] Gestión de devices (bloquear, liberar)
- [ ] Configuración de la empresa (umbrales, templates)
- [ ] Audit log explorable

### Stack tecnológico tentativo

- Next.js 15 (App Router)
- TypeScript estricto
- TailwindCSS + shadcn/ui
- React Query para data fetching
- Zod para validación
- Recharts para gráficos
- Mapbox para mapas

### Hitos

- Sprint 5.1: Scaffold + Auth + Layout base (1 semana)
- Sprint 5.2: CRUD principales + Tabla de marcas (1 semana)
- Sprint 5.3: Dashboard + Mapa + Reportes (1 semana)
- Sprint 5.4: Pulido + Tests + Deploy (1 semana)

---

## Gantt estimado (visual)

```text
Semana:    1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
─────────────────────────────────────────────────────────
Fase 0:    █
Fase 1:    █  ██ ██ █
Fase 2:             █  ██ ██ ██ ██
Fase 3:                            ██ ██
Fase 4:                                  ██ ██
Fase 5:                                        ██ ██ ██ ██
                                        ▲
                                  MVP COMPLETO (sem 11)
```

---

## Reglas de gobernanza del roadmap

1. **No saltarse fases.** El orden está pensado para minimizar reescritura.
2. **Cambios al plan se documentan.** Si una decisión cambia, se actualiza `PLAN.md` + ADR correspondiente.
3. **Cada PR cierra una tarea concreta del roadmap.** Linkear el item del checklist en la descripción.
4. **No iniciar siguiente fase sin completar criterios de aceptación de la anterior.**
5. **Demos al final de cada fase** con stakeholders.
6. **Retrospectiva al final de cada fase**: qué funcionó, qué no, qué ajustamos.

---

## Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md)
- 🏛️ [`arquitectura.md`](./arquitectura.md)
- 📱 [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md)
- ⚙️ [`funcionalidades-backend.md`](./funcionalidades-backend.md)
- 🗃️ [`modelo-datos.md`](./modelo-datos.md)
- 🛡️ [`seguridad.md`](./seguridad.md)
- 🧠 [`decisiones-tecnicas.md`](./decisiones-tecnicas.md)
