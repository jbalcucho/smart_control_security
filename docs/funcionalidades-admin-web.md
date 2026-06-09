# 🖥 Funcionalidades del Panel Admin Web — Smart Control Security

> Detalle exhaustivo del panel administrativo web (Next.js 15) usado por supervisores y administradores. Fuente de verdad para la Fase 5.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Mapa de pantallas](#3-mapa-de-pantallas)
4. [Autenticación](#4-autenticación)
5. [Dashboard principal](#5-dashboard-principal)
6. [Gestión de guardias](#6-gestión-de-guardias)
7. [Gestión de puestos](#7-gestión-de-puestos)
8. [Gestión de turnos](#8-gestión-de-turnos)
9. [Asignaciones (calendario)](#9-asignaciones-calendario)
10. [Marcas y validación](#10-marcas-y-validación)
11. [Alertas](#11-alertas)
12. [Reportes](#12-reportes)
13. [Gestión de devices](#13-gestión-de-devices)
14. [Configuración de empresa](#14-configuración-de-empresa)
15. [Audit log](#15-audit-log)
16. [Stack técnico](#16-stack-técnico)
17. [Criterios de aceptación](#17-criterios-de-aceptación)

---

## 1. Visión general

El **Panel Admin Web** es la "ventana" desde la cual los supervisores y administradores gestionan toda la operación del sistema. Mientras los guardias usan la app móvil para marcar asistencia, el panel permite:

- **Configurar** la operación: crear guardias, puestos, turnos, asignaciones
- **Monitorear** en tiempo real: dashboard con KPIs y mapa de marcas
- **Reaccionar** ante eventos: validar marcas dudosas, atender alertas de fraude
- **Reportar**: generar Excels para nómina, auditoría laboral, gerencia
- **Mantener** seguridad: bloquear devices, ver audit log

> 📱 La parte cliente que envía datos al sistema está en [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md).
> ⚙️ El API que ambos consumen está en [`funcionalidades-backend.md`](./funcionalidades-backend.md).

---

## 2. Roles y permisos

El panel reconoce 3 roles:

| Rol | Alcance | Acciones principales |
|---|---|---|
| **Supervisor** | Solo sus guardias asignados | Ver marcas, validar dudosas, atender alertas, ver reportes parciales |
| **Admin** | Toda su empresa | Todo lo anterior + CRUD de guardias/puestos/turnos, gestión de devices, reportes completos |
| **Superadmin** | Todas las empresas (Balcuapps) | Lo anterior + crear empresas, soporte cross-cliente |

### Matriz de permisos detallada

| Funcionalidad | Supervisor | Admin | Superadmin |
|---|:---:|:---:|:---:|
| Dashboard de mis guardias | ✅ | ✅ (toda la empresa) | ✅ (todas) |
| Listar marcas | ✅ (mis guardias) | ✅ (empresa) | ✅ (todas) |
| Validar marca dudosa | ✅ (mis guardias) | ✅ | ✅ |
| Crear/editar guardia | ❌ | ✅ | ✅ |
| Crear/editar puesto | ❌ | ✅ | ✅ |
| Crear/editar turno | ❌ | ✅ | ✅ |
| Asignar guardia a puesto | ✅ (mis guardias) | ✅ | ✅ |
| Bloquear/liberar device | ❌ | ✅ | ✅ |
| Ver/atender alertas | ✅ (mis guardias) | ✅ | ✅ |
| Generar reportes | ✅ (parciales) | ✅ (completos) | ✅ |
| Configuración empresa | ❌ | ✅ | ✅ |
| Ver audit log | ❌ | ✅ (solo lectura) | ✅ |
| Crear empresa | ❌ | ❌ | ✅ |
| Soporte multi-empresa | ❌ | ❌ | ✅ |

---

## 3. Mapa de pantallas

```text
┌─────────────────┐
│  /login         │  Pantalla pública
└────────┬────────┘
         │
         ▼ (autenticado)
┌──────────────────────────────────────────────────┐
│                /                                 │  Layout con sidebar + topbar
│  ┌────────────┐  ┌────────────────────────────┐  │
│  │  Sidebar   │  │  Contenido (rutas debajo)  │  │
│  └────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────┘

Rutas dentro del layout:
  /                       Dashboard principal
  /marcas                 Listado de marcas
  /marcas/[id]            Detalle de marca + foto + validación
  /guardias               Listado de guardias
  /guardias/nuevo         Crear guardia
  /guardias/[id]          Detalle + edición
  /puestos                Listado de puestos
  /puestos/nuevo          Crear puesto (con mapa para geofence)
  /puestos/[id]           Detalle + edición
  /turnos                 Listado de turnos
  /turnos/nuevo           Crear turno
  /asignaciones           Calendario de asignaciones
  /alertas                Bandeja de alertas
  /alertas/[id]           Detalle + atender
  /reportes               Generador de reportes
  /reportes/historial     Reportes ya generados
  /devices                Listado de devices vinculados
  /devices/[id]           Detalle + bloquear/liberar
  /config                 Configuración de la empresa
  /config/usuarios        Gestión de usuarios admin/supervisores
  /audit                  Audit log
  /perfil                 Perfil del usuario actual
  /perfil/password        Cambiar contraseña
```

---

## 4. Autenticación

### 4.1 Login (`/login`)

**Inputs:**
- Email
- Contraseña

**Flujo:**
1. `POST /api/auth/login` → recibe `access_token` + `refresh_token`
2. Tokens guardados en **cookies httpOnly + Secure + SameSite=Strict**
3. Redirige al dashboard

### 4.2 Refresh automático

- Interceptor en cliente axios renueva tokens al detectar 401
- Si refresh falla → redirect a `/login`

### 4.3 Recuperación de contraseña

- `/forgot-password` → email con link
- `/reset-password?token=...` → form para nueva contraseña

### 4.4 Protección de rutas

- Middleware Next.js verifica cookie en cada request
- Rutas no autenticadas: solo `/login`, `/forgot-password`, `/reset-password`
- Rutas no autorizadas (por rol): mostrar 403

---

## 5. Dashboard principal (`/`)

### 5.1 Layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ 🏢 Logo empresa     Smart Control Security    🔔 (5)   👤 Admin▼   │
├────────────────────────────────────────────────────────────────────┤
│ [Sidebar]  │  📊 Dashboard                                          │
│            │                                                        │
│ Dashboard  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│ Marcas     │  │ Marcas   │  │ Guardias │  │ Alertas  │  │ Tasa   │ │
│ Guardias   │  │   hoy    │  │ activos  │  │pendientes│  │cumplim.│ │
│ Puestos    │  │   132    │  │    24    │  │    5     │  │  98%   │ │
│ Turnos     │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│ Asignac.   │                                                        │
│ Alertas    │  📍 Mapa de marcas (últimas 24h)                       │
│ Reportes   │  ┌───────────────────────────────────────────────────┐ │
│ Devices    │  │                                                   │ │
│ Config     │  │       [Mapa con pines verdes/rojos]               │ │
│ Audit      │  │                                                   │ │
│            │  └───────────────────────────────────────────────────┘ │
│            │                                                        │
│            │  📈 Marcas por hora     │  🚨 Últimas alertas          │
│            │  [Gráfico de barras]    │  • Mock GPS - Juan P.        │
│            │                         │  • Face mismatch - María L.  │
│            │  ⏱ Marcas pendientes    │  • Fuera geofence - Pedro G. │
│            │  por más de 1h: 2       │  [Ver todas →]               │
└────────────┴────────────────────────────────────────────────────────┘
```

### 5.2 Widgets (KPIs)

| Widget | Valor | Refresh |
|---|---|---|
| Marcas hoy | Contador con tendencia vs ayer | 30s |
| Guardias activos | Cuántos marcaron entrada hoy / total | 30s |
| Alertas pendientes | Contador con badge rojo si > 0 | 10s |
| Tasa de cumplimiento | % marcas correctas hoy | 1min |

### 5.3 Mapa

- **Mapbox** o **Leaflet** + tiles de OpenStreetMap
- Pin por cada marca de las últimas 24h
- Color: verde (válida) / amarillo (revisar) / rojo (rechazada/fraude)
- Click en pin → popup con foto + datos
- Filtros: guardia, puesto, tipo evento, rango horario

### 5.4 Gráficos

- **Barras por hora**: cantidad de marcas en cada hora del día
- **Línea histórica**: tendencia de cumplimiento últimos 7 días

---

## 6. Gestión de guardias (`/guardias`)

### 6.1 Listado

Tabla con:
- Foto miniatura + nombre + DNI
- Código empleado
- Supervisor
- Puesto/turno actual
- Última marca (con relativo: "hace 5 min")
- Estado: activo / inactivo / device bloqueado
- Acciones: ver / editar / desactivar

Filtros: búsqueda por nombre/DNI, supervisor, estado.
Paginación: 20 por página, lazy load.

### 6.2 Crear / editar guardia (`/guardias/nuevo`)

Formulario con tabs:

**Tab 1: Datos personales**
- DNI (validación formato según país)
- Nombres + apellidos
- Email (opcional)
- Teléfono
- Fecha de ingreso
- Cargo

**Tab 2: Foto de referencia** (crítico para Face Matching)
- Drag & drop o tomar foto con webcam
- Validación: backend verifica con Rekognition que tiene rostro detectable
- Preview con score de calidad

**Tab 3: Asignación inicial**
- Supervisor responsable
- Puesto inicial
- Turno inicial

Validaciones con **Zod** + **React Hook Form**.

### 6.3 Detalle de guardia (`/guardias/[id]`)

- Datos completos
- Historial de marcas (link a `/marcas?guardia=X`)
- Historial de alertas (link a `/alertas?guardia=X`)
- Device vinculado (link a `/devices/[id]`)
- Asignaciones históricas (timeline)
- Acciones: editar / cambiar password / desactivar / liberar device

---

## 7. Gestión de puestos (`/puestos`)

### 7.1 Listado

Tabla con: nombre, código, dirección, guardias asignados, estado activo/inactivo.

### 7.2 Crear / editar puesto

Formulario con:
- Nombre + código
- Dirección
- **Mapa interactivo** para definir el geofence:
  - Click en mapa para colocar centro
  - Drag para dibujar polígono (mínimo 3 puntos)
  - O slider para radio circular (fallback simple)
- Notas
- Estado activo

Vista previa del polígono antes de guardar.

---

## 8. Gestión de turnos (`/turnos`)

Formulario simple:
- Nombre (ej. "Diurno 8h")
- Hora inicio + hora fin
- Toggle "cruza medianoche"
- Días de la semana (chips multi-select)
- Refrigerio: toggle + minutos
- Tolerancia tardanza (minutos)

---

## 9. Asignaciones (calendario) (`/asignaciones`)

Vista de **calendario semanal** (similar a Google Calendar):

```text
                  Lun       Mar       Mié       Jue       Vie       Sáb       Dom
   06:00-14:00   [Juan]    [Juan]    [Juan]    [Juan]    [Juan]    [María]   ___
   14:00-22:00   [Pedro]   [Pedro]   [Pedro]   [Pedro]   [Pedro]   ___       [Ana]
   22:00-06:00   [Luis]    [Luis]    [Luis]    [Luis]    [Luis]    [Luis]    [Luis]
```

- Drag & drop guardias a celdas
- Click en celda → modal de edición
- Filtros: puesto, supervisor, mes/semana
- Vista alternativa: lista
- Botón "Asignación masiva" para repetir patrón

---

## 10. Marcas y validación (`/marcas`)

### 10.1 Listado de marcas

Tabla con:
- Foto miniatura
- Guardia
- Tipo evento (chip de color: entrada/salida/refrigerio/ronda)
- Hora (server timestamp)
- Puesto
- Estado (válida / pendiente revisión / rechazada)
- Alertas (iconos: 🚫 mock GPS, ⚠️ fuera geofence, 🤖 face mismatch)
- Acciones: ver detalle / validar / rechazar

Filtros avanzados:
- Rango de fechas
- Guardia (autocompletado)
- Puesto
- Tipo evento
- Estado
- Solo con alertas
- Tipo de alerta específica

Exportar listado actual a Excel.

### 10.2 Detalle de marca (`/marcas/[id]`)

Layout:

```text
┌────────────────────────────────────────────────────────┐
│ ← Volver                            Marca #ABC-12345   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Foto grande]              ┌─────────────────────┐    │
│                             │ Datos de la marca   │    │
│                             ├─────────────────────┤    │
│  [Thumbnails de los         │ Guardia: Juan P.    │    │
│   otros 2 frames]           │ Tipo: Entrada       │    │
│                             │ Server time: 06:12  │    │
│                             │ Device time: 06:11  │    │
│                             │ Puesto: CC Plaza    │    │
│                             │ GPS: ±8m            │    │
│  ⚠️ Alertas detectadas:     └─────────────────────┘    │
│  • Liveness score: 65       ┌─────────────────────┐    │
│  • Face match: 87%          │ 📍 Mapa             │    │
│                             │ [pin + geofence]    │    │
│  Acciones:                  └─────────────────────┘    │
│  [✅ Aprobar] [❌ Rechazar]                            │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 10.3 Validación manual

Modal con:
- Comentario obligatorio (mínimo 10 chars)
- Acción: Aprobar / Rechazar
- Backend marca: `validada_por_user_id`, `validada_at`, `motivo_rechazo`
- Notifica al guardia vía push

---

## 11. Alertas (`/alertas`)

### 11.1 Bandeja

Tabla con:
- Severidad (badge: info / warning / critical)
- Tipo
- Guardia
- Descripción corta
- Hora
- Estado (pendiente / atendida / descartada)
- Acción

Filtros: severidad, tipo, estado, guardia, rango fechas.

Vista "Solo pendientes" por defecto.

### 11.2 Detalle de alerta (`/alertas/[id]`)

- Tipo y severidad
- Marca asociada (si aplica) — link directo
- Guardia
- Contexto/datos extra
- Acciones: atender (con nota) / descartar (con motivo)

---

## 12. Reportes (`/reportes`)

### 12.1 Generador

Form con:
- Tipo: horas trabajadas / asistencia / fraude / personalizado
- Rango de fechas
- Filtros: guardias específicos / todos
- Formato: Excel / CSV
- Botón "Generar"

### 12.2 Historial (`/reportes/historial`)

Tabla con reportes ya generados:
- Tipo + nombre
- Fecha solicitud
- Estado (procesando / listo / falló) + barra de progreso
- Tamaño
- Acciones: descargar / regenerar

Backend retorna `job_id`, el front hace polling cada 5s del status.

---

## 13. Gestión de devices (`/devices`)

### 13.1 Listado

Tabla con:
- Guardia asociado
- Modelo + OS
- Versión app
- Última actividad
- Estado: activo / bloqueado / inactivo > 30 días
- Acciones: ver / bloquear / liberar

### 13.2 Detalle

- Info técnica completa
- Marcas registradas desde este device
- Eventos de telemetría (root detectado, mock GPS, etc.)
- Botones: bloquear (con motivo) / liberar (para reasignar a otro guardia)

---

## 14. Configuración de empresa (`/config`)

Tabs:

### 14.1 General
- Nombre, NIT, dirección, contacto
- Logo (subir imagen)
- Zona horaria

### 14.2 Umbrales de fraude
- Liveness mínimo (0-100, default 80)
- Face match mínimo (0-100, default 90)
- Velocidad GPS imposible (km/h, default 150)
- Tolerancia tardanza por defecto (min, default 10)

### 14.3 Notificaciones
- Email del supervisor para alertas
- Tipos de alerta a notificar (toggles)
- Frecuencia (instantánea / agrupada cada hora / digest diario)

### 14.4 Política de retención
- Días retención de fotos (mín 90)
- Días retención de marcas (mín 365)

### 14.5 Usuarios (`/config/usuarios`)
- CRUD de usuarios admin y supervisor
- Asignación de rol
- Restablecer contraseña
- Activar/desactivar

---

## 15. Audit log (`/audit`)

Tabla cronológica de acciones críticas:
- Usuario que hizo la acción
- Acción (create_guardia, update_puesto, validate_marca, block_device, etc.)
- Entidad afectada
- Diff antes/después (en modal expandible)
- IP + user agent
- Timestamp

Filtros: usuario, acción, entidad, rango fechas.

Solo lectura. Exportable a CSV para auditoría externa.

---

## 16. Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 15** con App Router |
| Lenguaje | **TypeScript** estricto |
| UI | **Tailwind CSS 3** + componentes estilo shadcn/ui |
| Iconos | `lucide-react` |
| Data fetching | **TanStack Query v5** (cache, retry, optimistic updates) |
| Forms | **React Hook Form** + **Zod** |
| Tablas | **TanStack Table** (cuando se necesite ordenar/filtrar avanzado) |
| Gráficos | **Recharts** |
| Mapas | **Mapbox GL** o **Leaflet** (decidir según costo) |
| Fechas | **date-fns** |
| HTTP | **Axios** con interceptores |
| Tests | **Vitest** + **Testing Library** |
| E2E (opcional) | **Playwright** |

---

## 17. Criterios de aceptación (Fase 5)

Para considerar el panel listo para producción:

- [ ] Login + sesión persistente + refresh automático
- [ ] Middleware Next.js protege rutas
- [ ] 3 roles funcionando con matriz de permisos correcta
- [ ] Dashboard con KPIs + mapa + gráficos
- [ ] CRUD completo de: guardias, puestos, turnos, asignaciones
- [ ] Validación manual de marcas operativa
- [ ] Generación de reportes Excel funcional
- [ ] Gestión de devices (bloquear/liberar) operativa
- [ ] Configuración de umbrales por empresa
- [ ] Audit log explorable
- [ ] Responsive (mínimo: usable en tablet)
- [ ] Accesibilidad WCAG AA básica
- [ ] Cobertura de tests ≥ 60%
- [ ] Build de producción < 500KB inicial JS (con code splitting)
- [ ] Deploy automatizado a Vercel/AWS

---

## 18. Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md)
- 🏛️ [`arquitectura.md`](./arquitectura.md)
- 📱 [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md)
- ⚙️ [`funcionalidades-backend.md`](./funcionalidades-backend.md)
- 🗃️ [`modelo-datos.md`](./modelo-datos.md)
- 🛡️ [`seguridad.md`](./seguridad.md)
- 🗓️ [`roadmap-fases.md`](./roadmap-fases.md)
