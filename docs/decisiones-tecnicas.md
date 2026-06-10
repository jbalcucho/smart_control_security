# 🧠 Decisiones Técnicas (ADRs) — Smart Control Security

> Architecture Decision Records: registro corto de cada decisión técnica importante con su contexto, las opciones evaluadas, lo decidido y por qué.

**Formato:** cada ADR es atómico, fechado, y tiene un estado (`Propuesto`, `Aceptado`, `Reemplazado`, `Deprecado`).

---

## Índice de ADRs

| # | Decisión | Estado | Fecha |
|---|---|---|---|
| [ADR-001](#adr-001-flutter-en-vez-de-kotlin-nativo) | Flutter en vez de Kotlin nativo | ✅ Aceptado | 2026-06 |
| [ADR-002](#adr-002-aws-rekognition-en-vez-de-opencv-puro) | AWS Rekognition en vez de OpenCV puro | ✅ Aceptado | 2026-06 |
| [ADR-003](#adr-003-postgis-en-vez-de-pandas-para-validación-gps-en-tiempo-real) | PostGIS en vez de Pandas para validación GPS en tiempo real | ✅ Aceptado | 2026-06 |
| [ADR-004](#adr-004-monorepo-en-vez-de-multi-repo) | Monorepo en vez de multi-repo | ✅ Aceptado | 2026-06 |
| [ADR-005](#adr-005-jwt-con-refresh-tokens) | JWT con refresh tokens | ✅ Aceptado | 2026-06 |
| [ADR-006](#adr-006-hmac-request-signing) | HMAC request signing | ✅ Aceptado | 2026-06 |
| [ADR-007](#adr-007-sqlalchemy-async--asyncpg) | SQLAlchemy async + asyncpg | ✅ Aceptado | 2026-06 |
| [ADR-008](#adr-008-arq-en-vez-de-celery) | Arq en vez de Celery | ✅ Aceptado | 2026-06 |
| [ADR-009](#adr-009-structlog-en-vez-de-logging-stdlib) | structlog en vez de logging stdlib | ✅ Aceptado | 2026-06 |
| [ADR-010](#adr-010-server-timestamp-como-verdad-absoluta) | Server timestamp como verdad absoluta | ✅ Aceptado | 2026-06 |
| [ADR-011](#adr-011-play-integrity-api-para-attestation) | Play Integrity API para attestation | ✅ Aceptado | 2026-06 |
| [ADR-012](#adr-012-android-first-ios-pospuesto) | Android first, iOS pospuesto | ✅ Aceptado | 2026-06 |
| [ADR-013](#adr-013-alembic-para-migraciones-desde-el-día-1) | Alembic para migraciones desde el día 1 | ✅ Aceptado | 2026-06 |
| [ADR-014](#adr-014-s3-con-sse-kms-para-fotos) | S3 con SSE-KMS para fotos | ✅ Aceptado | 2026-06 |
| [ADR-015](#adr-015-3-frames-por-marca-para-liveness) | 3 frames por marca para Liveness | ✅ Aceptado | 2026-06 |
| [ADR-016](#adr-016-uuid-como-primary-key-en-todas-las-tablas) | UUID como Primary Key en todas las tablas | ✅ Aceptado | 2026-06 |
| [ADR-017](#adr-017-riverpod-en-flutter) | Riverpod en Flutter | ✅ Aceptado | 2026-06 |
| [ADR-018](#adr-018-stack-del-panel-admin-web) | Stack del panel admin web (Next.js 15 + Tailwind) | ✅ Aceptado | 2026-06 |
| [ADR-019](#adr-019-conventional-commits--trunk-based-development) | Conventional Commits + trunk-based development | ✅ Aceptado | 2026-06 |
| [ADR-020](#adr-020-estructura-híbrida-de-databasealembic--vistas--seeds--manual_ops) | Estructura híbrida de `database/` (Alembic + vistas + seeds + manual_ops) | ✅ Aceptado | 2026-06 |
| [ADR-021](#adr-021-demo-web-previo-a-la-app-nativa) | Demo web previo a la app nativa (Next.js + Vercel + Neon) | ✅ Aceptado | 2026-06 |

---

## ADR-001: Flutter en vez de Kotlin nativo

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Necesitamos una app móvil para guardias de seguridad con fuertes requisitos de seguridad (anti-fraude facial, GPS anti-spoofing, attestation del device). Debemos elegir entre Flutter (cross-platform) y Kotlin nativo (Android only).

### Opciones evaluadas

1. **Kotlin nativo** — máximo control sobre APIs de Android, mejor obfuscation, acceso directo a Play Integrity, KeyStore con TEE
2. **Flutter** — cross-platform (Android + iOS desde una base), plugins maduros para todas las APIs de seguridad necesarias
3. **React Native** — descartado: menos maduro en plugins de seguridad, peor rendimiento de cámara

### Decisión
**Flutter**, con Android primero e iOS pospuesto a fase futura.

### Justificación

- Las APIs críticas de seguridad están disponibles en Flutter vía plugins maduros (`play_integrity_flutter`, `flutter_jailbreak_detection`, `geolocator`, `flutter_secure_storage`)
- **El verdadero anti-fraude se valida server-side** (Liveness en Rekognition, geofencing en PostGIS, attestation token verificado contra Google). El cliente solo recolecta evidencia, no decide.
- La ventaja de Kotlin nativo en seguridad es marginal (~5%) cuando el grueso de la validación es server-side
- El costo de mantener dos codebases (Kotlin Android + Swift iOS) cuando se pida iOS es ~200% mayor
- Time-to-market más rápido con Flutter

### Consecuencias

- ✅ Una sola base de código para Android + futuro iOS
- ✅ Hot reload acelera desarrollo
- ⚠️ Dependemos de calidad y mantenimiento de plugins de seguridad
- ⚠️ Obfuscation menos agresivo que R8 nativo (aceptable para nuestro modelo de amenaza)
- ⚠️ App ligeramente más grande (~10-15MB extra por el runtime Dart)

### Notas
Si en el futuro el modelo de amenaza cambia (ej. ataques avanzados con presupuesto), siempre podemos reimplementar módulos críticos en código nativo via Flutter platform channels.

---

## ADR-002: AWS Rekognition en vez de OpenCV puro

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
El documento original sugería usar **OpenCV + ML custom** para Liveness Detection. Esto es seguridad teatral: OpenCV puro (Haar cascades, eye blink detection casero) fue derrotado hace años por fotos impresas, video en pantalla, máscaras de silicona, deepfakes.

### Opciones evaluadas

1. **OpenCV custom** (propuesta original)
2. **AWS Rekognition Face Liveness** — servicio managed de AWS, estado del arte
3. **Google ML Kit on-device + Rekognition server** — challenge on-device + validación cloud
4. **FaceTec / iProov SDK** — estándar bancario, paga
5. **Azure Face API** — alternativa cloud
6. **Modelos open-source modernos** (e.g. anti-spoofing CNN) — requiere infraestructura ML propia

### Decisión
**AWS Rekognition Face Liveness** como servicio principal, complementado con **ML Kit on-device** para challenge previo (parpadeo/giro) que mejora UX y reduce envíos innecesarios al backend.

### Justificación
- AWS Rekognition Face Liveness está específicamente diseñado para este caso (lanzado en 2023)
- Compatible con el stack AWS ya elegido (S3, RDS)
- Costo aceptable: ~$0.005 por sesión de liveness
- Combinación cloud + on-device da defensa en profundidad
- Evita el riesgo de mantener un modelo ML custom (datasets, drift, etc.)

### Consecuencias

- ✅ Estado del arte en anti-spoofing
- ✅ Sin necesidad de equipo ML propio
- ⚠️ Vendor lock-in con AWS (mitigable: si llega el momento, podemos cambiar a Azure)
- ⚠️ Requiere internet para validar (mitigado por challenge on-device como fallback)
- ⚠️ Costo escala con volumen — monitorear y posiblemente cachear

---

## ADR-003: PostGIS en vez de Pandas para validación GPS en tiempo real

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
El documento original menciona usar **Pandas** para calcular distancia entre marcas y detectar velocidades imposibles. Pandas es excelente para batch ETL, pero usarlo en tiempo real implica:

- Cargar datos en memoria desde DB
- Procesar en Python
- No es real-time → fraude se detecta horas después

### Opciones evaluadas

1. **Pandas en background batch** (propuesta original)
2. **PostGIS en el INSERT** — cálculos en SQL nativo
3. **Cálculos en Python en el endpoint** — sin PostGIS, queries simples
4. **Servicio geoespacial dedicado** (GeoServer, etc.)

### Decisión
**PostGIS** para cálculos geoespaciales en tiempo real (cada marca). **Pandas** se reserva para reportes batch (horas trabajadas mensuales, análisis de patrones complejos).

### Justificación
- PostGIS calcula distancias geodésicas precisas (`ST_Distance` con `geography`)
- Geofencing nativo con `ST_Contains`
- Performance excelente (indexable con GIST)
- Detección de fraude **en el momento del INSERT**, no horas después
- Es la herramienta correcta para el trabajo

### Consecuencias

- ✅ Detección de fraude GPS instantánea
- ✅ Geofencing real con polígonos arbitrarios
- ✅ Schema más rico (campos GEOGRAPHY explícitos)
- ⚠️ Requiere extensión PostGIS instalable en RDS (validar disponibilidad)
- ⚠️ Equipo debe aprender básicos de PostGIS (curva corta, gran valor)

---

## ADR-004: Monorepo en vez de multi-repo

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Tenemos al menos 3 componentes: backend Python, mobile Flutter, y futuro panel web. ¿Un repo o varios?

### Opciones evaluadas

1. **Monorepo único** — backend/, mobile/, admin-web/ en una sola raíz
2. **Multi-repo** — un repo por componente

### Decisión
**Monorepo único** durante toda la vida del proyecto (al menos hasta Fase 5+).

### Justificación
- Cambios que afectan múltiples componentes (ej. modificar payload de API y consumirlo en mobile) en un solo PR atómico
- Una sola fuente de verdad para docs, ADRs, roadmap
- CI/CD más simple inicialmente
- Equipo pequeño no se beneficia de multi-repo (que tiene overhead de coordinación)
- GitHub maneja monorepos bien hasta cientos de miles de archivos

### Consecuencias

- ✅ Sincronización fácil entre componentes
- ✅ Onboarding más simple (clone uno, ten todo)
- ⚠️ CI debe ser inteligente para no correr tests innecesarios (paths filter)
- ⚠️ Permisos finos requieren GitHub teams + CODEOWNERS

---

## ADR-005: JWT con refresh tokens

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Mecanismo de autenticación entre cliente móvil y backend.

### Opciones evaluadas

1. **JWT con access + refresh** — estándar moderno
2. **Sesiones server-side** (cookies + Redis) — requiere estado en server
3. **OAuth2 con proveedor externo** — innecesariamente complejo para login interno
4. **PASETO** — alternativa moderna a JWT, menos soportada

### Decisión
**JWT** firmado con **RS256** (par RSA, no HS256 con secret compartido), con:
- Access token de vida corta (**15 min**)
- Refresh token de vida larga (**30 días**), guardado hasheado en DB
- Blacklist de refresh tokens revocados en Redis

### Justificación
- Estándar industria, librerías maduras (`python-jose`)
- Stateless en el server → escala horizontal trivial
- RS256 permite verificar tokens sin compartir la clave privada
- Refresh tokens almacenados en DB permiten revocación granular

### Consecuencias

- ✅ Escalabilidad
- ✅ Logout efectivo (revoca refresh, access expira solo)
- ⚠️ Access tokens en circulación no se pueden invalidar antes de su expiración (mitigado por su corta vida)

---

## ADR-006: HMAC request signing

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
JWT solo asegura "este usuario está autenticado" pero NO previene replay attacks (atacante intercepta una request válida y la reenvía).

### Opciones evaluadas

1. **HMAC signing con nonce + timestamp** (decidido)
2. **mTLS** (mutual TLS con cert de cliente) — robusto pero costoso de operar
3. **Solo JWT con ID corto** — insuficiente para anti-replay
4. **Sin protección anti-replay** — inaceptable para anti-fraude

### Decisión
**HMAC-SHA256** firmando cada request crítica con:
- `device_secret` único por dispositivo (generado server-side en primer login)
- Mensaje: `método|path|timestamp|nonce|body_hash`
- Servidor verifica firma + timestamp en ventana ±5min + nonce no reusado (Redis TTL 10min)
- A nivel DB, `UNIQUE (guardia_id, nonce)` en tabla `marcas` como defensa adicional

### Justificación
- Anti-replay robusto sin complejidad de mTLS
- `device_secret` único por device limita el blast radius si una clave se compromete
- Algoritmo simple, fácil de implementar y auditar

### Consecuencias

- ✅ Protección efectiva contra replay
- ✅ Independiente del JWT (defensa en profundidad)
- ⚠️ Reloj del cliente debe estar razonablemente sincronizado (ventana 5min lo absorbe)
- ⚠️ Requiere distribución segura del device_secret (mitigado: se entrega UNA VEZ en login y se guarda en KeyStore)

---

## ADR-007: SQLAlchemy async + asyncpg

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
ORM para Python que se integre bien con FastAPI (async-first).

### Opciones evaluadas

1. **SQLAlchemy 2.x async + asyncpg** (decidido)
2. **SQLAlchemy sync** — bloquea el event loop, malo para FastAPI
3. **Tortoise ORM** — async-nativo pero menos maduro
4. **SQLModel** — wrapper sobre SQLAlchemy, agrega azúcar Pydantic
5. **Sin ORM (asyncpg + queries crudas)** — más rápido pero pierde mantenibilidad

### Decisión
**SQLAlchemy 2.x con async + asyncpg como driver + GeoAlchemy2 para PostGIS**.

### Justificación
- SQLAlchemy 2.x es el estándar de facto en Python
- Async permite que FastAPI aproveche su concurrencia
- asyncpg es el driver Postgres más rápido para Python
- GeoAlchemy2 da soporte de PostGIS de forma idiomática

### Consecuencias

- ✅ Performance óptimo para I/O concurrente
- ✅ Migración futura a otros motores (improbable) sería más fácil
- ⚠️ Sintaxis async requiere `await` en todas las queries (más verboso)
- ⚠️ Algunos patrones (relaciones lazy) requieren más explicitud

---

## ADR-008: Arq en vez de Celery

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Necesitamos un sistema de background jobs para envío de emails, push notifications, generación de reportes, cleanup, etc.

### Opciones evaluadas

1. **Celery** — estándar histórico, muy maduro
2. **Arq** — async-nativo, Redis-based, mucho más liviano
3. **RQ** — simple pero síncrono
4. **Dramatiq** — alternativa interesante pero menos comunidad

### Decisión
**Arq** (https://arq-docs.helpmanual.io/).

### Justificación
- Async-nativo, integra naturalmente con FastAPI
- Mucho más simple que Celery (configuración mínima)
- Suficiente para nuestro volumen esperado (decenas a cientos de jobs/min)
- Solo requiere Redis, no broker adicional
- Author es el de pydantic (Samuel Colvin), gran calidad

### Consecuencias

- ✅ Setup trivial
- ✅ Sin overhead de Celery
- ⚠️ Menos features avanzadas (sin chains/groups complejos, ok para nuestro caso)
- ⚠️ Comunidad más pequeña que Celery

### Cuándo reconsiderar
Si llegamos a >1000 jobs/segundo o necesitamos workflows complejos con dependencias entre tareas, evaluar Celery o Temporal.

---

## ADR-009: structlog en vez de logging stdlib

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Necesitamos logging que sea (1) estructurado (JSON), (2) trazable (request_id), (3) fácil de parsear en CloudWatch/Datadog.

### Opciones evaluadas

1. **logging stdlib + json formatter** — funciona pero verboso
2. **structlog** — diseñado para logs estructurados
3. **loguru** — más simple, menos features de structuring

### Decisión
**structlog** con processors para:
- Inyectar `request_id` automáticamente vía contextvar
- Format JSON en producción / pretty-print en local
- Integrar con Sentry breadcrumbs

### Justificación
- Logs JSON estructurados son indispensables para parsing en CloudWatch
- structlog permite enrichment automático sin escribir boilerplate
- Bien soportado, comunidad activa

### Consecuencias

- ✅ Logs grepeables y filtrables
- ✅ Correlación entre request y todos sus logs
- ⚠️ Curva de aprendizaje menor

---

## ADR-010: Server timestamp como verdad absoluta

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
El reloj del device del guardia puede ser manipulado (cambiar fecha/hora para parecer marcar a tiempo).

### Decisión
- El `timestamp_server` (calculado en el backend al insertar) es la **verdad absoluta** para todos los cálculos (horas trabajadas, geofencing temporal, cumplimiento de turnos)
- El `timestamp_device` se guarda solo para auditoría y para detectar discrepancias sospechosas
- Si `|timestamp_device - timestamp_server| > 5 minutos` → genera alerta `clock_skew`

### Justificación
- Reloj del cliente es untrustworthy en un modelo anti-fraude
- Server siempre puede sincronizar via NTP

### Consecuencias

- ✅ Imposible manipular cuándo se marca
- ⚠️ Marcas offline llegan con delay, deben aceptarse pero con flag de "delayed sync"

---

## ADR-011: Play Integrity API para attestation

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Necesitamos verificar que el device del guardia: (a) no está rooteado, (b) la app no fue modificada, (c) viene de Play Store oficial.

### Opciones evaluadas

1. **Play Integrity API** (sucesor de SafetyNet, deprecated)
2. **SafetyNet** — deprecado en 2024
3. **Validaciones solo en cliente** — bypasseables
4. **No hacer attestation** — riesgo alto

### Decisión
**Play Integrity API** vía plugin Flutter, con verificación server-side del token contra Google.

### Justificación
- Es la API oficial y soportada por Google
- Token verificable server-side (no se puede falsificar sin tener cuenta dev de Google)
- Comprueba integrity de device + app + cuenta

### Consecuencias

- ✅ Defensa robusta contra devices comprometidos
- ⚠️ Requiere configurar Google Cloud Project + habilitar API
- ⚠️ Tiene cuota (10K requests/día gratis, suficiente para MVP)

---

## ADR-012: Android first, iOS pospuesto

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Decisión de scope: ¿iOS desde el día 1 o solo Android?

### Decisión
**Solo Android en MVP**. iOS queda preparado (carpeta `mobile/ios/` reservada, código Flutter compatible) pero no se compila ni distribuye.

### Justificación
- > 95% de los guardias usan Android (gama baja-media)
- Reduce 40% el trabajo de desarrollo/testing/QA en Fase 2
- Permite ir más rápido al mercado
- Flutter permite agregar iOS después con esfuerzo limitado (semanas, no meses)

### Consecuencias

- ✅ MVP más rápido
- ✅ Foco en una plataforma → mejor calidad
- ⚠️ Si un cliente exige iOS, requiere fase adicional

---

## ADR-013: Alembic para migraciones desde el día 1

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Cómo manejar evolución del schema de DB.

### Decisión
**Alembic** integrado desde el inicio, con:
- Migración inicial que crea TODO el schema
- A partir de ahí, una migración por cambio
- Tests automáticos de upgrade + downgrade en CI

### Justificación
- Estándar de facto para SQLAlchemy
- Versionado del schema en Git
- Reversible (downgrade)
- Sin Alembic, terminaríamos con scripts SQL ad-hoc difíciles de auditar

### Consecuencias

- ✅ Schema reproducible
- ✅ Rollback seguro
- ⚠️ Disciplina requerida: nunca modificar DB sin migración

---

## ADR-014: S3 con SSE-KMS para fotos

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Las fotos faciales son datos biométricos protegidos por ley. Almacenamiento debe estar cifrado.

### Decisión
**Amazon S3** con **SSE-KMS** (Server-Side Encryption con Customer Managed Key), no SSE-S3.

### Justificación
- SSE-KMS permite control total sobre la clave (rotación, revocación, auditoría)
- Las llamadas a KMS quedan en CloudTrail (auditoría regulatoria)
- Diferencia de costo despreciable
- Requisito legal en muchas jurisdicciones para datos biométricos

### Consecuencias

- ✅ Cumplimiento legal
- ✅ Auditoría completa de accesos
- ⚠️ Costo ligeramente mayor (~$0.03/10K requests + costo KMS)
- ⚠️ Si pierdes la clave KMS, pierdes acceso (backup de clave es crítico)

### Alternativa a futuro
Si los costos de egress de S3 se vuelven problemáticos, evaluar **Cloudflare R2** (S3-compatible, zero egress) — requiere ADR aparte.

---

## ADR-015: 3 frames por marca para Liveness

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
AWS Rekognition Face Liveness funciona mejor con secuencias de frames que con foto única.

### Decisión
Capturar **3 frames** durante el challenge (no 1, no 10).

### Justificación
- 1 frame: detecta foto fija pero no video de pantalla
- 3 frames: equilibrio entre detección y costo de upload/almacenamiento
- 10+ frames: marginal mejora en detección, mucho más costo

### Consecuencias

- ✅ Detección robusta
- ⚠️ ~3x espacio en S3 por marca (mitigable con lifecycle a Glacier)

---

## ADR-016: UUID como Primary Key en todas las tablas

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
¿Auto-incremento o UUID como PK?

### Decisión
**UUID v4** (vía `gen_random_uuid()` de Postgres) como PK en todas las tablas.

### Justificación
- IDs no adivinables (security through obscurity adicional)
- Generables en cliente sin conflicto (útil para offline-first)
- Mergeables entre fuentes (futuro multi-cliente)
- Sin enumeración secuencial visible

### Consecuencias

- ✅ Seguridad
- ✅ Compatibilidad con sync offline
- ⚠️ Ligeramente más espacio (16 bytes vs 4-8 de int)
- ⚠️ Índices ligeramente menos eficientes (mitigado con UUID v7 si fuera crítico — evaluar futuro)

---

## ADR-017: Riverpod en Flutter

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
State management para Flutter. Opciones principales: Provider, Riverpod, Bloc, GetX.

### Decisión
**Riverpod 2.x con codegen** (paquetes `flutter_riverpod`, `riverpod_annotation`, `riverpod_generator`).

### Justificación
- Sucesor moderno de Provider (mismo autor, Remi Rousselet)
- Type-safe, compile-time guarantees
- Soporta async naturalmente
- Comunidad creciente, buen tooling (riverpod_lint, custom_lint)
- Curva de aprendizaje menor que Bloc
- Codegen reduce boilerplate

### Consecuencias

- ✅ Inyección de dependencias y estado en un solo sistema
- ✅ Tests fáciles (overrides de providers)
- ⚠️ Requiere correr `build_runner` para generar código

### Cuándo reconsiderar
Si en el futuro un equipo Bloc-experto se suma y la presión por consistencia es fuerte. No vale la pena migrar si Riverpod funciona.

---

## ADR-018: Stack del panel admin web

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
El panel administrativo es el segundo cliente (después de la app móvil) que consumirá la API. Necesitamos un framework moderno, productivo, con buen ecosistema de componentes y rendimiento adecuado para dashboards con muchos datos.

### Opciones evaluadas

1. **Next.js 15 + React 19 + Tailwind** (decidido)
2. **Refine** — framework opinado para admin panels
3. **React-Admin** — pre-construido pero rígido
4. **Vue + Nuxt** — válido pero equipo más fuerte en React
5. **Astro** — excelente performance pero menos apropiado para apps interactivas tipo dashboard

### Decisión
**Next.js 15** (App Router) + **React 19** + **TypeScript estricto** + **Tailwind CSS 3** + **TanStack Query** + **Zod** + componentes estilo **shadcn/ui** (copiables, no como dependencia).

### Justificación
- Next.js es el estándar de facto para React en producción
- App Router moderno + Server Components reducen JS al cliente
- Tailwind + shadcn-style dan velocidad de desarrollo + consistencia visual
- TanStack Query maneja todo el data fetching (cache, retry, optimistic)
- Zod garantiza type safety end-to-end (mismo schema valida API y forms)
- Ecosistema enorme, fácil contratar React devs

### Consecuencias

- ✅ Productividad alta
- ✅ Posibilidad de SSR para SEO/performance (aunque no es crítico en panel privado)
- ✅ Deploy trivial en Vercel
- ⚠️ Tailwind tiene curva inicial pero pagada al toque
- ⚠️ App Router es relativamente nuevo, algunos patrones aún evolucionan

### Componentes shadcn-style
No usaremos shadcn/ui como dependencia npm, sino que **copiaremos componentes a `components/ui/`** para tener control total sobre el código. Es el patrón que promueve shadcn.

---

## ADR-019: Conventional Commits + trunk-based development

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Necesitamos definir cómo escribimos commits y cómo se ramifica el código para soportar trabajo en paralelo de múltiples desarrolladores en el monorepo.

### Decisión

**Convención de commits:** [Conventional Commits](https://www.conventionalcommits.org/es/)
- Formato: `<tipo>(<scope>): <descripción>`
- Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, etc.
- Scopes: `backend`, `mobile`, `admin-web`, `docs`, `auth`, `marcas`, etc.

**Branching:** trunk-based development con feature branches cortas
- `main` siempre desplegable (protegida)
- Feature branches: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`
- Vida máxima de branch: 5 días
- Squash and merge a `main`

### Justificación
- **Conventional Commits** permite generar changelogs automáticos y entender la historia rápidamente
- **Trunk-based** evita integration hell de gitflow; obliga a integraciones frecuentes
- Branches cortas + squash mantienen historia limpia
- Compatible con CI/CD continuo

### Consecuencias

- ✅ Mensajes consistentes, historia legible
- ✅ Posibilidad futura de automatizar releases (semantic-release)
- ✅ Menos conflictos de merge
- ⚠️ Requiere disciplina del equipo (especialmente al inicio)
- ⚠️ PRs deben ser pequeños y enfocados

### Documentado en
[CONTRIBUTING.md](../CONTRIBUTING.md) con ejemplos completos.

---

## ADR-020: Estructura híbrida de `database/` (Alembic + vistas + seeds + manual_ops)

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
Un dev del equipo trae experiencia de su empresa actual donde manejan la base de datos con una convención **`explore` / `build` / `publish`** y separación **DDL/DML** (DDL auto-aplicado en CI/CD, DML con gate manual). El patrón viene de data engineering (Snowflake, BigQuery, Databricks) y resuelve dos problemas reales:

1. Separar cambios de **bajo riesgo** (auto-aplicables) de cambios **destructivos** (con gate humano)
2. Tener una convención **clara y compartida** que un dev nuevo entiende rápido

El reto es que Smart Control Security es un **sistema OLTP transaccional** (no un data warehouse), donde:
- Las migraciones son **secuenciales y versionadas** (no snapshot-based)
- Schema y datos se mezclan en migraciones (ej. `ALTER + UPDATE + ALTER` para columnas NOT NULL)
- Ya elegimos **Alembic** como herramienta de migración (ADR-013)

### Opciones evaluadas

1. **Replicar exacto** el patrón `explore/build/publish + ddl/dml` con scripts SQL puros y abandonar Alembic
2. **Ignorar** el patrón y quedarnos solo con Alembic (lo que teníamos)
3. **Híbrido**: tomar la filosofía del patrón (separar auto vs manual, tener sandbox, separar capas) pero implementarla con las herramientas correctas para OLTP

### Decisión
**Híbrido (opción 3):** crear `backend/database/` con subdirectorios que mapean los conceptos del patrón empresarial al stack Python/SQLAlchemy/PostgreSQL.

```text
backend/database/
├── migrations/      ← Alembic (estructura) — auto en CI/CD
├── views/           ← CREATE OR REPLACE VIEW — auto en CI/CD
├── analytics/       ← MATERIALIZED VIEW (drop+create) — auto en CI/CD
├── seeds/           ← INSERT ... ON CONFLICT — auto en CI/CD
├── init/            ← Extensiones de Postgres — una vez por DB
├── manual_ops/      ← DML destructivo — manual con aprobación
└── explore/         ← Sandbox del dev — solo local
```

### Mapeo con el patrón empresarial

| Patrón empresarial | Aquí | Tipo de cambio | Ejecución |
|---|---|---|:---:|
| `explore/` | `explore/` | Experimentos del dev | Solo local |
| `build/ddl/` | `migrations/` | Estructura del schema | Auto |
| `build/dml/` | `seeds/` | Datos catálogo | Auto |
| `publish/ddl/` | `views/` + `analytics/` | Capa expuesta | Auto |
| `publish/dml/` | `manual_ops/` | Cambios sensibles | Manual con 2 aprobaciones |

### Justificación

- **Respeta la filosofía** del patrón empresarial (separar auto vs manual, sandbox, capas claras)
- **Usa Alembic** que es lo correcto para OLTP con SQLAlchemy (versionado, rollback, autogenerate)
- **Idempotencia donde aplica**: vistas y seeds se re-aplican sin daño en cada deploy
- **Gate humano para lo peligroso**: `manual_ops/` requiere PR + 2 reviewers + GitHub Environment approval
- **Auditoría**: cada operación manual queda como artifact en GitHub Actions por 365 días
- **Onboarding rápido** para devs que vienen del patrón empresarial: estructura familiar

### Consecuencias

- ✅ Devs internos y externos entienden la estructura sin explicación larga
- ✅ Cambios estructurales seguros (`CREATE TABLE`, `CREATE INDEX`) van solos a producción
- ✅ Cambios destructivos (`DROP COLUMN`, `UPDATE` masivo) imposibles de ejecutar accidentalmente
- ✅ Las vistas del panel admin tienen un hogar claro y versionado
- ✅ Reportes pesados (materialized views) tienen su propio espacio sin contaminar OLTP
- ⚠️ Más directorios que aprender al inicio (mitigado con README en cada uno)
- ⚠️ Requiere disciplina: usar el directorio correcto según el tipo de cambio (mitigado con templates y CONTRIBUTING.md)
- ⚠️ Dos workflows de CI/CD para BD (auto-migrate + manual-ops) en vez de uno (aceptable)

### Documentado en
- [`backend/database/README.md`](../backend/database/README.md) — guía maestra
- README específico en cada subdirectorio (`migrations/`, `views/`, `analytics/`, `seeds/`, `manual_ops/`, `explore/`, `init/`)
- [`.github/workflows/database-auto-migrate.yml`](../.github/workflows/database-auto-migrate.yml)
- [`.github/workflows/database-manual-ops.yml`](../.github/workflows/database-manual-ops.yml)
- [CONTRIBUTING.md](../CONTRIBUTING.md) (sección de DB)

### Notas
Esta decisión NO reemplaza el ADR-013 (Alembic), lo complementa. Alembic sigue siendo la herramienta de migraciones de schema; los otros directorios son capas adicionales que cubren casos que Alembic no maneja idiomáticamente (vistas idempotentes, seeds idempotentes, scripts manuales auditables).

---

## ADR-021: Demo web previo a la app nativa

**Estado:** ✅ Aceptado
**Fecha:** 2026-06

### Contexto
El cliente quiere ver un demo del producto en **1-2 semanas**. La app nativa Android (Fase 2 del roadmap) requiere 8-12 semanas. Necesitamos algo que muestre el valor de la solución sin esperar tanto.

Adicionalmente, tenemos un repo de referencia (`rotatudisfraz`) que ya tiene resuelto el patrón Next.js 15 + AWS S3 + Vercel, lo que acelera el arranque.

### Opciones evaluadas

1. **No hacer demo, esperar la app nativa** — perdemos al cliente o credibilidad
2. **Demo en Flutter Web** — Flutter Web es inmaduro para producción, peor para demo crítico
3. **Mockup en Figma navegable** — no es funcional, no muestra el valor real (cámara, GPS, fraude)
4. **Web responsive (Next.js)** ✅ — funcional, rápido, reusa patrones de `rotatudisfraz`
5. **Prototipo con Adalo / Bubble** — vendor lock-in + no reusable

### Decisión
**Demo web responsive con Next.js 15 + Vercel + Neon Postgres + AWS S3.**

Vive en `smart_control_security/demo-web/` dentro del monorepo.

### Justificación

- **Velocidad de armado:** 12-15 días hábiles vs 8-12 semanas de la app nativa
- **Funcional de verdad:** captura cámara, GPS, sube a S3, valida geofence server-side
- **Mismo stack que el panel admin futuro:** TypeScript + Next.js + Tailwind + Postgres
- **Reusable:** las APIs y modelo de datos sirven para la app nativa después
- **Patrón validado:** `rotatudisfraz` ya tiene S3 + Next.js + Vercel funcionando
- **Costo cero:** Vercel free + Neon free + S3 centavos/mes
- **Cliente accede sin instalar nada:** abre URL en celular, listo

### Consecuencias

- ✅ Cliente ve algo tangible en 2 semanas
- ✅ Validamos UX y flujos antes de invertir en lo nativo
- ✅ APIs y modelo de datos quedan diseñados para la app nativa
- ✅ El equipo puede iterar rápido (deploy en 1 click a Vercel)
- ⚠️ Demo NO tiene capas de seguridad nativas (liveness real, anti-spoofing GPS, device attestation, offline real). Esto se comunica explícitamente al cliente.
- ⚠️ Web tiene limitaciones de cámara/GPS en interiores (mitigable mostrando precisión)
- ⚠️ Stack del demo (Prisma + Next.js API routes) **no es** el stack del backend final (FastAPI + SQLAlchemy + Alembic). El demo es desechable como código, pero su modelo de datos es válido.

### Trade-offs explícitos vs producción

| Capa | Demo | Producción |
|---|---|---|
| Frontend | Next.js mobile-first web | Flutter Android nativo |
| Backend | Next.js API routes (Node) | FastAPI (Python) |
| DB | Neon Postgres + Prisma | Postgres+PostGIS + SQLAlchemy + Alembic |
| Storage | AWS S3 directo | AWS S3 con SSE-KMS + presigned URLs |
| Auth | NextAuth credentials mock | JWT + refresh + device binding + HMAC |
| Liveness | NO (solo captura selfie) | AWS Rekognition Face Liveness real |
| GPS | Browser geolocation | Sensores nativos + Play Integrity |
| Offline | NO | SQLite local + sync workers |

### Documentado en
- [`docs/demo-web-plan.md`](./demo-web-plan.md) — Plan completo del demo
- [`demo-web/README.md`](../demo-web/README.md) — Cómo correrlo

### Notas
El demo es **complementario** al roadmap, no lo reemplaza. La app nativa sigue siendo el producto final. El demo sirve como (1) validación rápida con el cliente, (2) prototipo de UX, (3) referencia para las APIs que el backend Python implementará después.

---

## Cómo agregar un nuevo ADR

1. Agregar entrada en la tabla "Índice de ADRs" arriba
2. Crear una nueva sección con el formato `## ADR-XXX: Título`
3. Llenar campos: Estado, Fecha, Contexto, Opciones evaluadas, Decisión, Justificación, Consecuencias
4. PR aparte para discusión asíncrona del equipo
5. Mergear cuando haya consenso

---

## Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md)
- 🏛️ [`arquitectura.md`](./arquitectura.md)
- 🛡️ [`seguridad.md`](./seguridad.md)
- 🗓️ [`roadmap-fases.md`](./roadmap-fases.md)
