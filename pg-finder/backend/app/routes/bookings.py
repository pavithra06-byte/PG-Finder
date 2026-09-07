from datetime import datetime, timezone
from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import (
    error_response, ok, now_iso, valid_id, parse_int, iso_to_dt,
)
from app.sockets.events import broadcast_to_user
from app.routes.rooms import sync_room_availability, _room_status

bp = Blueprint("bookings", __name__)

LIFECYCLE = ["pending", "confirmed", "active", "completed", "cancelled", "rejected"]
ACTIVE_STATUSES = ["pending", "confirmed", "active"]


@bp.route("", methods=["GET"])
@require_auth
def list_bookings():
    db = get_db()
    user = request.user
    role = user.get("role")
    status = request.args.get("status")
    match = {}
    if role == "tenant":
        match["tenantId"] = str(user["_id"])
    elif role == "owner":
        pg_ids = [p["_id"] for p in db.pg_properties.find({"ownerId": str(user["_id"])})]
        match["pgId"] = {"$in": [value for pg_id in pg_ids for value in (pg_id, str(pg_id))]}
    elif role == "admin":
        pass
    if status and status in LIFECYCLE:
        match["status"] = status
    items = list(db.bookings.find(match).sort("createdAt", -1).limit(200))
    out = [_enrich_booking(db, b) for b in items]
    return ok(out)


def _enrich_booking(db, b):
    d = dict(b)
    d["id"] = str(d.pop("_id"))
    pg = db.pg_properties.find_one({"_id": ObjectId(d["pgId"])}) if valid_id(d.get("pgId")) else None
    d["pg"] = {"id": d.get("pgId"), "name": (pg or {}).get("name", "PG"), "image": ((pg or {}).get("images") or [None])[0]}
    tenant = db.users.find_one({"_id": ObjectId(d["tenantId"])}) if valid_id(d.get("tenantId")) else None
    d["tenant"] = {"id": d.get("tenantId"), "name": (tenant or {}).get("name", "Tenant"),
                   "avatar": (tenant or {}).get("avatar"), "phone": (tenant or {}).get("phone")}
    owner = None
    if pg:
        owner_id = pg.get("ownerId")
        o = db.users.find_one({"_id": ObjectId(owner_id)}) if valid_id(owner_id) else None
        owner = {"id": str(o["_id"]) if o else None, "name": (o or {}).get("name", "Owner"),
                 "avatar": (o or {}).get("avatar")}
    d["owner"] = owner
    room = db.rooms.find_one({"_id": ObjectId(d["roomId"])}) if valid_id(d.get("roomId")) else None
    d["room"] = {"id": d.get("roomId"), "number": (room or {}).get("number", "-"),
                 "type": (room or {}).get("type", "-"), "rent": (room or {}).get("rent")}
    return d


@bp.route("", methods=["POST"])
@require_auth
@require_role("tenant", "admin")
def create_booking():
    payload = request.get_json(silent=True) or {}
    pg_id = payload.get("pgId")
    room_id = payload.get("roomId")
    move_in = payload.get("moveInDate")
    duration = parse_int(payload.get("duration"), 1)
    occupants = parse_int(payload.get("occupants"), 1)
    message = (payload.get("message") or "").strip()[:500]

    if not valid_id(pg_id) or not valid_id(room_id):
        return error_response("PG and room are required.", 400)
    move_dt = iso_to_dt(move_in)
    if not move_dt:
        return error_response("A valid move-in date is required.", 400)
    if move_dt.date() < datetime.now(timezone.utc).date():
        return error_response("Move-in date cannot be in the past.", 400)
    if duration < 1 or duration > 24:
        return error_response("Duration must be between 1 and 24 months.", 400)
    if occupants < 1 or occupants > 4:
        return error_response("Occupants must be between 1 and 4.", 400)

    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg or pg.get("status") != "approved":
        return error_response("This PG is not available for booking.", 404)
    room = db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room or room.get("pgId") != pg_id:
        return error_response("Room not found for this PG.", 404)
    if room.get("status") == "maintenance":
        return error_response("This room is under maintenance.", 409)
    if room.get("availableBeds", 0) < occupants:
        return error_response("Not enough beds available in this room.", 409)

    move_out = _add_months(move_in, duration)
    overlap = db.bookings.find_one({
        "roomId": room_id,
        "status": {"$in": ["pending", "confirmed", "active"]},
        "moveInDate": {"$lt": move_out},
        "moveOutDate": {"$gt": move_in},
    })
    if overlap:
        return error_response(
            "This room already has an active booking for that period. Try another room or date.", 409)

    owner_id = pg.get("ownerId")
    owner = db.users.find_one({"_id": ObjectId(owner_id), "role": "owner"}) if valid_id(owner_id) else None
    if not owner:
        return error_response("This PG owner account is unavailable.", 409)

    booking = {
        "tenantId": str(request.user["_id"]),
        "pgId": pg_id,
        "pgName": pg.get("name"),
        "roomId": room_id,
        "roomType": room.get("type"),
        "roomNumber": room.get("number"),
        "moveInDate": move_in,
        "moveOutDate": move_out,
        "durationMonths": duration,
        "occupants": occupants,
        "rent": room.get("rent"),
        "deposit": room.get("deposit", 0),
        "message": message,
        "status": "pending",
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "history": [{"status": "pending", "at": now_iso(), "by": "tenant"}],
    }
    res = db.bookings.insert_one(booking)
    booking["_id"] = res.inserted_id

    new_avail = room.get("availableBeds", 0) - occupants
    db.rooms.update_one(
        {"_id": ObjectId(room_id)},
        {"$set": {"availableBeds": max(0, new_avail), "status": _room_status(max(0, new_avail), room.get("capacity", 1))},
         "$inc": {"occupiedBeds": occupants}},
    )
    sync_room_availability(pg_id)

    broadcast_to_user(str(owner["_id"]), "booking:new", {
            "bookingId": str(res.inserted_id),
            "pgName": pg.get("name"),
            "roomType": room.get("type"),
            "tenantName": request.user.get("name"),
            "moveInDate": move_in,
            "title": "New booking request",
            "body": f"{request.user['name']} requested to book {room.get('type')} at {pg.get('name')} from {move_in[:10]}.",
            "link": "/owner/bookings",
            "_notification": {"type": "booking:new", "title": "New booking request",
                              "body": f"{request.user['name']} requested to book {room.get('type')} at {pg.get('name')}.",
                              "link": "/owner/bookings"},
    })
    broadcast_to_user(str(request.user["_id"]), "notification:new", {
        "title": "Booking request sent",
        "body": f"Your booking request for {room.get('type')} at {pg.get('name')} was sent to the owner.",
        "link": "/tenant/bookings",
        "_notification": {"type": "booking:new", "title": "Booking request sent",
                          "body": f"Your booking request for {room.get('type')} at {pg.get('name')} was sent to the owner.",
                          "link": "/tenant/bookings"},
    })
    return ok({"id": str(res.inserted_id), "status": "pending"},
              "Booking request sent to the owner")


def _add_months(iso_str, months):
    dt = iso_to_dt(iso_str)
    if not dt:
        return iso_str
    y, m = dt.year, dt.month + months
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    try:
        return dt.replace(year=y, month=m).isoformat()
    except ValueError:
        return dt.replace(year=y, month=m, day=28).isoformat()


@bp.route("/<booking_id>", methods=["GET"])
@require_auth
def booking_detail(booking_id):
    if not valid_id(booking_id):
        return error_response("Invalid booking id.", 400)
    db = get_db()
    b = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not b:
        return error_response("Booking not found.", 404)
    user = request.user
    if user.get("role") == "tenant" and str(user["_id"]) != b.get("tenantId"):
        return error_response("Not your booking.", 403)
    if user.get("role") == "owner":
        pg = db.pg_properties.find_one({"_id": ObjectId(b["pgId"])})
        if not pg or str(user["_id"]) != pg.get("ownerId"):
            return error_response("Not your booking.", 403)
    return ok(_enrich_booking(db, b))


@bp.route("/<booking_id>/accept", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def accept_booking(booking_id):
    return _owner_act(booking_id, "confirmed", "Booking accepted",
                      "booking:accepted", "Booking confirmed",
                      "Your booking at {pg} has been accepted by the owner.")


@bp.route("/<booking_id>/reject", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def reject_booking(booking_id):
    return _owner_act(booking_id, "rejected", "Booking rejected",
                      "booking:rejected", "Booking rejected",
                      "Your booking at {pg} was rejected by the owner.")


def _owner_act(booking_id, new_status, ok_msg, event, notif_title, notif_body):
    if not valid_id(booking_id):
        return error_response("Invalid booking id.", 400)
    db = get_db()
    b = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not b:
        return error_response("Booking not found.", 404)
    pg = db.pg_properties.find_one({"_id": ObjectId(b["pgId"])})
    if request.user.get("role") != "admin" and (not pg or str(request.user["_id"]) != pg.get("ownerId")):
        return error_response("Not your booking.", 403)
    if b.get("status") != "pending":
        return error_response(f"This booking is already {b.get('status')}.", 409)

    db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": new_status, "updatedAt": now_iso()},
         "$push": {"history": {"status": new_status, "at": now_iso(), "by": request.user.get("role")}}},
    )
    _release_room_beds(db, b)
    tenant = db.users.find_one({"_id": ObjectId(b["tenantId"])})
    if tenant:
        broadcast_to_user(str(tenant["_id"]), event, {
            "bookingId": booking_id,
            "pgName": b.get("pgName"),
            "title": notif_title,
            "body": notif_body.format(pg=b.get("pgName", "PG")),
            "link": "/tenant/bookings",
            "_notification": {"type": "booking", "title": notif_title,
                              "body": notif_body.format(pg=b.get("pgName", "PG")),
                              "link": "/tenant/bookings"},
        })
    owner_id = pg.get("ownerId") if pg else None
    owner = db.users.find_one({"_id": ObjectId(owner_id), "role": "owner"}) if valid_id(owner_id) else None
    if owner:
        broadcast_to_user(str(owner["_id"]), "notification:new", {
            "title": notif_title,
            "body": f"You updated the booking for {b.get('pgName', 'your PG')}.",
            "link": "/owner/bookings",
            "_notification": {"type": "booking", "title": notif_title,
                              "body": f"You updated the booking for {b.get('pgName', 'your PG')}.",
                              "link": "/owner/bookings"},
        })
    return ok({"id": booking_id, "status": new_status}, ok_msg)


def _release_room_beds(db, b):
    """Free beds when a booking leaves pending/confirmed/active (reject/cancel/complete)."""
    if b.get("status") not in ACTIVE_STATUSES:
        return
    room = db.rooms.find_one({"_id": ObjectId(b["roomId"])}) if valid_id(b.get("roomId")) else None
    if not room:
        return
    occ = b.get("occupants", 1)
    avail = min(room.get("availableBeds", 0) + occ, room.get("capacity", 1))
    db.rooms.update_one(
        {"_id": room["_id"]},
        {"$set": {"availableBeds": avail, "status": _room_status(avail, room.get("capacity", 1))},
         "$inc": {"occupiedBeds": -occ}},
    )
    sync_room_availability(room["pgId"])


@bp.route("/<booking_id>/complete", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def complete_booking(booking_id):
    if not valid_id(booking_id):
        return error_response("Invalid booking id.", 400)
    db = get_db()
    b = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not b:
        return error_response("Booking not found.", 404)
    pg = db.pg_properties.find_one({"_id": ObjectId(b["pgId"])})
    if request.user.get("role") != "admin" and (not pg or str(request.user["_id"]) != pg.get("ownerId")):
        return error_response("Not your booking.", 403)
    if b.get("status") != "active" and b.get("status") != "confirmed":
        return error_response("Only confirmed/active bookings can be completed.", 409)
    db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": "completed", "updatedAt": now_iso()},
         "$push": {"history": {"status": "completed", "at": now_iso(), "by": request.user.get("role")}}},
    )
    _release_room_beds(db, b)
    tenant = db.users.find_one({"_id": ObjectId(b["tenantId"])})
    if tenant:
        broadcast_to_user(str(tenant["_id"]), "booking:completed", {
            "bookingId": booking_id, "status": "completed",
            "title": "Booking completed",
            "body": f"Your stay at {b.get('pgName')} has been completed. Please leave a review!",
            "link": "/tenant/bookings",
            "_notification": {"type": "booking", "title": "Booking completed",
                              "body": f"Your stay at {b.get('pgName')} is complete. Rate your experience!",
                              "link": "/tenant/bookings"},
        })
    owner_id = pg.get("ownerId") if pg else None
    owner = db.users.find_one({"_id": ObjectId(owner_id), "role": "owner"}) if valid_id(owner_id) else None
    if owner:
        broadcast_to_user(str(owner["_id"]), "notification:new", {
            "title": "Booking completed",
            "body": f"The booking at {b.get('pgName', 'your PG')} was marked completed.",
            "link": "/owner/bookings",
            "_notification": {"type": "booking", "title": "Booking completed",
                              "body": f"The booking at {b.get('pgName', 'your PG')} was marked completed.",
                              "link": "/owner/bookings"},
        })
    return ok({"id": booking_id, "status": "completed"}, "Booking completed")


@bp.route("/<booking_id>/cancel", methods=["POST"])
@require_auth
def cancel_booking(booking_id):
    """Tenant cancels an eligible (pending/confirmed) booking."""
    if not valid_id(booking_id):
        return error_response("Invalid booking id.", 400)
    db = get_db()
    b = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not b:
        return error_response("Booking not found.", 404)
    user = request.user
    if user.get("role") == "tenant" and str(user["_id"]) != b.get("tenantId"):
        return error_response("Not your booking.", 403)
    if b.get("status") not in ("pending", "confirmed"):
        return error_response("Only pending or confirmed bookings can be cancelled.", 409)
    db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": "cancelled", "updatedAt": now_iso(), "cancelledAt": now_iso()},
         "$push": {"history": {"status": "cancelled", "at": now_iso(), "by": user.get("role")}}},
    )
    _release_room_beds(db, b)
    pg = db.pg_properties.find_one({"_id": ObjectId(b["pgId"])})
    if pg:
        owner = db.users.find_one({"_id": ObjectId(pg.get("ownerId"))})
        if owner:
            broadcast_to_user(str(owner["_id"]), "booking:cancelled", {
                "bookingId": booking_id,
                "pgName": b.get("pgName"),
                "title": "Booking cancelled",
                "body": f"{user.get('name')} cancelled the booking at {b.get('pgName')}.",
                "link": "/owner/bookings",
                "_notification": {"type": "booking", "title": "Booking cancelled",
                                  "body": f"{user.get('name')} cancelled a booking at {b.get('pgName')}.",
                                  "link": "/owner/bookings"},
            })
    return ok({"id": booking_id, "status": "cancelled"}, "Booking cancelled")
