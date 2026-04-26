"""JWT verification for the Reel engine — uses the same TYFLIX_AUTH_JWT_SECRET as reel-web."""

from __future__ import annotations

from typing import Any

import jwt as pyjwt
from fastapi import Header, HTTPException, status

from app.config import get_settings


class TyflixUser:
    def __init__(self, claims: dict[str, Any]) -> None:
        self.id: str = claims["sub"]
        self.email: str = claims.get("email", "")
        self.role: str = claims.get("role", "guest")
        self.app: str = claims.get("app", "")

    def require(self, *roles: str) -> None:
        if self.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")


def _decode(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        return pyjwt.decode(
            token,
            s.tyflix_auth_jwt_secret,
            algorithms=["HS256"],
            audience="tyflix",
            issuer=s.tyflix_auth_jwt_issuer,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token") from exc


async def get_current_user(authorization: str | None = Header(default=None)) -> TyflixUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not_signed_in")
    token = authorization.split(" ", 1)[1].strip()
    claims = _decode(token)
    return TyflixUser(claims)


async def get_optional_user(authorization: str | None = Header(default=None)) -> TyflixUser | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1].strip()
        return TyflixUser(_decode(token))
    except HTTPException:
        return None
