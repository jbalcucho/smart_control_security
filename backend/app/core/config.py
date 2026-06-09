"""Configuración centralizada de la aplicación.

Lee variables de entorno (o el archivo .env) y las expone como un
objeto `settings` tipado mediante Pydantic.

Uso:
    from app.core.config import settings

    print(settings.database_url)
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    app_name: str = "Smart Control Security"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api"
    host: str = "0.0.0.0"  # noqa: S104  # binding necesario para Docker
    port: int = 8000

    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # ---- Base de datos ----
    database_url: PostgresDsn = Field(
        default="postgresql+asyncpg://scs_user:scs_password@localhost:5432/scs_db"  # type: ignore[arg-type]
    )
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_echo: bool = False

    # ---- Redis ----
    redis_url: RedisDsn = Field(default="redis://localhost:6379/0")  # type: ignore[arg-type]
    redis_nonce_ttl_seconds: int = 600

    # ---- JWT / Auth ----
    jwt_secret_key: str = "CAMBIAME_EN_PRODUCCION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # ---- HMAC ----
    hmac_timestamp_tolerance_seconds: int = 300

    # ---- AWS ----
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "smart-control-security-local"
    s3_use_kms: bool = False
    s3_kms_key_id: str = ""
    s3_presigned_url_expires_seconds: int = 900

    # ---- AWS Rekognition (Fase 3) ----
    rekognition_liveness_min_confidence: int = 80
    rekognition_face_match_min_similarity: int = 90

    # ---- Play Integrity ----
    google_play_project_number: str = ""
    play_integrity_enabled: bool = False

    # ---- SendGrid (Fase 4) ----
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@balcuapps.com"
    sendgrid_from_name: str = "Smart Control Security"

    # ---- Firebase (Fase 4) ----
    firebase_credentials_path: str = ""
    fcm_enabled: bool = False

    # ---- Sentry ----
    sentry_dsn: str = ""
    sentry_environment: str = "local"
    sentry_traces_sample_rate: float = 0.1

    # ---- Reglas de negocio ----
    fraud_velocity_max_kmh: int = 150
    geofence_default_radius_meters: int = 50
    min_gps_precision_meters: int = 50

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_local(self) -> bool:
        return self.environment == "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
