# `seeds/` — Datos iniciales (catálogos)

Inserts **idempotentes** de datos catálogo que la aplicación necesita para funcionar:
roles, tipos de alerta, configuraciones default, etc.

## Cuándo usar un seed aquí

- Catálogos pequeños y estables (roles, tipos, estados).
- Configuraciones por defecto (parámetros del sistema).
- Datos de referencia que TODOS los ambientes deben tener.

## Cuándo NO usar un seed aquí

- **Datos reales de cliente** (usuarios, guardias, puestos): se cargan vía panel admin o importadores.
- **Datos de prueba** para QA: viven en `backend/tests/fixtures/`.
- **Datos one-off** para corregir un problema: van a `manual_ops/`.

## Reglas

1. **Siempre** `INSERT ... ON CONFLICT (...) DO NOTHING` o `ON CONFLICT (...) DO UPDATE SET ...`.
2. **Nunca** `DELETE` o `TRUNCATE` en seeds (eso va a `manual_ops/`).
3. **Prefijo numérico** para orden: `001_roles.sql`, `002_tipos_alerta.sql`.
4. **Una entidad por archivo**: no mezcles seeds de roles y de tipos en el mismo archivo.
5. **Comentar** cada bloque INSERT con su propósito.

## Convención de nombres

```text
seeds/
├── 001_roles.sql
├── 002_tipos_alerta.sql
├── 003_estados_marca.sql
├── 010_config_defaults.sql
└── ...
```

## Template

Ver `_template_seed.sql.example` en este directorio.

## Cómo se ejecutan

En cada merge a `main` con cambios en `backend/database/seeds/**`, el workflow
`database-auto-migrate.yml` itera los `*.sql` ordenados alfabéticamente y los aplica.

Localmente:
```bash
cd backend
for f in database/seeds/*.sql; do
  docker exec -i scs-postgres psql -U scs_user -d scs_db < "$f"
done
```
