import base64
import os
import uuid

import pytest
from httpx import AsyncClient

from app.core.config import settings

SAMPLE_AUTH_HASH_A = "a" * 64
SAMPLE_AUTH_HASH_B = "b" * 64
SAMPLE_SALT = "c2FtcGxlX3NhbHRfYmFzZTY0XzEyMzQ="


def random_base64(num_bytes: int) -> str:
    return base64.b64encode(os.urandom(num_bytes)).decode("utf-8")


async def register_and_login(client: AsyncClient, email: str, auth_hash: str) -> str:
    # Register
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "auth_hash": auth_hash, "kdf_salt": SAMPLE_SALT},
    )
    # Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "auth_hash": auth_hash},
    )
    token = login_res.cookies.get(settings.SESSION_COOKIE_NAME)
    assert token is not None
    return token


@pytest.mark.asyncio
async def test_notes_crud_lifecycle(client: AsyncClient):
    token = await register_and_login(client, "user_crud@example.com", SAMPLE_AUTH_HASH_A)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    note_id = uuid.uuid4()
    ciphertext1 = base64.b64encode(b"First encrypted payload content").decode("utf-8")
    iv1 = random_base64(12)  # 12 bytes
    tag1 = random_base64(16)  # 16 bytes

    # 1. CREATE NOTE
    create_payload = {
        "id": str(note_id),
        "ciphertext": ciphertext1,
        "nonce_iv": iv1,
        "auth_tag": tag1,
        "crypto_version": 1,
    }
    create_res = await client.post("/api/v1/notes", json=create_payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["id"] == str(note_id)
    assert created_data["ciphertext"] == ciphertext1
    assert created_data["nonce_iv"] == iv1
    assert created_data["auth_tag"] == tag1
    assert created_data["version"] == 1

    # 2. GET NOTE
    get_res = await client.get(f"/api/v1/notes/{note_id}")
    assert get_res.status_code == 200
    got_data = get_res.json()
    assert got_data["id"] == str(note_id)
    assert got_data["version"] == 1

    # 3. UPDATE NOTE
    ciphertext2 = base64.b64encode(b"Updated encrypted payload content").decode("utf-8")
    iv2 = random_base64(12)
    tag2 = random_base64(16)

    update_payload = {
        "ciphertext": ciphertext2,
        "nonce_iv": iv2,
        "auth_tag": tag2,
        "crypto_version": 1,
        "version": 1,  # expected version
    }
    update_res = await client.put(f"/api/v1/notes/{note_id}", json=update_payload)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["id"] == str(note_id)
    assert updated_data["ciphertext"] == ciphertext2
    assert updated_data["nonce_iv"] == iv2
    assert updated_data["version"] == 2

    # 4. DELETE NOTE
    del_res = await client.delete(f"/api/v1/notes/{note_id}")
    assert del_res.status_code == 204

    # 5. VERIFY DELETED
    get_after_del = await client.get(f"/api/v1/notes/{note_id}")
    assert get_after_del.status_code == 404


@pytest.mark.asyncio
async def test_notes_pagination(client: AsyncClient):
    token = await register_and_login(client, "user_pagination@example.com", SAMPLE_AUTH_HASH_A)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # Create 5 notes
    for i in range(5):
        payload = {
            "ciphertext": base64.b64encode(f"Note content #{i}".encode()).decode(),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
        }
        res = await client.post("/api/v1/notes", json=payload)
        assert res.status_code == 201

    # Fetch page 1 (limit 2, offset 0)
    page1 = await client.get("/api/v1/notes?limit=2&offset=0")
    assert page1.status_code == 200
    data1 = page1.json()
    assert len(data1["items"]) == 2
    assert data1["total"] == 5
    assert data1["limit"] == 2
    assert data1["offset"] == 0

    # Fetch page 2 (limit 2, offset 2)
    page2 = await client.get("/api/v1/notes?limit=2&offset=2")
    assert page2.status_code == 200
    data2 = page2.json()
    assert len(data2["items"]) == 2
    assert data2["total"] == 5

    # Fetch page 3 (limit 2, offset 4)
    page3 = await client.get("/api/v1/notes?limit=2&offset=4")
    assert page3.status_code == 200
    data3 = page3.json()
    assert len(data3["items"]) == 1
    assert data3["total"] == 5


@pytest.mark.asyncio
async def test_optimistic_concurrency_conflict(client: AsyncClient):
    token = await register_and_login(client, "user_conflict@example.com", SAMPLE_AUTH_HASH_A)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # Create note
    create_res = await client.post(
        "/api/v1/notes",
        json={
            "ciphertext": random_base64(64),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
        },
    )
    note_id = create_res.json()["id"]

    # Try updating with wrong version (e.g. version=99)
    conflict_res = await client.put(
        f"/api/v1/notes/{note_id}",
        json={
            "ciphertext": random_base64(64),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
            "version": 99,
        },
    )
    assert conflict_res.status_code == 409
    assert "version mismatch" in conflict_res.json()["error"]["message"].lower()

    # Successful update with version 1 -> version becomes 2
    ok_res = await client.put(
        f"/api/v1/notes/{note_id}",
        json={
            "ciphertext": random_base64(64),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
            "version": 1,
        },
    )
    assert ok_res.status_code == 200
    assert ok_res.json()["version"] == 2

    # Trying again with stale version 1 -> conflicts!
    conflict_res2 = await client.put(
        f"/api/v1/notes/{note_id}",
        json={
            "ciphertext": random_base64(64),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
            "version": 1,
        },
    )
    assert conflict_res2.status_code == 409


@pytest.mark.asyncio
async def test_nonce_iv_reuse_forbidden(client: AsyncClient):
    token = await register_and_login(client, "user_nonce@example.com", SAMPLE_AUTH_HASH_A)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    fixed_iv = random_base64(12)
    create_res = await client.post(
        "/api/v1/notes",
        json={
            "ciphertext": random_base64(64),
            "nonce_iv": fixed_iv,
            "auth_tag": random_base64(16),
            "crypto_version": 1,
        },
    )
    note_id = create_res.json()["id"]

    # Attempt to update note reusing the same IV
    reuse_res = await client.put(
        f"/api/v1/notes/{note_id}",
        json={
            "ciphertext": random_base64(64),
            "nonce_iv": fixed_iv,  # Reuse of same IV!
            "auth_tag": random_base64(16),
            "crypto_version": 1,
            "version": 1,
        },
    )
    assert reuse_res.status_code == 409
    assert "reuse" in reuse_res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_crypto_validation_rules(client: AsyncClient):
    token = await register_and_login(client, "user_validation@example.com", SAMPLE_AUTH_HASH_A)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 1. Invalid base64
    res_b64 = await client.post(
        "/api/v1/notes",
        json={
            "ciphertext": "###NotValidBase64@@@",
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
        },
    )
    assert res_b64.status_code == 400
    assert "base64" in res_b64.json()["error"]["message"].lower()

    # 2. Invalid IV length (e.g. 8 bytes instead of 12)
    res_iv = await client.post(
        "/api/v1/notes",
        json={
            "ciphertext": random_base64(32),
            "nonce_iv": random_base64(8),  # 8 bytes instead of 12
            "auth_tag": random_base64(16),
            "crypto_version": 1,
        },
    )
    assert res_iv.status_code == 400
    assert "12 bytes" in res_iv.json()["error"]["message"]

    # 3. Invalid auth tag length (e.g. 10 bytes instead of 16)
    res_tag = await client.post(
        "/api/v1/notes",
        json={
            "ciphertext": random_base64(32),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(10),  # 10 bytes instead of 16
            "crypto_version": 1,
        },
    )
    assert res_tag.status_code == 400
    assert "16 bytes" in res_tag.json()["error"]["message"]


@pytest.mark.asyncio
async def test_data_isolation_idor_bola_protection(client: AsyncClient):
    """Verifies that User B cannot read, update, delete or list User A's notes."""
    # User A registers, logs in, creates Note A
    token_a = await register_and_login(client, "alice@example.com", SAMPLE_AUTH_HASH_A)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token_a)

    note_a_res = await client.post(
        "/api/v1/notes",
        json={
            "ciphertext": base64.b64encode(b"Alice top secret content").decode(),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
        },
    )
    assert note_a_res.status_code == 201
    note_a_id = note_a_res.json()["id"]

    # User B registers and logs in
    token_b = await register_and_login(client, "bob@example.com", SAMPLE_AUTH_HASH_B)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token_b)

    # 1. User B attempts GET on Note A -> 404 Not Found (mitigates IDOR enumeration)
    get_res = await client.get(f"/api/v1/notes/{note_a_id}")
    assert get_res.status_code == 404

    # 2. User B attempts PUT on Note A -> 404 Not Found
    put_res = await client.put(
        f"/api/v1/notes/{note_a_id}",
        json={
            "ciphertext": base64.b64encode(b"Bob malicious overwrite").decode(),
            "nonce_iv": random_base64(12),
            "auth_tag": random_base64(16),
            "crypto_version": 1,
            "version": 1,
        },
    )
    assert put_res.status_code == 404

    # 3. User B attempts DELETE on Note A -> 404 Not Found
    del_res = await client.delete(f"/api/v1/notes/{note_a_id}")
    assert del_res.status_code == 404

    # 4. User B lists their notes -> 0 items returned
    list_res = await client.get("/api/v1/notes")
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 0
    assert len(list_res.json()["items"]) == 0

    # 5. User A returns and verifies Note A is untouched
    client.cookies.set(settings.SESSION_COOKIE_NAME, token_a)
    alice_get = await client.get(f"/api/v1/notes/{note_a_id}")
    assert alice_get.status_code == 200
    assert alice_get.json()["ciphertext"] == note_a_res.json()["ciphertext"]
