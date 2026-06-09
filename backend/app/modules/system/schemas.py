"""Schemas Pydantic del módulo system."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: Literal["ok", "degraded", "down"] = Field(
        ..., description="Estado general del servicio"
    )
    environment: str = Field(..., description="Entorno actual (local/staging/production)")
    version: str = Field(..., description="Versión de la aplicación")
    timestamp: datetime = Field(..., description="Hora actual del servidor (UTC)")
    uptime_seconds: float = Field(..., description="Tiempo desde el último arranque")
    checks: dict[str, str] = Field(
        default_factory=dict,
        description="Estado individual de cada dependencia (db, redis, etc.)",
    )


class VersionResponse(BaseModel):
    app_name: str
    version: str
    api_prefix: str
