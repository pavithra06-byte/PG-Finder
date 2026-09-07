from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import error_response, ok, now_iso, valid_id

bp = Blueprint("amenities", __name__)

DEFAULT_AMENITIES = [
    "Wi-Fi", "Food", "AC", "Parking", "Laundry", "CCTV", "Security",
    "Power Backup", "Housekeeping", "Gym", "Hot Water", "Kitchen", "Study Area", "Furnished",
]
DEFAULT_CATEGORIES = [
    {"name": "Student PG", "icon": "graduation", "description": "Near colleges and universities"},
    {"name": "Working Professional", "icon": "briefcase", "description": "For working professionals"},
    {"name": "Co-living", "icon": "users", "description": "Community style shared living"},
    {"name": "Women Only", "icon": "female", "description": "Women-only accommodations"},
    {"name": "Men Only", "icon": "male", "description": "Men-only accommodations"},
]


def ensure_defaults(db):
    if db.amenities.count_documents({}) == 0:
        for a in DEFAULT_AMENITIES:
            db.amenities.insert_one({"name": a, "createdAt": now_iso()})
    if db.categories.count_documents({}) == 0:
        for c in DEFAULT_CATEGORIES:
            db.categories.insert_one({**c, "createdAt": now_iso()})


@bp.route("", methods=["GET"])
def list_amenities():
    db = get_db()
    ensure_defaults(db)
    items = list(db.amenities.find().sort("name", 1))
    return ok([{"id": str(a["_id"]), "name": a["name"]} for a in items])


@bp.route("", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def create_amenity():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    if not name:
        return error_response("Amenity name is required.", 400)
    db = get_db()
    if db.amenities.find_one({"name": name}):
        return error_response("Amenity already exists.", 409)
    res = db.amenities.insert_one({"name": name, "createdAt": now_iso()})
    return ok({"id": str(res.inserted_id), "name": name}, "Amenity added")


@bp.route("/<amenity_id>", methods=["DELETE"])
@require_auth
@require_role("owner", "admin")
def delete_amenity(amenity_id):
    if not valid_id(amenity_id):
        return error_response("Invalid id.", 400)
    db = get_db()
    db.amenities.delete_one({"_id": ObjectId(amenity_id)})
    return ok(message="Amenity deleted")


@bp.route("/categories", methods=["GET"])
def list_categories():
    db = get_db()
    ensure_defaults(db)
    items = list(db.categories.find().sort("name", 1))
    return ok([{"id": str(c["_id"]), "name": c["name"], "icon": c.get("icon"),
                "description": c.get("description")} for c in items])
