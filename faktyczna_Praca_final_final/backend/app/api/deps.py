from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from fastapi import Cookie, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import AuthenticationError
from app.core.security import hash_session_token
from app.db.session import async_session_maker
from app.models.user import User, UserSession


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provides an asynchronous database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user(
    request: Request,
    session_token: str | None = Cookie(default=None, alias=settings.SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticates the user from the HttpOnly session cookie."""
    if not session_token:
        raise AuthenticationError("Not authenticated. Missing session cookie.")

    token_hash = hash_session_token(session_token)
    stmt = (
        select(UserSession)
        .options(selectinload(UserSession.user))
        .where(UserSession.session_token_hash == token_hash)
    )
    result = await db.execute(stmt)
    session_obj = result.scalar_one_or_none()

    if not session_obj:
        raise AuthenticationError("Invalid or expired session.")

    now = datetime.now(UTC)
    # Ensure expires_at is timezone-aware for comparison
    expires_at = session_obj.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if expires_at < now:
        await db.delete(session_obj)
        await db.commit()
        raise AuthenticationError("Session has expired.")

    # Update last seen timestamp
    session_obj.last_seen_at = now
    await db.commit()

    if not session_obj.user or not session_obj.user.is_active:
        raise AuthenticationError("User account is inactive or disabled.")

    return session_obj.user
