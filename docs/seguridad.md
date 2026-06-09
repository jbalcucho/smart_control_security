# 🛡️ Estrategia de Seguridad y Anti-Fraude — Smart Control Security

> Este documento define el modelo de amenazas, las contramedidas técnicas, y el cumplimiento legal del sistema. La seguridad no es una fase aparte: está integrada en todos los componentes.

---

## Índice

1. [Principios rectores](#1-principios-rectores)
2. [Modelo de amenazas](#2-modelo-de-amenazas)
3. [Defensa en profundidad — App móvil](#3-defensa-en-profundidad--app-móvil)
4. [Defensa en profundidad — Backend](#4-defensa-en-profundidad--backend)
5. [Defensa en profundidad — Infraestructura](#5-defensa-en-profundidad--infraestructura)
6. [Anti-fraude: Liveness + Face Matching](#6-anti-fraude-liveness--face-matching)
7. [Anti-fraude: GPS](#7-anti-fraude-gps)
8. [Anti-replay: HMAC + nonces](#8-anti-replay-hmac--nonces)
9. [Manejo de secretos](#9-manejo-de-secretos)
10. [Cumplimiento legal](#10-cumplimiento-legal)
11. [Plan de incident response](#11-plan-de-incident-response)
12. [Checklist de seguridad](#12-checklist-de-seguridad)

---

## 1. Principios rectores

Todas las decisiones de seguridad se rigen por estos principios:

1. **Never trust the client.** Cualquier validación crítica DEBE replicarse en el servidor.
2. **Defensa en profundidad.** Múltiples capas; si una falla, otras protegen.
3. **Least privilege.** Cada componente tiene solo los permisos mínimos necesarios.
4. **Fail securely.** Si algo falla, el sistema rechaza por defecto, no acepta.
5. **Transparencia hacia el usuario.** El guardia sabe qué se valida y por qué.
6. **Privacidad por diseño.** Datos biométricos protegidos desde la captura hasta el almacenamiento.
7. **Auditabilidad total.** Toda acción crítica queda registrada en `audit_log`.
8. **Cifrado en tránsito y en reposo.** Sin excepciones.

---

## 2. Modelo de amenazas

### 2.1 Actores hostiles

| Actor | Motivación | Capacidad técnica |
|---|---|---|
| **Guardia deshonesto** | Cobrar sin trabajar | Baja-media. Usa apps de Fake GPS, fotos antiguas, pide a otro que marque por él |
| **Guardia técnico** | Bypassear controles | Media. Rootea su device, usa apps de modding, conoce hacks comunes |
| **Compañero cómplice** | Marcar por otro guardia | Baja. Solo necesita el device |
| **Atacante externo (red)** | Robar datos / inyectar marcas falsas | Alta. MITM, sniffing, replay attacks |
| **Empleado interno malicioso** | Acceder a datos de otros, manipular registros | Alta. Conoce la infraestructura |
| **Atacante con device físico** | Reverse engineering de la app | Media-alta |

### 2.2 Vectores de ataque identificados

| # | Vector | Impacto | Probabilidad | Riesgo |
|---|---|---|---|---|
| V1 | Suplantación con foto impresa | Alto | Alta | 🔴 Crítico |
| V2 | Suplantación con video en pantalla | Alto | Media | 🟠 Alto |
| V3 | Suplantación con deepfake | Alto | Baja (pero creciente) | 🟠 Alto |
| V4 | Fake GPS (mock location) | Alto | Alta | 🔴 Crítico |
| V5 | Manipulación de fecha/hora del device | Medio | Alta | 🟠 Alto |
| V6 | Replay attack (reenvío de request válida) | Alto | Media | 🟠 Alto |
| V7 | MITM intercepta credenciales | Crítico | Baja | 🟠 Alto |
| V8 | Device rooteado bypassea controles | Alto | Media | 🟠 Alto |
| V9 | Misma cuenta usada en N devices | Medio | Alta | 🟠 Alto |
| V10 | App modificada (APK alterado) | Alto | Baja | 🟡 Medio |
| V11 | SQL Injection / NoSQL Injection | Crítico | Baja (Pydantic + ORM) | 🟡 Medio |
| V12 | Robo de tokens JWT | Alto | Media | 🟠 Alto |
| V13 | Acceso indebido a fotos en S3 | Crítico | Baja | 🟡 Medio |
| V14 | Insider con acceso DB | Crítico | Baja | 🟠 Alto |
| V15 | Pérdida masiva de fotos (legal/reputacional) | Crítico | Baja | 🟠 Alto |
| V16 | DDoS al backend | Medio | Media | 🟡 Medio |
| V17 | Reverse engineering revela device_secret embebido | Alto | N/A (no se embebe) | 🟢 Mitigado |

---

## 3. Defensa en profundidad — App móvil

### 3.1 Capas de protección

```text
┌─────────────────────────────────────────────────────────┐
│  Capa 1: Hardware del device                           │
│    - Android KeyStore (TEE-backed cuando disponible)   │
│    - Hardware attestation via Play Integrity           │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 2: Sistema operativo                              │
│    - Permisos granulares (cámara, ubicación)           │
│    - Sandboxing de la app                              │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 3: Binario de la app                              │
│    - Code obfuscation (--obfuscate)                    │
│    - Anti-debugging checks                             │
│    - Detección root/jailbreak                          │
│    - Detección emulador                                │
│    - Verificación de firma del APK                     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 4: Almacenamiento local                           │
│    - flutter_secure_storage para JWT/secret/refresh    │
│    - SQLite cifrado (sqflite_sqlcipher)                │
│    - Fotos pendientes en directorio interno encriptado │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 5: Captura biométrica                             │
│    - Cámara nativa frontal forzada                     │
│    - Galería bloqueada totalmente                      │
│    - Challenge-response on-device (ML Kit)             │
│    - 3 frames capturados                               │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 6: Captura GPS                                    │
│    - Detección Mock Location (geolocator.isMocked)     │
│    - Validación de precisión (<50m)                    │
│    - Coordenadas firmadas con el resto del payload     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 7: Comunicación de red                            │
│    - TLS 1.3 obligatorio                               │
│    - Certificate Pinning con fingerprint del cert      │
│    - HMAC-SHA256 signing de cada request               │
│    - Nonce + timestamp en cada request                 │
│    - Play Integrity token en cada marca                │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Detalle por mecanismo

#### 3.2.1 Cámara nativa forzada

```dart
final cameras = await availableCameras();
final frontCamera = cameras.firstWhere(
  (c) => c.lensDirection == CameraLensDirection.front,
  orElse: () => throw NoFrontCameraException(),
);
controller = CameraController(frontCamera, ResolutionPreset.medium);
```

→ No se usa `image_picker.pickImage(source: ImageSource.gallery)` **NUNCA** en el código.

#### 3.2.2 Detección Mock Location

```dart
final position = await Geolocator.getCurrentPosition(
  desiredAccuracy: LocationAccuracy.high,
);
if (position.isMocked) {
  await reportMockLocationAttempt();
  throw MockLocationDetectedException();
}
```

→ Bloqueo inmediato + envío de telemetría al backend para que el supervisor lo sepa.

#### 3.2.3 Detección root + emulador

```dart
final jailbroken = await FlutterJailbreakDetection.jailbroken;
final developerMode = await FlutterJailbreakDetection.developerMode;
final isEmulator = await _checkEmulatorHeuristics(); // build tags, modelo, etc.

if (jailbroken || isEmulator) {
  await reportSecurityViolation(...);
  throw DeviceCompromisedException();
}
```

#### 3.2.4 Play Integrity API

```dart
final integrityToken = await PlayIntegrity.requestIntegrityToken(
  cloudProjectNumber: APP_CLOUD_PROJECT_NUMBER,
  nonce: requestNonce, // ata el token a esta request específica
);
// el token se envía al backend; el backend lo verifica contra Google
```

Verificación server-side:
```python
async def verify_play_integrity(token: str, expected_nonce: str) -> IntegrityResult:
    response = await google_play_api.decode_integrity_token(token)
    if response.request_details.nonce != expected_nonce:
        raise IntegrityVerificationFailed("nonce_mismatch")
    if response.device_integrity.device_recognition_verdict != "MEETS_DEVICE_INTEGRITY":
        raise IntegrityVerificationFailed("device_compromised")
    if response.app_integrity.app_recognition_verdict != "PLAY_RECOGNIZED":
        raise IntegrityVerificationFailed("app_tampered")
    return IntegrityResult(passed=True, details=response)
```

#### 3.2.5 Certificate Pinning

```dart
final dio = Dio();
dio.interceptors.add(
  CertificatePinningInterceptor(
    allowedSHAFingerprints: [
      'SHA256_FINGERPRINT_DEL_CERT_PROD',
      'SHA256_FINGERPRINT_DEL_CERT_BACKUP', // para rotación
    ],
  ),
);
```

→ La app **solo** acepta conexión si el cert del servidor matchea uno de los fingerprints listados.

#### 3.2.6 Code Obfuscation en build

```bash
flutter build appbundle \
  --release \
  --obfuscate \
  --split-debug-info=build/symbols/
```

→ Los símbolos Dart se reemplazan; los debug symbols se guardan separados para poder deobfuscar stack traces de Sentry.

---

## 4. Defensa en profundidad — Backend

### 4.1 Capas

```text
┌─────────────────────────────────────────────────────────┐
│  Capa 1: Edge (CDN/WAF)                                 │
│    - AWS CloudFront + AWS WAF (futuro)                 │
│    - Bloqueo de IPs maliciosas                         │
│    - Rate limiting global por IP                       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 2: API Gateway / NGINX                            │
│    - SSL termination (TLS 1.3 only)                    │
│    - Rate limiting por endpoint                        │
│    - Request size limits                               │
│    - Logging de todas las requests                     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 3: FastAPI middleware                             │
│    - CORS estricto (origin allowlist)                  │
│    - Request ID propagation                            │
│    - HMAC signature verification                       │
│    - Nonce verification (Redis, TTL 5min)              │
│    - Timestamp skew check (±5min)                      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 4: Auth middleware                                │
│    - JWT verification (RS256 con par pública/privada)  │
│    - Verificación de blacklist de tokens (Redis)       │
│    - Verificación de rol y permisos                    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 5: Validación de entrada (Pydantic)               │
│    - Type checking estricto                            │
│    - Validators custom (rangos, formatos)              │
│    - Tamaño de payloads limitado                       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 6: Lógica de negocio                              │
│    - Validación de permisos por recurso                │
│    - Anti-replay a nivel DB (UNIQUE nonce)             │
│    - Validación temporal (timestamp del servidor)      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Capa 7: Persistencia                                   │
│    - SQLAlchemy ORM (anti SQL injection)               │
│    - Connection pooling con límites                    │
│    - Prepared statements implícitos                    │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Rate limiting por endpoint

| Endpoint | Límite por device | Límite por IP |
|---|---|---|
| `POST /api/auth/login` | 5/min | 20/min |
| `POST /api/auth/refresh` | 10/min | 30/min |
| `POST /api/marcas` | 1/min | 10/min |
| `POST /api/auth/forgot-password` | 3/hora | 10/hora |
| Otros GET | 60/min | 200/min |

Implementado con `slowapi` o middleware custom backed por Redis.

---

## 5. Defensa en profundidad — Infraestructura

### 5.1 AWS

| Servicio | Protecciones |
|---|---|
| **VPC** | Subnets privadas para DB y Redis; pública solo para LB |
| **Security Groups** | Reglas mínimas (ej. DB solo desde el backend) |
| **RDS** | Encryption at rest (KMS), backups automáticos, IAM auth opcional |
| **S3** | SSE-KMS, bucket policies estrictas, sin acceso público |
| **Secrets Manager** | Para todas las credenciales (DB password, AWS keys, SendGrid key) |
| **IAM** | Least privilege en roles ECS/App Runner |
| **CloudTrail** | Auditoría de cambios de infraestructura |
| **GuardDuty** | Detección de actividad anómala (futuro) |
| **WAF** | Reglas básicas anti-OWASP Top 10 |

### 5.2 Red

- TLS 1.3 únicamente (TLS 1.2 mínimo, sin SSL/v1)
- Cifrados modernos (sin RC4, sin DES, sin MD5)
- HSTS habilitado
- Headers de seguridad: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy`

### 5.3 Backups y disaster recovery

- RDS: backups automáticos diarios, retención 7 días
- S3: versioning + cross-region replication para fotos críticas
- DB snapshots manuales antes de cada migración mayor
- Plan de DR documentado: RTO 4h, RPO 1h

---

## 6. Anti-fraude: Liveness + Face Matching

### 6.1 Pipeline biométrico

```text
1. Cliente captura 3 frames durante challenge ML Kit
2. Cliente sube los 3 frames al backend
3. Backend sube frames a S3 (URLs privadas)
4. Backend envía URLs a AWS Rekognition Face Liveness
   → Resultado: {is_live: bool, confidence: 0-100}
5. Si is_live == false → RECHAZAR la marca con error_code "liveness_failed"
6. Si is_live == true:
   Backend hace CompareFaces(frame_1, foto_referencia_guardia)
   → Resultado: {similarity: 0-100, match: bool}
7. Si similarity < UMBRAL_MATCH (default 90) → RECHAZAR con "face_mismatch"
8. Si pasa todo → ACEPTAR marca, guardar scores en DB para auditoría
```

### 6.2 Umbrales (configurables por empresa)

| Métrica | Default | Justificación |
|---|---|---|
| Liveness confidence mínimo | 80 | Balance entre falsos positivos y falsos negativos |
| Face match similarity mínimo | 90 | Estándar industria para alta confianza |

### 6.3 Foto de referencia

- Se sube al crear el guardia (por admin) desde el panel
- Debe ser foto frontal, buena iluminación, sin lentes
- Política: revisar y actualizar anualmente o tras cambio de apariencia significativa

### 6.4 Casos edge

| Caso | Manejo |
|---|---|
| Guardia con barba/sin barba en distintos días | Face Match es robusto, pero si baja consistentemente → actualizar foto referencia |
| Guardia con mascarilla obligatoria | Detectar y exigir captura sin mascarilla (con prompt) |
| Liveness API caído | Fallback: marcar como "pendiente de validación", supervisor revisa en panel |
| Costo de Rekognition se dispara | Implementar fallback a validación on-device + Rekognition asíncrono cada N marcas |

---

## 7. Anti-fraude: GPS

### 7.1 Tres capas de validación GPS

```text
┌──────────────────────────────────────────────────────────────────┐
│  Capa 1: Cliente (preventiva)                                    │
│    - Detección Mock Location en device → bloqueo inmediato       │
│    - Verificación de precisión < 50m                             │
│    - Verificación de Play Integrity (device confiable)           │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  Capa 2: Backend en tiempo real (PostGIS)                        │
│    - ¿Está dentro del geofence del puesto? (ST_Contains)         │
│    - Distancia a marca anterior (ST_Distance)                    │
│    - Velocidad implícita = distancia / tiempo                    │
│    - Si velocidad > 150 km/h → flag alerta_fraude_gps            │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  Capa 3: Analítica batch (Pandas)                                │
│    - Patrones repetitivos sospechosos                            │
│    - Clustering de marcas atípicas                               │
│    - Histórico de comportamiento del guardia                     │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Geofencing

Cada puesto tiene un polígono (`GEOGRAPHY(POLYGON, 4326)`). El backend valida:

```sql
SELECT ST_Contains(p.geofence::geometry,
                   ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
FROM puestos p
WHERE p.id = :puesto_id;
```

Si retorna `false`:
- La marca se acepta pero se marca `en_geofence = false`
- Se genera alerta `fuera_geofence`
- El supervisor decide si validarla o rechazarla

### 7.3 Umbral de velocidad imposible

- Default: 150 km/h (descarta caminar, trotar, conducir normal; detecta teletransporte)
- Configurable por empresa según contexto (ej. guardias en moto pueden ir a 80 km/h legítimamente)

---

## 8. Anti-replay: HMAC + nonces

### 8.1 Algoritmo de firma

**Cliente:**
```dart
final timestamp = DateTime.now().millisecondsSinceEpoch ~/ 1000;
final nonce = Uuid().v4();
final bodyHash = sha256.convert(utf8.encode(jsonBody)).toString();
final message = "$method|$path|$timestamp|$nonce|$bodyHash";
final signature = Hmac(sha256, utf8.encode(deviceSecret))
    .convert(utf8.encode(message))
    .toString();
```

**Headers que envía:**
- `X-Timestamp: 1717891234`
- `X-Nonce: <uuid-v4>`
- `X-Body-Hash: <sha256>`
- `X-Signature: <hmac-base64>`

### 8.2 Validación server-side

```python
async def verify_hmac_request(request: Request, device_secret: str) -> None:
    # 1. Timestamp dentro de ventana (±5 min)
    ts = int(request.headers["X-Timestamp"])
    if abs(time.time() - ts) > 300:
        raise HTTPException(401, "timestamp_skew")

    # 2. Nonce no repetido (Redis)
    nonce = request.headers["X-Nonce"]
    if await redis.exists(f"nonce:{nonce}"):
        raise HTTPException(409, "nonce_reused")
    await redis.set(f"nonce:{nonce}", "1", ex=600)  # TTL 10min

    # 3. Body hash matches
    body = await request.body()
    expected_hash = hashlib.sha256(body).hexdigest()
    if request.headers["X-Body-Hash"] != expected_hash:
        raise HTTPException(401, "body_hash_mismatch")

    # 4. Signature valida
    message = f"{request.method}|{request.url.path}|{ts}|{nonce}|{expected_hash}"
    expected_sig = hmac.new(
        device_secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(request.headers["X-Signature"], expected_sig):
        raise HTTPException(401, "signature_invalid")
```

### 8.3 Persistencia adicional

La tabla `marcas` tiene `UNIQUE (guardia_id, nonce)` como segunda línea de defensa anti-replay (defensa en profundidad).

---

## 9. Manejo de secretos

### 9.1 Categorías de secretos

| Secreto | Ubicación | Rotación |
|---|---|---|
| DB password | AWS Secrets Manager | Cada 90 días |
| JWT signing key (par RSA) | AWS Secrets Manager | Cada 12 meses |
| HMAC keys server-side | Secrets Manager | n/a (no se usan, solo se verifican las del cliente) |
| `device_secret` (por device) | DB (hash bcrypt) + KeyStore del cliente | n/a (se regenera si se desvincula device) |
| AWS access keys (en code) | NUNCA — usar IAM Roles | n/a |
| SendGrid API key | Secrets Manager | Cada 6 meses |
| Firebase private key | Secrets Manager | Cada 12 meses |
| KMS keys (S3) | AWS KMS | Cada 12 meses (auto-rotación) |

### 9.2 Acceso a secretos

- Backend lee secretos al boot desde AWS Secrets Manager (IAM role del task)
- Cache en memoria (no en disco)
- Logs nunca contienen valores de secretos (sanitización)
- `.env.example` versionado con valores dummy; `.env` ignorado por Git

### 9.3 device_secret (clave HMAC del cliente)

**Generación (server-side, en primer login):**
```python
device_secret = secrets.token_urlsafe(32)  # 256 bits aleatorios
secret_hash = bcrypt.hashpw(device_secret.encode(), bcrypt.gensalt())
# guardar hash en DB
# enviar device_secret al cliente UNA SOLA VEZ
```

**Almacenamiento (cliente):**
- `flutter_secure_storage` que usa Android KeyStore
- En devices con TEE (Trusted Execution Environment) la clave está respaldada por hardware
- Si el cliente desinstala la app → secret se pierde → debe re-loguear → backend genera nuevo secret y revoca el anterior

---

## 10. Cumplimiento legal

### 10.1 Marcos aplicables (según país del cliente)

| País | Ley/marco | Requisitos clave |
|---|---|---|
| 🇨🇴 Colombia | **Ley 1581 de 2012 (Habeas Data)** + Decreto 1377 | Consentimiento expreso, finalidad específica, autorización para datos biométricos |
| 🇧🇷 Brasil | **LGPD** | Base legal para tratamiento, DPO si aplica, derechos del titular |
| 🇲🇽 México | **LFPDPPP** | Aviso de privacidad, derechos ARCO |
| 🇪🇺 UE | **GDPR** | Consentimiento granular, derecho al olvido, DPIA para biometría |
| 🇨🇱 Chile | Ley 19.628 (actualización 21.719) | Similar a GDPR adaptado |
| 🇵🇪 Perú | Ley 29733 | Registro de bancos de datos personales |

### 10.2 Datos biométricos = categoría especial

Las fotos faciales son **datos biométricos**, una categoría de **especial protección** en casi todas las legislaciones modernas.

**Implicaciones:**
- Requiere **consentimiento expreso, informado y específico** (no genérico)
- El titular debe poder **revocar su consentimiento** en cualquier momento
- Almacenamiento por tiempo limitado (principio de proporcionalidad)
- Cifrado obligatorio en tránsito y reposo

### 10.3 Implementación del consentimiento

1. **En el contrato laboral del guardia:** cláusula explícita de uso de datos biométricos para control de asistencia.
2. **En la primera apertura de la app:** modal de aceptación de política de privacidad con scroll obligatorio antes de "Aceptar".
3. **Registro auditable:** se guarda en DB cuándo y desde qué device aceptó cada versión de la política.
4. **Política disponible siempre** en la pantalla P12 (Configuración → Política de privacidad).

### 10.4 Política de retención

| Dato | Tiempo máximo |
|---|---|
| Foto de marca | 1 año (configurable, mín 90 días para auditoría laboral) |
| Foto de referencia | mientras el guardia esté activo + 6 meses |
| Coordenadas GPS | mismo que la marca |
| Marcas (registro) | 3 años (legislación laboral típica) |
| Datos del guardia desactivado | 1 año, luego anonimización |

### 10.5 Derechos del titular (guardia)

La app debe permitir (o vía solicitud al admin):

- **Acceso:** ver todos sus datos (historial completo)
- **Rectificación:** solicitar corrección de datos erróneos
- **Cancelación / Supresión:** solicitar borrado (sujeto a obligaciones legales del empleador)
- **Oposición:** revocar consentimiento (implica baja del sistema)
- **Portabilidad:** exportar sus marcas en formato estándar (CSV/JSON)

Implementar endpoints `GET /api/guardias/me/datos-personales` y `POST /api/guardias/me/solicitar-borrado`.

### 10.6 DPIA (Data Protection Impact Assessment)

Antes de producción, realizar un DPIA documentado que cubra:
- Naturaleza del tratamiento
- Necesidad y proporcionalidad
- Riesgos para los derechos del guardia
- Medidas de mitigación implementadas

### 10.7 Otros aspectos legales

- **Términos y condiciones** del servicio entre Balcuapps y empresas cliente
- **Acuerdo de tratamiento de datos** (DPA) que define a Balcuapps como Encargado y al cliente como Responsable
- **Política de cookies** si el panel web usa cookies analíticas
- **Notificación obligatoria de brechas** (72h en GDPR, 15 días hábiles en Colombia)

---

## 11. Plan de incident response

### 11.1 Severidad de incidentes

| Nivel | Descripción | Tiempo de respuesta |
|---|---|---|
| **P0 — Crítico** | Filtración masiva de datos / sistema caído | Inmediato (<15 min) |
| **P1 — Alto** | Compromiso de cuenta admin / vulnerabilidad explotable | <1 hora |
| **P2 — Medio** | Vulnerabilidad sin explotación / bug de seguridad reportado | <24 horas |
| **P3 — Bajo** | Mejora de hardening / hallazgo de pentest no crítico | <7 días |

### 11.2 Procedimiento ante incidente

1. **Detección** — alertas automáticas (Sentry, CloudWatch) + reportes manuales
2. **Contención** — bloquear cuentas comprometidas, revocar tokens, rotar claves
3. **Análisis** — logs estructurados, audit_log, telemetría
4. **Erradicación** — patch, redeploy, comunicado interno
5. **Recuperación** — restaurar servicio normal
6. **Post-mortem** — documentar causa raíz y lecciones aprendidas
7. **Notificación legal** — si aplica (filtración de datos personales)

### 11.3 Contactos

_(Pendiente de definir cuando se conforme el equipo.)_

- Tech Lead
- Responsable de seguridad
- DPO (Data Protection Officer)
- Asesor legal

---

## 12. Checklist de seguridad (pre-producción)

### App móvil
- [ ] Galería bloqueada (verificar que no haya código que la abra)
- [ ] Cámara solo frontal
- [ ] Mock location detectada y bloqueante
- [ ] Root/jailbreak detectado y bloqueante
- [ ] Emulador detectado
- [ ] Play Integrity integrado y verificado en server
- [ ] Certificate pinning con fingerprint del cert de prod
- [ ] HMAC signing en cada request crítica
- [ ] SQLite local con SQLCipher
- [ ] Build de producción con `--obfuscate`
- [ ] APK firmado con keystore seguro (no commiteado)
- [ ] No hay credenciales/secrets embebidos en el binario

### Backend
- [ ] Pydantic valida todos los payloads
- [ ] HMAC verificado en endpoints críticos
- [ ] Nonces verificados en Redis
- [ ] Timestamps validados (±5 min)
- [ ] JWT con RS256 + clave en Secrets Manager
- [ ] Rate limiting en endpoints sensibles
- [ ] CORS estricto
- [ ] Headers de seguridad configurados
- [ ] TLS 1.3 forzado
- [ ] Logs no contienen datos sensibles (passwords, tokens)
- [ ] Errores 500 no exponen stacktrace al cliente
- [ ] Dependencias sin vulnerabilidades conocidas (`pip-audit`)
- [ ] Test de SQL injection (sqlmap) pasa OK
- [ ] OWASP ZAP scan pasa sin críticos

### Infraestructura
- [ ] DB en subnet privada
- [ ] S3 sin acceso público
- [ ] Encryption at rest en RDS y S3
- [ ] IAM roles con least privilege
- [ ] Secrets Manager para todas las credenciales
- [ ] CloudTrail habilitado
- [ ] Backups automáticos verificados
- [ ] Plan DR documentado y probado al menos una vez

### Legal
- [ ] Política de privacidad publicada y aceptada por usuarios
- [ ] Consentimiento biométrico explícito documentado
- [ ] DPIA realizado y archivado
- [ ] DPA firmado con cada cliente
- [ ] Política de retención implementada (jobs de cleanup)
- [ ] Procedimiento de respuesta a solicitudes de titulares definido

### Operación
- [ ] Sentry configurado para todos los servicios
- [ ] Alertas configuradas para errores críticos
- [ ] Monitoreo de costos AWS (Budgets + alertas)
- [ ] Plan de respuesta a incidentes documentado
- [ ] Auditoría de accesos privilegiados habilitada
- [ ] Rotación de secretos programada

---

## 13. Documentos relacionados

- 📐 [`PLAN.md`](./PLAN.md)
- 🏛️ [`arquitectura.md`](./arquitectura.md)
- 📱 [`funcionalidades-app-movil.md`](./funcionalidades-app-movil.md)
- ⚙️ [`funcionalidades-backend.md`](./funcionalidades-backend.md)
- 🗃️ [`modelo-datos.md`](./modelo-datos.md)
- 🧠 [`decisiones-tecnicas.md`](./decisiones-tecnicas.md)
