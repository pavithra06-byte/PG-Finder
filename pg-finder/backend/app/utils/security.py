import os
import time
import uuid
import jwt
import bcrypt
from functools import wraps
from flask import request, jsonify, current_app
from bson import ObjectId


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user, role: str) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user["_id"]),
        "role": role,
        "iat": now,
        "exp": now + current_app.config["JWT_EXPIRY_HOURS"] * 3600,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def decode_token(token: str):
    try:
        return jwt.decode(
            token, current_app.config["JWT_SECRET"], algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        return {"error": "expired"}
    except jwt.InvalidTokenError:
        return {"error": "invalid"}


def get_current_user():
    """Resolve Authorization header -> user doc (or None)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    payload = decode_token(auth[7:])
    if not payload or "error" in payload:
        return None
    from app.models import get_db

    try:
        return get_db().users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        return None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401
        payload = decode_token(auth[7:])
        if not payload:
            return jsonify({"error": "Invalid token"}), 401
        if payload.get("error") == "expired":
            return jsonify({"error": "Session expired. Please login again."}), 401
        from app.models import get_db

        try:
            user = get_db().users.find_one({"_id": ObjectId(payload["sub"])})
        except Exception:
            user = None
        if not user:
            return jsonify({"error": "Account not found"}), 401
        request.user = user
        request.token_payload = payload
        return fn(*args, **kwargs)

    return wrapper


def require_role(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(request, "user", None)
            if not user:
                return jsonify({"error": "Authentication required"}), 401
            if user.get("role") not in roles:
                return jsonify({"error": "Forbidden: insufficient permissions"}), 403
            if user.get("status") == "suspended":
                return jsonify({"error": "Account suspended. Contact support."}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def public_user(user):
    """Safe public representation of a user (no private fields)."""
    return {
        "id": str(user["_id"]),
        "name": user.get("name", "User"),
        "role": user.get("role"),
        "avatar": user.get("avatar"),
        "isVerified": user.get("isVerified", False),
        "city": user.get("city"),
        "createdAt": user.get("createdAt"),
    }


def full_user(user):
    """Full representation for the account owner / admin."""
    data = public_user(user)
    data.update(
        {
            "email": user.get("email"),
            "phone": user.get("phone"),
            "status": user.get("status", "active"),
            "gender": user.get("gender"),
            "address": user.get("address"),
            "bio": user.get("bio"),
            "homeLocation": user.get("homeLocation"),
            "searchRadius": user.get("searchRadius"),
            "preferences": user.get("preferences", {}),
            "notificationSettings": user.get("notificationSettings", {}),
            "ownerDetails": user.get("ownerDetails"),
            "stats": user.get("stats", {}),
        }
    )
    return data
