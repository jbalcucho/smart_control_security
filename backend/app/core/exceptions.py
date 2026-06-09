"""Excepciones de dominio y manejadores globales para FastAPI.

Define una jerarquía de excepciones específicas del negocio que
generan respuestas HTTP uniformes en formato:

    {
        "error_code": "...",
        "message": "...",
        "details": {...},
        "request_id": "..."
    }
"""

from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppException(Exception):
    """Excepción base de la aplicación."""

    error_code: str = "internal_error"
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message: str = "Error interno del servidor"

    def __init__(
        self,
        message: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message
        self.details = details or {}


class NotFoundError(AppException):
    error_code = "not_found"
    status_code = status.HTTP_404_NOT_FOUND
    message = "Recurso no encontrado"


class UnauthorizedError(AppException):
    error_code = "unauthorized"
    status_code = status.HTTP_401_UNAUTHORIZED
    message = "No autorizado"


class ForbiddenError(AppException):
    error_code = "forbidden"
    status_code = status.HTTP_403_FORBIDDEN
    message = "Acceso denegado"


class ConflictError(AppException):
    error_code = "conflict"
    status_code = status.HTTP_409_CONFLICT
    message = "Conflicto con el estado actual"


class ValidationError(AppException):
    error_code = "validation_error"
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "Datos inválidos"


def _build_error_response(
    request: Request,
    *,
    status_code: int,
    error_code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    body = {
        "error_code": error_code,
        "message": message,
        "details": details or {},
        "request_id": request_id,
    }
    return JSONResponse(status_code=status_code, content=body)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.warning(
        "app_exception",
        error_code=exc.error_code,
        message=exc.message,
        path=request.url.path,
    )
    return _build_error_response(
        request,
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logger.info(
        "request_validation_error",
        path=request.url.path,
        errors=exc.errors(),
    )
    return _build_error_response(
        request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code="validation_error",
        message="Datos de entrada inválidos",
        details={"errors": exc.errors()},
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    logger.warning("integrity_error", path=request.url.path, error=str(exc.orig))
    return _build_error_response(
        request,
        status_code=status.HTTP_409_CONFLICT,
        error_code="integrity_error",
        message="Violación de integridad de datos",
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception", path=request.url.path)
    if not request.app.debug:  # type: ignore[attr-defined]
        message = "Error interno del servidor"
        details: dict[str, Any] = {}
    else:
        message = str(exc)
        details = {"type": exc.__class__.__name__}
    return _build_error_response(
        request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="internal_error",
        message=message,
        details=details,
    )


def register_exception_handlers(app: Any) -> None:
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
