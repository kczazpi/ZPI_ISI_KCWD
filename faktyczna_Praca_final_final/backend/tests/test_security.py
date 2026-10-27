from app.core.security import (
    constant_time_compare,
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)


def test_password_hashing_and_verification():
    auth_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    hashed = hash_password(auth_hash)

    assert hashed.startswith("$argon2id$")
    assert verify_password(auth_hash, hashed) is True
    assert verify_password("wrong_auth_hash", hashed) is False


def test_session_token_generation():
    token1 = generate_session_token()
    token2 = generate_session_token()

    assert len(token1) == 64
    assert len(token2) == 64
    assert token1 != token2

    hash1 = hash_session_token(token1)
    assert len(hash1) == 64
    assert hash_session_token(token1) == hash1


def test_constant_time_compare():
    assert constant_time_compare("token_abc", "token_abc") is True
    assert constant_time_compare("token_abc", "token_xyz") is False
