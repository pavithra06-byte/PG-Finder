from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import error_response, ok, now_iso, valid_id
from app.sockets.events import broadcast_to_user

bp = Blueprint("reports", __name__)

REASONS = ["Fake listing", "Wrong information", "Harassment", "Fraud", "Safety concern", "Spam", "Other"]


@bp.route("", methods=["GET"])
@require_auth
def list_reports():
    db = get_db()
    user = request.user
    match = {}
    if user.get("role") != "admin":
        match["reporterId"] = str(user["_id"])
    items = list(db.reports.find(match).sort("createdAt", -1).limit(200))
    out = []
    for r in items:
        d = dict(r)
        d["id"] = str(d.pop("_id"))
        reporter = db.users.find_one({"_id": ObjectId(d["reporterId"])}) if valid_id(d.get("reporterId")) else None
        d["reporter"] = {"id": d.get("reporterId"), "name": (reporter or {}).get("name", "User")}
        if d.get("pgId") and valid_id(d["pgId"]):
            pg = db.pg_properties.find_one({"_id": ObjectId(d["pgId"])})
            d["pg"] = {"id": d.get("pgId"), "name": (pg or {}).get("name", "PG")}
        out.append(d)
    return ok(out)


@bp.route("", methods=["POST"])
@require_auth
def create_report():
    payload = request.get_json(silent=True) or {}
    pg_id = payload.get("pgId")
    reason = payload.get("reason") or "Other"
    details = (payload.get("details") or "").strip()
    if not valid_id(pg_id):
        return error_response("PG is required.", 400)
    if reason not in REASONS:
        reason = "Other"
    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg:
        return error_response("PG not found.", 404)
    report = {
        "reporterId": str(request.user["_id"]),
        "pgId": pg_id,
        "pgName": pg.get("name"),
        "reason": reason,
        "details": details[:1000],
        "status": "open",
        "createdAt": now_iso(),
    }
    res = db.reports.insert_one(report)
    for admin in db.users.find({"role": "admin"}):
        broadcast_to_user(str(admin["_id"]), "notification:new", {
            "title": "New report",
            "body": f"{request.user['name']} reported '{pg.get('name')}' for {reason}.",
            "link": "/admin/reports",
            "_notification": {"type": "report", "title": "New report",
                              "body": f"'{pg.get('name')}' was reported for {reason}.",
                              "link": "/admin/reports"},
        })
    return ok({"id": str(res.inserted_id), "status": "open"}, "Report submitted. Our team will review it.")


@bp.route("/<report_id>/resolve", methods=["POST"])
@require_auth
@require_role("admin")
def resolve_report(report_id):
    if not valid_id(report_id):
        return error_response("Invalid report id.", 400)
    db = get_db()
    r = db.reports.find_one({"_id": ObjectId(report_id)})
    if not r:
        return error_response("Report not found.", 404)
    payload = request.get_json(silent=True) or {}
    db.reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"status": "resolved", "resolution": (payload.get("resolution") or "").strip()[:500],
                  "resolvedAt": now_iso(), "resolvedBy": str(request.user["_id"])}},
    )
    return ok(message="Report resolved")
