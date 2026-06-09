# Panel Admin Web — Smart Control Security

Panel administrativo Next.js para **supervisores** y **administradores** del sistema.

> 📚 **Documentación funcional:** [`../docs/funcionalidades-admin-web.md`](../docs/funcionalidades-admin-web.md)
> ⚙️ **API que consume:** [`../docs/funcionalidades-backend.md`](../docs/funcionalidades-backend.md)
> 🗓️ **Roadmap (Fase 5):** [`../docs/roadmap-fases.md`](../docs/roadmap-fases.md)

---

## 🎯 Estado actual

**Scaffold inicial creado.** Listo para que un desarrollador frontend ejecute los pasos de inicialización (abajo) y comience la Fase 5 cuando llegue el momento.

---

## 🧱 Stack

- **Next.js 15** con App Router
- **React 19**
- **TypeScript** estricto (con `noUncheckedIndexedAccess`)
- **Tailwind CSS 3** + clases utility con `cn()` helper
- **TanStack Query** — fetching, caching, optimistic updates
- **Zod** + **React Hook Form** — validación y formularios
- **Lucide React** — iconos
- **Recharts** — gráficos para dashboard
- **date-fns** — manejo de fechas
- **Vitest** + **Testing Library** — tests

---

## 🚀 Primera vez configurando este proyecto

### Requisitos

1. **Node.js 20+** ([descargar](https://nodejs.org/))
2. **npm** (incluido con Node) o **pnpm** (recomendado)

Verifica con:
```bash
node --version    # debe ser >= 20.0.0
npm --version
```

### Paso 1: Clonar el repo (si no lo tienes)

```bash
git clone <repo-url>
cd smart_control_security/admin-web
```

### Paso 2: Instalar dependencias

```bash
npm install
# o
pnpm install
```

> Tomará 1-2 minutos la primera vez (descarga ~300MB de paquetes en `node_modules/`).

### Paso 3: Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con la URL real del backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Paso 4: Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador. Verás el placeholder del scaffold.

---

## 🛠️ Comandos disponibles

```bash
# Desarrollo con hot reload
npm run dev

# Build de producción
npm run build

# Servir build (después de npm run build)
npm run start

# Linter
npm run lint
npm run lint:fix

# Formato con Prettier
npm run format
npm run format:check

# Type checker
npm run typecheck

# Tests
npm run test
npm run test:watch
npm run test:coverage

# Todo junto (pre-push)
npm run lint && npm run typecheck && npm run test
```

---

## 📁 Estructura del proyecto

```
admin-web/
├── app/                          # App Router de Next.js 15
│   ├── layout.tsx                # Layout raíz
│   ├── page.tsx                  # Página inicial (placeholder)
│   ├── globals.css               # Estilos globales + Tailwind
│   ├── (auth)/                   # Grupo de rutas de auth (Fase 5)
│   │   ├── login/
│   │   └── forgot-password/
│   └── (dashboard)/              # Grupo de rutas protegidas (Fase 5)
│       ├── layout.tsx            # Sidebar + Topbar
│       ├── page.tsx              # Dashboard principal
│       ├── guardias/
│       ├── puestos/
│       ├── turnos/
│       ├── marcas/
│       ├── alertas/
│       └── reportes/
├── components/                   # Componentes reutilizables
│   ├── ui/                       # Primitivas (Button, Input, Card)
│   ├── layout/                   # Sidebar, Topbar
│   ├── tables/                   # DataTable
│   └── charts/                   # Gráficos
├── hooks/                        # Custom hooks
├── lib/                          # Utilidades, API client, configs
│   └── utils.ts                  # cn() helper
├── public/                       # Assets estáticos
├── next.config.ts                # Configuración Next.js
├── tailwind.config.ts            # Configuración Tailwind
├── tsconfig.json                 # Configuración TypeScript
├── postcss.config.mjs
├── .eslintrc.json
├── .prettierrc.json
├── package.json
├── .env.example
├── .gitignore
└── README.md                     # Este archivo
```

---

## 🎨 Convenciones de UI

- **Tailwind utility-first** — preferir clases utility sobre CSS custom
- **`cn()` helper** de `lib/utils.ts` para combinar clases dinámicamente
- **Iconos**: solo de `lucide-react` (consistencia)
- **Componentes shadcn/ui style** (cuando lleguen): copiables y modificables
- **Colores semánticos**: usar paleta `brand-*` definida en `tailwind.config.ts`
- **Accesibilidad**: roles ARIA + navegación por teclado obligatorios

---

## 🔐 Convenciones técnicas

- **TypeScript strict** + `noUncheckedIndexedAccess` (cero `any`)
- **Server Components** por defecto, `"use client"` solo cuando se necesite
- **Validación con Zod** en todos los formularios y respuestas de API
- **TanStack Query** para todo data fetching (cache, retry, optimistic)
- **Tests** obligatorios para hooks complejos y componentes críticos

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'next'"
Faltó instalar: `npm install`

### "Port 3000 is already in use"
Otra app está usando ese puerto. Mata el proceso o usa otro:
```bash
npm run dev -- -p 3001
```

### El backend no responde
Verifica que el backend FastAPI esté corriendo en `http://localhost:8000` y que `NEXT_PUBLIC_API_URL` en `.env.local` apunte correctamente.

### Tailwind no aplica estilos
- Verifica que `globals.css` está importado en `app/layout.tsx`
- Reinicia el dev server (`Ctrl+C` y `npm run dev` de nuevo)
- Verifica que el archivo que editas está en `content: [...]` de `tailwind.config.ts`

---

## 🤝 Antes de hacer push

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test
```

Si todo pasa, listo.
