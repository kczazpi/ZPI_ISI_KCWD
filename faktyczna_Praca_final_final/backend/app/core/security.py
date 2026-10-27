import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

# Initialize Argon2 PasswordHasher with configured security parameters
ph = PasswordHasher(
    time_cost=settings.ARGON2_TIME_COST,
    memory_cost=settings.ARGON2_MEMORY_COST,
    parallelism=settings.ARGON2_PARALLELISM,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hashes a password/auth_hash using Argon2id."""
    return ph.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a password/auth_hash against an Argon2id hash with constant-time verification."""
    try:
        return ph.verify(hashed_password, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def generate_session_token() -> str:
    """Generates a secure random 32-byte (64 hex characters) session token."""
    return secrets.token_hex(32)


def hash_session_token(token: str) -> str:
    """Computes SHA-256 hash of a session token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_compare(val1: str, val2: str) -> bool:
    """Performs constant-time comparison to prevent timing attacks."""
    return secrets.compare_digest(val1, val2)
