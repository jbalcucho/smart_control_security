# 🎬 Plan del Demo Web — Smart Control Security

> **Objetivo:** entregar un demo funcional para el cliente en **1-2 semanas** que muestre el flujo completo de la solución, sin necesidad de tener la app nativa Android/iOS lista.

---

## 1. ¿Qué es este demo?

Es una **web responsive** (mobile-first) que simula la futura app móvil del guardia + el panel del supervisor. Se despliega en **Vercel**, usa **AWS S3** para fotos y **Neon Postgres** como base de datos.

> No es la versión final del producto. Es un prototipo navegable que demuestra el valor de la solución y permite al cliente probar los flujos clave en su celular abriendo una URL.

---

## 2. ¿Por qué un demo web y no la app nativa?

| Razón | Detalle |
|---|---|
| ⏱️ **Tiempo** | La app Android nativa requiere 8-12 semanas (Fase 2 del roadmap). El cliente quiere ver algo en 1-2 semanas. |
| 🎯 **Foco** | Validar la propuesta de valor (flujo, UX, anti-fraude visible) sin invertir en lo nativo aún. |
| 📱 **Acceso** | El cliente abre la URL en su celular y ya. No hace falta instalar nada, ni publicar en stores. |
| 💸 **Costo** | Vercel + Neon free tier + S3 (pocos centavos/mes para demo). |
| 🔄 **Reusable** | Las APIs y el modelo de datos que armemos sirven después para la app nativa. |

---

## 3. Decisiones de stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Mismo stack que el panel admin futuro. Vercel-native. |
| Estilos | **Tailwind CSS 4** | Mobile-first ágil. Mismo del admin-web. |
| Base de datos | **Neon Postgres (serverless)** | Free tier generoso. Mismo Postgres que producción. Soporta PostGIS si lo necesitamos. |
| ORM | **Prisma 5** | Schema declarativo, type-safety end-to-end, migrations integradas. |
| Auth | **NextAuth.js v5** (CredentialsProvider) | Email + password con 3 usuarios mock precargados. |
| Storage | **AWS S3** | Mismo patrón del repo `rotatudisfraz` (probado). |
| Mapa | **Leaflet** + **OpenStreetMap tiles** | Gratis, sin API key, simple. |
| Hashing | **bcryptjs** | Para contraseñas mock. |
| Validación | **Zod** | Validación de inputs en API + forms. |
| Deploy | **Vercel** | 1-click deploy + edge network. |

### Stack que NO usamos en el demo (y sí en producción)

| No usado | ¿Por qué? | Cuándo entra |
|---|---|---|
| FastAPI (backend Python) | El demo necesita ser rápido de armar. Next.js API routes son suficientes. | Cuando empecemos la app nativa de verdad (Fase 2+). |
| Alembic | Prisma maneja migrations en el demo. | Cuando migremos al backend Python. |
| AWS Rekognition (Liveness real) | Requiere SDK nativo o componente web pago. | App nativa (Fase 3). |
| Play Integrity | Android-only. | App nativa (Fase 2). |
| HMAC signing | Sobre-ingeniería para demo. | App nativa (Fase 2). |
| Redis + Arq | No hay background jobs en el demo. | Backend Python (Fase 1.4). |
| PostGIS | Calculamos distancia con Haversine en JS. Para demo es suficiente. | Backend Python (Fase 1.2). |

---

## 4. Funcionalidades del demo (Must-Have)

### 🔐 Autenticación

- Login con **email + contraseña** (3 usuarios mock precargados)
- Sesión persistente con NextAuth
- Logout
- Middleware que redirige según rol

**Usuarios precargados:**

| Email | Password | Rol | Vista |
|---|---|---|---|
| `guardia1@demo.com` | `demo1234` | guardia | Vista mobile (marcaje + historial) |
| `guardia2@demo.com` | `demo1234` | guardia | Vista mobile |
| `supervisor@demo.com` | `demo1234` | supervisor | Vista desktop (dashboard + mapa) |

### 👮 Vista Guardia (mobile-first)

```text
┌─────────────────────────┐
│   Buenos días, Juan     │
│   Puesto: Sede Norte    │  ← Pantalla home
│   Turno: 6am - 2pm      │
│                         │
│   [📷 Marcar entrada]  │  ← Botón grande de acción
│                         │
│   Próxima marca:        │
│   Salida 14:00 (en 3h)  │
└─────────────────────────┘
```

**Flujo de marcaje (la estrella del demo):**

1. Click en "Marcar entrada"
2. Solicita permisos de cámara + GPS
3. Captura selfie en vivo (cámara frontal)
4. Captura GPS en background
5. Verifica geofence (¿está dentro de 100m del puesto?)
6. Sube foto a S3
7. Guarda registro en DB
8. Muestra confirmación: ✅ "Marca registrada" o ⚠️ "Fuera de zona, alerta enviada"

**Historial:**
- Lista de marcas del guardia con thumbnails
- Cada marca muestra: hora, ubicación, estado (✅ válida / ⚠️ alerta)
- Click en una marca → detalle con foto grande y mini-mapa

### 👨‍💼 Vista Supervisor (desktop)

**Dashboard:**
- Tabla de últimas 50 marcas (refresh cada 5s con polling)
- Filtros: guardia, fecha, estado (válida / fraude)
- Indicadores: total marcas hoy, alertas, % cumplimiento

**Mapa:**
- Mapa Leaflet con puestos (círculos del geofence)
- Pins de las marcas (colores por estado)
- Click en pin → mini-card con foto y datos del guardia

**Alertas en tiempo real:**
- Banner rojo cuando llega una alerta nueva
- Si una marca está fuera del geofence → genera alerta automática
- Lista de alertas pendientes para "atender"

---

## 5. Funcionalidades NO incluidas en el demo

Esto es CRÍTICO ser transparentes con el cliente:

| ❌ No incluido | ¿Por qué? | Dónde sí va |
|---|---|---|
| **Liveness real** (detección de foto vs persona real) | Requiere componente nativo o servicio pago | App nativa + AWS Rekognition (Fase 3) |
| **Validación de "1 device por guardia"** | Browser no expone hardware ID confiable | App nativa con device fingerprint |
| **Modo offline real** | El demo requiere internet | App nativa con SQLite local |
| **Notificaciones push reales** | Vercel + web push es complejo de configurar para demo | App nativa con FCM |
| **Detección anti-spoofing GPS** | Browser no detecta mock locations | App nativa con sensores físicos |
| **Validación HMAC + nonce** | Sobre-ingeniería para demo | App nativa |

> **Lo que diremos al cliente:** "El demo prueba el flujo y el valor. La app nativa agregará las capas de seguridad que verán acá [→ docs/seguridad.md] y que el browser no puede dar."

---

## 6. Modelo de datos del demo

Subset simplificado del modelo de producción ([`modelo-datos.md`](./modelo-datos.md)):

```prisma
User {
  id        String  @id @default(cuid())
  email     String  @unique
  password  String              // hash bcrypt
  nombre    String
  rol       Role                // GUARDIA | SUPERVISOR | ADMIN
  puestoId  String?             // si es GUARDIA
  puesto    Puesto? @relation(...)
  marcas    Marca[]
}

Puesto {
  id              String  @id @default(cuid())
  nombre          String              // "Sede Norte"
  direccion       String
  latitud         Float
  longitud        Float
  radioGeofenceM  Int     @default(100)
  guardias        User[]
  marcas          Marca[]
}

Marca {
  id                String        @id @default(cuid())
  userId            String
  puestoId          String
  tipo              TipoMarca     // ENTRADA | SALIDA
  fotoUrl           String        // URL pública S3
  latitud           Float
  longitud          Float
  distanciaPuestoM  Float                 // calculada al insertar
  dentroDelGeofence Boolean
  esFraude          Boolean       @default(false)
  motivoFraude      String?
  timestampCliente  DateTime              // del navegador
  timestampServidor DateTime      @default(now())
  user              User    @relation(...)
  puesto            Puesto  @relation(...)
  alerta            Alerta?
}

Alerta {
  id        String        @id @default(cuid())
  marcaId   String        @unique
  tipo      TipoAlerta    // FUERA_GEOFENCE | DEVICE_NUEVO | ...
  severidad Severidad     // BAJA | MEDIA | ALTA
  resuelta  Boolean       @default(false)
  marca     Marca   @relation(...)
}

enum Role { GUARDIA SUPERVISOR ADMIN }
enum TipoMarca { ENTRADA SALIDA }
enum TipoAlerta { FUERA_GEOFENCE FOTO_INVALIDA HORARIO_FUERA_TURNO }
enum Severidad { BAJA MEDIA ALTA }
```

> Cuando migremos al backend Python en producción, este modelo es **subset** del de [`modelo-datos.md`](./modelo-datos.md). Compatible al 100%.

---

## 7. Estructura del código

```text
smart_control_security/
└── demo-web/
    ├── README.md
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── .eslintrc.json
    ├── .prettierrc.json
    ├── .env.example
    ├── .gitignore
    │
    ├── prisma/
    │   ├── schema.prisma            ← Modelo de datos
    │   ├── seed.ts                  ← 3 usuarios + 2 puestos demo
    │   └── migrations/              ← Generadas por Prisma
    │
    ├── public/
    │   └── icons/                   ← Iconos PWA (opcional)
    │
    └── src/
        ├── app/
        │   ├── layout.tsx           ← Root layout
        │   ├── globals.css          ← Tailwind + custom
        │   ├── page.tsx             ← Login
        │   │
        │   ├── (guardia)/           ← Route group: vista guardia
        │   │   ├── layout.tsx       ← Mobile-first container
        │   │   ├── home/page.tsx
        │   │   ├── marcar/page.tsx  ← Cámara + GPS + upload
        │   │   └── historial/
        │   │       ├── page.tsx     ← Lista de marcas
        │   │       └── [id]/page.tsx ← Detalle de marca
        │   │
        │   ├── (supervisor)/        ← Route group: vista supervisor
        │   │   ├── layout.tsx       ← Desktop layout
        │   │   ├── dashboard/page.tsx
        │   │   ├── mapa/page.tsx
        │   │   └── alertas/page.tsx
        │   │
        │   └── api/
        │       ├── auth/[...nextauth]/route.ts
        │       ├── marcas/
        │       │   ├── route.ts         ← GET (lista) + POST (crear)
        │       │   └── [id]/route.ts
        │       ├── puestos/route.ts
        │       ├── upload/route.ts      ← POST → S3
        │       └── alertas/route.ts
        │
        ├── components/
        │   ├── ui/                  ← Botones, Card, Input
        │   ├── guardia/
        │   │   ├── MarcaCamera.tsx
        │   │   ├── GPSStatus.tsx
        │   │   ├── ConfirmacionMarca.tsx
        │   │   └── HistorialItem.tsx
        │   ├── supervisor/
        │   │   ├── MarcasTable.tsx
        │   │   ├── MapaMarcas.tsx
        │   │   └── AlertasPanel.tsx
        │   └── shared/
        │       ├── Header.tsx
        │       └── BottomNav.tsx
        │
        ├── lib/
        │   ├── auth.ts              ← NextAuth config + helpers
        │   ├── prisma.ts            ← Cliente singleton
        │   ├── s3.ts                ← Upload + presigned URLs
        │   ├── geofence.ts          ← Haversine
        │   ├── utils.ts
        │   └── validations.ts       ← Schemas Zod
        │
        ├── middleware.ts            ← Auth + redirección por rol
        │
        └── types/
            └── index.ts
```

---

## 8. Plan de ejecución por sprint

### Sprint Demo 0 — Foundation (1 día)
- [x] Plan documentado
- [ ] Scaffold de `demo-web/` (configs, package, lint)
- [ ] Prisma schema + seed
- [ ] Setup Neon Postgres + variables de entorno
- [ ] Deploy mínimo a Vercel ("Hola mundo")

### Sprint Demo 1 — Auth + Navegación (2 días)
- [ ] NextAuth con CredentialsProvider
- [ ] Página de login funcional
- [ ] Middleware de protección de rutas
- [ ] Layouts diferenciados (guardia mobile / supervisor desktop)
- [ ] BottomNav para guardia / Sidebar para supervisor
- [ ] Pantalla home del guardia con datos reales

### Sprint Demo 2 — Marcaje (3-4 días) ⭐ CORE
- [ ] Componente `MarcaCamera` con `getUserMedia`
- [ ] Componente `GPSStatus` con `navigator.geolocation`
- [ ] Cálculo de distancia al puesto (Haversine)
- [ ] Upload a S3 vía API route
- [ ] Guardado de marca en DB con flag `dentroDelGeofence`
- [ ] Generación automática de alerta si está fuera
- [ ] Pantalla de confirmación animada

### Sprint Demo 3 — Historial guardia (1-2 días)
- [ ] API GET `/api/marcas?userId=...`
- [ ] Lista responsive con thumbnails
- [ ] Página de detalle con mini-mapa Leaflet
- [ ] Estados visuales (válida / alerta)

### Sprint Demo 4 — Vista supervisor (3-4 días)
- [ ] Dashboard con tabla de marcas (polling 5s)
- [ ] Filtros + paginación
- [ ] Vista de mapa con Leaflet + pins
- [ ] Panel de alertas pendientes
- [ ] Indicadores (KPIs simples)

### Sprint Demo 5 — Pulido + Deploy (2 días)
- [ ] Responsive testing (real devices)
- [ ] Animaciones y loading states
- [ ] Manejo de errores amigable
- [ ] Deploy final a Vercel con dominio personalizado (opcional)
- [ ] Guion de demostración para el cliente
- [ ] Smoke test end-to-end

**Total estimado:** 12-15 días hábiles (caben en 2 semanas)

---

## 9. Variables de entorno necesarias

```bash
# Base de datos
DATABASE_URL="postgresql://user:pass@host.neon.tech/dbname?sslmode=require"
DIRECT_URL="postgresql://user:pass@host.neon.tech/dbname?sslmode=require"  # para migrations

# NextAuth
NEXTAUTH_URL="http://localhost:3000"          # en Vercel: dominio real
NEXTAUTH_SECRET="<openssl rand -base64 32>"

# AWS S3
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="scs-demo-fotos-2026"

# Feature flags (opcional)
NEXT_PUBLIC_DEMO_MODE="true"
NEXT_PUBLIC_MAPA_PROVIDER="osm"               # openstreetmap por defecto
```

---

## 10. Servicios externos a configurar

Antes de poder desarrollar de verdad necesitamos:

| Servicio | Quién lo configura | Tiempo | Costo |
|---|---|---|---|
| **Neon Postgres** | Tú (signup con email) | 10 min | Free tier (3GB) |
| **AWS S3 bucket** | Tú (crear bucket + IAM user) | 15 min | ~centavos/mes |
| **Vercel project** | Tú (importar repo desde GitHub) | 5 min | Free tier |
| **(opcional) Dominio** | Tú (Vercel domain o tuyo) | 5 min | Vercel da subdominio gratis |

> Te dejo un README específico en `demo-web/README.md` con el paso a paso de cada uno cuando empecemos a desarrollar.

---

## 11. Riesgos del demo y mitigación

| Riesgo | Mitigación |
|---|---|
| **Cámara no funciona en HTTP** | Vercel sirve HTTPS por defecto. Local dev usa `localhost` que el browser trata como seguro. |
| **GPS impreciso en interiores** | Mostramos la precisión al usuario. En el demo aceptamos hasta ±50m. |
| **Cliente piensa que esto es el producto final** | Diapositiva inicial: "Demo prototipo. La app nativa agregará: liveness real, offline real, anti-spoofing GPS, push." |
| **Free tier de Neon se agota** | 3GB son ~30k marcas, suficiente para demo. Cerramos cuenta o pagamos $19/mes si crece. |
| **Permisos de cámara/GPS denegados** | Pantalla explicativa con instrucciones de cómo habilitarlos. |

---

## 12. Qué guión de demostración usar con el cliente

Plantilla sugerida (5-7 minutos):

1. **(30s) Intro:** "Esto es un prototipo navegable. La app nativa tendrá X capas adicionales."
2. **(1m) Login como Guardia:** muestra cómo el guardia abre la app, ve su puesto y turno.
3. **(2m) Marcaje completo:** captura selfie, GPS, sube. Muestra que la validación de geofence es server-side.
4. **(1m) Marcaje "fraudulento":** simula estar fuera del geofence (basta moverse al hacer demo). Muestra la alerta generada.
5. **(2m) Vista Supervisor:** login como supervisor. Muestra la marca recién hecha apareciendo en el dashboard y la alerta. Abre el mapa.
6. **(30s) Cierre:** "Esto es la propuesta de valor. La app nativa lo lleva al siguiente nivel de seguridad."

---

## 13. Documentos relacionados

- [`PLAN.md`](./PLAN.md) — Plan maestro del producto completo
- [`arquitectura.md`](./arquitectura.md) — Arquitectura de producción
- [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md) — Spec de la app nativa final
- [`modelo-datos.md`](./modelo-datos.md) — Modelo de datos de producción
- [`seguridad.md`](./seguridad.md) — Capas de seguridad que el demo NO tiene (y la app nativa sí)
- [`roadmap-fases.md`](./roadmap-fases.md) — Roadmap del producto completo
- [`decisiones-tecnicas.md`](./decisiones-tecnicas.md) — ADRs (incluido el ADR-021 que justifica este demo)
