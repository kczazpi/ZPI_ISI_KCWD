from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class EntityNotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=status.HTTP_404_NOT_FOUND, details=details)


class AuthenticationError(AppException):
    def __init__(self, message: str = "Invalid credentials", details: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=status.HTTP_401_UNAUTHORIZED, details=details)


class AuthorizationError(AppException):
    def __init__(self, message: str = "Access forbidden", details: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=status.HTTP_403_FORBIDDEN, details=details)


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict", details: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=status.HTTP_409_CONFLICT, details=details)


async def app_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "message": exc.message,
                    "status_code": exc.status_code,
                    "details": exc.details,
                }
            },
        )
    return await general_exception_handler(request, exc)


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Protect against leaking sensitive stack trace in production
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "message": "An internal server error occurred.",
                "status_code": 500,
            }
        },
    )
