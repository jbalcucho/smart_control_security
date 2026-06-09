# 📱 Funcionalidades de la App Móvil — Smart Control Security

> Detalle exhaustivo de todo lo que la app móvil Android (Flutter) debe hacer. Esta es la fuente de verdad para Fase 2.

---

## Índice

1. [Pantallas y navegación](#1-pantallas-y-navegación)
2. [Autenticación y sesión](#2-autenticación-y-sesión)
3. [Pantalla principal del guardia](#3-pantalla-principal-del-guardia)
4. [Registro de marca de asistencia](#4-registro-de-marca-de-asistencia)
5. [Modo offline-first](#5-modo-offline-first)
6. [Seguridad anti-fraude (cliente)](#6-seguridad-anti-fraude-cliente)
7. [Historial personal](#7-historial-personal)
8. [Notificaciones push](#8-notificaciones-push)
9. [Configuración y perfil](#9-configuración-y-perfil)
10. [Accesibilidad y UX](#10-accesibilidad-y-ux)
11. [Permisos del sistema](#11-permisos-del-sistema)
12. [Casos de error y mensajes al usuario](#12-casos-de-error-y-mensajes-al-usuario)

---

## 1. Pantallas y navegación

### 1.1 Mapa de pantallas

```text
┌─────────────────┐
│  Splash + Auth  │
│   verificación  │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌─────────┐  ┌──────────────┐
│  Login  │  │  Home Guardia│  ◀── pantalla principal
└─────────┘  └──────┬───────┘
                    │
       ┌────────────┼─────────────┬──────────────┬─────────────┐
       ▼            ▼             ▼              ▼             ▼
   ┌────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Marcar │  │Historial│  │ Pendientes│  │  Perfil  │  │ Settings │
   │  Asist.│  │   Mío   │  │   Sync    │  │          │  │          │
   └───┬────┘  └─────────┘  └──────────┘  └────┬─────┘  └────┬─────┘
       ▼                                       ▼              ▼
   ┌──────────┐                          ┌──────────┐  ┌──────────────┐
   │ Cámara + │                          │ Cambiar  │  │ Privacidad,  │
   │ Liveness │                          │ password │  │ términos,    │
   │ Challenge│                          │          │  │ versión, etc.│
   └──────────┘                          └──────────┘  └──────────────┘
```

### 1.2 Lista de pantallas

| ID | Pantalla | Descripción | Ruta |
|---|---|---|---|
| P1 | Splash | Verifica sesión + carga inicial | `/` |
| P2 | Login | Usuario + contraseña | `/login` |
| P3 | Home | Dashboard del guardia + botón "Marcar" | `/home` |
| P4 | Captura de marca | Cámara + Liveness + GPS | `/marcar` |
| P5 | Confirmación de marca | Resumen + feedback éxito/error | `/marcar/confirmacion` |
| P6 | Historial | Lista de marcas pasadas | `/historial` |
| P7 | Detalle de marca | Foto + datos completos | `/historial/:id` |
| P8 | Cola de pendientes | Marcas sin sincronizar | `/pendientes` |
| P9 | Perfil | Datos del guardia | `/perfil` |
| P10 | Cambio de password | Form para cambiar contraseña | `/perfil/password` |
| P11 | Configuración | Opciones de la app | `/settings` |
| P12 | Política de privacidad | Texto legal + consentimiento | `/legal/privacidad` |
| P13 | Términos de uso | Texto legal | `/legal/terminos` |
| P14 | Acerca de | Versión, soporte, créditos | `/about` |

---

## 2. Autenticación y sesión

### 2.1 Login (P2)

**Inputs:**
- Documento de identidad (DNI / cédula)
- Contraseña

**Validaciones cliente:**
- DNI no vacío
- Contraseña mínimo 8 caracteres

**Flujo:**
1. Usuario ingresa credenciales y presiona "Iniciar sesión"
2. App muestra spinner
3. Llamada a `POST /api/auth/login` con `{dni, password, device_fingerprint, fcm_token}`
4. Backend valida y responde:
   - **200 OK**: `{access_token, refresh_token, user, device_secret}` → guardar en `flutter_secure_storage`, navegar a Home
   - **401**: "Credenciales incorrectas"
   - **403 device_blocked**: "Este dispositivo está bloqueado. Contacta a tu supervisor."
   - **403 device_mismatch**: "Tu cuenta ya está asociada a otro dispositivo. Solicita liberar el anterior."
   - **423 user_disabled**: "Tu cuenta está desactivada."

**Estados:**
- Inicial / Cargando / Error / Éxito

### 2.2 Sesión persistente

- Tras login exitoso se guardan en `flutter_secure_storage` (KeyStore):
  - `access_token` (JWT, vida corta — 15 min)
  - `refresh_token` (vida larga — 30 días)
  - `device_secret` (clave HMAC única de este device)
  - `user_id`, `user_data`
- En Splash (P1): si hay token válido → Home; si expiró → intentar refresh; si refresh falló → Login

### 2.3 Refresh token automático

- Interceptor en `dio` que detecta `401`:
  - Hace `POST /api/auth/refresh` con el refresh_token
  - Si OK → reintenta la request original con el nuevo access_token
  - Si falla → logout + redirect a Login

### 2.4 Logout

- Manual desde Configuración (P11)
- Borra todos los tokens de `flutter_secure_storage`
- Cierra base SQLite local **si no hay marcas pendientes**
- Si hay marcas pendientes → muestra warning "Tienes N marcas pendientes de sincronizar. ¿Cerrar sesión perderá estas marcas?"
- Llama a `POST /api/auth/logout` (invalida el refresh_token en server)

### 2.5 Vinculación de dispositivo

- Al primer login, el backend asocia el device fingerprint a esa cuenta
- Si el guardia intenta loguearse desde otro device → error `403 device_mismatch`
- Solo el supervisor puede "liberar" el device anterior desde el panel admin (Fase 5)

---

## 3. Pantalla principal del guardia (P3)

### 3.1 Layout

```
┌───────────────────────────────────────┐
│ ☰  Smart Control Security      🔔 (3) │
├───────────────────────────────────────┤
│                                       │
│    👤 Juan Pérez García               │
│    Cód. EMP-00134                     │
│                                       │
│    🏢 Puesto asignado:                │
│    Centro Comercial Plaza Mayor       │
│    Turno: 06:00 - 14:00               │
│                                       │
│    📍 Próximo evento esperado:        │
│    🟢 Entrada - en 12 minutos         │
│                                       │
│    Última marca: ✅ Salida 14:03      │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │                                 │  │
│  │     [ 📷  MARCAR ASISTENCIA ]  │  │  ◀── botón gigante, central
│  │                                 │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Estado: 🟢 Conectado                 │
│  ⏳ 0 marcas pendientes               │
│                                       │
├───────────────────────────────────────┤
│  🏠 Inicio  📋 Historial  👤 Perfil   │
└───────────────────────────────────────┘
```

### 3.2 Elementos

- Header con notificaciones (badge con cantidad sin leer)
- Foto y datos del guardia (nombre, código)
- Puesto asignado con nombre y turno actual
- Próximo evento esperado (cuenta regresiva)
- Última marca registrada
- **Botón gigante "Marcar Asistencia"** (foco visual principal)
- Indicador de conexión (online/offline)
- Contador de marcas pendientes de sync
- Bottom navigation: Home / Historial / Perfil

### 3.3 Lógica

- Al entrar, hace `GET /api/guardias/me/dashboard` que retorna:
  - Datos del guardia
  - Puesto y turno actuales
  - Próximo evento esperado
  - Última marca registrada
- Refresca cada 30 segundos en foreground
- Indicador "Conectado/Offline" reactivo al estado de la red

---

## 4. Registro de marca de asistencia

### 4.1 Pre-condiciones (validaciones silenciosas antes de abrir cámara)

Al presionar el botón "Marcar":

| Validación | Si falla → |
|---|---|
| Permiso de cámara concedido | Pide permiso; si rechazado, muestra explicación + abre settings |
| Permiso de ubicación concedido | Igual |
| GPS activado | Modal: "Activa el GPS para continuar" + botón a settings |
| No hay Mock Location | Bloqueo + alerta al backend |
| Device no rooteado | Bloqueo + alerta al backend |
| Hay batería suficiente (>5%) | Warning pero permite continuar |
| Precisión GPS aceptable (<50m) | Espera hasta 10s mejorando precisión |

### 4.2 Captura de foto + Liveness Challenge (P4)

**Layout:**

```
┌───────────────────────────────────────┐
│  ← Cancelar          Marcar entrada   │
├───────────────────────────────────────┤
│                                       │
│       ┌─────────────────────┐         │
│       │                     │         │
│       │   [PREVIEW CÁMARA]  │         │
│       │      FRONTAL        │         │
│       │                     │         │
│       │   👁️  Mira al frente │         │
│       │                     │         │
│       └─────────────────────┘         │
│                                       │
│   👁️  Parpadea 2 veces lentamente    │
│                                       │
│   [████████░░░░░░] 60% completado     │
│                                       │
└───────────────────────────────────────┘
```

**Comportamiento:**
1. Abre cámara **frontal** vía `camera` plugin (no permite cambiar a trasera, no permite galería)
2. Detecta rostro con `google_mlkit_face_detection`
3. Lanza challenge aleatorio: parpadear, sonreír, girar cabeza
4. Captura **3 frames** durante el challenge (para enviar al backend)
5. Comprime imágenes a ~200KB cada una (JPEG quality 80, max 1024px)
6. Encripta temporalmente en almacenamiento interno
7. Continúa al envío

**Por qué 3 frames:** AWS Rekognition Face Liveness analiza secuencia (no foto única) y detecta video/foto fija mejor.

### 4.3 Envío al backend (online)

**Payload:**

```json
POST /api/marcas
Headers:
  Authorization: Bearer <jwt>
  X-Signature: <hmac_sha256(body + timestamp + nonce, device_secret)>
  X-Timestamp: 1717891234
  X-Nonce: <uuid-v4>
  X-Play-Integrity-Token: <token>

Body (multipart/form-data):
  - tipo_evento: "entrada" | "salida" | "refrigerio_inicio" | "refrigerio_fin" | "ronda"
  - latitud: -4.612345
  - longitud: -74.082345
  - precision_gps_m: 8.5
  - altitud_m: 2640.5
  - timestamp_device: 1717891200
  - puesto_id: 42
  - fotos[]: archivo binario (3 frames)
  - device_info: {"modelo":"...", "os":"Android 13", "app_version":"1.2.0"}
```

**Respuestas:**

- **201 Created** → marca registrada exitosamente
  ```json
  { "id": "uuid", "validacion": "ok", "alertas": [] }
  ```
- **201 Created con flags** → registrada pero con alertas
  ```json
  { "id": "uuid", "validacion": "ok_con_alertas", "alertas": ["fuera_geofence"] }
  ```
- **422 Unprocessable** → falló validación de liveness
  ```json
  { "error": "liveness_failed", "mensaje": "No se detectó persona viva. Intenta de nuevo." }
  ```
- **403** → device bloqueado o no autorizado
- **409 Conflict** → marca duplicada (nonce repetido)
- **500** → error servidor — encolar localmente para reintento

### 4.4 Confirmación (P5)

```
┌───────────────────────────────────────┐
│         ✅ MARCA REGISTRADA           │
├───────────────────────────────────────┤
│                                       │
│       [foto pequeña capturada]        │
│                                       │
│   Tipo: Entrada                       │
│   Hora: 06:12:34                      │
│   Lugar: Centro Comercial Plaza       │
│   GPS: ±8m                            │
│                                       │
│   [ Volver al inicio ]                │
│                                       │
└───────────────────────────────────────┘
```

Si hay alertas: muestra warning amarillo "Tu marca fue registrada pero requiere revisión del supervisor".

---

## 5. Modo offline-first

### 5.1 Detección de red

- `connectivity_plus` plugin reporta cambios
- Estado guardado en provider Riverpod global
- Indicador visible en todas las pantallas

### 5.2 Cuando no hay red durante captura

1. La marca + fotos se guardan en SQLite local
2. Las fotos se almacenan en almacenamiento interno cifrado: `app_data/pending_photos/{marca_uuid}/frame_{1,2,3}.jpg`
3. Se muestra al guardia: "⏳ Marca guardada localmente. Se sincronizará cuando vuelva la conexión."
4. Se incrementa el contador de pendientes en Home

### 5.3 Sincronización automática (background)

**Cuándo se dispara:**
- Cuando vuelve la conectividad (escucha eventos de `connectivity_plus`)
- Cada 15 minutos vía `workmanager` (incluso con app cerrada)
- Manualmente desde la pantalla "Pendientes" (P8)

**Algoritmo:**

```text
para cada marca en cola SQLite (orden FIFO):
    intento = 1
    mientras intento <= 5:
        intentar POST /api/marcas
        si OK (201):
            eliminar marca local
            eliminar fotos del FS
            break
        si error 4xx (excepto 408, 429):
            marcar como FAILED
            mover a tabla 'marcas_rechazadas' local
            break
        si error 5xx, 408, 429 o sin red:
            esperar (2^intento * 1000) ms con jitter
            intento++
    si intento > 5:
        marcar como FAILED_MAX_RETRIES
        notificar al guardia
```

**Límites:**
- Tamaño máximo de cola: 200 marcas (purga FIFO si excede)
- Tamaño máximo total de fotos en cache: 500 MB
- Si cola supera 50 marcas, mostrar notificación persistente al guardia

### 5.4 Cola de pendientes (P8)

```
┌───────────────────────────────────────┐
│  ← Marcas pendientes (3)              │
├───────────────────────────────────────┤
│  [📷] Entrada     06:12   ⏳ Pendiente │
│  [📷] Salida      14:00   ⏳ Pendiente │
│  [📷] Entrada     14:30   ⚠️ Falló (3x)│
│                                       │
│  [🔄 Forzar sincronización]           │
└───────────────────────────────────────┘
```

### 5.5 Conflict resolution

- Backend identifica duplicados por `(guardia_id, timestamp_device, tipo_evento)` con tolerancia de 5 segundos
- Si duplicado → responde 409 Conflict con ID de la marca original; cliente elimina la local

---

## 6. Seguridad anti-fraude (cliente)

### 6.1 Resumen de capas en cliente

| Capa | Mecanismo | Si se viola |
|---|---|---|
| **Cámara nativa** | Plugin `camera` configurado solo frontal, sin acceso a galería | Imposible bypassear sin modificar el binario |
| **Mock Location** | `geolocator.isMocked` (Android) | Bloqueo + alerta al backend con flag `mock_detected` |
| **Root/Jailbreak** | `flutter_jailbreak_detection` | Bloqueo de la marca + alerta al backend |
| **Emulador** | Heurística (modelo "generic", build tags "test-keys", etc.) | Bloqueo + alerta |
| **Play Integrity** | `play_integrity_flutter` antes de cada marca | Token enviado al backend, que lo verifica contra Google |
| **Cert Pinning** | `dio_certificate_pinning` con fingerprint del cert de prod | App no se conecta a otros servidores (anti-MITM) |
| **Code Obfuscation** | Build con `--obfuscate --split-debug-info=symbols/` | Dificulta reverse engineering del Dart |
| **HMAC Signing** | Cada request firma con `device_secret` + nonce + timestamp | Anti-replay; servidor rechaza requests sin firma válida o con nonce reusado |
| **Anti-debugging** | Verificar `BuildConfig.DEBUG == false` en runtime | Bloqueo silencioso si detecta debugger |

### 6.2 Generación de `device_secret`

- En el primer login, backend genera un secret aleatorio de 32 bytes
- Se envía al cliente UNA SOLA VEZ en la respuesta del login
- Cliente lo guarda en `flutter_secure_storage` (KeyStore hardware-backed cuando esté disponible)
- Cliente lo usa para firmar todas las requests posteriores
- Nunca se transmite de nuevo después del primer login

### 6.3 Algoritmo de firma HMAC

```dart
String message = "$method|$path|$timestamp|$nonce|$bodyHash";
String signature = HMAC-SHA256(message, deviceSecret).toBase64();
```

Headers a enviar:
- `X-Timestamp`: epoch en segundos
- `X-Nonce`: UUID v4 (servidor rechaza nonces ya vistos en últimos 5 min)
- `X-Signature`: firma HMAC base64
- `X-Body-Hash`: SHA256(body) si hay body (para multipart, hash del concatenado ordenado)

### 6.4 Política de bloqueo del cliente

Si se detecta CUALQUIERA de:
- Root/Jailbreak
- Emulador
- Debug build en producción
- Play Integrity falla
- Cert pinning falla

→ La app NO permite marcar y muestra:
```
🚫 Tu dispositivo no cumple los requisitos de seguridad.
   Causa: [específica si es seguro mostrarla]
   Contacta a tu supervisor.
```

Y envía un evento de telemetría al backend.

---

## 7. Historial personal (P6, P7)

### 7.1 Lista de marcas (P6)

- Muestra últimas N marcas (default 30 días, filtrable)
- Filtros: rango de fechas, tipo de evento, estado (sincronizada/pendiente/rechazada)
- Cada item muestra:
  - Tipo evento + hora
  - Miniatura de la foto
  - Estado con color (✅ verde / ⏳ ámbar / ❌ rojo)
  - Si tiene alertas: ícono ⚠️
- Pull-to-refresh
- Paginación infinita (lazy load de a 20)

### 7.2 Detalle de marca (P7)

- Foto en grande (la primera del trío)
- Tipo de evento, fecha y hora
- Ubicación (con minimapa estático)
- Estado y, si rechazada, motivo
- Si tiene alertas, lista de qué se detectó (transparencia)
- Botón "Reportar problema" (envía feedback al supervisor)

### 7.3 Origen de datos

- Online: `GET /api/marcas/mias?desde=...&hasta=...&estado=...`
- Cache local de las últimas 100 marcas en SQLite para visualización offline

---

## 8. Notificaciones push

### 8.1 Tipos de notificaciones

| Tipo | Cuándo | Acción al tap |
|---|---|---|
| Recordatorio de entrada | 15 min antes del turno | Abre Home |
| Recordatorio de refrigerio | A la hora pactada | Abre Home |
| Recordatorio de salida | 5 min antes del fin de turno | Abre Home |
| Marca rechazada | Cuando el backend rechaza una marca | Abre detalle de la marca rechazada |
| Cambio de puesto | Cuando admin reasigna | Abre Home |
| Cambio de turno | Cuando admin cambia turno | Abre Home |
| Mensaje del supervisor | Cuando supervisor envía mensaje | Abre pantalla del mensaje |
| Aviso de no marcación | Si el guardia no marca entrada en X min después de hora esperada | Abre Marcar |

### 8.2 Implementación

- Firebase Cloud Messaging (FCM)
- Token FCM se envía al backend en login y cada vez que cambia
- Backend envía push via Firebase Admin SDK desde un job de Arq
- Tap en notificación abre la pantalla destino + marca como leída

### 8.3 Persistencia de notificaciones in-app

- Bandeja de notificaciones accesible desde el ícono 🔔 del Home
- Guardadas en SQLite local

---

## 9. Configuración y perfil (P9, P10, P11)

### 9.1 Perfil (P9)

- Foto del guardia (foto de referencia que usa Face Matching)
- Datos personales (solo lectura): nombre completo, DNI, código empleado, cargo
- Empresa y supervisor asignado
- Botón "Cambiar contraseña"
- Botón "Cerrar sesión"

### 9.2 Cambio de password (P10)

- Form: password actual + nuevo + confirmar
- Validaciones: mín 8 chars, mayúscula, número, símbolo
- `POST /api/auth/change-password`

### 9.3 Configuración (P11)

- Modo de alto contraste (toggle)
- Tamaño de fuente (pequeño / normal / grande)
- Permitir push notifications (toggle, sincroniza con permisos del sistema)
- Limpiar caché de fotos (solo las ya sincronizadas)
- Reportar un problema (form de soporte)
- Política de privacidad → P12
- Términos de uso → P13
- Acerca de → P14

---

## 10. Accesibilidad y UX

### 10.1 Principios

- **Botones grandes** (mínimo 48dp) — usable con guantes
- **Alto contraste opcional** — operación nocturna o luz solar directa
- **Tipografía legible** (mínimo 16sp por defecto)
- **Vibración háptica** en confirmaciones importantes
- **Sonidos opcionales** (toggle)
- **Mensajes claros, sin jerga técnica**

### 10.2 Estados de carga

- Skeleton screens en lugar de spinners cuando sea posible
- Operaciones largas (>2s) deben mostrar progreso
- Operaciones de marcado nunca bloquean indefinidamente (timeout 30s)

### 10.3 Mensajes de error

- Siempre incluir:
  - Qué pasó (en español plano)
  - Qué hacer al respecto
  - Cómo contactar soporte si persiste

---

## 11. Permisos del sistema

| Permiso | Cuándo se pide | Justificación al usuario |
|---|---|---|
| Cámara | Primera vez que entra a Marcar | "Necesaria para registrar tu foto de asistencia" |
| Ubicación (foreground + background) | Primera vez | "Necesaria para validar que estás en tu puesto" |
| Notificaciones | Primer login (Android 13+) | "Para recordatorios de turno y alertas importantes" |
| Internet | Automático | n/a |
| Almacenamiento (solo interno) | Automático | n/a |

**Política:** si el usuario rechaza un permiso crítico (cámara, ubicación) → la app no funciona, pantalla bloqueante con instrucciones para activar desde Settings de Android.

---

## 12. Casos de error y mensajes al usuario

| Situación | Mensaje |
|---|---|
| Sin red durante login | "Sin conexión a internet. Necesitas conexión para iniciar sesión la primera vez." |
| Sin red durante marca | "Sin conexión. Tu marca se guardó localmente y se enviará cuando vuelva la conexión." |
| GPS desactivado | "Activa el GPS para poder marcar. Toca aquí para abrir configuración." |
| Mock Location detectado | "🚫 Se detectó GPS falso. No puedes marcar. Desactívalo o usa otro dispositivo." |
| Root detectado | "🚫 Tu dispositivo está modificado y no cumple los requisitos de seguridad. Contacta a tu supervisor." |
| Cámara denegada | "Necesitamos permiso de cámara para registrar tu marca. Toca aquí para activarlo." |
| Liveness falló | "No se pudo verificar tu identidad. Intenta de nuevo en buena luz, mirando directamente a la cámara." |
| Token expirado, refresh falló | "Tu sesión expiró. Por favor, inicia sesión de nuevo." |
| Servidor caído | "El servidor no responde. Tu marca se guardó localmente y se enviará cuando se restablezca el servicio." |
| Versión obsoleta | "Hay una nueva versión obligatoria. Actualiza desde Play Store para continuar." |
| Device bloqueado por supervisor | "Tu dispositivo fue bloqueado. Contacta a tu supervisor para más información." |

---

## 13. Métricas y telemetría a capturar

La app envía eventos de telemetría al backend para que el supervisor pueda monitorear comportamiento (no logs personales detallados, solo eventos de sistema):

- Login exitoso / fallido
- Marca registrada (con metadata)
- Marca rechazada localmente (root, mock, etc.)
- Sincronización exitosa de cola pendiente
- Crash / error reportado (vía Sentry)
- Tiempo desde apertura de app hasta marca registrada
- Versión de la app + OS + modelo de device

---

## 14. Stack y arquitectura interna de la app

### 14.1 Estructura de carpetas Flutter (propuesta)

```text
mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── core/
│   │   ├── config/          # AppConfig, env vars
│   │   ├── constants/
│   │   ├── di/              # Riverpod providers globales
│   │   ├── errors/
│   │   ├── network/         # Dio, interceptors, cert pinning
│   │   ├── security/        # HMAC, KeyStore, integrity checks
│   │   ├── storage/         # SQLite, SecureStorage
│   │   ├── theme/
│   │   └── utils/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/        # Repositories, datasources
│   │   │   ├── domain/      # Entities, use cases
│   │   │   └── presentation/# Pages, widgets, providers
│   │   ├── home/
│   │   ├── marca/
│   │   ├── historial/
│   │   ├── pendientes/
│   │   ├── perfil/
│   │   └── settings/
│   └── shared/
│       ├── widgets/         # Botones, snackbars, etc. reusables
│       └── models/
├── android/
├── ios/                     # placeholder, no se compila en MVP
├── test/
├── integration_test/
├── assets/
│   ├── images/
│   ├── fonts/
│   └── translations/
└── pubspec.yaml
```

### 14.2 Arquitectura aplicada

- **Clean Architecture** simplificada (3 capas: data / domain / presentation)
- **Riverpod** para state management e inyección de dependencias
- **Repository pattern** para abstraer fuentes de datos (API vs local)
- **Freezed** para modelos inmutables + unions
- **Result type** para manejo explícito de errores (`Result<Success, Failure>`)

---

## 15. Criterios de aceptación (Fase 2)

Para que la app móvil se considere "lista para Fase 3":

- [ ] Login + sesión persistente funcional
- [ ] Captura de marca con cámara frontal funciona en 5+ devices Android distintos
- [ ] Modo offline: registrar 10 marcas sin red, recuperar red, todas se sincronizan correctamente
- [ ] Mock Location detectada y bloqueada en device con Fake GPS instalado
- [ ] Root detection funciona en device rooteado
- [ ] Play Integrity token enviado y verificado por backend
- [ ] HMAC signing funcional, requests sin firma rechazadas
- [ ] Cert pinning funcional, app no se conecta a backend con cert distinto
- [ ] Push notifications recibidas en foreground y background
- [ ] APK obfuscado y firmado, tamaño < 30MB
- [ ] Pruebas de campo: 1 día completo con un guardia real, sin crashes
- [ ] Cobertura de tests unitarios ≥ 70%
- [ ] Integration tests en al menos 3 flujos críticos

---

## 16. Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md)
- 🏛️ [`arquitectura.md`](./arquitectura.md)
- ⚙️ [`funcionalidades-backend.md`](./funcionalidades-backend.md)
- 🛡️ [`seguridad.md`](./seguridad.md)
- 🗓️ [`roadmap-fases.md`](./roadmap-fases.md)
