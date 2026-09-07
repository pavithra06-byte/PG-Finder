from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import error_response, ok, now_iso, valid_id

bp = Blueprint("favorites", __name__)


@bp.route("", methods=["GET"])
@require_auth
@require_role("tenant")
def list_favorites():
    db = get_db()
    uid = str(request.user["_id"])
    favs = list(db.favorites.find({"tenantId": uid}).sort("createdAt", -1))
    pg_ids = [ObjectId(f["pgId"]) for f in favs if valid_id(f.get("pgId"))]
    docs = {str(p["_id"]): p for p in db.pg_properties.find({"_id": {"$in": pg_ids}})} if pg_ids else {}
    out = []
    for f in favs:
        pg = docs.get(f.get("pgId"))
        if not pg:
            continue
        d = {
            "id": f.get("pgId"),
            "name": pg.get("name"),
            "city": pg.get("city"),
            "area": pg.get("area"),
            "images": pg.get("images", []),
            "rent": pg.get("rent"),
            "deposit": pg.get("deposit"),
            "rating": (pg.get("rating") or {}).get("average", 0),
            "reviewCount": (pg.get("rating") or {}).get("count", 0),
            "gender": pg.get("gender"),
            "roomTypes": pg.get("roomTypes", []),
            "availableRooms": pg.get("availableRooms", 0),
            "amenities": pg.get("amenities", []),
            "verified": pg.get("verified", False),
        }
        out.append(d)
    return ok(out)


@bp.route("/<pg_id>", methods=["POST"])
@require_auth
@require_role("tenant")
def add_favorite(pg_id):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id), "status": "approved"})
    if not pg:
        return error_response("PG not found.", 404)
    uid = str(request.user["_id"])
    if db.favorites.find_one({"tenantId": uid, "pgId": pg_id}):
        return ok({"favorited": True}, "Already in your favorites")
    db.favorites.insert_one({"tenantId": uid, "pgId": pg_id, "createdAt": now_iso()})
    return ok({"favorited": True}, "Added to favorites")


@bp.route("/<pg_id>", methods=["DELETE"])
@require_auth
@require_role("tenant")
def remove_favorite(pg_id):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    db.favorites.delete_one({"tenantId": str(request.user["_id"]), "pgId": pg_id})
    return ok({"favorited": False}, "Removed from favorites")


@bp.route("/status/<pg_id>", methods=["GET"])
@require_auth
@require_role("tenant")
def favorite_status(pg_id):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    fav = db.favorites.find_one({"tenantId": str(request.user["_id"]), "pgId": pg_id})
    return ok({"favorited": fav is not None})
