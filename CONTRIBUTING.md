# Guía de Contribución — Smart Control Security

¡Bienvenido al proyecto! Esta guía cubre cómo organizamos el trabajo, las convenciones técnicas y el flujo de pull requests.

> 📚 **Antes de contribuir, lee:** [`docs/PLAN.md`](./docs/PLAN.md)

---

## 📦 Estructura del monorepo

Este proyecto es un **monorepo** con 3 componentes principales:

```text
smart_control_security/
├── backend/        # API FastAPI (Python)
├── mobile/         # App Flutter (Android first)
├── admin-web/      # Panel Next.js
└── docs/           # Documentación viva
```

Cada componente tiene su propio `README.md` con instrucciones específicas.

---

## 🌳 Flujo de Git

### Branching strategy

Usamos **trunk-based development** con feature branches cortas:

- `main` → siempre desplegable, protegida (requiere PR aprobado)
- `develop` → integración (opcional, para releases agrupados)
- `feat/<descripcion-corta>` → nueva funcionalidad
- `fix/<descripcion-corta>` → corrección de bug
- `chore/<descripcion-corta>` → mantenimiento (deps, configs)
- `docs/<descripcion-corta>` → solo documentación
- `refactor/<descripcion-corta>` → reorganización sin cambio de comportamiento

### Reglas

1. **Nunca hacer push directo a `main`**
2. **Cada PR cierra una tarea concreta** del [roadmap](./docs/roadmap-fases.md)
3. **Branches cortas** (< 5 días de vida)
4. **Rebase** antes de mergear para mantener historia limpia
5. **Squash and merge** por defecto (un commit por PR en `main`)

---

## 📝 Convención de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/es/):

```text
<tipo>(<scope>): <descripción corta en presente>

[cuerpo opcional]

[footer opcional]
```

### Tipos permitidos

| Tipo | Cuándo |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `style` | Formato (sin cambio funcional) |
| `refactor` | Cambio de código sin agregar features ni arreglar bugs |
| `perf` | Mejora de rendimiento |
| `test` | Agregar o corregir tests |
| `chore` | Tareas de mantenimiento, dependencias, configuración |
| `ci` | Cambios en CI/CD |
| `build` | Cambios en sistema de build |

### Scopes sugeridos

- `backend`, `mobile`, `admin-web`, `docs`, `ci`, `db`, `auth`, `marcas`, etc.

### Ejemplos

```text
feat(backend): agregar endpoint POST /api/marcas
fix(mobile): corregir crash al perder GPS durante captura
docs(plan): actualizar duración estimada de fase 3
chore(deps): actualizar fastapi a 0.115.0
refactor(backend): extraer lógica de geofence a service propio
test(backend): cubrir casos edge de validación HMAC
ci: agregar workflow para mobile
```

---

## 🔄 Flujo de Pull Request

### 1. Crear branch desde `main`

```bash
git checkout main
git pull origin main
git checkout -b feat/mi-feature
```

### 2. Hacer cambios + tests

Cada componente tiene sus comandos. Antes de hacer push:

**Backend:**
```bash
cd backend
ruff check . && ruff format --check . && mypy app && pytest
```

**Mobile:**
```bash
cd mobile
flutter analyze && dart format --set-exit-if-changed . && flutter test
```

**Admin Web:**
```bash
cd admin-web
npm run lint && npm run format:check && npm run typecheck && npm run test
```

### 3. Commit con mensaje descriptivo

```bash
git add .
git commit -m "feat(backend): agregar endpoint POST /api/marcas

- Validación HMAC + nonce
- Subida de 3 fotos a S3
- Cálculo de geofence con PostGIS
- Tests E2E con stubs de Rekognition

Closes #42"
```

### 4. Push + abrir PR

```bash
git push -u origin feat/mi-feature
```

Luego abre el PR en GitHub. Llena la plantilla automática.

### 5. Esperar review

- **CI debe pasar** (lint + tests + build)
- **Al menos 1 review aprobada** (o 2 si tocas seguridad/infra)
- Resolver todos los comentarios

### 6. Merge

Una vez aprobado:
- Quien hizo el PR hace el **squash and merge**
- Elimina la branch remota
- Borra la branch local

---

## 🧪 Estándares de calidad

### Cobertura mínima de tests

| Componente | Mínimo | Crítico |
|---|---|---|
| Backend | 70% | 90% en módulos `auth`, `marcas`, `security` |
| Mobile | 70% | 90% en `features/marca`, `core/security` |
| Admin web | 60% | 80% en lógica de auth y validación |

### Reglas de código

- **No `console.log` / `print` en producción** (usar el logger)
- **No `any` en TypeScript** (usar `unknown` y narrowing)
- **No commits con TODO sin issue asociado** (`TODO(#123): ...`)
- **No commitear secretos** (CI verifica con `gitleaks`)
- **Comentarios solo cuando agregan valor**, no narrar el código
- **Code review obligatoria** — no autoaprobar

---

## 🗄️ Cambios en la base de datos

La organización de `backend/database/` separa cambios **auto-aplicables** de cambios **manuales con aprobación**. Antes de tocar la BD, elige el directorio correcto:

| Tipo de cambio | Va en | Cómo se aplica |
|---|---|---|
| Crear/modificar tabla, columna, índice | `backend/database/migrations/` (Alembic) | 🤖 Auto en CI/CD |
| Crear/modificar vista expuesta | `backend/database/views/` (`CREATE OR REPLACE VIEW`) | 🤖 Auto en CI/CD |
| Materialized view para reportes | `backend/database/analytics/` (DROP + CREATE) | 🤖 Auto en CI/CD |
| Catálogos (roles, tipos) | `backend/database/seeds/` (`ON CONFLICT`) | 🤖 Auto en CI/CD |
| `DROP COLUMN` / `DROP TABLE` | `backend/database/manual_ops/` | 👤 Workflow manual + 2 aprobaciones |
| `UPDATE` masivo / backfill | `backend/database/manual_ops/` | 👤 Workflow manual + 2 aprobaciones |
| Experimento personal | `backend/database/explore/` | 🏠 Solo local (no se commitea) |

**Antes de mergear** una migración Alembic prueba localmente:

```bash
cd backend
alembic upgrade head      # aplica
alembic downgrade -1      # baja
alembic upgrade head      # vuelve a aplicar
```

Para operaciones manuales (`manual_ops/`), tu PR debe incluir:
- Cabecera del SQL con: autor, ticket, justificación, plan de rollback, filas afectadas estimadas
- Validación pre y post ejecución
- Al menos **2 aprobaciones** antes de mergear

Guía completa: [`backend/database/README.md`](./backend/database/README.md). ADR de referencia: [ADR-020](./docs/decisiones-tecnicas.md).

---

## 🛡️ Seguridad

Si encuentras una vulnerabilidad **NO abras un issue público**. Reportarla por:
- Email a: `security@balcuapps.com` _(pendiente de configurar)_
- O DM al Tech Lead

---

## 📚 Documentación viva

Cuando agregas una funcionalidad nueva:

1. Actualiza el documento correspondiente en [`docs/`](./docs/)
2. Si tomaste una decisión técnica importante, agrega un nuevo ADR a [`docs/decisiones-tecnicas.md`](./docs/decisiones-tecnicas.md)
3. Si cambia un endpoint del API, actualiza [`docs/funcionalidades-backend.md`](./docs/funcionalidades-backend.md)
4. Si cambia el modelo de datos, actualiza [`docs/modelo-datos.md`](./docs/modelo-datos.md) **y** crea migración Alembic

---

## 🎯 Definición de "Hecho" (Definition of Done)

Una tarea está **completa** cuando:

- [ ] Código implementado siguiendo las convenciones
- [ ] Tests escritos y pasando (cobertura cumple mínimo)
- [ ] Linter + type checker pasan sin warnings
- [ ] Documentación actualizada (si aplica)
- [ ] PR abierto y aprobado
- [ ] CI verde en todos los jobs
- [ ] Mergeado a `main`
- [ ] Item del [roadmap](./docs/roadmap-fases.md) marcado como completado

---

## 🆘 ¿Necesitas ayuda?

- **Onboarding**: lee primero [`README.md`](./README.md) → [`docs/PLAN.md`](./docs/PLAN.md) → README del componente que vas a tocar
- **Decisiones técnicas**: revisa [`docs/decisiones-tecnicas.md`](./docs/decisiones-tecnicas.md) antes de proponer cambios arquitectónicos
- **Issue/duda específica**: abre un issue con la plantilla correspondiente
