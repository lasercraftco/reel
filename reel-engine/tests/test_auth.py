"""Auth smoke — JWT round-trip with the same secret used by reel-web."""

from __future__ import annotations

import jwt as pyjwt

from app.auth import _decode
from app.config import get_settings


def test_jwt_round_trip() -> None:
    s = get_settings()
    token = pyjwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "email": "tyler@tyflix.net",
            "role": "owner",
            "app": "reel",
        },
        s.tyflix_auth_jwt_secret,
        algorithm="HS256",
        headers={},
    )
    # Add aud/iss like reel-web does
    token = pyjwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "email": "tyler@tyflix.net",
            "role": "owner",
            "app": "reel",
            "aud": "tyflix",
            "iss": s.tyflix_auth_jwt_issuer,
        },
        s.tyflix_auth_jwt_secret,
        algorithm="HS256",
    )
    claims = _decode(token)
    assert claims["sub"].startswith("1111")
    assert claims["role"] == "owner"
