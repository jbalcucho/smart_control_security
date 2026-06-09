# `explore/` — Sandbox local del desarrollador

Espacio personal para **experimentos SQL** que NO van a producción.

## Reglas

1. **Solo local.** Estos scripts no se ejecutan jamás en CI/CD ni en ambientes compartidos.
2. **No commitear archivos `.sql`** de este directorio (están en `.gitignore`).
3. **Solo este README está versionado.**
4. **Si algo aquí es útil**, conviértelo en:
   - Una migración Alembic (`migrations/`) si es estructural.
   - Una vista (`views/`) si es para exponer.
   - Una operación manual (`manual_ops/`) si es un fix puntual.

## Casos de uso típicos

- Probar `EXPLAIN ANALYZE` de queries complejas
- Borradores de migraciones futuras
- Scratchpad para entender un schema
- Pruebas de funciones de PostGIS
- Drafts de vistas analíticas

## Ejemplo de flujo

```bash
# 1. Crear un script para experimentar
echo "SELECT count(*) FROM marcas WHERE es_fraude;" > database/explore/test_fraudes.sql

# 2. Ejecutarlo en tu Postgres local
docker exec -i scs-postgres psql -U scs_user -d scs_db < database/explore/test_fraudes.sql

# 3. Cuando ya tengas la query final, moverla al lugar correcto
#    (por ejemplo, convertirla en una vista en database/views/)
```

## Convención sugerida (opcional)

Para organizar tus experimentos, sub-carpetas por fecha o tema:

```text
explore/
├── README.md         ← este archivo (versionado)
├── 2026-06-09/       ← tus experimentos del día (ignorado por git)
│   ├── queries_marcas.sql
│   └── pruebas_postgis.sql
└── borradores/
    └── nueva_vista_alertas.sql
```
