"""Entorno de Alembic para Smart Control Security.

Configurado para SQLAlchemy 2.x **async** (asyncpg). La URL de la BD se toma
de `app.core.config.settings.database_url`, NO del `alembic.ini`.

Para usar:
    cd backend
    alembic upgrade head
    alembic revision --autogenerate -m "descripción del cambio"
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# --------------------------------------------------------------------------- #
# Configuración general de Alembic
# --------------------------------------------------------------------------- #
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --------------------------------------------------------------------------- #
# Cargamos la URL desde las settings de la app (no del alembic.ini)
# --------------------------------------------------------------------------- #
# Importación tardía: necesitamos que el path de la app esté disponible.
# Alembic ya añade el cwd (backend/) al sys.path.
from app.core.config import settings  # noqa: E402

config.set_main_option("sqlalchemy.url", settings.database_url)

# --------------------------------------------------------------------------- #
# Metadata target: se llenará cuando existan los modelos en app/models/
# --------------------------------------------------------------------------- #
# A partir de Sprint 1.2, importar la Base declarativa:
#
#   from app.db.base import Base
#   import app.models  # noqa: F401 — para que registre todos los modelos
#   target_metadata = Base.metadata
#
target_metadata = None


# --------------------------------------------------------------------------- #
# Modo "offline" — genera SQL sin conectarse
# --------------------------------------------------------------------------- #
def run_migrations_offline() -> None:
    """Ejecuta migraciones en modo 'offline' (genera SQL sin BD)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# --------------------------------------------------------------------------- #
# Modo "online" — se conecta y aplica
# --------------------------------------------------------------------------- #
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_schemas=False,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Ejecuta migraciones en modo async (usando asyncpg)."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Punto de entrada del modo online."""
    asyncio.run(run_async_migrations())


# --------------------------------------------------------------------------- #
# Dispatcher
# --------------------------------------------------------------------------- #
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
