📱 1. ECOSISTEMA MÓVIL Y DISTRIBUCIÓN (Físico / Usuario)
 ┌────────────────────────────────────────────────────────┐
 │ 🛒 Google Play Store / Apple App Store                 │
 │    [Cuentas de desarrollador para instalar la app]     │
 ├────────────────────────────────────────────────────────┤
 │ 📱 Teléfono del Guardia [Flutter o React Native]       │
 │    - Captura con cámara nativa física                  │
 │    - Chip GPS (Anti-Spoofing) y Almacenamiento Local   │
 └──────────────────────────┬─────────────────────────────┘
                            │ 
               🔒 CANAL DE COMUNICACIÓN SEGURO
               [Dominio Web Propio + Certificado SSL/HTTPS]
               (Evita intercepción de datos en internet)
                            │
                            ▼
 ☁️ 2. INFRAESTRUCTURA CLOUD (Ej. AWS / Google Cloud)
 ┌────────────────────────────────────────────────────────┐
 │ ⚙️ A. SERVIDORES VIRTUALES (Ej. AWS EC2 o App Runner)  │
 │    [Python + FastAPI]                                  │
 │    Orquestador central que recibe todas las peticiones │
 ├──────────────────────────┬─────────────────────────────┤
 │ 🧠 B. PROCESAMIENTO I.A. │ 📊 C. MOTOR DE ANALÍTICA    │
 │    [Python + OpenCV]     │    [Pandas]                 │
 │    Liveness Detection    │    Procesamiento Batch para │
 │    y validación facial   │    cálculo de horas (ETL)   │
 ├──────────────────────────┴─────────────────────────────┤
 │ 📦 D. ALMACENAMIENTO DE OBJETOS (Ej. Amazon S3)        │
 │    Disco infinito para guardar evidencia (.jpg / .mp4) │
 ├────────────────────────────────────────────────────────┤
 │ 🗃️ E. BASE DE DATOS ADMINISTRADA (Ej. AWS RDS)         │
 │    [PostgreSQL]                                        │
 │    Seguridad, respaldos automáticos, tablas relacionales│
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ✉️ 3. SERVICIOS DE TERCEROS (SaaS)
 ┌────────────────────────────────────────────────────────┐
 │ 📨 SendGrid (API de Correo Masivo)                     │
 │    Envío inmediato de alertas de fraude a supervisores │
 └────────────────────────────────────────────────────────┘