import base64
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException, ConflictError, EntityNotFoundError
from app.models.user import User
from app.repositories.note_repo import note_repo
from app.schemas.common import PaginatedResponse
from app.schemas.note import NoteCreateRequest, NoteResponse, NoteUpdateRequest

MAX_CIPHERTEXT_LENGTH = 10 * 1024 * 1024  # 10 MB limit


def _validate_base64(data: str, field_name: str) -> bytes:
    """Validates that a string is valid Base64 encoded data."""
    try:
        return base64.b64decode(data, validate=True)
    except Exception as exc:
        raise AppException(
            message=f"Invalid Base64 encoding in field '{field_name}'.",
            status_code=400,
        ) from exc


class NoteService:
    @staticmethod
    def validate_crypto_fields(ciphertext: str, nonce_iv: str, auth_tag: str) -> None:
        """Validates Base64 encoding, sizes, and formats of AEAD cryptographic parameters."""
        if len(ciphertext) > MAX_CIPHERTEXT_LENGTH:
            raise AppException(
                message=f"Ciphertext exceeds maximum allowed length of {MAX_CIPHERTEXT_LENGTH} bytes.",
                status_code=413,
            )

        _validate_base64(ciphertext, "ciphertext")

        raw_iv = _validate_base64(nonce_iv, "nonce_iv")
        # Standard AES-GCM nonce is 96 bits (12 bytes)
        if len(raw_iv) != 12:
            raise AppException(
                message=f"Nonce IV must be exactly 12 bytes (96 bits) for AES-GCM, got {len(raw_iv)} bytes.",
                status_code=400,
            )

        raw_tag = _validate_base64(auth_tag, "auth_tag")
        # Standard AES-GCM auth tag is 128 bits (16 bytes)
        if len(raw_tag) != 16:
            raise AppException(
                message=f"Auth tag must be exactly 16 bytes (128 bits) for AES-GCM, got {len(raw_tag)} bytes.",
                status_code=400,
            )

    @staticmethod
    async def list_notes(
        db: AsyncSession,
        user: User,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[NoteResponse]:
        """Lists notes for the authenticated user with pagination."""
        items, total = await note_repo.list_by_user(
            db=db,
            user_id=user.id,
            limit=limit,
            offset=offset,
        )
        return PaginatedResponse[NoteResponse](
            items=[NoteResponse.model_validate(note) for note in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    async def get_note(
        db: AsyncSession,
        note_id: uuid.UUID,
        user: User,
    ) -> NoteResponse:
        """Retrieves a single note.

        Returns 404 if the note does not exist OR if it belongs to another user,
        ensuring strict IDOR/BOLA protection.
        """
        note = await note_repo.get_by_id(db, note_id=note_id, user_id=user.id)
        if not note:
            raise EntityNotFoundError("Note not found.")
        return NoteResponse.model_validate(note)

    @staticmethod
    async def create_note(
        db: AsyncSession,
        request: NoteCreateRequest,
        user: User,
    ) -> NoteResponse:
        """Creates a new encrypted note with client-provided or generated UUID."""
        NoteService.validate_crypto_fields(
            ciphertext=request.ciphertext,
            nonce_iv=request.nonce_iv,
            auth_tag=request.auth_tag,
        )

        try:
            note = await note_repo.create(
                db=db,
                user_id=user.id,
                ciphertext=request.ciphertext,
                nonce_iv=request.nonce_iv,
                auth_tag=request.auth_tag,
                crypto_version=request.crypto_version,
                note_id=request.id,
            )
        except IntegrityError as exc:
            await db.rollback()
            raise ConflictError(
                "A note with this ID already exists or nonce conflict occurred."
            ) from exc

        return NoteResponse.model_validate(note)

    @staticmethod
    async def update_note(
        db: AsyncSession,
        note_id: uuid.UUID,
        request: NoteUpdateRequest,
        user: User,
    ) -> NoteResponse:
        """Updates an encrypted note with optimistic concurrency control and IV reuse protection."""
        NoteService.validate_crypto_fields(
            ciphertext=request.ciphertext,
            nonce_iv=request.nonce_iv,
            auth_tag=request.auth_tag,
        )

        note = await note_repo.get_by_id(db, note_id=note_id, user_id=user.id)
        if not note:
            raise EntityNotFoundError("Note not found.")

        # Optimistic concurrency check
        if note.version != request.version:
            raise ConflictError(
                f"Conflict: Note version mismatch. Expected version {request.version}, but current version is {note.version}. "
                "The note has been modified elsewhere."
            )

        # Nonce reuse prevention
        if note.nonce_iv == request.nonce_iv:
            raise ConflictError(
                "Nonce/IV reuse is strictly forbidden. A new, unique IV must be provided for every encryption operation."
            )

        try:
            updated = await note_repo.update(
                db=db,
                note=note,
                ciphertext=request.ciphertext,
                nonce_iv=request.nonce_iv,
                auth_tag=request.auth_tag,
                crypto_version=request.crypto_version,
            )
        except IntegrityError as exc:
            await db.rollback()
            raise ConflictError(
                "Database integrity violation during update (possible duplicate IV)."
            ) from exc

        return NoteResponse.model_validate(updated)

    @staticmethod
    async def delete_note(
        db: AsyncSession,
        note_id: uuid.UUID,
        user: User,
    ) -> None:
        """Permanently deletes a note."""
        note = await note_repo.get_by_id(db, note_id=note_id, user_id=user.id)
        if not note:
            raise EntityNotFoundError("Note not found.")
        await note_repo.delete(db, note)


note_service = NoteService()
