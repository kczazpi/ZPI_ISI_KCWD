import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note


class NoteRepository:
    @staticmethod
    async def get_by_id(
        db: AsyncSession,
        note_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Note | None:
        """Retrieves a note strictly isolated by user_id to prevent BOLA/IDOR."""
        stmt = select(Note).where(Note.id == note_id, Note.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_user(
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Note], int]:
        """Returns a paginated list of notes for the user and total count."""
        # Total count query
        count_stmt = select(func.count()).select_from(Note).where(Note.user_id == user_id)
        count_res = await db.execute(count_stmt)
        total = count_res.scalar() or 0

        # Items query ordered by updated_at descending
        items_stmt = (
            select(Note)
            .where(Note.user_id == user_id)
            .order_by(Note.updated_at.desc(), Note.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        items_res = await db.execute(items_stmt)
        items = list(items_res.scalars().all())

        return items, total

    @staticmethod
    async def create(
        db: AsyncSession,
        user_id: uuid.UUID,
        ciphertext: str,
        nonce_iv: str,
        auth_tag: str,
        crypto_version: int = 1,
        note_id: uuid.UUID | None = None,
    ) -> Note:
        """Creates and persists a new encrypted note."""
        note = Note(
            id=note_id or uuid.uuid4(),
            user_id=user_id,
            ciphertext=ciphertext,
            nonce_iv=nonce_iv,
            auth_tag=auth_tag,
            crypto_version=crypto_version,
            version=1,
        )
        db.add(note)
        await db.commit()
        await db.refresh(note)
        return note

    @staticmethod
    async def update(
        db: AsyncSession,
        note: Note,
        ciphertext: str,
        nonce_iv: str,
        auth_tag: str,
        crypto_version: int,
    ) -> Note:
        """Updates note fields and increments the version number for optimistic locking."""
        note.ciphertext = ciphertext
        note.nonce_iv = nonce_iv
        note.auth_tag = auth_tag
        note.crypto_version = crypto_version
        note.version += 1

        await db.commit()
        await db.refresh(note)
        return note

    @staticmethod
    async def delete(db: AsyncSession, note: Note) -> None:
        """Permanently deletes an encrypted note."""
        await db.delete(note)
        await db.commit()


note_repo = NoteRepository()
