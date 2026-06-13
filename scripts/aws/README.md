# Scripts AWS — Smart Control Security

Scripts shell para bootstrap y operación de recursos AWS de la app.

## bootstrap-fase1.sh

Crea idempotentemente todos los recursos AWS de Fase 1 para un ambiente:
Budget Alert, S3 Bucket, CloudWatch Log Group, SSM Parameter Store, IAM
Policy y IAM Role.

### Uso

```bash
# Dev (lo que ya existe — re-ejecutar es seguro, hace sync de config)
./scripts/aws/bootstrap-fase1.sh dev

# Staging (cuenta AWS distinta, profile distinto)
./scripts/aws/bootstrap-fase1.sh staging

# Prod
./scripts/aws/bootstrap-fase1.sh prod

# Sin pedir confirmación (útil en CI)
SKIP_CONFIRM=1 ./scripts/aws/bootstrap-fase1.sh dev

# Region distinta (default us-east-2)
AWS_REGION=us-east-1 ./scripts/aws/bootstrap-fase1.sh prod

# Email override
OWNER_EMAIL=ops@mi-empresa.com ./scripts/aws/bootstrap-fase1.sh prod

# Profile name override (default por env: smart-control / smart-control-staging / smart-control-prod)
PROFILE_OVERRIDE=mi-profile-custom ./scripts/aws/bootstrap-fase1.sh prod
```

### Defaults por ambiente

| Variable | dev | staging | prod |
|---|---|---|---|
| Profile | `smart-control` | `smart-control-staging` | `smart-control-prod` |
| Budget mensual | $10 | $50 | $500 |
| Log retention | 30d | 90d | 365d |
| Email default | `wallyribal@gmail.com` | `alertas-staging@scsecurity.com` | `ops@scsecurity.com` |

### Pre-requisitos

Cada ambiente requiere antes (manual, una sola vez por cuenta):

1. Cuenta AWS root creada y asegurada con MFA, sin access keys del root
2. Usuario IAM `smart-control-dev` creado y agregado al grupo
   `smart-control-dev-group` con políticas `PowerUserAccess` + `IAMFullAccess`
3. AWS CLI configurado con el profile correspondiente

Ver `docs/aws-bootstrap.md` Pasos 1–9 para el detalle.

### Idempotencia

- Detecta cada recurso antes de crear y actualiza la configuración si ya existe
- Maneja el límite IAM de 5 versiones por policy (borra la más vieja non-default)
- Trust policy del role se actualiza si cambia (no se duplica)
- Los `.keep` markers de S3 se sobrescriben sin problema (overwrite gratis)
- Tags y configuraciones de bucket se aplican siempre (son PUT, no CREATE)

### Cuándo NO usar este script

- **Migración a IaC**: cuando crezca el número de recursos o ambientes, migrar
  a AWS CDK (Python o TypeScript) en `infra/`. Este script imperativo no
  escala bien para infra compleja.
- **Cambios destructivos**: el script NO borra recursos. Si necesitás teardown,
  hacerlo manualmente con `aws ... delete-*` o `aws cloudformation delete-stack`
  cuando exista el CDK.
- **Cuentas multi-tenant**: si en algún momento hay sub-cuentas (AWS Organizations),
  el script asume 1 cuenta = 1 ambiente. Adaptar para SSO/AssumeRole según haga falta.

### Cuándo SÍ usar

- **Setup inicial de un nuevo ambiente** (staging, prod, prod-EU, etc.)
- **Sync de configuración** cuando agregamos un nuevo recurso (rerun: solo crea el nuevo)
- **Validación de drift** — corré el script y mirá los `↷ skip` vs `✓ creado` para
  detectar diferencias entre dev y prod
