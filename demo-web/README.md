# Demo Web — Smart Control Security

Web responsive (mobile-first) que simula la futura app móvil del guardia + el panel del supervisor. Pensada para presentar al cliente en demos en vivo desde su celular.

> 📚 **Plan completo:** [`../docs/demo-web-plan.md`](../docs/demo-web-plan.md)
> 🧠 **Decisión documentada:** [ADR-021](../docs/decisiones-tecnicas.md)

---

## 🎯 ¿Qué hace este demo?

| Vista | Funcionalidad |
|---|---|
| **Guardia (mobile)** | Login → ve su puesto y turno → captura selfie + GPS → marca asistencia → ve historial |
| **Supervisor (desktop)** | Login → dashboard con marcas en tiempo real → mapa con puestos y geofences → panel de alertas |

### Lo que SÍ valida en vivo

- ✅ Captura de cámara en el navegador (`getUserMedia`)
- ✅ Captura de GPS (`navigator.geolocation`)
- ✅ Cálculo de geofence server-side (distancia Haversine al puesto asignado)
- ✅ Subida de fotos a AWS S3
- ✅ Generación automática de alertas cuando la marca está fuera del geofence
- ✅ Vista supervisor con polling en tiempo real
- ✅ Responsive total: el guardia abre la URL en su celular y se ve como una app

### Lo que NO valida (y es honesto decirlo al cliente)

- ❌ Liveness real (detección de foto vs persona real) → requiere SDK nativo
- ❌ Anti-spoofing GPS (detectar mock locations) → browser no expone esto
- ❌ Device binding (1 dispositivo por guardia) → browser no tiene hardware ID confiable
- ❌ Modo offline real → requiere persistencia local + workers nativos

Todo esto **sí está en la app nativa** (Fase 2-3 del roadmap principal).

---

## 🧱 Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 (mobile-first) |
| Base de datos | Neon Postgres (serverless) |
| ORM | Prisma 5 |
| Auth | NextAuth.js v5 (credentials) |
| Storage | AWS S3 |
| Mapa | Leaflet + OpenStreetMap |
| Validación | Zod |
| Deploy | Vercel |

---

## 🚀 Cómo correr en local

### Pre-requisitos

- Node.js 20+ (`node --version`)
- npm 10+ (viene con Node)
- Cuenta de **Neon** ([neon.tech](https://neon.tech)) — free tier
- Cuenta de **AWS** con bucket S3 + IAM user con permisos `s3:PutObject` y `s3:GetObject`

### Paso 1: Setup de Neon Postgres

1. Crea una cuenta en [neon.tech](https://neon.tech) (gratis, signup con email)
2. Crea un nuevo proyecto: `scs-demo`
3. Copia la **Connection string** (formato `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`)
4. La vas a poner en `DATABASE_URL` y `DIRECT_URL` en el `.env`

### Paso 2: Setup de AWS S3

1. En AWS Console → S3 → "Create bucket"
2. Nombre sugerido: `scs-demo-fotos-2026` (debe ser globalmente único)
3. Región: `us-east-1` (más barata)
4. **Object Ownership:** ACLs disabled (recomendado)
5. **Block all public access:** desactivar el bloqueo (necesitamos URLs públicas para el demo)
6. Después de crear el bucket → **Permissions** → **Bucket Policy** → pega:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicRead",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::scs-demo-fotos-2026/*"
     }]
   }
   ```

7. Crea un IAM user con política `AmazonS3FullAccess` (o más restrictiva)
8. Genera Access Key + Secret y guárdalos para el `.env`

### Paso 3: Instalar y configurar

```bash
cd smart_control_security/demo-web

# Instalar dependencias
npm install

# Copiar variables de entorno
copy .env.example .env

# Editar .env con tus credenciales reales:
#   - DATABASE_URL y DIRECT_URL (de Neon)
#   - AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME
#   - NEXTAUTH_SECRET: genera con `npx auth secret` o `openssl rand -base64 32`

# Aplicar el schema a la base de datos
npx prisma migrate dev --name init

# Poblar datos de demo (3 usuarios + 2 puestos)
npx prisma db seed
```

### Paso 4: Correr en desarrollo

```bash
npm run dev
# Abre http://localhost:3000
```

### Usuarios de prueba (creados por el seed)

| Email | Password | Rol |
|---|---|---|
| `guardia1@demo.com` | `demo1234` | Guardia (asignado a Sede Norte) |
| `guardia2@demo.com` | `demo1234` | Guardia (asignado a Sede Sur) |
| `supervisor@demo.com` | `demo1234` | Supervisor |

---

## 🛠️ Comandos útiles

```bash
# Desarrollo
npm run dev                    # Servidor de desarrollo
npm run build                  # Build de producción
npm start                      # Correr build de prod

# Calidad
npm run lint                   # ESLint
npm run lint:fix               # Auto-fix
npm run format                 # Prettier
npm run typecheck              # tsc --noEmit

# Base de datos
npx prisma studio              # GUI para ver datos
npx prisma migrate dev         # Crear nueva migración
npx prisma migrate reset       # Borrar y recrear (con seed)
npx prisma db seed             # Solo poblar seed
npx prisma generate            # Regenerar cliente Prisma
```

---

## 🌐 Deploy a Vercel

### Primera vez

1. [vercel.com/new](https://vercel.com/new) → importa el repo `smart_control_security`
2. **Root Directory:** `demo-web` (importante)
3. **Framework Preset:** Next.js (auto-detectado)
4. **Build Command:** `prisma generate && next build` (sobreescribe el default)
5. En **Environment Variables**, pega todas las del `.env.example` con tus valores reales:
   - `DATABASE_URL`, `DIRECT_URL`
   - `NEXTAUTH_URL` (será `https://tu-proyecto.vercel.app`)
   - `NEXTAUTH_SECRET`
   - `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
6. Click **Deploy**
7. Después de deploy: corre las migrations desde local con `DATABASE_URL` de prod:
   ```bash
   DATABASE_URL="<prod url>" npx prisma migrate deploy
   DATABASE_URL="<prod url>" npx prisma db seed
   ```

### Deploys siguientes

Cada push a `main` con cambios en `demo-web/**` despliega automáticamente.

---

## 📁 Estructura

Ver [`../docs/demo-web-plan.md`](../docs/demo-web-plan.md) sección 7 para el árbol completo.

```text
demo-web/
├── prisma/              # Schema + seed + migrations
├── public/              # Assets estáticos
└── src/
    ├── app/             # Routes (App Router)
    │   ├── (guardia)/   # Layout mobile
    │   ├── (supervisor)/# Layout desktop
    │   └── api/         # API routes
    ├── components/      # UI reutilizable
    ├── lib/             # Auth, prisma, s3, geofence
    ├── middleware.ts    # Protección + redirección por rol
    └── types/
```

---

## 🐛 Troubleshooting

### Cámara no abre

- En `http://localhost:3000` debería funcionar (browser trata localhost como seguro).
- Si pruebas con IP local (`http://192.168.x.x:3000`) **no funcionará**. Usa `localhost` o despliega a Vercel.
- Verifica que diste permiso en el browser (candado de la URL).

### GPS no devuelve coordenadas

- En interiores la precisión es mala. El demo acepta hasta ±50m.
- Si nunca devuelve, revisa permisos del browser y del sistema operativo.
- En desktop sin GPS hardware, el browser usa WiFi positioning (puede dar bajos resultados).

### Error de conexión a Neon

- Verifica que la `DATABASE_URL` tenga `?sslmode=require` al final.
- Si tu IP cambió, en Neon Console agrégala a la allowlist (o pon `0.0.0.0/0` para demo).

### S3 devuelve 403 al ver imágenes

- Revisa la bucket policy (paso 6 del setup de S3).
- Verifica que "Block all public access" esté desactivado.

### Prisma falla con "Migration engine error"

- Suele ser problema de SSL. Asegúrate de usar `DIRECT_URL` (sin pgbouncer) para `migrate`.
- Neon te da dos URLs: la pooled (`DATABASE_URL`) y la directa (`DIRECT_URL`).

---

## 🤝 Contribuir

Ver [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

Scope sugerido para commits de este componente:
```
feat(demo-web): agregar pantalla de marcaje
fix(demo-web): corregir cálculo de geofence
```

---

## 🔗 Documentación relacionada

- [Plan completo del demo](../docs/demo-web-plan.md)
- [ADR-021 (justificación del demo)](../docs/decisiones-tecnicas.md)
- [Modelo de datos completo](../docs/modelo-datos.md)
- [Funcionalidades de la app nativa final](../docs/funcionalidades-app-movil.md)
