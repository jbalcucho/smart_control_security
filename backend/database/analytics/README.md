# `analytics/` — Materialized Views para reportes

Vistas materializadas (`MATERIALIZED VIEW`) que **almacenan resultados precomputados** para
consultas pesadas del panel administrativo y reportes ejecutivos.

## Cuándo usar una materialized view aquí

- Agregaciones sobre **muchas filas** (millones de marcas, eventos, etc.).
- Reportes consultados frecuentemente desde el panel admin.
- Datos que no necesitan estar al segundo (refresh cada X minutos/horas es aceptable).
- Cálculos de fraude consolidados (ej. ranking de guardias con más alertas).

## Estrategia de refresh

| Materialized View | Frecuencia | Cómo |
|---|---|---|
| `mv_marcas_por_mes` | Cada hora | Cron job en Arq |
| `mv_fraude_por_guardia` | Cada 6h | Cron job en Arq |
| `mv_kpis_diarios` | Diario 02:00 | Cron job en Arq |

Los jobs viven en `backend/app/workers/analytics_refresh.py` (Sprint 1.6).

## Reglas

1. **Patrón DROP-CREATE** para idempotencia:
   ```sql
   DROP MATERIALIZED VIEW IF EXISTS mv_xxx;
   CREATE MATERIALIZED VIEW mv_xxx AS
   SELECT ...;
   CREATE UNIQUE INDEX ix_mv_xxx_pk ON mv_xxx (...);  -- requerido para REFRESH CONCURRENTLY
   ```
2. **Prefijo:** `mv_<dominio>_<descripcion>`.
3. **Siempre** crear un índice único después de la vista (para soportar `REFRESH MATERIALIZED VIEW CONCURRENTLY`).
4. **Comentar** la vista y los índices.
5. **No crear materialized views con tipos geoespaciales** sin asesorarse primero (PostGIS tiene restricciones).

## Template

Ver `_template_mview.sql.example` en este directorio.

## Cómo se ejecutan

En cada merge a `main` con cambios en `backend/database/analytics/**`, el workflow
`database-auto-migrate.yml` itera los `*.sql` y los aplica.

El **refresh periódico** lo hacen los workers de Arq, no el deploy.

## Diferencia con `views/`

| | `views/` | `analytics/` |
|---|---|---|
| Tipo | `VIEW` | `MATERIALIZED VIEW` |
| Almacena datos | No (se computa al consultar) | Sí (precomputado) |
| Idempotencia | `CREATE OR REPLACE VIEW` | `DROP + CREATE` |
| Refresh | Automático (siempre fresh) | Manual / cron |
| Costo de consulta | Variable | Bajo (lectura directa) |
| Tamaño de datos | 0 bytes | MB / GB |
