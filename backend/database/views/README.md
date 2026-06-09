# `views/` — Vistas SQL expuestas

Vistas no-materializadas (`CREATE OR REPLACE VIEW`) que son **idempotentes** y se
re-aplican automáticamente en cada deploy.

## Cuándo usar una vista aquí

- Consultas que se exponen al panel admin y son **estables**.
- Capa de abstracción entre las tablas OLTP y los consumidores.
- Vistas que no requieren materialización (poco volumen, ejecución rápida).

## Cuándo NO usar una vista aquí (usa `analytics/` en su lugar)

- Cálculos pesados sobre millones de filas.
- Agregaciones que se consultan muy frecuentemente y benefician de cache.

## Reglas

1. **Siempre** `CREATE OR REPLACE VIEW` (no `CREATE VIEW`).
2. **Schema implícito:** `public` (no usar schemas separados por ahora).
3. **Prefijo del nombre:** `v_<dominio>_<descripcion>` — ejemplo: `v_guardias_activos`.
4. **Comentar la vista** con `COMMENT ON VIEW v_xxx IS '...';` después de crearla.
5. **Si tiene dependencias** con otras vistas, ordena los archivos numéricamente
   (`10_v_base.sql`, `20_v_depende_de_base.sql`).
6. **No incluyas datos sensibles** sin filtrar (siempre aplica RLS o filtros explícitos).

## Convención de nombres de archivo

```text
views/
├── v_guardias_activos.sql
├── v_marcas_diarias.sql
├── v_alertas_pendientes.sql
└── 10_v_base_jornadas.sql       ← orden explícito si hay dependencias
    20_v_jornadas_completas.sql
```

## Template

Ver `_template_view.sql.example` en este directorio.

## Cómo se ejecutan

En cada merge a `main` con cambios en `backend/database/views/**`, el workflow
`database-auto-migrate.yml` itera todos los `*.sql` ordenados alfabéticamente y los aplica.

Localmente:
```bash
cd backend
for f in database/views/*.sql; do
  docker exec -i scs-postgres psql -U scs_user -d scs_db < "$f"
done
```

(O usar el helper `python -m database.tools.apply_views` que se agrega en Sprint 1.2.)
