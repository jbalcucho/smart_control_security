"""Router del módulo system: health check, versión, etc."""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, status

from app.core.config import settings
from app.modules.system.schemas import HealthCheckResponse, VersionResponse

router = APIRouter(prefix="/system", tags=["system"])

_START_TIME = time.monotonic()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check del backend",
    description=(
        "Endpoint de healthcheck que reporta el estado del servicio. "
        "En esta versión (Sprint 1.1) verifica solo el proceso. "
        "En Sprint 1.2 se agregan checks de PostgreSQL y Redis."
    ),
)
async def health_check() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        environment=settings.environment,
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=round(time.monotonic() - _START_TIME, 2),
        checks={"process": "ok"},
    )


@router.get(
    "/version",
    response_model=VersionResponse,
    status_code=status.HTTP_200_OK,
    summary="Versión del API",
)
async def get_version() -> VersionResponse:
    return VersionResponse(
        app_name=settings.app_name,
        version=settings.app_version,
        api_prefix=settings.api_v1_prefix,
    )
