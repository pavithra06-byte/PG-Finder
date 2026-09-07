from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import error_response, ok, now_iso, valid_id
from app.sockets.events import broadcast_to_user

bp = Blueprint("notifications", __name__)


@bp.route("", methods=["GET"])
@require_auth
def list_notifications():
    db = get_db()
    uid = str(request.user["_id"])
    limit = min(int(request.args.get("limit") or 50), 100)
    items = list(db.notifications.find({"userId": uid}).sort("createdAt", -1).limit(limit))
    out = []
    for n in items:
        d = dict(n)
        d["id"] = str(d.pop("_id"))
        out.append(d)
    unread = db.notifications.count_documents({"userId": uid, "read": False})
    return ok({"items": out, "unread": unread})


@bp.route("/unread-count", methods=["GET"])
@require_auth
def unread_count():
    db = get_db()
    uid = str(request.user["_id"])
    count = db.notifications.count_documents({"userId": uid, "read": False})
    unread_msgs = 0
    for conv in db.conversations.find({"participants": ObjectId(uid)}):
        unread_msgs += (conv.get("unread") or {}).get(uid, 0)
    return ok({"notifications": count, "messages": unread_msgs})


@bp.route("/<notification_id>/read", methods=["POST"])
@require_auth
def mark_read(notification_id):
    if not valid_id(notification_id):
        return error_response("Invalid notification id.", 400)
    db = get_db()
    db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": str(request.user["_id"])},
        {"$set": {"read": True}},
    )
    return ok(message="Marked as read")


@bp.route("/read-all", methods=["POST"])
@require_auth
def read_all():
    db = get_db()
    db.notifications.update_many(
        {"userId": str(request.user["_id"]), "read": False},
        {"$set": {"read": True}},
    )
    return ok(message="All notifications marked as read")


@bp.route("/announce", methods=["POST"])
@require_auth
@require_role("admin")
def announce():
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    body = (payload.get("body") or "").strip()
    role = payload.get("role")  # optional: tenant | owner | all
    if not title or not body:
        return error_response("Title and body are required.", 400)
    db = get_db()
    q = {"role": {"$ne": "admin"}}
    if role in ("tenant", "owner"):
        q["role"] = role
    users = list(db.users.find(q, {"_id": 1}))
    count = 0
    for u in users:
        broadcast_to_user(str(u["_id"]), "notification:new", {
            "type": "announcement",
            "title": title,
            "body": body,
            "link": payload.get("link", ""),
            "_notification": {"type": "announcement", "title": title, "body": body,
                              "link": payload.get("link", "")},
        })
        count += 1
    return ok({"sentTo": count}, f"Announcement sent to {count} users")
