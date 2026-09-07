from datetime import datetime, timezone
from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role, full_user
from app.utils.helpers import (
    error_response, ok, now_iso, valid_id, parse_int,
)
from app.sockets.events import broadcast_to_user

bp = Blueprint("admin", __name__)


def _admin_required(fn):
    from functools import wraps

    @wraps(fn)
    @require_auth
    @require_role("admin")
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)

    return wrapper


@bp.route("/dashboard", methods=["GET"])
@_admin_required
def dashboard():
    db = get_db()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    users = db.users.count_documents({})
    tenants = db.users.count_documents({"role": "tenant"})
    owners = db.users.count_documents({"role": "owner"})
    pending_owners = db.users.count_documents({
        "role": "owner",
        "ownerDetails.verificationStatus": {"$in": ["pending", None]},
    })
    suspended = db.users.count_documents({"status": "suspended"})

    pgs = db.pg_properties.count_documents({})
    pending_listings = db.pg_properties.count_documents({"status": "pending"})
    approved_listings = db.pg_properties.count_documents({"status": "approved"})
    rejected_listings = db.pg_properties.count_documents({"status": "rejected"})

    rooms = db.rooms.count_documents({})
    rooms_agg = list(db.rooms.aggregate([
        {"$group": {"_id": None,
                    "available": {"$sum": {"$cond": [{"$eq": ["$status", "available"]}, 1, 0]}},
                    "occupiedBeds": {"$sum": "$occupiedBeds"},
                    "totalBeds": {"$sum": "$capacity"}}},
    ]))
    room_stats = rooms_agg[0] if rooms_agg else {"available": 0, "occupiedBeds": 0, "totalBeds": 0}

    bookings = db.bookings.count_documents({})
    active_bookings = db.bookings.count_documents({"status": "active"})
    pending_bookings = db.bookings.count_documents({"status": "pending"})
    completed_bookings = db.bookings.count_documents({"status": "completed"})
    cancelled_bookings = db.bookings.count_documents({"status": "cancelled"})
    month_bookings = db.bookings.count_documents({"createdAt": {"$gte": month_start}})

    reviews = db.reviews.count_documents({})
    enquiries = db.enquiries.count_documents({})
    visits = db.visit_requests.count_documents({})
    pending_visits = db.visit_requests.count_documents({"status": "pending"})
    reports = db.reports.count_documents({})
    open_reports = db.reports.count_documents({"status": "open"})
    messages = db.messages.count_documents({})
    favorites = db.favorites.count_documents({})

    return ok({
        "users": users, "tenants": tenants, "owners": owners,
        "pendingOwners": pending_owners, "suspendedUsers": suspended,
        "pgListings": pgs, "pendingListings": pending_listings,
        "approvedListings": approved_listings, "rejectedListings": rejected_listings,
        "rooms": rooms, "availableRooms": room_stats["available"],
        "occupiedBeds": room_stats["occupiedBeds"], "totalBeds": room_stats["totalBeds"],
        "bookings": bookings, "activeBookings": active_bookings,
        "pendingBookings": pending_bookings, "completedBookings": completed_bookings,
        "cancelledBookings": cancelled_bookings, "monthBookings": month_bookings,
        "reviews": reviews, "enquiries": enquiries, "visits": visits,
        "pendingVisits": pending_visits, "reports": reports, "openReports": open_reports,
        "messages": messages, "favorites": favorites,
    })


@bp.route("/analytics", methods=["GET"])
@_admin_required
def analytics():
    db = get_db()

    def monthly(collection, field="createdAt", months=6):
        from collections import defaultdict
        counts = defaultdict(int)
        for doc in collection.find({}, {field: 1}):
            key = (doc.get(field) or "")[:7]
            if key:
                counts[key] += 1
        return [{"month": k, "count": counts.get(k, 0)} for k in sorted(counts)][-months:]

    city_counts = {}
    for p in db.pg_properties.find({"status": "approved"}, {"city": 1}):
        city = p.get("city") or "Other"
        city_counts[city] = city_counts.get(city, 0) + 1
    popular_cities = [{"city": k, "count": v} for k, v in sorted(city_counts.items(), key=lambda x: -x[1])][:10]

    rt = {}
    for b in db.bookings.find({}, {"roomType": 1}):
        t = b.get("roomType") or "Other"
        rt[t] = rt.get(t, 0) + 1
    room_types = [{"roomType": k, "count": v} for k, v in sorted(rt.items(), key=lambda x: -x[1])]

    am = {}
    for p in db.pg_properties.find({"status": "approved"}, {"amenities": 1}):
        for a in (p.get("amenities") or []):
            am[a] = am.get(a, 0) + 1
    amenities = [{"amenity": k, "count": v} for k, v in sorted(am.items(), key=lambda x: -x[1])][:10]

    return ok({
        "userRegistrations": monthly(db.users),
        "pgListings": monthly(db.pg_properties),
        "bookings": monthly(db.bookings),
        "popularLocations": popular_cities,
        "popularRoomTypes": room_types,
        "popularAmenities": amenities,
    })



@bp.route("/users", methods=["GET"])
@_admin_required
def list_users():
    db = get_db()
    role = request.args.get("role")
    q = request.args.get("q")
    status = request.args.get("status")
    match = {}
    if role in ("tenant", "owner", "admin"):
        match["role"] = role
    if status in ("active", "suspended"):
        match["status"] = status
    if q:
        match["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    page = max(1, parse_int(request.args.get("page"), 1))
    per = min(50, max(1, parse_int(request.args.get("per_page"), 20)))
    total = db.users.count_documents(match)
    items = list(db.users.find(match).sort("createdAt", -1).skip((page - 1) * per).limit(per))
    out = []
    for u in items:
        d = full_user(u)
        if u.get("role") == "owner":
            d["verificationStatus"] = (u.get("ownerDetails") or {}).get("verificationStatus", "pending")
            d["pgCount"] = db.pg_properties.count_documents({"ownerId": str(u["_id"])})
        out.append(d)
    return ok({"items": out, "total": total, "page": page, "per_page": per})


@bp.route("/users/<user_id>/status", methods=["POST"])
@_admin_required
def set_user_status(user_id):
    if not valid_id(user_id):
        return error_response("Invalid user id.", 400)
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return error_response("User not found.", 404)
    if user.get("role") == "admin":
        return error_response("Cannot suspend another admin.", 403)
    new_status = (request.get_json(silent=True) or {}).get("status")
    if new_status not in ("active", "suspended"):
        return error_response("Status must be active or suspended.", 400)
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": new_status}})
    if new_status == "suspended":
        broadcast_to_user(str(user["_id"]), "notification:new", {
            "title": "Account suspended",
            "body": "Your account has been suspended by the admin. Contact support.",
            "_notification": {"type": "system", "title": "Account suspended",
                              "body": "Your account has been suspended by the admin. Contact support.",
                              "link": ""},
        })
    return ok(message=f"User {new_status}")



@bp.route("/owners/<owner_id>/verify", methods=["POST"])
@_admin_required
def verify_owner(owner_id):
    if not valid_id(owner_id):
        return error_response("Invalid owner id.", 400)
    db = get_db()
    owner = db.users.find_one({"_id": ObjectId(owner_id), "role": "owner"})
    if not owner:
        return error_response("Owner not found.", 404)
    payload = request.get_json(silent=True) or {}
    decision = payload.get("decision")
    if decision not in ("approved", "rejected"):
        return error_response("Decision must be approved or rejected.", 400)
    reason = (payload.get("reason") or "").strip()
    details = dict(owner.get("ownerDetails") or {})
    details["verificationStatus"] = decision
    details["rejectionReason"] = reason if decision == "rejected" else None
    details["verifiedAt"] = now_iso() if decision == "approved" else details.get("verifiedAt")
    db.users.update_one(
        {"_id": ObjectId(owner_id)},
        {"$set": {"ownerDetails": details, "isVerified": decision == "approved"}},
    )
    broadcast_to_user(str(owner["_id"]), "notification:new", {
        "title": "Verification " + ("approved" if decision == "approved" else "rejected"),
        "body": "Congratulations! You can now publish PG listings." if decision == "approved"
                else f"Your verification was rejected. Reason: {reason or 'Not specified'}",
        "link": "/owner/dashboard",
        "_notification": {"type": "verification", "title": "Verification update",
                          "body": "Congratulations! You can now publish PG listings." if decision == "approved"
                                  else f"Your verification was rejected. Reason: {reason or 'Not specified'}",
                          "link": "/owner/dashboard"},
    })
    return ok(message=f"Owner {decision}")



@bp.route("/listings", methods=["GET"])
@_admin_required
def list_listings():
    db = get_db()
    status = request.args.get("status")
    q = request.args.get("q")
    match = {}
    if status and status in ("pending", "approved", "rejected", "suspended", "unpublished", "draft"):
        match["status"] = status
    if q:
        match["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]
    page = max(1, parse_int(request.args.get("page"), 1))
    per = min(50, max(1, parse_int(request.args.get("per_page"), 20)))
    total = db.pg_properties.count_documents(match)
    items = list(db.pg_properties.find(match).sort("createdAt", -1).skip((page - 1) * per).limit(per))
    out = []
    for p in items:
        d = dict(p)
        d["id"] = str(d.pop("_id"))
        owner = db.users.find_one({"_id": ObjectId(d["ownerId"])}) if valid_id(d.get("ownerId")) else None
        d["ownerName"] = (owner or {}).get("name", "Unknown")
        d.pop("ownerId", None)
        out.append(d)
    return ok({"items": out, "total": total, "page": page, "per_page": per})


@bp.route("/listings/<pg_id>/approve", methods=["POST"])
@_admin_required
def approve_listing(pg_id):
    return _listing_decision(pg_id, "approved", "Listing approved and published")


@bp.route("/listings/<pg_id>/reject", methods=["POST"])
@_admin_required
def reject_listing(pg_id):
    reason = (request.get_json(silent=True) or {}).get("reason", "").strip()
    return _listing_decision(pg_id, "rejected", "Listing rejected", reason)


@bp.route("/listings/<pg_id>/suspend", methods=["POST"])
@_admin_required
def suspend_listing(pg_id):
    return _listing_decision(pg_id, "suspended", "Listing suspended")


def _listing_decision(pg_id, new_status, ok_msg, reason=None):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg:
        return error_response("Listing not found.", 404)
    update = {"status": new_status, "updatedAt": now_iso()}
    if reason is not None:
        update["rejectionReason"] = reason
    db.pg_properties.update_one({"_id": ObjectId(pg_id)}, {"$set": update})
    owner = db.users.find_one({"_id": ObjectId(pg.get("ownerId"))}) if valid_id(pg.get("ownerId")) else None
    if owner:
        broadcast_to_user(str(owner["_id"]), "notification:new", {
            "title": "Listing " + new_status,
            "body": f"'{pg.get('name')}' was {new_status} by admin." +
                    (f" Reason: {reason}" if reason else ""),
            "link": "/owner/pgs",
            "_notification": {"type": "listing", "title": "Listing " + new_status,
                              "body": f"'{pg.get('name')}' was {new_status} by admin." +
                                      (f" Reason: {reason}" if reason else ""),
                              "link": "/owner/pgs"},
        })
    return ok({"id": pg_id, "status": new_status}, ok_msg)



@bp.route("/reviews", methods=["GET"])
@_admin_required
def list_reviews():
    db = get_db()
    items = list(db.reviews.find().sort("createdAt", -1).limit(200))
    out = []
    for r in items:
        d = dict(r)
        d["id"] = str(d.pop("_id"))
        tenant = db.users.find_one({"_id": ObjectId(d["tenantId"])}) if valid_id(d.get("tenantId")) else None
        d["tenantName"] = (tenant or {}).get("name", "User")
        d.pop("tenantId", None)
        out.append(d)
    return ok(out)


@bp.route("/bookings", methods=["GET"])
@_admin_required
def list_bookings():
    from app.routes.bookings import _enrich_booking

    db = get_db()
    status = request.args.get("status")
    match = {}
    if status:
        match["status"] = status
    items = list(db.bookings.find(match).sort("createdAt", -1).limit(200))
    return ok([_enrich_booking(db, b) for b in items])
