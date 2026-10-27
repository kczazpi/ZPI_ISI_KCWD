import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteCreateRequest(BaseModel):
    id: uuid.UUID | None = Field(
        default=None,
        description="Optional client-generated UUIDv4 matching AAD binding",
    )
    ciphertext: str = Field(
        ...,
        min_length=1,
        description="AES-256-GCM ciphertext payload (Base64)",
    )
    nonce_iv: str = Field(
        ...,
        min_length=12,
        max_length=32,
        description="Random 96-bit initialization vector (Base64)",
    )
    auth_tag: str = Field(
        ...,
        min_length=16,
        max_length=32,
        description="128-bit authentication tag (Base64)",
    )
    crypto_version: int = Field(default=1, ge=1)


class NoteUpdateRequest(BaseModel):
    ciphertext: str = Field(
        ...,
        min_length=1,
        description="New AES-256-GCM ciphertext payload (Base64)",
    )
    nonce_iv: str = Field(
        ...,
        min_length=12,
        max_length=32,
        description="Fresh random 96-bit IV (must never be reused)",
    )
    auth_tag: str = Field(
        ...,
        min_length=16,
        max_length=32,
        description="128-bit authentication tag for updated payload",
    )
    crypto_version: int = Field(default=1, ge=1)
    version: int = Field(
        ...,
        ge=1,
        description="Expected version for optimistic concurrency control",
    )


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ciphertext: str
    nonce_iv: str
    auth_tag: str
    crypto_version: int
    version: int
    created_at: datetime
    updated_at: datetime
