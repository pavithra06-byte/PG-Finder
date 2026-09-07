from datetime import datetime, timezone
from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import error_response, ok, now_iso, valid_id, iso_to_dt
from app.sockets.events import broadcast_to_user

bp = Blueprint("visits", __name__)

STATUSES = ["pending", "accepted", "rescheduled", "rejected", "cancelled", "completed"]


@bp.route("", methods=["GET"])
@require_auth
def list_visits():
    db = get_db()
    user = request.user
    match = {}
    if user.get("role") == "tenant":
        match["tenantId"] = str(user["_id"])
    elif user.get("role") == "owner":
        pg_ids = [p["_id"] for p in db.pg_properties.find({"ownerId": str(user["_id"])})]
        match["pgId"] = {"$in": [value for pg_id in pg_ids for value in (pg_id, str(pg_id))]}
    status = request.args.get("status")
    if status and status in STATUSES:
        match["status"] = status
    items = list(db.visit_requests.find(match).sort("createdAt", -1).limit(200))
    out = []
    for v in items:
        d = dict(v)
        d["id"] = str(d.pop("_id"))
        pg = db.pg_properties.find_one({"_id": ObjectId(d["pgId"])}) if valid_id(d.get("pgId")) else None
        d["pg"] = {"id": d.get("pgId"), "name": (pg or {}).get("name", "PG"), "image": ((pg or {}).get("images") or [None])[0]}
        tenant = db.users.find_one({"_id": ObjectId(d["tenantId"])}) if valid_id(d.get("tenantId")) else None
        d["tenant"] = {"id": d.get("tenantId"), "name": (tenant or {}).get("name", "Tenant"),
                       "avatar": (tenant or {}).get("avatar"), "phone": (tenant or {}).get("phone")}
        out.append(d)
    return ok(out)


@bp.route("", methods=["POST"])
@require_auth
@require_role("tenant", "admin")
def create_visit():
    payload = request.get_json(silent=True) or {}
    pg_id = payload.get("pgId")
    visit_date = payload.get("date")
    visit_time = (payload.get("time") or "").strip()
    visitors = max(1, min(10, int(payload.get("visitors") or 1)))
    message = (payload.get("message") or "").strip()[:500]

    if not valid_id(pg_id):
        return error_response("PG is required.", 400)
    if not visit_date:
        return error_response("Visit date is required.", 400)
    dt = iso_to_dt(visit_date)
    if not dt:
        return error_response("Invalid visit date.", 400)
    if dt.date() < datetime.now(timezone.utc).date():
        return error_response("Visit date cannot be in the past.", 400)
    if not visit_time:
        return error_response("Visit time is required.", 400)

    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg or pg.get("status") != "approved":
        return error_response("PG not available.", 404)

    visit = {
        "tenantId": str(request.user["_id"]),
        "pgId": pg_id,
        "pgName": pg.get("name"),
        "date": visit_date,
        "time": visit_time,
        "visitors": visitors,
        "message": message,
        "status": "pending",
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    }
    res = db.visit_requests.insert_one(visit)
    owner = db.users.find_one({"_id": ObjectId(pg.get("ownerId"))})
    if owner:
        broadcast_to_user(str(owner["_id"]), "visit:new", {
            "visitId": str(res.inserted_id),
            "pgName": pg.get("name"),
            "tenantName": request.user.get("name"),
            "date": visit_date[:10],
            "time": visit_time,
            "title": "New visit request",
            "body": f"{request.user['name']} requested a site visit to {pg.get('name')} on {visit_date[:10]} at {visit_time}.",
            "link": "/owner/visits",
            "_notification": {"type": "visit:new", "title": "New visit request",
                              "body": f"{request.user['name']} wants to visit {pg.get('name')} on {visit_date[:10]} at {visit_time}.",
                              "link": "/owner/visits"},
        })
    broadcast_to_user(str(request.user["_id"]), "notification:new", {
        "title": "Visit request sent",
        "body": f"Your visit request to {pg.get('name')} on {visit_date[:10]} at {visit_time} was sent to the owner.",
        "link": "/tenant/visits",
        "_notification": {"type": "visit:new", "title": "Visit request sent",
                          "body": f"Your visit request to {pg.get('name')} was sent to the owner.",
                          "link": "/tenant/visits"},
    })
    return ok({"id": str(res.inserted_id), "status": "pending"}, "Visit request sent to the owner")


def _owner_find(db, visit_id):
    v = db.visit_requests.find_one({"_id": ObjectId(visit_id)})
    if not v:
        return None, error_response("Visit request not found.", 404)
    pg = db.pg_properties.find_one({"_id": ObjectId(v["pgId"])})
    if request.user.get("role") != "admin" and (not pg or str(request.user["_id"]) != pg.get("ownerId")):
        return None, error_response("Not your visit request.", 403)
    return v, None


@bp.route("/<visit_id>/accept", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def accept_visit(visit_id):
    return _visit_act(visit_id, "accepted", "Visit accepted", "visit:accepted",
                      "Visit request accepted", "Your visit request to {pg} was accepted. See you there!")


@bp.route("/<visit_id>/reject", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def reject_visit(visit_id):
    return _visit_act(visit_id, "rejected", "Visit rejected", "visit:rejected",
                      "Visit request rejected", "Your visit request to {pg} was rejected by the owner.")


@bp.route("/<visit_id>/reschedule", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def reschedule_visit(visit_id):
    if not valid_id(visit_id):
        return error_response("Invalid visit id.", 400)
    db = get_db()
    v, err = _owner_find(db, visit_id)
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    new_date = payload.get("date") or v.get("date")
    new_time = payload.get("time") or v.get("time")
    if not iso_to_dt(new_date):
        return error_response("Invalid new date.", 400)
    db.visit_requests.update_one(
        {"_id": ObjectId(visit_id)},
        {"$set": {"date": new_date, "time": new_time, "status": "rescheduled",
                  "rescheduleReason": (payload.get("reason") or "").strip()[:300],
                  "updatedAt": now_iso()}},
    )
    tenant = db.users.find_one({"_id": ObjectId(v["tenantId"])})
    if tenant:
        broadcast_to_user(str(tenant["_id"]), "visit:rescheduled", {
            "visitId": visit_id, "date": new_date[:10], "time": new_time,
            "title": "Visit rescheduled",
            "body": f"Your visit to {v.get('pgName')} was rescheduled to {new_date[:10]} at {new_time}.",
            "link": "/tenant/visits",
            "_notification": {"type": "visit:rescheduled", "title": "Visit rescheduled",
                              "body": f"Your visit to {v.get('pgName')} is now on {new_date[:10]} at {new_time}.",
                              "link": "/tenant/visits"},
        })
    return ok({"id": visit_id, "status": "rescheduled", "date": new_date, "time": new_time}, "Visit rescheduled")


def _visit_act(visit_id, new_status, ok_msg, event, title, body):
    if not valid_id(visit_id):
        return error_response("Invalid visit id.", 400)
    db = get_db()
    v, err = _owner_find(db, visit_id)
    if err:
        return err
    if v.get("status") != "pending":
        return error_response(f"This request is already {v.get('status')}.", 409)
    db.visit_requests.update_one(
        {"_id": ObjectId(visit_id)},
        {"$set": {"status": new_status, "updatedAt": now_iso()}},
    )
    tenant = db.users.find_one({"_id": ObjectId(v["tenantId"])})
    if tenant:
        broadcast_to_user(str(tenant["_id"]), event, {
            "visitId": visit_id,
            "title": title,
            "body": body.format(pg=v.get("pgName", "PG")),
            "link": "/tenant/visits",
            "_notification": {"type": "visit", "title": title,
                              "body": body.format(pg=v.get("pgName", "PG")),
                              "link": "/tenant/visits"},
        })
    return ok({"id": visit_id, "status": new_status}, ok_msg)


@bp.route("/<visit_id>/cancel", methods=["POST"])
@require_auth
def cancel_visit(visit_id):
    if not valid_id(visit_id):
        return error_response("Invalid visit id.", 400)
    db = get_db()
    v = db.visit_requests.find_one({"_id": ObjectId(visit_id)})
    if not v:
        return error_response("Visit request not found.", 404)
    user = request.user
    if user.get("role") == "tenant" and str(user["_id"]) != v.get("tenantId"):
        return error_response("Not your visit request.", 403)
    if v.get("status") not in ("pending", "accepted", "rescheduled"):
        return error_response("This request cannot be cancelled.", 409)
    db.visit_requests.update_one(
        {"_id": ObjectId(visit_id)},
        {"$set": {"status": "cancelled", "updatedAt": now_iso()}},
    )
    return ok({"id": visit_id, "status": "cancelled"}, "Visit request cancelled")
