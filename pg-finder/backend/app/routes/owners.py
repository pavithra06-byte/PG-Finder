from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role, full_user
from app.utils.helpers import (
    error_response, ok, now_iso, valid_id, save_image,
    parse_int, parse_float, parse_bool,
)

bp = Blueprint("owners", __name__)

AMENITIES_MASTER = [
    "Wi-Fi", "Food", "AC", "Parking", "Laundry", "CCTV", "Security",
    "Power Backup", "Housekeeping", "Gym", "Hot Water", "Kitchen", "Study Area", "Furnished",
]
ROOM_TYPES = ["Single", "Double Sharing", "Triple Sharing", "Four Sharing"]
FACILITY_CATEGORIES = [
    "college", "university", "hospital", "bus_stop", "railway_station",
    "restaurant", "supermarket", "atm", "pharmacy", "gym",
]


@bp.route("/verification-status", methods=["GET"])
@require_auth
@require_role("owner", "admin")
def verification_status():
    return ok(request.user.get("ownerDetails", {"verificationStatus": "pending"}))


@bp.route("/dashboard", methods=["GET"])
@require_auth
@require_role("owner")
def dashboard():
    db = get_db()
    uid = str(request.user["_id"])
    pgs = list(db.pg_properties.find({"ownerId": uid}))
    pg_ids = [p["_id"] for p in pgs]
    room_agg = list(db.rooms.aggregate([
        {"$match": {"pgId": {"$in": pg_ids}}},
        {"$group": {"_id": None, "total": {"$sum": 1},
                    "available": {"$sum": {"$cond": [{"$eq": ["$status", "available"]}, 1, 0]}},
                    "occupied": {"$sum": {"$sum": "$occupiedBeds"}}}},
    ]))
    bookings = list(db.bookings.find({"pgId": {"$in": pg_ids}})) if pg_ids else []
    pending_bookings = sum(1 for b in bookings if b.get("status") == "pending")
    active_bookings = sum(1 for b in bookings if b.get("status") == "active")
    total_bookings = len(bookings)
    enquiries = db.enquiries.count_documents({"pgId": {"$in": pg_ids}}) if pg_ids else 0
    visits = db.visit_requests.count_documents({"pgId": {"$in": pg_ids}}) if pg_ids else 0
    pending_visits = db.visit_requests.count_documents({"pgId": {"$in": pg_ids}, "status": "pending"}) if pg_ids else 0
    unread_messages = 0
    for conv in db.conversations.find({"participants": ObjectId(uid)}):
        unread_messages += (conv.get("unread") or {}).get(uid, 0)
    reviews = list(db.reviews.find({"pgId": {"$in": pg_ids}})) if pg_ids else []
    avg_rating = round(sum(r.get("rating", 0) for r in reviews) / len(reviews), 1) if reviews else 0
    return ok({
        "totalPGs": len(pgs),
        "publishedPGs": sum(1 for p in pgs if p.get("status") == "approved"),
        "pendingListings": sum(1 for p in pgs if p.get("status") == "pending"),
        "totalRooms": (room_agg[0]["total"] if room_agg else 0),
        "availableRooms": (room_agg[0]["available"] if room_agg else 0),
        "occupiedBeds": (room_agg[0]["occupied"] if room_agg else 0),
        "pendingBookings": pending_bookings,
        "totalBookings": total_bookings,
        "activeBookings": active_bookings,
        "newEnquiries": enquiries,
        "pendingVisits": pending_visits,
        "totalVisits": visits,
        "reviews": len(reviews),
        "avgRating": avg_rating,
        "unreadMessages": unread_messages,
        "verificationStatus": (request.user.get("ownerDetails") or {}).get("verificationStatus", "pending"),
    })


@bp.route("/analytics", methods=["GET"])
@require_auth
@require_role("owner")
def analytics():
    db = get_db()
    uid = str(request.user["_id"])
    pgs = list(db.pg_properties.find({"ownerId": uid}))
    pg_ids = [p["_id"] for p in pgs]
    pg_keys = [value for pg_id in pg_ids for value in (pg_id, str(pg_id))]

    bookings = list(db.bookings.find({"pgId": {"$in": pg_keys}})) if pg_keys else []
    reviews = list(db.reviews.find({"pgId": {"$in": pg_keys}})) if pg_keys else []
    enquiries = list(db.enquiries.find({"pgId": {"$in": pg_keys}})) if pg_keys else []

    monthly_bookings = {}
    for b in bookings:
        key = (b.get("createdAt") or "")[:7]
        monthly_bookings[key] = monthly_bookings.get(key, 0) + 1

    rating_breakdown = {str(i): 0 for i in range(1, 6)}
    for r in reviews:
        rating_breakdown[str(int(r.get("rating", 0)))] += 1

    room_type_demand = {}
    for b in bookings:
        rt = b.get("roomType", "Other")
        room_type_demand[rt] = room_type_demand.get(rt, 0) + 1

    return ok({
        "bookingsByMonth": [{"month": k, "count": v} for k, v in sorted(monthly_bookings.items())],
        "ratingBreakdown": [{"rating": int(k), "count": v} for k, v in sorted(rating_breakdown.items())],
        "roomTypeDemand": [{"roomType": k, "count": v} for k, v in sorted(room_type_demand.items(), key=lambda x: -x[1])],
        "enquiryCount": len(enquiries),
        "enquiryTopics": _topic_counts(enquiries),
        "bookingStatusCounts": _status_counts(bookings, ["pending", "confirmed", "active", "completed", "cancelled", "rejected"]),
    })


def _topic_counts(enquiries):
    counts = {}
    for e in enquiries:
        t = e.get("topic", "General")
        counts[t] = counts.get(t, 0) + 1
    return [{"topic": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])]


def _status_counts(bookings, statuses):
    counts = {s: 0 for s in statuses}
    for b in bookings:
        s = b.get("status")
        if s in counts:
            counts[s] += 1
    return [{"status": k, "count": v} for k, v in counts.items()]
