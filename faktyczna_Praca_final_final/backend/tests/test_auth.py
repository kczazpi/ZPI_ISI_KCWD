from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import generate_session_token, hash_session_token
from app.models.user import User, UserSession

SAMPLE_AUTH_HASH = "a" * 64
SAMPLE_SALT = "c2FtcGxlX3NhbHRfYmFzZTY0XzEyMzQ="  # 32 chars Base64


@pytest.mark.asyncio
async def test_get_kdf_params_for_existing_user(client: AsyncClient):
    # Register user first
    reg_payload = {
        "email": "kdf_test@example.com",
        "auth_hash": SAMPLE_AUTH_HASH,
        "kdf_salt": SAMPLE_SALT,
        "kdf_params": {"algorithm": "argon2id", "m": 65536, "t": 3, "p": 1},
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    # Request KDF params
    response = await client.get("/api/v1/auth/kdf-params", params={"email": "kdf_test@example.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["kdf_salt"] == SAMPLE_SALT
    assert data["kdf_params"]["m"] == 65536
    assert data["kdf_params"]["algorithm"] == "argon2id"


@pytest.mark.asyncio
async def test_get_kdf_params_enumeration_protection(client: AsyncClient):
    # Request KDF params for non-existent user
    non_existent = "nonexistent_probing@example.com"
    res1 = await client.get("/api/v1/auth/kdf-params", params={"email": non_existent})
    assert res1.status_code == 200
    data1 = res1.json()
    assert "kdf_salt" in data1
    assert data1["kdf_params"]["algorithm"] == "argon2id"

    # Determinism check: probing the same email yields the same dummy salt
    res2 = await client.get("/api/v1/auth/kdf-params", params={"email": non_existent})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data1["kdf_salt"] == data2["kdf_salt"]


@pytest.mark.asyncio
async def test_register_success_and_password_hashed(client: AsyncClient, db_session: AsyncSession):
    payload = {
        "email": "new_user@example.com",
        "auth_hash": SAMPLE_AUTH_HASH,
        "kdf_salt": SAMPLE_SALT,
    }
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "new_user@example.com"
    assert "id" in data
    assert data["is_active"] is True

    # Verify that in DB password is NOT stored as raw auth_hash
    stmt = select(User).where(User.email == "new_user@example.com")
    result = await db_session.execute(stmt)
    user_in_db = result.scalar_one()
    assert user_in_db.password_hash != SAMPLE_AUTH_HASH
    assert user_in_db.password_hash.startswith("$argon2id$")


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "auth_hash": SAMPLE_AUTH_HASH,
        "kdf_salt": SAMPLE_SALT,
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    data = res2.json()
    assert "already exists" in data["error"]["message"]


@pytest.mark.asyncio
async def test_login_success_and_cookie(client: AsyncClient):
    # Register
    reg_payload = {
        "email": "login_user@example.com",
        "auth_hash": SAMPLE_AUTH_HASH,
        "kdf_salt": SAMPLE_SALT,
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Login
    login_payload = {
        "email": "login_user@example.com",
        "auth_hash": SAMPLE_AUTH_HASH,
    }
    res = await client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200
    assert res.json()["message"] == "Authenticated successfully"

    # Verify HttpOnly session cookie
    cookies = res.cookies
    assert settings.SESSION_COOKIE_NAME in cookies
    raw_cookie = res.headers.get("set-cookie", "")
    assert "HttpOnly" in raw_cookie


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    # Register
    reg_payload = {
        "email": "valid_user@example.com",
        "auth_hash": SAMPLE_AUTH_HASH,
        "kdf_salt": SAMPLE_SALT,
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Wrong auth hash
    wrong_payload = {
        "email": "valid_user@example.com",
        "auth_hash": "b" * 64,
    }
    res = await client.post("/api/v1/auth/login", json=wrong_payload)
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["error"]["message"]

    # Non-existent email
    non_existent_payload = {
        "email": "nobody@example.com",
        "auth_hash": SAMPLE_AUTH_HASH,
    }
    res_none = await client.post("/api/v1/auth/login", json=non_existent_payload)
    assert res_none.status_code == 401
    assert "Invalid email or password" in res_none.json()["error"]["message"]


@pytest.mark.asyncio
async def test_me_endpoint_flow(client: AsyncClient):
    # Attempt /me without auth
    res_unauth = await client.get("/api/v1/auth/me")
    assert res_unauth.status_code == 401

    # Register and login
    email = "me_flow@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "auth_hash": SAMPLE_AUTH_HASH, "kdf_salt": SAMPLE_SALT},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "auth_hash": SAMPLE_AUTH_HASH},
    )
    session_token = login_res.cookies.get(settings.SESSION_COOKIE_NAME)
    assert session_token is not None

    # Call /me with session cookie
    client.cookies.set(settings.SESSION_COOKIE_NAME, session_token)
    me_res = await client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email


@pytest.mark.asyncio
async def test_logout_revokes_session(client: AsyncClient):
    email = "logout_test@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "auth_hash": SAMPLE_AUTH_HASH, "kdf_salt": SAMPLE_SALT},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "auth_hash": SAMPLE_AUTH_HASH},
    )
    session_token = login_res.cookies.get(settings.SESSION_COOKIE_NAME)
    client.cookies.set(settings.SESSION_COOKIE_NAME, session_token)

    # Logout
    logout_res = await client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200

    # Ensure subsequent calls to /me fail
    me_res = await client.get("/api/v1/auth/me")
    assert me_res.status_code == 401


@pytest.mark.asyncio
async def test_session_expiry_blocks_access(client: AsyncClient, db_session: AsyncSession):
    # Create user
    user = User(
        email="expired_session@example.com",
        password_hash="fake",
        kdf_salt="salt",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Create an expired session in DB
    token = generate_session_token()
    token_hash = hash_session_token(token)
    expired_time = datetime.now(UTC) - timedelta(hours=1)
    session_obj = UserSession(
        user_id=user.id,
        session_token_hash=token_hash,
        expires_at=expired_time,
    )
    db_session.add(session_obj)
    await db_session.commit()

    # Try accessing /me with expired session cookie
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert "expired" in res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_logout_all_sessions(client: AsyncClient, db_session: AsyncSession):
    email = "multi_session@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "auth_hash": SAMPLE_AUTH_HASH, "kdf_salt": SAMPLE_SALT},
    )
    # Login twice to establish two sessions
    login1 = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "auth_hash": SAMPLE_AUTH_HASH},
    )
    token1 = login1.cookies.get(settings.SESSION_COOKIE_NAME)

    login2 = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "auth_hash": SAMPLE_AUTH_HASH},
    )
    token2 = login2.cookies.get(settings.SESSION_COOKIE_NAME)

    # Set token2 on client and call logout-all
    client.cookies.set(settings.SESSION_COOKIE_NAME, token2)
    logout_all_res = await client.post("/api/v1/auth/logout-all")
    assert logout_all_res.status_code == 200

    # Test that neither token1 nor token2 works anymore
    client.cookies.set(settings.SESSION_COOKIE_NAME, token1)
    res1 = await client.get("/api/v1/auth/me")
    assert res1.status_code == 401

    client.cookies.set(settings.SESSION_COOKIE_NAME, token2)
    res2 = await client.get("/api/v1/auth/me")
    assert res2.status_code == 401
