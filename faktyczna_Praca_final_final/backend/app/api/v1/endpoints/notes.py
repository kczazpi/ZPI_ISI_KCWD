import uuid

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.note import NoteCreateRequest, NoteResponse, NoteUpdateRequest
from app.services.note_service import note_service

router = APIRouter(prefix="/notes", tags=["Notes"])


@router.get(
    "",
    response_model=PaginatedResponse[NoteResponse],
    status_code=status.HTTP_200_OK,
    summary="List user notes with pagination",
)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def list_notes(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[NoteResponse]:
    """Retrieves a paginated list of encrypted notes owned by the authenticated user."""
    return await note_service.list_notes(
        db=db,
        user=current_user,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new encrypted note",
)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def create_note(
    request: Request,
    body: NoteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    """Stores a new encrypted note.

    The payload contains only ciphertext, nonce/IV, and authentication tag.
    The server cannot read or decrypt the content.
    """
    return await note_service.create_note(
        db=db,
        request=body,
        user=current_user,
    )


@router.get(
    "/{note_id}",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single encrypted note",
)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def get_note(
    request: Request,
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    """Retrieves a single encrypted note by its ID.

    Returns 404 if the note does not exist or belongs to another user.
    """
    return await note_service.get_note(
        db=db,
        note_id=note_id,
        user=current_user,
    )


@router.put(
    "/{note_id}",
    response_model=NoteResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an encrypted note",
)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def update_note(
    request: Request,
    note_id: uuid.UUID,
    body: NoteUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    """Updates an encrypted note.

    Enforces optimistic concurrency control (matching version) and
    ensures that a fresh, unique nonce/IV is used.
    """
    return await note_service.update_note(
        db=db,
        note_id=note_id,
        request=body,
        user=current_user,
    )


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an encrypted note",
)
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def delete_note(
    request: Request,
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Permanently deletes an encrypted note."""
    await note_service.delete_note(
        db=db,
        note_id=note_id,
        user=current_user,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
