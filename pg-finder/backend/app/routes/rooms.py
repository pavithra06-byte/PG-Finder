from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import (
    error_response, ok, now_iso, valid_id, parse_int, parse_float,
)

bp = Blueprint("rooms", __name__)

ROOM_TYPES = ["Single", "Double Sharing", "Triple Sharing", "Four Sharing"]
STATUSES = ["available", "almost_full", "full", "maintenance"]


def _room_status(available_beds, capacity):
    if available_beds <= 0:
        return "full"
    if capacity >= 3 and available_beds <= capacity // 3:
        return "almost_full"
    return "available"


def _recompute_status(room):
    avail = room.get("availableBeds", 0)
    cap = room.get("capacity", 1)
    if room.get("status") == "maintenance":
        return
    status = _room_status(avail, cap)
    if status != room.get("status"):
        get_db().rooms.update_one({"_id": room["_id"]}, {"$set": {"status": status}})


def sync_room_availability(pg_id):
    """After booking changes, recompute room statuses + PG availability."""
    db = get_db()
    rooms = list(db.rooms.find({"pgId": pg_id}))
    for r in rooms:
        _recompute_status(r)
    total = len(rooms)
    avail = sum(1 for r in rooms if r.get("status") in ("available", "almost_full"))
    db.pg_properties.update_one(
        {"_id": ObjectId(pg_id)},
        {"$set": {"availableRooms": avail, "totalRooms": total, "updatedAt": now_iso()}},
    )


@bp.route("", methods=["GET"])
def list_rooms():
    pg_id = request.args.get("pgId")
    if not valid_id(pg_id):
        return error_response("pgId is required.", 400)
    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg:
        return error_response("PG not found.", 404)
    if pg.get("status") != "approved":
        user = getattr(request, "user", None)
        if not user or str(user["_id"]) != pg.get("ownerId"):
            return error_response("This listing is not published.", 404)
    rooms = list(db.rooms.find({"pgId": pg_id}).sort("rent", 1))
    items = []
    for r in rooms:
        d = dict(r)
        d["id"] = str(d.pop("_id"))
        items.append(d)
    return ok(items)


@bp.route("", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def create_room():
    payload = request.get_json(silent=True) or {}
    pg_id = payload.get("pgId") or request.args.get("pgId")
    if not valid_id(pg_id):
        return error_response("pgId is required.", 400)
    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg:
        return error_response("PG not found.", 404)
    if request.user.get("role") != "admin" and str(request.user["_id"]) != pg.get("ownerId"):
        return error_response("You can only add rooms to your own PG.", 403)

    number = (payload.get("number") or "").strip()
    room_type = payload.get("type")
    capacity = parse_int(payload.get("capacity"), 1)
    rent = parse_float(payload.get("rent"))
    deposit = parse_float(payload.get("deposit")) or 0
    if not number:
        return error_response("Room number is required.", 400)
    if room_type not in ROOM_TYPES:
        return error_response("Invalid room type.", 400)
    if capacity < 1 or capacity > 8:
        return error_response("Capacity must be between 1 and 8.", 400)
    if not rent or rent <= 0:
        return error_response("Rent is required.", 400)
    occupied = parse_int(payload.get("occupiedBeds"), 0)
    if occupied < 0 or occupied > capacity:
        return error_response("Occupied beds must be between 0 and capacity.", 400)

    room = {
        "pgId": pg_id,
        "number": number,
        "type": room_type,
        "capacity": capacity,
        "occupiedBeds": occupied,
        "availableBeds": capacity - occupied,
        "rent": rent,
        "deposit": deposit,
        "facilities": [f for f in (payload.get("facilities") or []) if isinstance(f, str)][:12],
        "status": _room_status(capacity - occupied, capacity) if (payload.get("status") or "auto") == "auto" else payload.get("status"),
        "createdAt": now_iso(),
    }
    if room["status"] not in STATUSES:
        room["status"] = "available"
    res = db.rooms.insert_one(room)
    room.pop("_id", None)
    room["id"] = str(res.inserted_id)
    sync_room_availability(pg_id)
    return ok(room, "Room added")


@bp.route("/<room_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin")
def update_room(room_id):
    if not valid_id(room_id):
        return error_response("Invalid room id.", 400)
    db = get_db()
    room = db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        return error_response("Room not found.", 404)
    pg = db.pg_properties.find_one({"_id": ObjectId(room["pgId"])})
    if request.user.get("role") != "admin" and (not pg or str(request.user["_id"]) != pg.get("ownerId")):
        return error_response("You can only edit rooms of your own PG.", 403)
    payload = request.get_json(silent=True) or {}

    update = {}
    if "number" in payload and str(payload["number"]).strip():
        update["number"] = str(payload["number"]).strip()
    if "type" in payload and payload["type"] in ROOM_TYPES:
        update["type"] = payload["type"]
    if "capacity" in payload:
        cap = parse_int(payload["capacity"])
        if cap and 1 <= cap <= 8:
            update["capacity"] = cap
    if "rent" in payload:
        r = parse_float(payload["rent"])
        if r and r > 0:
            update["rent"] = r
    if "deposit" in payload:
        update["deposit"] = parse_float(payload["deposit"]) or 0
    if "facilities" in payload:
        update["facilities"] = [f for f in payload["facilities"] if isinstance(f, str)][:12]
    if "occupiedBeds" in payload:
        occ = parse_int(payload["occupiedBeds"], room.get("occupiedBeds", 0))
        cap = update.get("capacity", room.get("capacity", 1))
        if 0 <= occ <= cap:
            update["occupiedBeds"] = occ
    if "status" in payload and payload["status"] in STATUSES:
        update["status"] = payload["status"]

    if "capacity" in update or "occupiedBeds" in update:
        cap = update.get("capacity", room.get("capacity", 1))
        occ = update.get("occupiedBeds", room.get("occupiedBeds", 0))
        update["availableBeds"] = cap - occ
        if "status" not in update:
            update["status"] = _room_status(cap - occ, cap)

    if not update:
        return error_response("Nothing to update.", 400)
    update["updatedAt"] = now_iso()
    db.rooms.update_one({"_id": ObjectId(room_id)}, {"$set": update})
    sync_room_availability(room["pgId"])
    return ok(message="Room updated")


@bp.route("/<room_id>", methods=["DELETE"])
@require_auth
@require_role("owner", "admin")
def delete_room(room_id):
    if not valid_id(room_id):
        return error_response("Invalid room id.", 400)
    db = get_db()
    room = db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        return error_response("Room not found.", 404)
    pg = db.pg_properties.find_one({"_id": ObjectId(room["pgId"])})
    if request.user.get("role") != "admin" and (not pg or str(request.user["_id"]) != pg.get("ownerId")):
        return error_response("You can only delete rooms of your own PG.", 403)
    active = db.bookings.count_documents({"roomId": room_id, "status": {"$in": ["pending", "confirmed", "active"]}})
    if active:
        return error_response("Cannot delete a room with active bookings.", 409)
    db.rooms.delete_one({"_id": ObjectId(room_id)})
    sync_room_availability(room["pgId"])
    return ok(message="Room deleted")
