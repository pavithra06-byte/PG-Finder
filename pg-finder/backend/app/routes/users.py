import re
from flask import Blueprint, request
from app.models import get_db
from app.utils.security import require_auth, full_user, hash_password, check_password
from app.utils.helpers import error_response, ok, now_iso, save_image

bp = Blueprint("users", __name__)


@bp.route("/me", methods=["GET"])
@require_auth
def me():
    return ok(full_user(request.user))


@bp.route("/me", methods=["PUT"])
@require_auth
def update_me():
    payload = request.get_json(silent=True) or {}
    db = get_db()
    allowed = ["name", "phone", "city", "gender", "bio", "address", "homeLocation", "searchRadius"]
    update = {k: v for k, v in payload.items() if k in allowed and v is not None}
    if payload.get("homeLocation") is None:
        update["homeLocation"] = None
    if payload.get("searchRadius") is None:
        update["searchRadius"] = None
    if "phone" in update and update["phone"] and not re.match(r"^[+0-9 ]{7,15}$", str(update["phone"])):
        return error_response("Please enter a valid phone number.")
    if "homeLocation" in update and update["homeLocation"] is not None:
        hl = update["homeLocation"]
        try:
            lat = float(hl["lat"]); lng = float(hl["lng"])
        except (TypeError, ValueError, KeyError):
            return error_response("Please pick a location on the map first.", 400)
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return error_response("That location looks invalid — pick it on the map.", 400)
        update["homeLocation"] = {
            "lat": lat, "lng": lng,
            "label": str(hl.get("label") or "")[:200],
            "source": "profile",
        }
    if "searchRadius" in update and update["searchRadius"] is not None:
        if int(update["searchRadius"]) not in (1, 3, 5, 10, 15, 20, 25):
            return error_response("Search radius must be 1, 3, 5, 10, 15, 20 or 25 km.", 400)
        update["searchRadius"] = int(update["searchRadius"])
    if not update:
        return error_response("Nothing to update.", 400)
    update["updatedAt"] = now_iso()
    db.users.update_one({"_id": request.user["_id"]}, {"$set": update})
    user = db.users.find_one({"_id": request.user["_id"]})
    return ok(full_user(user), "Profile updated")


@bp.route("/me/photo", methods=["POST"])
@require_auth
def upload_photo():
    if "photo" not in request.files:
        return error_response("No photo uploaded.", 400)
    try:
        url = save_image(request.files["photo"], subdir="avatars")
    except ValueError as e:
        return error_response(str(e), 400)
    db = get_db()
    db.users.update_one({"_id": request.user["_id"]}, {"$set": {"avatar": url, "updatedAt": now_iso()}})
    return ok({"avatar": url}, "Photo updated")


@bp.route("/preferences", methods=["GET", "PUT"])
@require_auth
def preferences():
    db = get_db()
    if request.method == "GET":
        return ok(request.user.get("preferences", {}))
    payload = request.get_json(silent=True) or {}
    keys = [
        "preferredLocation", "preferredLat", "preferredLng",
        "maxRent", "roomType", "foodRequired", "acRequired",
        "genderPreference", "amenities", "moveInDate",
    ]
    prefs = {k: payload.get(k) for k in keys if k in payload}
    db.users.update_one({"_id": request.user["_id"]}, {"$set": {"preferences": prefs, "updatedAt": now_iso()}})
    return ok(prefs, "Preferences saved")


@bp.route("/settings/notifications", methods=["PUT"])
@require_auth
def notification_settings():
    payload = request.get_json(silent=True) or {}
    db = get_db()
    settings = {**request.user.get("notificationSettings", {}), **payload}
    db.users.update_one({"_id": request.user["_id"]}, {"$set": {"notificationSettings": settings}})
    return ok(settings, "Notification settings updated")


@bp.route("/password", methods=["PUT"])
@require_auth
def change_password():
    payload = request.get_json(silent=True) or {}
    old = payload.get("oldPassword") or ""
    new = payload.get("newPassword") or ""
    if not old or not new:
        return error_response("Current and new password are required.", 400)
    if len(new) < 6:
        return error_response("New password must be at least 6 characters.", 400)
    if not check_password(old, request.user.get("password", "")):
        return error_response("Current password is incorrect.", 401)
    db = get_db()
    db.users.update_one({"_id": request.user["_id"]}, {"$set": {"password": hash_password(new), "updatedAt": now_iso()}})
    return ok(message="Password changed successfully")
