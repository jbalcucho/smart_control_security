#!/usr/bin/env bash
# ============================================================================
# bootstrap-fase1.sh — Smart Control Security
#
# Crea idempotentemente todos los recursos AWS de Fase 1 para un ambiente:
#   - Budget Alert mensual con 4 niveles de notificación
#   - Bucket S3 (block public access, AES256, versioning, lifecycle, CORS)
#   - CloudWatch Log Group con retention controlada
#   - SSM Parameter Store: /smart-control/db-password (SecureString, placeholder)
#   - IAM Customer-Managed Policy "smart-control-app-policy" (least-privilege)
#   - IAM Role "smart-control-app-role" (trust: lambda + amplify)
#   - Attach de policy → role
#
# USO:
#   ./bootstrap-fase1.sh <env>
#
# AMBIENTES SOPORTADOS:
#   dev      → profile "smart-control",         budget $10,  retention 30d
#   staging  → profile "smart-control-staging", budget $50,  retention 90d
#   prod     → profile "smart-control-prod",    budget $500, retention 365d
#
# PRE-REQUISITOS (paso una sola vez por ambiente, manual):
#   1. Cuenta AWS root creada y asegurada (MFA, sin access keys del root).
#   2. Usuario IAM "smart-control-dev" creado y con grupo
#      "smart-control-dev-group" (PowerUserAccess + IAMFullAccess) — ver
#      docs/aws-bootstrap.md Pasos 1-9.
#   3. AWS CLI configurado con el profile correspondiente (Paso 6).
#   4. Variables de entorno opcionales:
#        AWS_REGION       (default: us-east-2)
#        OWNER_EMAIL      (default: wallyribal@gmail.com)
#        SKIP_CONFIRM=1   (no pide "yes" antes de aplicar)
#
# IDEMPOTENCIA:
#   - Re-ejecutar es seguro: cada paso detecta si el recurso ya existe y
#     actualiza la configuración en lugar de duplicar.
#   - Para IAM policy maneja el límite de 5 versiones automáticamente.
#
# REFERENCIA: docs/aws-bootstrap.md
# ============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# Args y config per ambiente
# ----------------------------------------------------------------------------
ENV="${1:-}"
if [ -z "$ENV" ]; then
  cat <<USAGE >&2
ERROR: falta argumento <env>

Uso:    $0 <env>
Donde:  env = dev | staging | prod

Ejemplo:
  $0 dev
  AWS_REGION=us-east-1 OWNER_EMAIL=ops@scsecurity.com $0 prod
USAGE
  exit 1
fi

case "$ENV" in
  dev)
    PROFILE="${PROFILE_OVERRIDE:-smart-control}"
    BUDGET_USD=10
    LOG_RETENTION_DAYS=30
    DEFAULT_OWNER_EMAIL="wallyribal@gmail.com"
    ;;
  staging)
    PROFILE="${PROFILE_OVERRIDE:-smart-control-staging}"
    BUDGET_USD=50
    LOG_RETENTION_DAYS=90
    DEFAULT_OWNER_EMAIL="alertas-staging@scsecurity.com"
    ;;
  prod)
    PROFILE="${PROFILE_OVERRIDE:-smart-control-prod}"
    BUDGET_USD=500
    LOG_RETENTION_DAYS=365
    DEFAULT_OWNER_EMAIL="ops@scsecurity.com"
    ;;
  *)
    echo "ERROR: ambiente desconocido '$ENV'. Usar: dev | staging | prod" >&2
    exit 1
    ;;
esac

REGION="${AWS_REGION:-us-east-2}"
OWNER_EMAIL="${OWNER_EMAIL:-$DEFAULT_OWNER_EMAIL}"

# Recursos
BUCKET="smart-control-${ENV}"                  # global, lleva env (S3 names son únicos globales)
ROLE_NAME="smart-control-app-role"             # per-cuenta, no necesita env
POLICY_NAME="smart-control-app-policy"         # per-cuenta
LOG_GROUP="/smart-control/api"                 # per-cuenta
PARAM_DB_PASSWORD="/smart-control/db-password" # per-cuenta
GROUP_NAME="smart-control-dev-group"           # solo referencia, ya debe existir
BUDGET_NAME="smart-control-monthly-${BUDGET_USD}usd"

# Colors
BLUE=$'\033[0;34m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'; RESET=$'\033[0m'

# Temp dir con cleanup automático
TMP_DIR=$(mktemp -d -t bootstrap-fase1-XXXXXX)
trap "rm -rf '$TMP_DIR'" EXIT

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
log_section() {
  echo ""
  echo "${BLUE}═══════════════════════════════════════════════════════════════${RESET}"
  echo "${BLUE}  $*${RESET}"
  echo "${BLUE}═══════════════════════════════════════════════════════════════${RESET}"
}

log_step() {
  echo "  ${BLUE}→${RESET} $*"
}

log_ok() {
  echo "  ${GREEN}✓${RESET} $*"
}

log_skip() {
  echo "  ${YELLOW}↷${RESET} $*"
}

log_err() {
  echo "  ${RED}✗${RESET} $*" >&2
}

aws_cli() {
  aws --profile "$PROFILE" "$@"
}

# ----------------------------------------------------------------------------
# Pre-flight checks
# ----------------------------------------------------------------------------
preflight() {
  log_section "Pre-flight checks"

  command -v aws >/dev/null || {
    log_err "AWS CLI no instalado. Instalá con: brew install awscli"
    exit 1
  }
  log_ok "AWS CLI presente ($(aws --version 2>&1 | head -1))"

  if ! aws configure list-profiles 2>/dev/null | grep -qx "$PROFILE"; then
    log_err "Profile '$PROFILE' no existe en ~/.aws/credentials"
    log_err "Configurar con: aws configure --profile $PROFILE"
    exit 1
  fi
  log_ok "Profile '$PROFILE' existe"

  IDENTITY=$(aws_cli sts get-caller-identity --output json 2>&1) || {
    log_err "No se pudo obtener identidad con profile '$PROFILE': $IDENTITY"
    exit 1
  }
  ACCOUNT_ID=$(echo "$IDENTITY" | python3 -c "import sys, json; print(json.load(sys.stdin)['Account'])")
  CALLER_ARN=$(echo "$IDENTITY" | python3 -c "import sys, json; print(json.load(sys.stdin)['Arn'])")
  log_ok "Identidad: $CALLER_ARN"
  log_ok "Account ID: $ACCOUNT_ID"
}

# ----------------------------------------------------------------------------
# Confirmación
# ----------------------------------------------------------------------------
confirm() {
  log_section "Configuración resuelta"
  cat <<EOF
  Ambiente:           ${YELLOW}${ENV}${RESET}
  AWS Profile:        $PROFILE
  Account ID:         $ACCOUNT_ID
  Region:             $REGION
  Owner email:        $OWNER_EMAIL

  Recursos a crear/actualizar (idempotente):
    • Budget Alert:   $BUDGET_NAME (\$${BUDGET_USD}/mes)
    • S3 Bucket:      $BUCKET
    • Log Group:      $LOG_GROUP (retention ${LOG_RETENTION_DAYS}d)
    • SSM Parameter:  $PARAM_DB_PASSWORD
    • IAM Policy:     $POLICY_NAME
    • IAM Role:       $ROLE_NAME
EOF

  if [ "${SKIP_CONFIRM:-0}" = "1" ]; then
    log_ok "SKIP_CONFIRM=1 — continuando sin pedir confirmación"
    return 0
  fi

  echo ""
  read -r -p "  ¿Continuar? (escribí 'yes' exactamente): " CONFIRM_INPUT
  if [ "$CONFIRM_INPUT" != "yes" ]; then
    log_err "Cancelado por el usuario."
    exit 0
  fi
}

# ----------------------------------------------------------------------------
# Step 1 — Budget Alert
# ----------------------------------------------------------------------------
ensure_budget() {
  log_section "1/6 Budget Alert ($BUDGET_NAME)"

  if aws_cli budgets describe-budget \
       --account-id "$ACCOUNT_ID" \
       --budget-name "$BUDGET_NAME" \
       --region us-east-1 >/dev/null 2>&1; then
    log_skip "Budget ya existe (saltando creación)"
    return 0
  fi

  cat > "$TMP_DIR/budget.json" <<EOF
{
  "BudgetName": "$BUDGET_NAME",
  "BudgetLimit": { "Amount": "$BUDGET_USD", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
EOF

  cat > "$TMP_DIR/notifications.json" <<EOF
[
  {
    "Notification": { "NotificationType": "ACTUAL",     "ComparisonOperator": "GREATER_THAN", "Threshold": 50,  "ThresholdType": "PERCENTAGE" },
    "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "$OWNER_EMAIL" }]
  },
  {
    "Notification": { "NotificationType": "ACTUAL",     "ComparisonOperator": "GREATER_THAN", "Threshold": 80,  "ThresholdType": "PERCENTAGE" },
    "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "$OWNER_EMAIL" }]
  },
  {
    "Notification": { "NotificationType": "ACTUAL",     "ComparisonOperator": "GREATER_THAN", "Threshold": 100, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "$OWNER_EMAIL" }]
  },
  {
    "Notification": { "NotificationType": "FORECASTED", "ComparisonOperator": "GREATER_THAN", "Threshold": 100, "ThresholdType": "PERCENTAGE" },
    "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "$OWNER_EMAIL" }]
  }
]
EOF

  aws_cli budgets create-budget \
    --account-id "$ACCOUNT_ID" \
    --budget "file://$TMP_DIR/budget.json" \
    --notifications-with-subscribers "file://$TMP_DIR/notifications.json" \
    --region us-east-1
  log_ok "Budget $BUDGET_NAME creado con 4 niveles de notificación"
}

# ----------------------------------------------------------------------------
# Step 2 — S3 Bucket (creación + configuración completa)
# ----------------------------------------------------------------------------
ensure_bucket() {
  log_section "2/6 S3 Bucket ($BUCKET)"

  # Crear si no existe
  if aws_cli s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    log_skip "Bucket ya existe"
  else
    # us-east-1 NO requiere LocationConstraint (es el default)
    if [ "$REGION" = "us-east-1" ]; then
      aws_cli s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
    else
      aws_cli s3api create-bucket \
        --bucket "$BUCKET" --region "$REGION" \
        --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
    fi
    log_ok "Bucket creado"
  fi

  # Block Public Access (idempotente)
  log_step "Aplicando Block Public Access (4 capas)"
  aws_cli s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  log_step "Aplicando default encryption AES256"
  aws_cli s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

  log_step "Habilitando versioning"
  aws_cli s3api put-bucket-versioning --bucket "$BUCKET" \
    --versioning-configuration Status=Enabled

  log_step "Aplicando lifecycle (versiones viejas IA → Glacier → delete)"
  cat > "$TMP_DIR/lifecycle.json" <<'EOF'
{
  "Rules": [
    {
      "ID": "transition-noncurrent-versions",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionTransitions": [
        { "NoncurrentDays": 30, "StorageClass": "STANDARD_IA" },
        { "NoncurrentDays": 90, "StorageClass": "GLACIER" }
      ],
      "NoncurrentVersionExpiration": { "NoncurrentDays": 365 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
EOF
  aws_cli s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
    --lifecycle-configuration "file://$TMP_DIR/lifecycle.json"

  log_step "Aplicando CORS (localhost + amplifyapp.com)"
  cat > "$TMP_DIR/cors.json" <<'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001", "https://*.amplifyapp.com"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-version-id"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF
  aws_cli s3api put-bucket-cors --bucket "$BUCKET" \
    --cors-configuration "file://$TMP_DIR/cors.json"

  log_step "Aplicando tags estándar"
  aws_cli s3api put-bucket-tagging --bucket "$BUCKET" \
    --tagging "TagSet=[\
{Key=Project,Value=smart-control-security},\
{Key=Environment,Value=$ENV},\
{Key=Phase,Value=fase-1},\
{Key=Owner,Value=$OWNER_EMAIL},\
{Key=CostCenter,Value=smart-control},\
{Key=ManagedBy,Value=manual}]"

  log_step "Creando markers de carpetas (fotos/marcas, fotos/incidentes, reportes, backups)"
  for prefix in "fotos/marcas/" "fotos/incidentes/" "reportes/" "backups/"; do
    echo "" | aws_cli s3api put-object \
      --bucket "$BUCKET" \
      --key "${prefix}.keep" >/dev/null
  done

  log_ok "Bucket $BUCKET configurado completamente"
}

# ----------------------------------------------------------------------------
# Step 3 — CloudWatch Log Group
# ----------------------------------------------------------------------------
ensure_log_group() {
  log_section "3/6 CloudWatch Log Group ($LOG_GROUP)"

  if aws_cli logs describe-log-groups \
       --log-group-name-prefix "$LOG_GROUP" --region "$REGION" \
       --query "logGroups[?logGroupName=='$LOG_GROUP'] | length(@)" --output text 2>/dev/null | grep -q '^1$'; then
    log_skip "Log group ya existe"
  else
    aws_cli logs create-log-group --log-group-name "$LOG_GROUP" --region "$REGION"
    log_ok "Log group creado"
  fi

  log_step "Setting retention a ${LOG_RETENTION_DAYS} días"
  aws_cli logs put-retention-policy \
    --log-group-name "$LOG_GROUP" \
    --retention-in-days "$LOG_RETENTION_DAYS" \
    --region "$REGION"

  log_step "Aplicando tags"
  aws_cli logs tag-resource \
    --resource-arn "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:${LOG_GROUP}" \
    --tags "Project=smart-control-security,Environment=$ENV,Phase=fase-1,Owner=$OWNER_EMAIL,CostCenter=smart-control,ManagedBy=manual" \
    --region "$REGION"

  log_ok "Log group $LOG_GROUP configurado"
}

# ----------------------------------------------------------------------------
# Step 4 — SSM Parameter Store (DB password placeholder)
# ----------------------------------------------------------------------------
ensure_db_password_param() {
  log_section "4/6 SSM Parameter Store ($PARAM_DB_PASSWORD)"

  if aws_cli ssm get-parameter --name "$PARAM_DB_PASSWORD" --region "$REGION" >/dev/null 2>&1; then
    log_skip "Parámetro ya existe (NO se sobrescribe el value para no tocar password real)"
    return 0
  fi

  PLACEHOLDER="REPLACE_WHEN_RDS_CREATED_$(openssl rand -hex 8)"
  aws_cli ssm put-parameter \
    --name "$PARAM_DB_PASSWORD" \
    --description "Password de Aurora PostgreSQL Fase 1 (placeholder hasta crear RDS)" \
    --value "$PLACEHOLDER" \
    --type SecureString \
    --tier Standard \
    --tags "Key=Project,Value=smart-control-security" \
           "Key=Environment,Value=$ENV" \
           "Key=Phase,Value=fase-1" \
           "Key=Owner,Value=$OWNER_EMAIL" \
           "Key=CostCenter,Value=smart-control" \
           "Key=ManagedBy,Value=manual" \
    --region "$REGION" >/dev/null
  log_ok "Parámetro $PARAM_DB_PASSWORD creado con placeholder ($((${#PLACEHOLDER})) chars)"
}

# ----------------------------------------------------------------------------
# Step 5 — IAM Customer-Managed Policy (idempotente con versionado)
# ----------------------------------------------------------------------------
build_app_policy_json() {
  cat > "$TMP_DIR/app-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ObjectsReadWriteDelete",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:GetObjectVersion", "s3:DeleteObjectVersion"],
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    },
    {
      "Sid": "S3BucketList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::${BUCKET}"
    },
    {
      "Sid": "RekognitionFaceLivenessAndCompare",
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectFaces",
        "rekognition:CompareFaces",
        "rekognition:StartFaceLivenessSession",
        "rekognition:CreateFaceLivenessSession",
        "rekognition:GetFaceLivenessSessionResults"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SecretsManagerReadAppSecrets",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": "arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:smart-control/*"
    },
    {
      "Sid": "CloudWatchLogsWriteOwnNamespace",
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
      "Resource": "arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/smart-control/*"
    },
    {
      "Sid": "SSMParameterStoreReadAppParams",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/smart-control/*"
    },
    {
      "Sid": "KMSDecryptForSecureStrings",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*",
      "Condition": { "StringEquals": { "kms:ViaService": "ssm.${REGION}.amazonaws.com" } }
    }
  ]
}
EOF
}

ensure_iam_policy() {
  log_section "5/6 IAM Policy ($POLICY_NAME)"

  build_app_policy_json
  POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

  if aws_cli iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
    log_step "Policy ya existe, creando nueva versión"

    # IAM limita a 5 versiones — borrar la más vieja non-default si llegamos al límite
    NUM_VERSIONS=$(aws_cli iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'length(Versions)' --output text)
    if [ "$NUM_VERSIONS" -ge 5 ]; then
      OLDEST=$(aws_cli iam list-policy-versions --policy-arn "$POLICY_ARN" \
        --query 'sort_by(Versions[?IsDefaultVersion==`false`], &CreateDate)[0].VersionId' --output text)
      aws_cli iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$OLDEST"
      log_ok "Versión vieja $OLDEST borrada (estábamos en el límite de 5)"
    fi

    aws_cli iam create-policy-version \
      --policy-arn "$POLICY_ARN" \
      --policy-document "file://$TMP_DIR/app-policy.json" \
      --set-as-default >/dev/null
    log_ok "Nueva versión creada y marcada como default"
  else
    aws_cli iam create-policy \
      --policy-name "$POLICY_NAME" \
      --description "Least-privilege para la app Smart Control Fase 1: S3, Rekognition face APIs, Secrets Manager, CloudWatch Logs, SSM Parameter Store, KMS via SSM" \
      --policy-document "file://$TMP_DIR/app-policy.json" \
      --tags Key=Project,Value=smart-control-security \
             Key=Environment,Value="$ENV" \
             Key=Phase,Value=fase-1 \
             Key=ManagedBy,Value=manual >/dev/null
    log_ok "Policy $POLICY_NAME creada"
  fi
}

# ----------------------------------------------------------------------------
# Step 6 — IAM Role + attach
# ----------------------------------------------------------------------------
ensure_iam_role() {
  log_section "6/6 IAM Role ($ROLE_NAME)"

  cat > "$TMP_DIR/trust-policy.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowLambdaAndAmplifyToAssume",
    "Effect": "Allow",
    "Principal": { "Service": ["lambda.amazonaws.com", "amplify.amazonaws.com"] },
    "Action": "sts:AssumeRole"
  }]
}
EOF

  if aws_cli iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    log_step "Role ya existe, actualizando trust policy"
    aws_cli iam update-assume-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-document "file://$TMP_DIR/trust-policy.json"
  else
    aws_cli iam create-role \
      --role-name "$ROLE_NAME" \
      --description "Role asumido por Lambda/Amplify para la app Smart Control Fase 1" \
      --assume-role-policy-document "file://$TMP_DIR/trust-policy.json" \
      --tags Key=Project,Value=smart-control-security \
             Key=Environment,Value="$ENV" \
             Key=Phase,Value=fase-1 \
             Key=Owner,Value="$OWNER_EMAIL" \
             Key=CostCenter,Value=smart-control \
             Key=ManagedBy,Value=manual >/dev/null
    log_ok "Role $ROLE_NAME creado"
  fi

  # Attach policy si no está
  POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
  ATTACHED=$(aws_cli iam list-attached-role-policies --role-name "$ROLE_NAME" \
    --query "AttachedPolicies[?PolicyArn=='$POLICY_ARN'] | length(@)" --output text)
  if [ "$ATTACHED" = "1" ]; then
    log_skip "Policy ya adjunta al role"
  else
    aws_cli iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY_ARN"
    log_ok "Policy adjunta al role"
  fi
}

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
print_summary() {
  log_section "✅ Bootstrap completo para ambiente: $ENV"
  cat <<EOF

  Recursos creados/actualizados:

    Budget Alert:     $BUDGET_NAME (\$${BUDGET_USD}/mes → $OWNER_EMAIL)
    S3 Bucket:        arn:aws:s3:::$BUCKET
    Log Group:        arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:${LOG_GROUP}
    SSM Parameter:    arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter${PARAM_DB_PASSWORD}
    IAM Policy:       arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}
    IAM Role:         arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}

  Próximos pasos manuales:
    - Crear RDS Aurora Serverless v2 con master password = $PARAM_DB_PASSWORD
    - Configurar SES (verificar dominio si vas a enviar emails reales)
    - Desplegar app en Amplify Hosting con el role $ROLE_NAME
    - Para staging/prod: revisar tabla de "Decisiones por ambiente" en
      docs/aws-bootstrap.md (sección 12) — ajustar lifecycle, retention,
      tamaño RDS, etc.

EOF
}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
main() {
  preflight
  confirm
  ensure_budget
  ensure_bucket
  ensure_log_group
  ensure_db_password_param
  ensure_iam_policy
  ensure_iam_role
  print_summary
}

main "$@"
