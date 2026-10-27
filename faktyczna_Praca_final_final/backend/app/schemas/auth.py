import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class KdfParamsSchema(BaseModel):
    algorithm: str = Field(default="argon2id")
    m: int = Field(default=65536, description="Memory cost in KiB")
    t: int = Field(default=3, description="Time iterations")
    p: int = Field(default=1, description="Parallelism lanes")


class KdfParamsResponse(BaseModel):
    kdf_salt: str
    kdf_params: KdfParamsSchema


class UserRegisterRequest(BaseModel):
    email: EmailStr
    auth_hash: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="SHA-256 hex string derived client-side from K_auth",
    )
    kdf_salt: str = Field(
        ...,
        min_length=16,
        max_length=64,
        description="Base64 encoded 16-byte user salt",
    )
    kdf_params: KdfParamsSchema = Field(default_factory=KdfParamsSchema)


class UserLoginRequest(BaseModel):
    email: EmailStr
    auth_hash: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="SHA-256 hex string derived client-side from K_auth",
    )


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    is_active: bool
    created_at: datetime
