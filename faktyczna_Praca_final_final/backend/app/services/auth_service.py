import base64
import hashlib
import hmac
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.models.user import User
from app.repositories.session_repo import session_repo
from app.repositories.user_repo import user_repo
from app.schemas.auth import (
    KdfParamsResponse,
    KdfParamsSchema,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

# Dummy hash for constant-time mitigation when email does not exist
DUMMY_PASSWORD_HASH = hash_password("dummy_constant_time_comparison_string")


class AuthService:
    @staticmethod
    async def get_kdf_params(db: AsyncSession, email: str) -> KdfParamsResponse:
        """Returns KDF salt and parameters for the given email.

        To prevent user enumeration (account enumeration attacks), if the user
        does not exist, a deterministic pseudo-random salt is generated via HMAC
        using the server secret and the requested email. An attacker cannot distinguish
        between existing and non-existing accounts based on status codes or response structure.
        """
        normalized_email = email.lower().strip()
        user = await user_repo.get_by_email(db, normalized_email)

        if user:
            return KdfParamsResponse(
                kdf_salt=user.kdf_salt,
                kdf_params=KdfParamsSchema(**user.kdf_params),
            )

        # Deterministic dummy salt generation
        hmac_digest = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            normalized_email.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        dummy_salt = base64.b64encode(hmac_digest[:16]).decode("utf-8")

        return KdfParamsResponse(
            kdf_salt=dummy_salt,
            kdf_params=KdfParamsSchema(),
        )

    @staticmethod
    async def register(db: AsyncSession, request: UserRegisterRequest) -> UserResponse:
        """Registers a new user account with client-derived auth hash and salt."""
        normalized_email = request.email.lower().strip()
        existing_user = await user_repo.get_by_email(db, normalized_email)
        if existing_user:
            raise ConflictError("User with this email already exists.")

        # Hash client's auth_hash with server Argon2id
        server_password_hash = hash_password(request.auth_hash)

        user = await user_repo.create(
            db=db,
            email=normalized_email,
            password_hash=server_password_hash,
            kdf_salt=request.kdf_salt,
            kdf_params=request.kdf_params.model_dump(),
        )
        return UserResponse.model_validate(user)

    @staticmethod
    async def login(
        db: AsyncSession,
        request: UserLoginRequest,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> tuple[str, UserResponse]:
        """Authenticates user and issues a new session token."""
        normalized_email = request.email.lower().strip()
        user = await user_repo.get_by_email(db, normalized_email)

        if not user or not user.is_active:
            # Perform dummy verify to mitigate timing attacks
            verify_password(request.auth_hash, DUMMY_PASSWORD_HASH)
            raise AuthenticationError("Invalid email or password.")

        if not verify_password(request.auth_hash, user.password_hash):
            raise AuthenticationError("Invalid email or password.")

        # Generate secure random session token
        session_token = generate_session_token()
        session_token_hash = hash_session_token(session_token)

        expires_at = datetime.now(UTC) + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS)

        await session_repo.create_session(
            db=db,
            user_id=user.id,
            session_token_hash=session_token_hash,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        return session_token, UserResponse.model_validate(user)

    @staticmethod
    async def logout(db: AsyncSession, session_token: str | None) -> None:
        """Revokes the current session from the database."""
        if not session_token:
            return
        token_hash = hash_session_token(session_token)
        await session_repo.revoke_session(db, token_hash)

    @staticmethod
    async def logout_all(db: AsyncSession, user: User) -> int:
        """Revokes all active sessions for the user."""
        return await session_repo.revoke_all_user_sessions(db, user.id)


auth_service = AuthService()
