import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower().strip())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(
        db: AsyncSession,
        email: str,
        password_hash: str,
        kdf_salt: str,
        kdf_params: dict[str, Any],
    ) -> User:
        user = User(
            email=email.lower().strip(),
            password_hash=password_hash,
            kdf_salt=kdf_salt,
            kdf_params=kdf_params,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


user_repo = UserRepository()
