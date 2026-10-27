import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.user import User


@pytest.mark.asyncio
async def test_user_creation_and_query(db_session: AsyncSession):
    user = User(
        email="test_user@example.com",
        password_hash="argon2id$v=19$m=65536,t=3,p=1$fakehash...",
        kdf_salt="1234567890abcdef",
        kdf_params={"algorithm": "argon2id", "m": 65536, "t": 3, "p": 1},
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.id is not None
    assert user.email == "test_user@example.com"
    assert user.is_active is True

    # Query from DB
    stmt = select(User).where(User.email == "test_user@example.com")
    result = await db_session.execute(stmt)
    retrieved = result.scalar_one_or_none()
    assert retrieved is not None
    assert retrieved.id == user.id


@pytest.mark.asyncio
async def test_note_creation_and_cascade(db_session: AsyncSession):
    user = User(
        email="note_owner@example.com",
        password_hash="fake_hash",
        kdf_salt="salt_bytes_base64",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    note_id = uuid.uuid4()
    note = Note(
        id=note_id,
        user_id=user.id,
        ciphertext="encrypted_base64_payload_content",
        nonce_iv="random_iv_base64",
        auth_tag="auth_tag_128_bit",
        crypto_version=1,
        version=1,
    )
    db_session.add(note)
    await db_session.commit()
    await db_session.refresh(note)

    assert note.id == note_id
    assert note.version == 1

    # Test cascade delete: deleting user deletes their notes
    await db_session.delete(user)
    await db_session.commit()

    note_stmt = select(Note).where(Note.id == note_id)
    result = await db_session.execute(note_stmt)
    assert result.scalar_one_or_none() is None
