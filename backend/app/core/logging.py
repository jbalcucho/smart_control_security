"""Configuración de logging estructurado con structlog.

En desarrollo: salida amigable (con colores) para humanos.
En producción: salida JSON para parsing en CloudWatch/Datadog.

Uso:
    from app.core.logging import get_logger

    logger = get_logger(__name__)
    logger.info("user_login", user_id=user.id, ip=request.client.host)
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import EventDict, Processor

from app.core.config import settings


def _add_app_context(_logger: Any, _method_name: str, event_dict: EventDict) -> EventDict:
    event_dict["app"] = settings.app_name
    event_dict["env"] = settings.environment
    event_dict["version"] = settings.app_version
    return event_dict


def configure_logging() -> None:
    """Configura structlog para toda la aplicación."""
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        _add_app_context,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.is_local:
        renderer: Processor = structlog.dev.ConsoleRenderer(colors=True)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.UnicodeDecoder(),
            renderer,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=settings.log_level,
    )

    for noisy_logger in ("uvicorn.access", "boto3", "botocore", "urllib3"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.stdlib.get_logger(name)
