# ☁️ AWS Bootstrap — Smart Control Security

> Playbook reproducible para preparar una cuenta AWS desde cero hasta el punto en que se pueden empezar a crear los recursos reales de **Fase 1**. Sigue estos pasos en orden la primera vez; los siguientes onboarding (segundo dev, ambiente staging, etc.) reutilizan los mismos comandos.

**Última actualización:** 2026-06-12
**Cuenta inicial configurada:** `052251888904`
**Región primaria:** `us-east-2` (Ohio)
**Región para servicios globales** (Budgets, IAM, CloudFront): `us-east-1` (siempre)

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Pre-requisitos en la máquina local](#2-pre-requisitos-en-la-máquina-local)
3. [Paso 1 — Crear cuenta AWS (root)](#paso-1--crear-cuenta-aws-root)
4. [Paso 2 — Asegurar la cuenta root](#paso-2--asegurar-la-cuenta-root)
5. [Paso 3 — Crear usuario IAM `smart-control-dev`](#paso-3--crear-usuario-iam-smart-control-dev)
6. [Paso 4 — Generar access keys del usuario](#paso-4--generar-access-keys-del-usuario)
7. [Paso 5 — Instalar AWS CLI local](#paso-5--instalar-aws-cli-local)
8. [Paso 6 — Configurar el profile local](#paso-6--configurar-el-profile-local)
9. [Paso 7 — Eliminar el CSV de keys del repo](#paso-7--eliminar-el-csv-de-keys-del-repo)
10. [Paso 8 — Crear Budget Alert de seguridad](#paso-8--crear-budget-alert-de-seguridad)
11. [Paso 9 — Crear grupo IAM y asignar permisos](#paso-9--crear-grupo-iam-y-asignar-permisos)
12. [Paso 10 — Configurar los MCPs de AWS en Cursor](#paso-10--configurar-los-mcps-de-aws-en-cursor)
13. [Verificación final](#13-verificación-final)
14. [Operación recurrente](#14-operación-recurrente)
15. [Troubleshooting](#15-troubleshooting)
16. [Apéndice — Comandos útiles](#16-apéndice--comandos-útiles)

---

## 1. Resumen ejecutivo

Al terminar este playbook tenés:

| Componente | Estado deseado |
|---|---|
| Cuenta AWS root protegida con MFA y sin access keys | ✅ |
| Usuario IAM `smart-control-dev` con MFA opcional | ✅ |
| Profile local `smart-control` (región `us-east-2`) | ✅ |
| Grupo IAM `smart-control-dev-group` con `PowerUserAccess` + `IAMFullAccess` | ✅ |
| Budget Alert de **10 USD/mes** con 4 niveles (50%, 80%, 100% real, 100% pronosticado) | ✅ |
| 9 MCPs AWS configurados en `.cursor/mcp.json` | ✅ |
| `.gitignore` blindado contra archivos de credenciales | ✅ |

**Principio rector:** least privilege, MFA en todo lo que mira a internet, budget alert como red de seguridad económica.

---

## 2. Pre-requisitos en la máquina local

| Requisito | Versión usada | Verificación |
|---|---|---|
| macOS | Darwin 25.5.0 | `uname -a` |
| Homebrew | 6.0.1 | `brew --version` |
| Cursor IDE | reciente con soporte MCP | — |
| `uv` / `uvx` (Python tooling) | 0.11.21 | `uvx --version` |
| Email para notificaciones | `wallyribal@gmail.com` | — |
| Tarjeta de crédito válida para AWS | sí | — |

> ⚠️ Si Homebrew está instalado en `/opt/homebrew` (Apple Silicon) ajustá las rutas absolutas de los binarios en `.cursor/mcp.json`. En este proyecto Homebrew vive en `/usr/local` (Intel Mac).

---

## Paso 1 — Crear cuenta AWS (root)

1. Ir a https://aws.amazon.com/ y hacer click en **Create an AWS Account**.
2. Email a usar como root: `wallyribal@gmail.com`. **Este email no se reutiliza para nada más.**
3. Nombre de cuenta sugerido: `smart-control-security`.
4. Crear contraseña fuerte (>16 caracteres, guardada en password manager).
5. Tipo de cuenta: **Personal** (cambiar a Business cuando se factura al cliente final).
6. Dirección, teléfono, tarjeta de crédito.
7. Verificación por SMS/llamada.
8. Plan: **Basic Support — Free**.

**Resultado:** cuenta AWS con número (`052251888904` en nuestro caso) y acceso a la Console como usuario root.

---

## Paso 2 — Asegurar la cuenta root

Esto se hace **una sola vez** y se olvida — el root no se vuelve a usar excepto para tareas que ningún otro usuario puede hacer (cerrar la cuenta, cambiar método de pago).

1. **Activar MFA en el root**
   - Console → click en el nombre arriba a la derecha → **Security credentials**
   - **Multi-factor authentication (MFA)** → **Assign MFA device**
   - Tipo: **Authenticator app** (Google Authenticator, Authy, 1Password, etc.)
   - Escanear QR y guardar dos códigos consecutivos.

2. **NO crear access keys del root.** Si ya existen, borrarlas.
   - Console → Security credentials → **Access keys** → eliminar todas.

3. **Habilitar IAM access en Billing Console** (para que después usuarios IAM puedan ver costos).
   - Console → buscar **Account** → **IAM user and role access to Billing information** → **Edit** → **Activate**.

4. **Configurar región por defecto** (cosmético, no afecta seguridad).
   - Switch a `us-east-2 (Ohio)` arriba a la derecha.

---

## Paso 3 — Crear usuario IAM `smart-control-dev`

Este es el usuario que vas a usar día a día desde la CLI/MCPs. Nunca el root.

Desde la Console como root:

1. **IAM** → **Users** → **Create user**.
2. Username: `smart-control-dev`.
3. **NO marcar** "Provide user access to the AWS Management Console" (solo lo vamos a usar vía CLI/programáticamente).
4. **Permissions** → "Attach policies directly" → **dejar vacío** (los permisos se asignan en el Paso 9 vía grupo).
5. **Tags** (opcional):
   - `Project=smart-control-security`
   - `Environment=dev`
   - `Owner=wallyribal@gmail.com`
6. **Create user**.

> 🔒 **Por qué sin Console access:** este usuario está pensado para uso programático. Las personas se loguean con su propio usuario IAM nominal o con SSO. Mezclar uso programático y humano en el mismo usuario IAM hace casi imposible rotar credenciales sin downtime.

---

## Paso 4 — Generar access keys del usuario

1. Click en el usuario recién creado → tab **Security credentials**.
2. Sección **Access keys** → **Create access key**.
3. Use case: **Command Line Interface (CLI)**.
4. Marcar el checkbox "I understand the above recommendation...".
5. **Description tag** (opcional): `local-dev-mac-jbalcucho`.
6. **Create access key**.
7. **Descargar el CSV** o copiar Access Key ID + Secret Access Key.

> ⚠️ **CRÍTICO:** El Secret Access Key se ve **una sola vez**. Si lo perdés, hay que generar uno nuevo.

> ⚠️ **CRÍTICO:** **No guardes el CSV en el repo.** Si lo descargás a `~/Downloads`, después de configurar la CLI **borralo**. Nuestro `.gitignore` ya protege patrones `*accessKeys*.csv`, `*_accessKeys*`, `aws-credentials*`, `.aws/`.

---

## Paso 5 — Instalar AWS CLI local

```bash
brew install awscli
aws --version
# Resultado esperado: aws-cli/2.35.4 Python/3.14.5 Darwin/25.5.0 source/x86_64
```

---

## Paso 6 — Configurar el profile local

Asumiendo que el CSV está en `~/Downloads/smart-control-dev_accessKeys.csv`:

```bash
CSV="$HOME/Downloads/smart-control-dev_accessKeys.csv"

# Extrae sin imprimir las keys en pantalla
AK=$(awk -F',' 'NR==2 {gsub(/\r/, ""); print $1}' "$CSV")
SK=$(awk -F',' 'NR==2 {gsub(/\r/, ""); print $2}' "$CSV")

aws configure set aws_access_key_id     "$AK" --profile smart-control
aws configure set aws_secret_access_key "$SK" --profile smart-control
aws configure set region                us-east-2 --profile smart-control
aws configure set output                json --profile smart-control

unset AK SK

# Verificación
aws sts get-caller-identity --profile smart-control
```

Salida esperada:

```json
{
  "UserId": "AIDAQYKTURUEFL56KZ25J",
  "Account": "052251888904",
  "Arn": "arn:aws:iam::052251888904:user/smart-control-dev"
}
```

> 💡 **Tip:** Para no escribir `--profile smart-control` cada vez, en tu shell:
>
> ```bash
> export AWS_PROFILE=smart-control
> ```
>
> O agregalo a `~/.zshrc`. Tené cuidado si tenés varios proyectos AWS — usar el flag explícito es más seguro.

---

## Paso 7 — Eliminar el CSV de keys del repo

```bash
# Borrar el archivo
rm -v ~/Downloads/smart-control-dev_accessKeys.csv

# Verificar que no quedó nada en el repo
cd /path/al/repo
git status --short | grep -i "access\|credential\|key" || echo "✅ Repo limpio"
```

El `.gitignore` del repo ya contiene (sección "Secretos y entornos"):

```gitignore
*accessKeys*.csv
*_accessKeys*
aws-credentials*
.aws/
```

> 🔐 **Si por error ya commiteaste el CSV:** rotá las keys **inmediatamente** (Paso 14.1) y eliminá del histórico con `git filter-repo` o BFG. **No basta con `git rm`** — quedan en el histórico para siempre.

---

## Paso 8 — Crear Budget Alert de seguridad

Esto es lo primero que se hace en una cuenta nueva. Te avisa por email si algo se sale de control.

```bash
# Paso 8.1 — Crear el budget JSON
cat > /tmp/budget.json <<'EOF'
{
  "BudgetName": "smart-control-monthly-10usd",
  "BudgetLimit": { "Amount": "10", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
EOF

# Paso 8.2 — Crear las notificaciones JSON
cat > /tmp/budget-notifications.json <<'EOF'
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 50,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      { "SubscriptionType": "EMAIL", "Address": "wallyribal@gmail.com" }
    ]
  },
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      { "SubscriptionType": "EMAIL", "Address": "wallyribal@gmail.com" }
    ]
  },
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      { "SubscriptionType": "EMAIL", "Address": "wallyribal@gmail.com" }
    ]
  },
  {
    "Notification": {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      { "SubscriptionType": "EMAIL", "Address": "wallyribal@gmail.com" }
    ]
  }
]
EOF

# Paso 8.3 — Crear el budget (AWS Budgets vive SIEMPRE en us-east-1)
aws budgets create-budget \
  --account-id 052251888904 \
  --budget file:///tmp/budget.json \
  --notifications-with-subscribers file:///tmp/budget-notifications.json \
  --profile smart-control \
  --region us-east-1

# Paso 8.4 — Verificar
aws budgets describe-budget \
  --account-id 052251888904 \
  --budget-name smart-control-monthly-10usd \
  --profile smart-control --region us-east-1 \
  --output table

aws budgets describe-notifications-for-budget \
  --account-id 052251888904 \
  --budget-name smart-control-monthly-10usd \
  --profile smart-control --region us-east-1 \
  --output table

# Paso 8.5 — Limpieza
rm /tmp/budget.json /tmp/budget-notifications.json
```

> 📨 **Nota:** El primer email que llegue de AWS Budgets es uno de confirmación de SNS — hay que aceptarlo o las notificaciones no se entregan. (En la práctica, Budgets envía directamente sin SNS si usás `SubscriptionType=EMAIL`, pero en algunos casos pasa por SNS.)

> ⚠️ **Importante:** AWS Budgets **NOTIFICA, no detiene servicios.** Para corte automático real se necesita **AWS Budgets Actions** (también gratis pero más complejo). Para Fase 1 con $10 de tope, los emails son suficientes.

---

## Paso 9 — Crear grupo IAM y asignar permisos

Este paso **requiere permisos de IAM**, que el propio usuario `smart-control-dev` **no tiene** (es buena práctica de seguridad — un usuario de aplicación no debe poder darse permisos a sí mismo). Por eso se ejecuta desde **AWS CloudShell logueado como root** (o desde otro usuario admin).

### 9.1 — Abrir AWS CloudShell como root

🔗 https://us-east-1.console.aws.amazon.com/cloudshell/home?region=us-east-1

(La primera vez tarda ~30 segundos en arrancar.)

### 9.2 — Ejecutar el script en CloudShell

```bash
GROUP=smart-control-dev-group
USER=smart-control-dev

# Crear grupo (idempotente)
aws iam create-group --group-name "$GROUP" 2>/dev/null || echo "Grupo ya existía, continuando..."

# Adjuntar las 2 políticas mínimas para dev productivo
aws iam attach-group-policy --group-name "$GROUP" \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

aws iam attach-group-policy --group-name "$GROUP" \
  --policy-arn arn:aws:iam::aws:policy/IAMFullAccess

# Meter al usuario en el grupo
aws iam add-user-to-group --group-name "$GROUP" --user-name "$USER"

# Verificar
echo "=== Políticas del grupo ==="
aws iam list-attached-group-policies --group-name "$GROUP" --output table

echo "=== Grupos del usuario ==="
aws iam list-groups-for-user --user-name "$USER" --output table
```

### 9.3 — Verificar desde la CLI local

```bash
aws iam list-attached-user-policies --user-name smart-control-dev --profile smart-control

# Prueba de fuego: simular permisos críticos de Fase 1
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::052251888904:user/smart-control-dev \
  --action-names \
    s3:CreateBucket \
    rekognition:CompareFaces \
    lambda:CreateFunction \
    rds:CreateDBCluster \
    iam:CreateRole \
  --profile smart-control \
  --query 'EvaluationResults[*].[EvalActionName,EvalDecision]' \
  --output table
```

Todos deben decir `allowed`.

### 9.4 — Por qué `PowerUserAccess` + `IAMFullAccess` (y no estricto-mínimo)

| Política | Para qué |
|---|---|
| `PowerUserAccess` | Acceso a **todos** los servicios AWS excepto IAM, Organizations, Account Management y Billing root-only. Es la política recomendada por AWS para devs. |
| `IAMFullAccess` | Necesario para crear **roles de servicio** que Lambda, Amplify, RDS, etc. requieren para funcionar. Sin esto te frena en cada recurso nuevo. |

**Trade-off aceptado:** el usuario podría crear otros usuarios IAM. **Mitigaciones activas:**
- Budget Alert de $10 limita el daño económico.
- `.gitignore` previene leak de keys.
- Las keys deberían rotarse cada 90 días (ver Paso 14.1).

**Cuándo migrar a estricto-mínimo:** cuando entre un segundo dev al equipo, o cuando se cree el ambiente de **staging/prod**. En ese punto vale la pena armar políticas custom por servicio (ver Apéndice A).

---

## Paso 10 — Configurar los MCPs de AWS en Cursor

Los MCPs (Model Context Protocol servers) permiten que Cursor invoque AWS directamente desde el chat: crear recursos, consultar precios, leer logs, etc.

> 📦 **Buena noticia:** el archivo `.cursor/mcp.json` está **versionado** en este repo (es una excepción explícita en el `.gitignore`). Cualquier dev que clone el repo ya tiene los 9 MCPs configurados — sólo necesita tener `uv`/`uvx` instalado localmente y un profile AWS llamado `smart-control` (Pasos 5 y 6). No hace falta crear el archivo a mano.

### 10.1 — Contenido de `.cursor/mcp.json` (referencia)

Si por algún motivo necesitás recrearlo desde cero o adaptarlo a otra cuenta:

```bash
mkdir -p .cursor
```

Archivo: `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "aws-knowledge": {
      "url": "https://knowledge-mcp.global.api.aws"
    },
    "aws-amplify": {
      "url": "https://amplify-mcp.global.api.aws"
    },
    "aws-api": {
      "command": "/usr/local/bin/uvx",
      "args": ["awslabs.aws-api-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "smart-control",
        "AWS_REGION": "us-east-2",
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    },
    "aws-pricing": {
      "command": "/usr/local/bin/uvx",
      "args": ["awslabs.aws-pricing-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "smart-control",
        "AWS_REGION": "us-east-1",
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    },
    "aws-iam": {
      "command": "/usr/local/bin/uvx",
      "args": ["awslabs.aws-iam-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "smart-control",
        "AWS_REGION": "us-east-1",
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    },
    "aws-iac": {
      "command": "/usr/local/bin/uvx",
      "args": ["awslabs.cdk-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "smart-control",
        "AWS_REGION": "us-east-2",
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    },
    "aws-cloudwatch": {
      "command": "/usr/local/bin/uvx",
      "args": ["awslabs.cloudwatch-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "smart-control",
        "AWS_REGION": "us-east-2",
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    },
    "aws-postgres": {
      "command": "/usr/local/bin/uvx",
      "args": ["awslabs.postgres-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "smart-control",
        "AWS_REGION": "us-east-2",
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    },
    "aws-dynamodb": {
      "command": "/usr/local/bin/uvx",
      "args": ["awslabs.dynamodb-mcp-server@latest"],
      "env": {
        "AWS_PROFILE": "smart-control",
        "AWS_REGION": "us-east-2",
        "FASTMCP_LOG_LEVEL": "ERROR"
      }
    }
  }
}
```

### 10.2 — Notas importantes

- **`/usr/local/bin/uvx` es ruta absoluta** porque Cursor tiene un bug conocido en el que no encuentra `uvx` en `$PATH`. Si Homebrew vive en `/opt/homebrew` (Apple Silicon) cambiar a `/opt/homebrew/bin/uvx`.
- Los MCPs `aws-knowledge` y `aws-amplify` son HTTP públicos — no requieren credenciales (sólo consultan documentación).
- Los demás corren locales con `uvx` y heredan el profile `smart-control`.
- **Cursor debe reiniciarse** después de crear/modificar `.cursor/mcp.json` para que los MCPs aparezcan.

### 10.3 — Listado de los 9 MCPs y para qué sirven

| MCP | Tipo | Uso típico |
|---|---|---|
| `aws-knowledge` | HTTP público | "¿Cuál es el límite de filas en una tabla DynamoDB?" |
| `aws-amplify` | HTTP público | "Cómo configurar Amplify Hosting con monorepo" |
| `aws-api` | Local `uvx` | Ejecutar cualquier llamada a la API de AWS (proxy general) |
| `aws-pricing` | Local `uvx` | "Cuánto cuesta Aurora Serverless v2 en us-east-2" |
| `aws-iam` | Local `uvx` | Crear/modificar usuarios, roles, políticas |
| `aws-iac` | Local `uvx` | Generar código CDK |
| `aws-cloudwatch` | Local `uvx` | Leer logs, métricas, alarmas |
| `aws-postgres` | Local `uvx` | Consultar Aurora PostgreSQL desde el chat |
| `aws-dynamodb` | Local `uvx` | Consultar tablas DynamoDB desde el chat |

---

## 13. Verificación final

Después de los 10 pasos, esto debe funcionar:

```bash
# 1. CLI configurada
aws sts get-caller-identity --profile smart-control
# → { "Account": "052251888904", "Arn": ".../smart-control-dev" }

# 2. Permisos activos
aws s3 ls --profile smart-control
# → (lista vacía, sin AccessDenied)

# 3. Budget activo
aws budgets describe-budget \
  --account-id 052251888904 \
  --budget-name smart-control-monthly-10usd \
  --profile smart-control --region us-east-1
# → JSON con BudgetLimit: 10 USD, 4 notificaciones

# 4. Grupo y políticas
aws iam list-groups-for-user --user-name smart-control-dev --profile smart-control
# → smart-control-dev-group

# 5. CSV borrado
ls ~/Downloads/*accessKeys*.csv 2>/dev/null
# → vacío

# 6. .gitignore protege
git check-ignore -v test-accessKeys.csv
# → .gitignore:N:*accessKeys*  test-accessKeys.csv

# 7. MCPs cargan en Cursor
# Reiniciar Cursor → Settings → MCP → ver los 9 servidores listados
```

---

## 14. Operación recurrente

### 14.1 — Rotar access keys (cada 90 días)

```bash
# Desde la CLI local con las keys actuales
USER=smart-control-dev

# 1. Crear key nueva (queda activa la vieja también temporalmente)
aws iam create-access-key --user-name "$USER" --profile smart-control

# 2. Actualizar el profile local con la nueva key
aws configure set aws_access_key_id     "NUEVO_AK"  --profile smart-control
aws configure set aws_secret_access_key "NUEVO_SK"  --profile smart-control

# 3. Verificar
aws sts get-caller-identity --profile smart-control

# 4. Listar todas las keys del usuario para identificar la vieja
aws iam list-access-keys --user-name "$USER" --profile smart-control

# 5. Desactivar la key vieja (no borrar todavía, por si algo se rompe)
aws iam update-access-key --user-name "$USER" \
  --access-key-id "AKIA_VIEJA" --status Inactive --profile smart-control

# 6. Esperar 24-48h verificando que nada falle, luego borrarla
aws iam delete-access-key --user-name "$USER" \
  --access-key-id "AKIA_VIEJA" --profile smart-control
```

### 14.2 — Aumentar el budget cuando empieces a desplegar prod

```bash
cat > /tmp/budget-update.json <<'EOF'
{
  "BudgetName": "smart-control-monthly-10usd",
  "BudgetLimit": { "Amount": "200", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
EOF

aws budgets update-budget \
  --account-id 052251888904 \
  --new-budget file:///tmp/budget-update.json \
  --profile smart-control --region us-east-1

rm /tmp/budget-update.json
```

> 💡 **Recomendación:** Renombrá el budget a `smart-control-monthly-200usd` (o creá uno nuevo) para que el nombre refleje el límite vigente.

### 14.3 — Agregar un nuevo dev al equipo

Si entra otro dev:

1. Crear su usuario IAM `<nombre>-dev` (Paso 3).
2. Generar access keys (Paso 4).
3. Entregarle las keys por canal seguro (1Password, no email).
4. Agregarlo al mismo grupo: `aws iam add-user-to-group --group-name smart-control-dev-group --user-name <nombre>-dev` (corrido desde root/admin).

No es necesario re-asignar políticas — las hereda del grupo.

---

## 15. Troubleshooting

### `An error occurred (AccessDenied) when calling X`

El usuario no tiene la política que cubre esa acción. Verificá:

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::052251888904:user/smart-control-dev \
  --action-names X:Action \
  --profile smart-control
```

Si dice `implicitDeny`, falta política. Reforzar `PowerUserAccess` no aplica (no toca IAM/Org). Solución típica: agregar otra política específica al grupo desde CloudShell root.

### `Unable to locate credentials`

El profile no está configurado o `AWS_PROFILE` no está exportado.

```bash
aws configure list-profiles
# Debe aparecer "smart-control"

cat ~/.aws/credentials | grep smart-control
# Debe existir la sección [smart-control]
```

### Cursor no muestra los MCPs

1. Verificar ruta absoluta de `uvx`: `which uvx`.
2. Actualizar `.cursor/mcp.json` con la ruta exacta.
3. Cursor → Settings → MCP → ver si hay errores en el log.
4. Reiniciar Cursor completo (no recargar ventana).

### `uvx: command not found` en algún MCP

Reemplazá `"command": "uvx"` por `"command": "/usr/local/bin/uvx"` (o la ruta que devuelva `which uvx`).

### Budget no envía emails

1. Confirmar el email en la bandeja (puede haber ido a spam).
2. Verificar que la suscripción de SNS está confirmada (si AWS la creó).
3. AWS Budgets toma hasta **24h** en empezar a enviar después de crearse.

### El CSV se commiteó por accidente

```bash
# 1. ROTAR LAS KEYS INMEDIATAMENTE (ver 14.1)
# 2. Eliminar del histórico
git filter-repo --path smart-control-dev_accessKeys.csv --invert-paths
# 3. Force-push (coordinar con equipo)
git push --force-with-lease
```

---

## 16. Apéndice — Comandos útiles

### A. Política IAM custom estricto-mínimo (para Fase 2 / staging / prod)

Cuando se quiera reemplazar `PowerUserAccess` por permisos exactos de Fase 1:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:*",            "Resource": "*" },
    { "Effect": "Allow", "Action": "rekognition:*",   "Resource": "*" },
    { "Effect": "Allow", "Action": "rds:*",           "Resource": "*" },
    { "Effect": "Allow", "Action": "rds-db:*",        "Resource": "*" },
    { "Effect": "Allow", "Action": "ses:*",           "Resource": "*" },
    { "Effect": "Allow", "Action": "lambda:*",        "Resource": "*" },
    { "Effect": "Allow", "Action": "events:*",        "Resource": "*" },
    { "Effect": "Allow", "Action": "scheduler:*",     "Resource": "*" },
    { "Effect": "Allow", "Action": "logs:*",          "Resource": "*" },
    { "Effect": "Allow", "Action": "cloudwatch:*",    "Resource": "*" },
    { "Effect": "Allow", "Action": "secretsmanager:*","Resource": "*" },
    { "Effect": "Allow", "Action": "amplify:*",       "Resource": "*" },
    { "Effect": "Allow", "Action": "cloudfront:*",    "Resource": "*" },
    { "Effect": "Allow", "Action": "wafv2:*",         "Resource": "*" },
    { "Effect": "Allow", "Action": "route53:*",       "Resource": "*" },
    { "Effect": "Allow", "Action": "ec2:*",           "Resource": "*" },
    { "Effect": "Allow", "Action": "iam:PassRole",    "Resource": "*" },
    { "Effect": "Allow", "Action": [
        "iam:CreateRole", "iam:DeleteRole", "iam:GetRole",
        "iam:ListRoles", "iam:AttachRolePolicy", "iam:DetachRolePolicy",
        "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy",
        "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
        "iam:CreateServiceLinkedRole"
      ],
      "Resource": "*"
    }
  ]
}
```

### B. Listar costos actuales

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-06-01,End=2026-06-30 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --profile smart-control --region us-east-1
```

### C. Tags estándar a aplicar en todo recurso Fase 1

Cada recurso AWS de Fase 1 debe llevar estos tags (esto se va a automatizar con CDK más adelante):

| Key | Value |
|---|---|
| `Project` | `smart-control-security` |
| `Environment` | `dev` / `staging` / `prod` |
| `Phase` | `fase-1` |
| `Owner` | `wallyribal@gmail.com` |
| `CostCenter` | `smart-control` |
| `ManagedBy` | `cdk` (o `manual` mientras no haya CDK) |

### D. URLs frecuentes

| Recurso | URL |
|---|---|
| Console root | https://console.aws.amazon.com/ |
| IAM Users | https://us-east-1.console.aws.amazon.com/iam/home#/users |
| Billing | https://console.aws.amazon.com/billing/home |
| Budgets | https://console.aws.amazon.com/billing/home#/budgets |
| Cost Explorer | https://console.aws.amazon.com/cost-management/home |
| CloudShell | https://us-east-1.console.aws.amazon.com/cloudshell/home |
| Health Dashboard | https://health.aws.amazon.com/health/home |

---

## Referencias internas

- [`docs/seguridad.md`](./seguridad.md) — Modelo de amenazas y defensa en profundidad.
- [`docs/roadmap-fases.md`](./roadmap-fases.md) — Qué recursos AWS toca crear en Fase 1 vs Fase 2.
- [`docs/arquitectura.md`](./arquitectura.md) — Arquitectura técnica completa.
- [`.cursor/mcp.json`](../.cursor/mcp.json) — Configuración de los MCPs.
- [`.gitignore`](../.gitignore) — Patrones de credenciales protegidos.
