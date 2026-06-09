# 📐 Plan Maestro — Smart Control Security

> **Documento padre de todo el proyecto.** Cualquier decisión, funcionalidad o fase descrita en otros documentos debe ser consistente con este plan. Si algo cambia, este plan cambia primero.

---

## 1. Visión

> _Construir el sistema de control de asistencia más confiable del mercado para empresas de seguridad privada, eliminando el fraude laboral mediante validación biométrica server-side, geolocalización a prueba de manipulación, y operación robusta en zonas sin conectividad._

---

## 2. Problema a resolver

Las empresas de seguridad enfrentan **fraude laboral sistemático** que las soluciones tradicionales (relojes biométricos, llamadas, planillas, apps básicas) no resuelven:

| Tipo de fraude | Mecanismo común | Costo para la empresa |
|---|---|---|
| **Suplantación de identidad** | Un guardia marca por otro (con foto antigua, foto en pantalla, máscara) | Pagar a personal ausente |
| **Foto falsa** | Subida desde galería en vez de cámara en vivo | Validación nula del registro |
| **GPS spoofing** | Apps de "Fake GPS" simulan estar en el puesto cuando están en casa | Abandono de puesto no detectado |
| **Marcas duplicadas / reenviadas** | Interceptar y reproducir requests válidos | Falsificación masiva de asistencia |
| **Dispositivo comprometido** | Root/jailbreak para bypassear seguridad de la app | Anulación de todos los controles |
| **Manipulación del reloj** | Cambio de fecha/hora del device para alterar timestamps | Marcas fuera de turno aparentando ser válidas |
| **Pérdida de marcas legítimas** | Sin internet → la marca se pierde | Disputas laborales, conflictos sindicales |

**Nuestro sistema ataca cada uno de estos vectores** mediante una combinación de validaciones cliente + servidor, con la regla de oro **"Never trust the client"**.

---

## 3. Usuarios objetivo

### 3.1 Usuarios primarios

| Rol | Descripción | Plataforma |
|---|---|---|
| **Guardia de seguridad** | Personal en terreno que registra sus marcas de asistencia | App móvil Android |
| **Supervisor** | Monitorea a los guardias bajo su cargo, revisa alertas, valida marcas dudosas | Panel web (fase futura) |
| **Administrador** | Configura puestos, asigna turnos, gestiona empleados, genera reportes | Panel web (fase futura) |

### 3.2 Características clave del usuario primario (guardia)

- Trabaja en **terreno**, frecuentemente en sótanos, almacenes, parqueaderos, zonas remotas con conectividad pobre.
- Usa típicamente un **Android de gama baja a media** (Android 9+).
- Puede tener guantes, condiciones de baja luz, lluvia.
- No es necesariamente "técnico" — la app debe ser **simple, robusta y a prueba de errores**.
- Trabaja en turnos rotativos (mañana, tarde, noche, 24 horas).

---

## 4. Alcance

### 4.1 Qué SÍ está dentro del alcance (MVP + Fases 1-4)

✅ Registro de marcas de asistencia con foto + GPS desde app móvil Android
✅ Operación 100% offline-first con sincronización automática
✅ Bloqueo de galería, detección de Mock GPS, detección de root, attestation
✅ Validación biométrica server-side (Liveness + Face Matching)
✅ Geofencing por puesto asignado
✅ Cálculo en tiempo real de saltos GPS imposibles
✅ Almacenamiento de fotos en S3 con cifrado at-rest
✅ Cálculo de horas trabajadas, refrigerios, ausencias (analítica Pandas)
✅ Alertas automáticas por correo a supervisores (SendGrid)
✅ Notificaciones push al guardia (Firebase)
✅ Reportes exportables a Excel
✅ Sistema de autenticación robusto (JWT + refresh tokens)
✅ Cumplimiento legal de datos biométricos (consentimiento, encriptación, retención)

### 4.2 Qué NO está dentro del alcance (excluido del MVP)

❌ Soporte iOS (la arquitectura lo permite pero no se desarrolla en MVP)
❌ Panel administrativo web — pospuesto a Fase 5
❌ Chat / mensajería entre guardias o con supervisores
❌ Integración con relojes biométricos físicos
❌ Integración con sistemas de nómina externos (vendrá vía API en fase posterior)
❌ Versión web para guardias (la app móvil es la única vía)
❌ Soporte multi-idioma — solo español en MVP
❌ Marcación por NFC o QR (queda como mejora futura)

---

## 5. Objetivos de éxito (KPIs)

### 5.1 Métricas técnicas

| KPI | Meta MVP |
|---|---|
| Tasa de marcas sincronizadas exitosamente | ≥ 99% |
| Tasa de detección de fraude facial (Liveness) | ≥ 95% |
| Falsos positivos de Liveness | ≤ 2% |
| Tiempo de respuesta del endpoint de marca | < 800ms (p95) |
| Disponibilidad del backend | ≥ 99.5% mensual |
| Tasa de marcas pendientes > 24h sin sincronizar | < 0.5% |
| Tamaño de la app móvil | < 30 MB |

### 5.2 Métricas de negocio

| KPI | Meta MVP |
|---|---|
| Reducción de marcas fraudulentas vs. sistema actual del cliente | ≥ 80% |
| Tiempo promedio de marcado (desde abrir app hasta confirmación) | < 30 segundos |
| Tasa de adopción por parte de guardias entrenados | ≥ 90% en 2 semanas |
| Alertas de fraude que efectivamente correspondan a fraude real | ≥ 70% |

---

## 6. Componentes del sistema (visión de alto nivel)

```text
┌──────────────────────────┐
│   📱 App móvil Android   │   Flutter
│   (Guardias)             │
└──────────┬───────────────┘
           │ HTTPS + Cert Pinning + HMAC Signing
           ▼
┌──────────────────────────┐
│   🚪 API Gateway / NGINX │   (Rate limiting, SSL termination)
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│   ⚙️  Backend FastAPI    │   Python 3.11+
│   - Auth, Marcas, Users  │
│   - Validaciones         │
└─┬─────────┬────────┬────┬┘
  │         │        │    │
  ▼         ▼        ▼    ▼
┌─────┐  ┌─────┐ ┌─────┐ ┌──────┐
│ DB  │  │ S3  │ │ Redis│ │ Rekog│
│PgSQL│  │     │ │      │ │nition│
│PostGIS│ │KMS  │ │ Arq  │ │Liveness
└─────┘  └─────┘ └──┬───┘ └──────┘
                    │
                    ▼ (background jobs)
              ┌──────────────┐
              │ 📊 Analytics │   Pandas
              │ ✉️ SendGrid  │
              │ 🔔 Firebase  │
              └──────────────┘

[Fase futura]
┌──────────────────────────┐
│   🖥 Panel Admin Web    │   Next.js
│   (Supervisores / Admin) │
└──────────────────────────┘
```

Detalles completos en [`arquitectura.md`](./arquitectura.md).

---

## 7. Plan de fases (resumen ejecutivo)

| Fase | Nombre | Duración est. | Entregable |
|---|---|---|---|
| **1** | Backend base e infraestructura de datos | 2-3 semanas | API FastAPI funcional con CRUD básico, conexión PostgreSQL/PostGIS, subida a S3, auth JWT, CI |
| **2** | App móvil Flutter | 3-4 semanas | App Android instalable con captura foto/GPS, modo offline, sincronización, todas las protecciones cliente |
| **3** | Capa de seguridad biométrica (IA) | 2 semanas | Integración AWS Rekognition Face Liveness + Face Matching, validación end-to-end |
| **4** | Analítica y alertas | 2 semanas | Pandas para horas/refrigerio, PostGIS para fraude GPS, SendGrid alertas, reportes Excel |
| **5** _(futura)_ | Panel admin web | 3-4 semanas | Dashboard Next.js para supervisores |

**Duración total estimada del MVP (Fases 1-4): 9-11 semanas.**

Detalle completo de cada fase con tareas, dependencias y criterios de aceptación en [`roadmap-fases.md`](./roadmap-fases.md).

---

## 8. Riesgos identificados y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | AWS Rekognition Face Liveness tiene falsos positivos altos en pieles oscuras o iluminación pobre | Media | Alto | Probar con dataset real antes de Fase 3; tener fallback de revisión manual desde panel admin |
| R2 | Costo de AWS escala más rápido de lo esperado (Rekognition + S3 + RDS) | Media | Medio | Monitoreo de costos desde día 1 con AWS Budgets + alertas; preparar migración a Cloudflare R2 como plan B |
| R3 | Guardias con devices muy antiguos no soportan Play Integrity ni ML Kit | Media | Medio | Definir baseline mínimo de Android (sugerido: Android 9 / API 28); validar con cliente |
| R4 | Plugins de Flutter de seguridad quedan sin mantenimiento | Baja | Medio | Elegir plugins con > 1000 likes y commits recientes; aislar dependencias detrás de interfaces propias |
| R5 | Conectividad pobre causa colas locales muy grandes que afectan rendimiento del device | Media | Alto | Limitar tamaño de fotos (compresión a ~200KB), límite de N marcas pendientes con purga FIFO, sincronización adaptativa |
| R6 | Cambios regulatorios de protección de datos biométricos | Baja | Alto | Diseñar con cumplimiento desde día 1 (consentimiento, retención, derecho al olvido); revisión legal antes de prod |
| R7 | Resistencia al cambio de los guardias (sienten que los espían más) | Alta | Medio | UX clara: el guardia ve sus propias marcas, sabe qué se valida, política de transparencia |
| R8 | Falla del backend → guardias no pueden marcar → conflicto laboral | Baja | Crítico | Modo offline robusto, SLA 99.5%, monitoreo 24/7, backups automáticos de RDS |
| R9 | Reverse engineering del cliente revela el secreto HMAC | Media | Medio | Clave única por device generada en login (no embebida), rotación periódica, attestation server-side |
| R10 | Equipo no tiene experiencia previa con alguno del stack (Flutter, FastAPI, PostGIS) | Variable | Variable | Spike técnico al inicio de cada fase, code review riguroso, documentación inline |

---

## 9. Decisiones técnicas clave ya tomadas

Estas son decisiones **cerradas** (con justificación en [`decisiones-tecnicas.md`](./decisiones-tecnicas.md)):

| Decisión | Elección |
|---|---|
| Framework móvil | **Flutter** (no Kotlin nativo, no React Native) |
| Plataforma inicial | **Android only** (iOS preparado vía Flutter pero no implementado en MVP) |
| Liveness Detection | **AWS Rekognition Face Liveness** (no OpenCV puro) |
| Cálculo geoespacial | **PostGIS** (no Pandas para tiempo real) |
| Auth | **JWT con refresh tokens** |
| Anti-replay | **HMAC-SHA256 con nonce + timestamp** firmado por device |
| Attestation | **Play Integrity API** (Android) |
| Almacenamiento de fotos | **S3 con SSE-KMS** (evaluar R2 según costos) |
| Migraciones BD | **Alembic** |
| Observabilidad | **structlog + Sentry** |
| CI/CD | **GitHub Actions** |
| Estructura | **Monorepo** (backend/ + mobile/ + admin-web/) |

---

## 10. Decisiones pendientes (TODO)

Estas decisiones se tomarán cuando lleguemos a la fase correspondiente:

- [ ] Proveedor de email: SendGrid vs AWS SES (evaluar en Fase 4 según volumen esperado)
- [ ] Hosting del backend: AWS App Runner vs ECS Fargate vs Fly.io (decidir antes de primer deploy)
- [ ] Versión mínima de Android soportada (sugerido API 28 = Android 9; confirmar con cliente)
- [ ] Política de retención de fotos (sugerido: 90 días por defecto; depende de marco legal del cliente)
- [ ] Estrategia de internacionalización si llega a expandirse (no relevante en MVP)
- [ ] Almacenamiento alternativo S3 vs Cloudflare R2 (evaluar al estimar costos reales)
- [ ] Proveedor de mapas para panel web: Mapbox vs Leaflet+OSM (decidir según costo en Fase 5)
- [ ] Definir LICENSE oficial del proyecto (privada por defecto)

### Decisiones ya resueltas (movidas a [`decisiones-tecnicas.md`](./decisiones-tecnicas.md))

- ✅ Manejo de estado en Flutter: **Riverpod 2.x con codegen** (ADR-017, confirmado al crear scaffold mobile)
- ✅ Stack del panel admin: **Next.js 15 + React 19 + TypeScript + Tailwind + shadcn-style** (decidido al crear scaffold admin-web)
- ✅ Convención de commits: **Conventional Commits** (documentado en CONTRIBUTING.md)
- ✅ Branching strategy: **Trunk-based con feature branches cortas** (documentado en CONTRIBUTING.md)

---

## 11. Equipo y responsabilidades

_(Pendiente de definir según contratación.)_

Roles mínimos sugeridos para ejecutar el MVP:

- **1× Tech Lead / Arquitecto** (parte de tiempo) — Revisión de PRs, decisiones técnicas
- **1× Backend Developer Senior (Python)** — Fases 1, 3, 4
- **1× Mobile Developer (Flutter)** — Fase 2 y soporte continuo
- **1× DevOps / Cloud Engineer** (parte de tiempo) — Infraestructura AWS, CI/CD
- **1× Diseñador UX/UI** (parte de tiempo) — Pantallas móvil + panel futuro
- **1× QA** (parte de tiempo) — Pruebas en device físico, casos de fraude simulados

---

## 12. Glosario

| Término | Significado |
|---|---|
| **Liveness Detection** | Validación de que la persona frente a la cámara es real y está viva (no foto, video, máscara) |
| **Face Matching** | Comparación 1:1 entre foto capturada y foto de referencia del empleado |
| **Mock Location / Fake GPS** | App que simula coordenadas GPS falsas |
| **Geofencing** | Verificar si un punto GPS está dentro de un polígono geográfico definido (el puesto del guardia) |
| **Attestation** | Prueba criptográfica de que un device no ha sido manipulado (Play Integrity API en Android) |
| **HMAC** | Hash-based Message Authentication Code — firma criptográfica de un mensaje con una clave compartida |
| **Cert Pinning** | Cliente solo confía en un certificado SSL específico, no en CAs públicas — anti-MITM |
| **Replay Attack** | Atacante intercepta una request válida y la reenvía múltiples veces |
| **PostGIS** | Extensión de PostgreSQL para datos geoespaciales |
| **ETL** | Extract, Transform, Load — procesamiento batch de datos |
| **ADR** | Architecture Decision Record — documento corto que registra una decisión arquitectónica |
| **MVP** | Minimum Viable Product |

---

## 13. Documentos relacionados

- 🏛️ [`arquitectura.md`](./arquitectura.md) — Arquitectura técnica detallada
- 📱 [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md) — Detalle de la app Android
- ⚙️ [`funcionalidades-backend.md`](./funcionalidades-backend.md) — Detalle del backend
- 🖥 [`funcionalidades-admin-web.md`](./funcionalidades-admin-web.md) — Detalle del panel web
- 🗃️ [`modelo-datos.md`](./modelo-datos.md) — Modelo de datos
- 🛡️ [`seguridad.md`](./seguridad.md) — Estrategia de seguridad
- 🗓️ [`roadmap-fases.md`](./roadmap-fases.md) — Plan de ejecución por fases
- 🧠 [`decisiones-tecnicas.md`](./decisiones-tecnicas.md) — ADRs
- 🤝 [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — Guía de contribución

---

**Última actualización:** Junio 2026
**Versión del plan:** v1.0
