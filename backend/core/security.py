
import os
from datetime import datetime, timezone, timedelta

import jwt
from pwdlib import PasswordHash
from dotenv import load_dotenv


load_dotenv()


# ==========================================
# JWT CONFIGURATION
# ==========================================

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = int(
    os.getenv("TOKEN_EXPIRE_MINUTES", "60")
)

if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is missing. Please configure it in your .env file."
    )

if len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET must contain at least 32 characters."
    )

if TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError(
        "TOKEN_EXPIRE_MINUTES must be greater than zero."
    )


# ==========================================
# PASSWORD HASHING
# ==========================================

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Generate a secure password hash."""
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Verify a plain password against its stored hash."""
    return password_hash.verify(
        plain_password,
        hashed_password
    )


# ==========================================
# JWT ACCESS TOKEN GENERATION
# ==========================================

def create_access_token(data: dict) -> str:
    """Generate a JWT access token."""

    to_encode = data.copy()

    now = datetime.now(timezone.utc)

    expire = now + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "iat": now,
        "exp": expire
    })

    token = jwt.encode(
        to_encode,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )

    return token
