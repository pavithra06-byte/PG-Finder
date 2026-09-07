from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import error_response, ok, now_iso, valid_id, parse_int
from app.sockets.events import broadcast_to_user

bp = Blueprint("reviews", __name__)

DIMENSIONS = ["cleanliness", "location", "food", "facilities", "security", "valueForMoney"]


@bp.route("", methods=["GET"])
def list_reviews():
    pg_id = request.args.get("pgId")
    db = get_db()
    match = {}
    if pg_id:
        if not valid_id(pg_id):
            return error_response("Invalid PG id.", 400)
        match["pgId"] = pg_id
    items = list(db.reviews.find(match).sort("createdAt", -1).limit(200))
    out = []
    for r in items:
        d = dict(r)
        d["id"] = str(d.pop("_id"))
        tenant = db.users.find_one({"_id": ObjectId(d["tenantId"])}) if valid_id(d.get("tenantId")) else None
        d["tenant"] = {"id": d.get("tenantId"), "name": (tenant or {}).get("name", "Tenant"),
                       "avatar": (tenant or {}).get("avatar")}
        d.pop("tenantId", None)
        out.append(d)
    return ok(out)


@bp.route("/eligible/<pg_id>", methods=["GET"])
@require_auth
@require_role("tenant")
def eligible(pg_id):
    """Check whether the current tenant may review this PG (has completed booking)."""
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    completed = db.bookings.count_documents({
        "tenantId": str(request.user["_id"]), "pgId": pg_id, "status": "completed"})
    already = db.reviews.find_one({"tenantId": str(request.user["_id"]), "pgId": pg_id})
    return ok({
        "eligible": completed > 0,
        "hasReviewed": already is not None,
        "review": None if not already else {**{k: v for k, v in already.items() if k != "_id"}, "id": str(already["_id"])},
    })


@bp.route("", methods=["POST"])
@require_auth
@require_role("tenant")
def create_review():
    payload = request.get_json(silent=True) or {}
    pg_id = payload.get("pgId")
    rating = parse_int(payload.get("rating"))
    if not valid_id(pg_id):
        return error_response("PG is required.", 400)
    if not rating or rating < 1 or rating > 5:
        return error_response("Overall rating must be between 1 and 5.", 400)

    db = get_db()
    uid = str(request.user["_id"])
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg or pg.get("status") != "approved":
        return error_response("PG not found.", 404)
    completed = db.bookings.count_documents({"tenantId": uid, "pgId": pg_id, "status": "completed"})
    if completed == 0:
        return error_response("Only tenants with a completed stay can review this PG.", 403)
    if db.reviews.find_one({"tenantId": uid, "pgId": pg_id}):
        return error_response("You have already reviewed this PG.", 409)

    dims = {}
    for k in DIMENSIONS:
        v = parse_int(payload.get(k))
        if v and 1 <= v <= 5:
            dims[k] = v
    review = {
        "tenantId": uid,
        "pgId": pg_id,
        "pgName": pg.get("name"),
        "rating": rating,
        "dimensions": dims,
        "comment": (payload.get("comment") or "").strip()[:1500],
        "createdAt": now_iso(),
    }
    res = db.reviews.insert_one(review)

    agg = db.reviews.aggregate([
        {"$match": {"pgId": pg_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ])
    row = next(agg, None)
    if row:
        db.pg_properties.update_one(
            {"_id": ObjectId(pg_id)},
            {"$set": {"rating": {"average": round(row["avg"], 1), "count": row["n"]}}},
        )
    owner = db.users.find_one({"_id": ObjectId(pg.get("ownerId"))})
    if owner:
        broadcast_to_user(str(owner["_id"]), "notification:new", {
            "title": "New review received",
            "body": f"{request.user['name']} rated {pg.get('name')} {rating}/5.",
            "link": "/owner/reviews",
            "_notification": {"type": "review", "title": "New review received",
                              "body": f"{request.user['name']} rated {pg.get('name')} {rating}/5.",
                              "link": "/owner/reviews"},
        })
    return ok({"id": str(res.inserted_id)}, "Thank you! Your review has been posted.")


@bp.route("/<review_id>", methods=["DELETE"])
@require_auth
@require_role("admin", "owner", "tenant")
def delete_review(review_id):
    if not valid_id(review_id):
        return error_response("Invalid review id.", 400)
    db = get_db()
    r = db.reviews.find_one({"_id": ObjectId(review_id)})
    if not r:
        return error_response("Review not found.", 404)
    user = request.user
    if user.get("role") == "tenant" and str(user["_id"]) != r.get("tenantId"):
        return error_response("Not your review.", 403)
    if user.get("role") == "owner":
        pg = db.pg_properties.find_one({"_id": ObjectId(r["pgId"])})
        if not pg or str(user["_id"]) != pg.get("ownerId"):
            return error_response("Not your PG's review.", 403)
    db.reviews.delete_one({"_id": ObjectId(review_id)})
    agg = db.reviews.aggregate([
        {"$match": {"pgId": r["pgId"]}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ])
    row = next(agg, None)
    db.pg_properties.update_one(
        {"_id": ObjectId(r["pgId"])},
        {"$set": {"rating": {"average": round(row["avg"], 1) if row else 0,
                             "count": row["n"] if row else 0}}},
    )
    return ok(message="Review deleted")
