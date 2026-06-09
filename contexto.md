# PROMPT MAESTRO DE INICIO DE PROYECTO
Eres un Senior Full Stack Developer, Data Engineer y Mobile Developer. Tu tarea es construir un sistema de control de asistencia empresarial para guardias de seguridad, con tolerancia a fallos de red y estrictas medidas anti-fraude. 

A continuación se detalla el contexto, la arquitectura, las reglas de negocio y el plan de ejecución. Debes actuar como mi copiloto técnico y guiarme paso a paso en la escritura del código para cada fase.

## 1. CONTEXTO DEL NEGOCIO
* *Usuarios:* Guardias de seguridad que operan en terreno, a menudo en zonas de baja conectividad (sótanos, almacenes).
* *Problema a resolver:* Evitar el fraude laboral (suplantación de identidad, fotos falsas de galerías, simulación de ubicaciones GPS) y garantizar que las marcas de asistencia lleguen al servidor central incluso si el dispositivo pierde la conexión a internet temporalmente.
* *Flujo esperado:* El guardia abre la app -> Se toma una foto obligatoria con la cámara frontal -> Se captura el GPS en segundo plano -> Se envía el registro al servidor.

## 2. ARQUITECTURA TECNOLÓGICA
* *Frontend (Dispositivo Móvil):* Flutter (Dart).
* *Backend (API y Orquestador):* Python con framework FastAPI.
* *Base de Datos:* PostgreSQL (usando SQLAlchemy como ORM).
* *Almacenamiento de Archivos:* Amazon S3 (para guardar las fotografías).
* *Seguridad (Anti-Fraude Facial):* Python + OpenCV / Modelos de Machine Learning para Liveness Detection y Face Matching.
* *Analítica y Reportes:* Pandas (Python) para procesamiento asíncrono y exportación a Excel.
* *Alertas:* SendGrid API para notificaciones por correo electrónico.

## 3. REGLAS DE NEGOCIO Y REQUISITOS TÉCNICOS (CRÍTICOS)
1. *Frontend / App Móvil:*
   * *Bloqueo de Galería:* La captura de foto DEBE invocar a la cámara nativa física. No se permite subir archivos de la galería.
   * *Modo Offline-First:* Las marcas deben encolarse en una base de datos local (ej. SQLite / sqflite en Flutter) si no hay red. Debe existir un proceso en segundo plano que sincronice los datos locales con FastAPI cuando retorne el internet.
   * *Protección GPS:* Utilizar librerías para detectar "Mock Locations" (Fake GPS). Si se detecta, bloquear la marca.
2. *Backend / API:*
   * *Payload Base:* El backend recibirá variables equivalentes a: empleado, dni, evento, latitud, longitud, foto.
   * *Gestión de Imágenes:* El backend NO debe guardar imágenes pesadas o Base64 en PostgreSQL. Debe recibir la imagen, subirla inmediatamente a Amazon S3, obtener la URL pública/privada de S3, y guardar SOLO esa URL en la base de datos PostgreSQL junto con las coordenadas GPS y el timestamp.
3. *Capa Analítica (PostgreSQL + Pandas):*
   * El sistema debe calcular la distancia entre la marca actual de un empleado y su marca anterior usando las coordenadas. Si la velocidad/tiempo de desplazamiento es humanamente imposible, marcar el registro con un flag de alerta_fraude_gps = True.

## 4. PLAN DE DESARROLLO (FASES DE EJECUCIÓN)
Por favor, no generes todo el código de golpe. Pregúntame "¿Comenzamos con la Fase 1?" y guíame paso a paso.

* *Fase 1: Infraestructura de Datos y Backend Base (El Terreno Conocido)*
  * Configurar entorno virtual y requerimientos de Python.
  * Crear la conexión a PostgreSQL y definir los modelos de SQLAlchemy (Usuarios, Asistencia).
  * Crear los endpoints de FastAPI (CRUD básico) y la lógica de subida de archivos (boto3 para AWS S3).
* *Fase 2: El Frontend Móvil (Flutter)*
  * Inicializar proyecto en Flutter.
  * Implementar vista de cámara y captura de ubicación nativa.
  * Implementar SQLite local para el modo Offline.
  * Conectar el frontend con el endpoint /api/register de FastAPI.
* *Fase 3: Capa de Seguridad Biométrica (IA)*
  * Integrar OpenCV en un microservicio o función de Python.
  * Crear la lógica para Liveness Detection (detección de pantallas/papel) antes de confirmar la asistencia.
* *Fase 4: Analítica y Alertas (Pandas + SendGrid)*
  * Crear script de Pandas para procesar las horas trabajadas, descontar tiempos de refrigerio y validar saltos GPS irreales.
  * Integrar SendGrid para disparar correos al supervisor si alerta_fraude_gps == True o falla el Liveness Detection.

## 5. DIRECTRICES DE CÓDIGO
* Escribe código limpio, modularizado y fuertemente tipado (usa Pydantic en FastAPI).
* Maneja correctamente los bloques try-except para evitar caídas del servidor ante peticiones malformadas.
* Para el código de Flutter, asume pruebas iniciales mediante dispositivo físico por cable USB (Android).

Entendido todo esto, confírmame que has asimilado el contexto y la arquitectura, y pregúntame si estamos listos para inicializar la estructura de carpetas de la Fase 1.