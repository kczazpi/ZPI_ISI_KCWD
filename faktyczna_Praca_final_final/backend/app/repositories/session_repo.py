import uuid
from datetime import datetime
from typing import Any, cast

from sqlalchemy import CursorResult, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserSession


class SessionRepository:
    @staticmethod
    async def create_session(
        db: AsyncSession,
        user_id: uuid.UUID,
        session_token_hash: str,
        expires_at: datetime,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> UserSession:
        session = UserSession(
            user_id=user_id,
            session_token_hash=session_token_hash,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def get_by_token_hash(db: AsyncSession, session_token_hash: str) -> UserSession | None:
        stmt = select(UserSession).where(UserSession.session_token_hash == session_token_hash)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def revoke_session(db: AsyncSession, session_token_hash: str) -> bool:
        stmt = delete(UserSession).where(UserSession.session_token_hash == session_token_hash)
        result = await db.execute(stmt)
        await db.commit()
        cursor_result = cast(CursorResult[Any], result)
        return (cursor_result.rowcount or 0) > 0

    @staticmethod
    async def revoke_all_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> int:
        stmt = delete(UserSession).where(UserSession.user_id == user_id)
        result = await db.execute(stmt)
        await db.commit()
        cursor_result = cast(CursorResult[Any], result)
        return int(cursor_result.rowcount or 0)


session_repo = SessionRepository()
