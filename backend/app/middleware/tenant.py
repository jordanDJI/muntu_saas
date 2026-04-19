import logging
from functools import lru_cache
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import httpx
from jose import jwk as jose_jwk, jwt as jose_jwt
from jose.exceptions import JWTError, ExpiredSignatureError

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _fetch_jwks() -> tuple:
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    keys = tuple(resp.json().get("keys", []))
    logger.info(f"JWKS fetched: {len(keys)} key(s)")
    return keys


def _decode_supabase_jwt(token: str) -> dict:
    try:
        header = jose_jwt.get_unverified_header(token)
    except Exception as e:
        logger.error(f"JWT header error: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token malformé")

    kid = header.get("kid")
    alg = header.get("alg", "ES256")

    try:
        keys = _fetch_jwks()
    except Exception as e:
        logger.error(f"JWKS fetch failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Erreur JWKS")

    for key_data in keys:
        if kid and key_data.get("kid") != kid:
            continue
        try:
            ec_key = jose_jwk.construct(key_data, algorithm=alg)
            return jose_jwt.decode(token, ec_key, algorithms=[alg], audience="authenticated")
        except ExpiredSignatureError:
            logger.error("Token expiré")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expiré")
        except JWTError as e:
            logger.error(f"JWT decode failed: {type(e).__name__}: {e}")
            continue

    logger.error(f"Aucune clé JWKS ne correspond au kid={kid}")
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = _decode_supabase_jwt(token)
    return {
        "sub": payload.get("sub"),
        "email": payload.get("email"),
        "app_metadata": payload.get("app_metadata", {}),
        "user_metadata": payload.get("user_metadata", {}),
    }


async def get_current_tenant(user: dict = Depends(get_current_user)) -> str:
    tenant_id = user.get("app_metadata", {}).get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aucun tenant associé")
    return tenant_id
