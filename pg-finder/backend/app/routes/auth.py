import re
import requests as http_requests
from flask import Blueprint, request, jsonify, current_app
from app.utils.security import (
    hash_password,
    check_password,
    create_token,
    require_auth,
    full_user,
)
from app.utils.helpers import now_iso, error_response, ok
from app.utils.ratelimit import rate_limit
from app.models import get_db

bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9 .'-]{1,49}$")


def _validate_register(payload):
    errors = []
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    phone = (payload.get("phone") or "").strip()
    role = payload.get("role") or "tenant"

    if not name or not NAME_RE.match(name):
        errors.append("Please enter a valid name (letters, spaces, 2-50 chars).")
    if not EMAIL_RE.match(email):
        errors.append("Please enter a valid email address.")
    if len(password) < 6:
        errors.append("Password must be at least 6 characters.")
    if phone and not re.match(r"^[+0-9 ]{7,15}$", phone):
        errors.append("Please enter a valid phone number.")
    if role not in ("tenant", "owner", "admin"):
        errors.append("Role must be 'tenant', 'owner' or 'admin'.")
    return errors, {
        "name": name,
        "email": email,
        "password": password,
        "phone": phone,
        "role": role,
    }


@bp.route("/register", methods=["POST"])
@rate_limit(max_requests=10, window_seconds=60)
def register():
    payload = request.get_json(silent=True) or {}
    errors, data = _validate_register(payload)
    if errors:
        return error_response(errors[0], 400)

    from app.models import get_db

    db = get_db()
    if db.users.find_one({"email": data["email"]}):
        return error_response("An account with this email already exists.", 409)

    user = {
        "name": data["name"],
        "email": data["email"],
        "phone": data["phone"],
        "role": data["role"],
        "password": hash_password(data["password"]),
        "status": "active",
        "avatar": None,
        "city": (payload.get("city") or "").strip(),
        "gender": (payload.get("gender") or "").strip() or None,
        "bio": "",
        "preferences": {},
        "notificationSettings": {
            "bookingUpdates": True,
            "messages": True,
            "enquiries": True,
            "announcements": True,
        },
        "isVerified": False,
        "createdAt": now_iso(),
        "lastLogin": now_iso(),
    }
    if data["role"] == "owner":
        user["ownerDetails"] = {
            "verificationStatus": "pending",  # pending | approved | rejected
            "rejectionReason": None,
            "idProof": None,
            "businessName": (payload.get("businessName") or "").strip(),
            "verifiedAt": None,
        }
    result = db.users.insert_one(user)
    user["_id"] = result.inserted_id
    token = create_token(user, user["role"])
    return jsonify({"success": True, "token": token, "user": full_user(user)}), 201


@bp.route("/login", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        return error_response("Email and password are required.", 400)

    from app.models import get_db

    db = get_db()
    user = db.users.find_one({"email": email})
    if not user or not check_password(password, user.get("password", "")):
        return error_response("Invalid email or password.", 401)
    if user.get("status") == "suspended":
        return error_response("This account has been suspended. Contact support.", 403)
    if user.get("role") == "owner" and (user.get("ownerDetails") or {}).get("verificationStatus") == "rejected":
        return error_response(
            "Your owner verification was rejected. Contact support for more details.", 403
        )

    db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": now_iso()}})
    token = create_token(user, user["role"])
    return ok({"token": token, "user": full_user(user)})


@bp.route("/google", methods=["POST"])
@rate_limit(max_requests=20, window_seconds=60)
def google_login():
    """Google sign-in.

    Real mode:  { "idToken": "<Google ID token>" }  — signature verified against
                Google's public JWKS, user created/logged in by verified email.
    Demo mode:  { "mode": "demo" }  — used when no VITE_GOOGLE_CLIENT_ID is
                configured; signs into the seeded demo Google account.
    """
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return error_response("Google login payload must be an object.", 400)
    db = get_db()
    role = str(payload.get("role") or "tenant").strip().lower()
    if role not in ("tenant", "owner", "admin"):
        role = "tenant"

    if payload.get("mode") == "demo":
        if role not in ("tenant", "owner"):
            role = "tenant"
        email = "google.demo.owner@pgfinder.com" if role == "owner" else "google.demo@pgfinder.com"
        name = "Google Demo Owner" if role == "owner" else "Google Demo User"
        user = db.users.find_one({"email": email})
        if not user:
            user = {
                "name": name,
                "email": email,
                "phone": "",
                "role": role,
                "password": hash_password("google-demo-no-password"),
                "status": "active",
                "avatar": None,
                "city": "",
                "gender": None,
                "bio": "Signed in with Google (demo)",
                "preferences": {},
                "notificationSettings": {
                    "bookingUpdates": True, "messages": True,
                    "enquiries": True, "announcements": True,
                },
                "isVerified": False,
                "ownerDetails": None,
                "createdAt": now_iso(),
                "lastLogin": now_iso(),
            }
            user["_id"] = db.users.insert_one(user).inserted_id
        else:
            db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": now_iso()}})
        token = create_token(user, user["role"])
        return ok({"token": token, "user": full_user(user)})

    id_token = (payload.get("idToken") or "").strip()
    if not id_token:
        return error_response("idToken is required.", 400)
    info = _verify_google_token(id_token)
    if not info:
        return error_response("Google token verification failed.", 401)
    email = (info.get("email") or "").strip().lower()
    if not email or not info.get("email_verified", False):
        return error_response("Google account has no verified email.", 400)

    user = db.users.find_one({"email": email})
    if not user:
        new_role = role if role in ("tenant", "owner") else "tenant"
        user = {
            "name": (info.get("name") or email.split("@")[0]).strip()[:60],
            "email": email,
            "phone": "",
            "role": new_role,
            "password": hash_password(f"google-{info.get('sub', '')}"),
            "status": "active",
            "avatar": info.get("picture"),
            "city": "",
            "gender": None,
            "bio": "Signed in with Google",
            "preferences": {},
            "notificationSettings": {
                "bookingUpdates": True, "messages": True,
                "enquiries": True, "announcements": True,
            },
            "isVerified": False,
            "ownerDetails": None,
            "createdAt": now_iso(),
            "lastLogin": now_iso(),
        }
        user["_id"] = db.users.insert_one(user).inserted_id
    else:
        update = {"lastLogin": now_iso()}
        if info.get("picture"):
            update["avatar"] = info["picture"]
        db.users.update_one({"_id": user["_id"]}, {"$set": update})

    token = create_token(user, user["role"])
    return ok({"token": token, "user": full_user(user)})


def _verify_google_token(id_token):
    """Verify a Google ID token against Google's public JWKS (RS256)."""
    try:
        import jwt as pyjwt

        certs = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/certs", timeout=10
        ).json()
        header = pyjwt.get_unverified_header(id_token)
        jwk = next(
            (k for k in certs.get("keys", []) if k.get("kid") == header.get("kid")),
            None,
        )
        if not jwk:
            return None
        key = pyjwt.algorithms.RSAAlgorithm.from_jwk(jwk)
        client_id = current_app.config.get("GOOGLE_CLIENT_ID")
        decoded = pyjwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=client_id,
            leeway=300,
            options={"verify_aud": bool(client_id), "verify_iss": False},
        )
        if decoded.get("iss") not in {"https://accounts.google.com", "accounts.google.com"}:
            return None
        return decoded
    except Exception as exc:
        current_app.logger.warning("Google ID token verification failed: %s", exc)
        return None


@bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    return ok(message="Logged out successfully")


@bp.route("/me", methods=["GET"])
@require_auth
def me():
    return ok(full_user(request.user))
