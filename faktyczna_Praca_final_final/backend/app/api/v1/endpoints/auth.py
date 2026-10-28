from fastapi import APIRouter, Cookie, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.models.user import User
from app.schemas.auth import (
    KdfParamsResponse,
    LoginResponse,
    MessageResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/kdf-params",
    response_model=KdfParamsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get KDF salt and parameters",
)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_kdf_params(
    request: Request,
    email: str = Query(..., description="User's email address"),
    db: AsyncSession = Depends(get_db),
) -> KdfParamsResponse:
    """Retrieves the KDF salt and parameters required for client-side key derivation.

    Mitigates user enumeration attacks by returning a deterministic dummy salt
    if the account does not exist.
    """
    return await auth_service.get_kdf_params(db, email)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
async def register(
    request: Request,
    body: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Registers a new user account with zero-knowledge cryptography parameters.

    The client derives K_auth client-side and transmits auth_hash (SHA-256 of K_auth).
    The server hashes this value with Argon2id before storing it.
    """
    return await auth_service.register(db, body)


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Login user and establish session",
)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(
    request: Request,
    body: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Verifies credentials and sets a secure HttpOnly session cookie."""
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None

    session_token, user = await auth_service.login(
        db=db,
        request=body,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    # Set secure HttpOnly cookie
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )

    return LoginResponse(
        user=user,
        message="Authenticated successfully",
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Logout user and revoke session",
)
async def logout(
    response: Response,
    session_token: str | None = Cookie(default=None, alias=settings.SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Revokes the current session from the database and removes the session cookie."""
    await auth_service.logout(db, session_token)

    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )

    return MessageResponse(message="Logged out successfully")


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Logout user from all devices",
)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Revokes all active sessions for the authenticated user across all devices."""
    count = await auth_service.logout_all(db, current_user)

    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )

    return MessageResponse(message=f"Revoked {count} active sessions successfully")


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Returns the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)
