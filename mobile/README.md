# App Móvil — Smart Control Security

App Flutter para guardias de seguridad: marca de asistencia con foto + GPS, modo offline-first y seguridad anti-fraude.

> 📚 **Documentación funcional completa:** [`../docs/funcionalidades-app-movil.md`](../docs/funcionalidades-app-movil.md)
> 🛡️ **Estrategia de seguridad:** [`../docs/seguridad.md`](../docs/seguridad.md)
> 🗓️ **Roadmap:** [`../docs/roadmap-fases.md`](../docs/roadmap-fases.md)

---

## 🎯 Estado actual

**Scaffold inicial creado.** Listo para que un desarrollador Flutter ejecute los pasos de inicialización (abajo) y comience la Fase 2.

> ⚠️ **Importante:** este scaffold contiene la estructura de código Dart (`lib/`, `pubspec.yaml`, etc.) pero NO contiene los archivos específicos de plataforma (`android/`, `ios/`). Esos los genera Flutter automáticamente con `flutter create .` (ver paso 2 abajo).

---

## 🧱 Stack

- **Flutter 3.24+** / Dart 3.4+
- **Riverpod 2.x** — state management
- **Dio** + cert pinning — HTTP
- **sqflite** — SQLite local para modo offline
- **camera** + **ML Kit Face Detection** — captura + liveness on-device
- **geolocator** — GPS con anti-spoofing
- **workmanager** — sincronización en background
- **flutter_secure_storage** — KeyStore para tokens y secrets
- **Firebase Messaging** — push notifications

Ver lista completa de dependencias en [`pubspec.yaml`](./pubspec.yaml).

---

## 🚀 Primera vez configurando este proyecto

### Requisitos

1. **Flutter SDK 3.24 o superior** ([instalación oficial](https://docs.flutter.dev/get-started/install/windows))
2. **Android Studio** (incluye Android SDK + emulador)
3. Para pruebas reales: un **device Android físico** con depuración USB habilitada
4. (Opcional pero recomendado) **VS Code** con la extensión Flutter

Verifica la instalación con:

```bash
flutter doctor
```

Debe mostrar ✅ en Flutter, Android toolchain y al menos un device.

### Paso 1: Clonar el repo (si no lo tienes)

```bash
git clone <repo-url>
cd smart_control_security/mobile
```

### Paso 2: Generar archivos de plataforma (PRIMERA vez)

El scaffold no incluye las carpetas `android/` ni `ios/`. Flutter las genera:

```bash
# Desde mobile/
flutter create . --org com.balcuapps.smartcontrolsecurity --platforms=android
```

Esto crea `android/` con `build.gradle`, `AndroidManifest.xml`, etc. **Solo se hace una vez.**

> El `--platforms=android` indica que solo generamos Android. Si en el futuro queremos iOS, ejecutar:
> `flutter create . --platforms=android,ios`

### Paso 3: Instalar dependencias

```bash
flutter pub get
```

### Paso 4: Correr la app

Con el device conectado por USB (o emulador encendido):

```bash
flutter run
```

Deberías ver la pantalla del scaffold inicial: **"Smart Control Security — App móvil de control de asistencia"** con un ícono de escudo.

---

## 🛠️ Comandos útiles

```bash
# Análisis estático (linter)
flutter analyze

# Formatear código
dart format .

# Correr tests
flutter test

# Tests con cobertura
flutter test --coverage

# Generar código (Freezed, Riverpod codegen)
dart run build_runner build --delete-conflicting-outputs

# Modo watch para code generation
dart run build_runner watch

# Limpiar build
flutter clean
```

### Build de release (cuando lleguemos a producción)

```bash
# APK con obfuscation (anti reverse engineering)
flutter build apk --release \
  --obfuscate \
  --split-debug-info=build/symbols/

# App Bundle para Play Store
flutter build appbundle --release \
  --obfuscate \
  --split-debug-info=build/symbols/
```

> ⚠️ Guarda la carpeta `build/symbols/` en un lugar seguro — la necesitarás para de-obfuscar stack traces en Sentry.

---

## 📁 Estructura del proyecto

```
mobile/
├── lib/                          # Código Dart
│   ├── main.dart                 # Entry point
│   ├── app.dart                  # Widget raíz
│   ├── core/                     # Infraestructura compartida
│   │   ├── config/               # AppConfig, env (Fase 2)
│   │   ├── network/              # Dio + interceptors (Sprint 2.6)
│   │   ├── security/             # HMAC, KeyStore (Sprint 2.6)
│   │   ├── storage/              # SQLite + Secure (Sprint 2.5)
│   │   └── theme/                # Temas Material 3
│   ├── features/                 # Una carpeta por dominio
│   │   ├── auth/                 # Login, refresh, logout (Sprint 2.2)
│   │   ├── home/                 # Dashboard guardia (Sprint 2.3)
│   │   ├── marca/                # Captura asistencia (Sprint 2.4)
│   │   ├── historial/            # Marcas propias (Sprint 2.7)
│   │   ├── pendientes/           # Cola offline (Sprint 2.5)
│   │   ├── perfil/               # Datos guardia (Sprint 2.3)
│   │   └── settings/             # Configuración (Sprint 2.3)
│   └── shared/                   # Widgets reutilizables
│       └── widgets/
├── test/                         # Tests unitarios + widget
│   └── widget_test.dart
├── integration_test/             # Tests E2E (se crea en Fase 2)
├── android/                      # ⚠️ Generado por flutter create
├── ios/                          # ⚠️ Generado por flutter create (futuro)
├── pubspec.yaml                  # Dependencias y metadata
├── analysis_options.yaml         # Reglas de linter (very_good_analysis)
├── .gitignore
└── README.md                     # Este archivo
```

### Arquitectura aplicada (Clean Architecture)

Cada `feature/` se divide en 3 capas:

```
features/<feature>/
├── data/             # Implementación: API datasources, DB
├── domain/           # Reglas de negocio: entities, use cases
└── presentation/     # UI: pages, widgets, Riverpod providers
```

---

## 🔐 Configuración antes de Fase 2

Antes de empezar a desarrollar features, configurar:

- [ ] **Firebase project** creado y `google-services.json` colocado en `android/app/` (NO commitear)
- [ ] **Keystore Android** para builds firmados (NO commitear)
- [ ] **URL del backend** en variables de entorno
- [ ] **Cert pinning fingerprint** del backend de staging
- [ ] Confirmar **versión mínima de Android** (sugerido API 28 = Android 9)

---

## 🐛 Troubleshooting

### "Flutter command not found"
Flutter no está en tu PATH. Reinstala siguiendo [los pasos oficiales](https://docs.flutter.dev/get-started/install/windows) y reinicia tu terminal.

### "Android licenses not accepted"
```bash
flutter doctor --android-licenses
```
Acepta todas las licencias.

### "No connected devices"
- Conecta tu Android por USB con **depuración USB habilitada** (Settings → Developer Options → USB Debugging)
- O abre un emulador desde Android Studio (AVD Manager)
- Verifica con: `flutter devices`

### "Gradle build failed"
Asegúrate de tener Android SDK Build-Tools y NDK actualizados:
```bash
flutter doctor -v
```

### El device dice "no se puede instalar"
Desinstala versiones previas: `flutter clean && flutter pub get && flutter run`

---

## 🤝 Convenciones

- **Naming**: snake_case para archivos, PascalCase para clases, camelCase para variables/funciones
- **Estructura por feature** (no por tipo) — todo lo de auth en `features/auth/`
- **Inmutabilidad** con Freezed para modelos
- **Riverpod** con `@riverpod` annotation + codegen
- **Tests** obligatorios para use cases y widgets críticos
- Pre-push: `flutter analyze && dart format . && flutter test`
