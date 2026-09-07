from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth
from app.utils.helpers import error_response, ok, now_iso, valid_id

bp = Blueprint("messages", __name__)


@bp.route("/conversations", methods=["GET"])
@require_auth
def conversations():
    db = get_db()
    uid = str(request.user["_id"])
    convs = list(db.conversations.find({"participants": ObjectId(uid)}).sort("lastMessageAt", -1).limit(100))
    out = []
    for c in convs:
        d = dict(c)
        d["id"] = str(d.pop("_id"))
        d["participants"] = [str(p) for p in (d.get("participants") or [])]
        other_id = next((p for p in d["participants"] if p != uid), None)
        other = db.users.find_one({"_id": ObjectId(other_id)}) if other_id and valid_id(other_id) else None
        d["other"] = {
            "id": other_id,
            "name": (other or {}).get("name", "User"),
            "avatar": (other or {}).get("avatar"),
            "role": (other or {}).get("role"),
        }
        d["unread"] = (d.get("unread") or {}).get(uid, 0)
        out.append(d)
    return ok(out)


@bp.route("/conversations", methods=["POST"])
@require_auth
def start_conversation():
    """Open a conversation between tenant and owner (usually linked to a PG)."""
    payload = request.get_json(silent=True) or {}
    other_id = payload.get("otherId")
    pg_id = payload.get("pgId")
    if not valid_id(other_id):
        return error_response("otherId is required.", 400)
    db = get_db()
    other = db.users.find_one({"_id": ObjectId(other_id)})
    if not other:
        return error_response("User not found.", 404)
    uid = str(request.user["_id"])
    if uid == other_id:
        return error_response("You cannot chat with yourself.", 400)
    existing = db.conversations.find_one({
        "participants": {"$all": [ObjectId(uid), ObjectId(other_id)]},
    })
    if existing:
        existing = dict(existing)
        existing["id"] = str(existing.pop("_id"))
        return ok({"id": existing["id"], "existing": True})
    conv = {
        "participants": [ObjectId(uid), ObjectId(other_id)],
        "pgId": pg_id if valid_id(pg_id) else None,
        "lastMessage": None,
        "lastMessageAt": now_iso(),
        "unread": {uid: 0, other_id: 0},
        "createdAt": now_iso(),
    }
    res = db.conversations.insert_one(conv)
    return ok({"id": str(res.inserted_id), "existing": False}, "Conversation started")


@bp.route("/conversations/<conv_id>/messages", methods=["GET"])
@require_auth
def messages(conv_id):
    if not valid_id(conv_id):
        return error_response("Invalid conversation id.", 400)
    db = get_db()
    uid = str(request.user["_id"])
    conv = db.conversations.find_one({"_id": ObjectId(conv_id)})
    if not conv or uid not in [str(p) for p in (conv.get("participants") or [])]:
        return error_response("Conversation not found.", 404)
    before = request.args.get("before")
    q = {"conversationId": conv_id}
    if before and valid_id(before):
        prev = db.messages.find_one({"_id": ObjectId(before)})
        if prev:
            q["createdAt"] = {"$lt": prev.get("createdAt")}
    msgs = list(db.messages.find(q).sort("createdAt", -1).limit(60))
    msgs.reverse()
    out = []
    for m in msgs:
        d = dict(m)
        d["id"] = str(d.pop("_id"))
        out.append(d)
    db.messages.update_many(
        {"conversationId": conv_id, "senderId": {"$ne": uid}, "readBy": {"$ne": uid}},
        {"$push": {"readBy": uid}},
    )
    db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": {f"unread.{uid}": 0}})
    return ok({"messages": out, "otherId": next((str(p) for p in (conv.get("participants") or []) if str(p) != uid), None)})


@bp.route("/conversations/<conv_id>/send", methods=["POST"])
@require_auth
def send_message(conv_id):
    if not valid_id(conv_id):
        return error_response("Invalid conversation id.", 400)
    db = get_db()
    uid = str(request.user["_id"])
    conv = db.conversations.find_one({"_id": ObjectId(conv_id)})
    if not conv or uid not in [str(p) for p in (conv.get("participants") or [])]:
        return error_response("Conversation not found.", 404)
    text = (request.get_json(silent=True) or {}).get("text", "").strip()
    if not text:
        return error_response("Message cannot be empty.", 400)
    msg = {
        "conversationId": conv_id,
        "senderId": uid,
        "text": text[:2000],
        "readBy": [uid],
        "createdAt": now_iso(),
    }
    res = db.messages.insert_one(msg)
    msg["id"] = str(msg.pop("_id"))
    other = next((str(p) for p in (conv.get("participants") or []) if str(p) != uid), None)
    db.conversations.update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {"lastMessage": text, "lastMessageAt": now_iso(), "lastSenderId": uid},
         "$inc": {f"unread.{other}": 1}} if other else {"$set": {"lastMessage": text, "lastMessageAt": now_iso()}},
    )
    from app.sockets.events import broadcast_to_user
    if other:
        broadcast_to_user(other, "message:new", {
            "conversationId": conv_id, "fromUserId": uid, "preview": text[:120],
            "title": "New message", "body": text[:120],
            "_notification": {"type": "message", "title": "New message",
                              "body": text[:120], "link": "/messages"},
        })
    broadcast_to_user(uid, "notification:new", {
        "title": "Message sent",
        "body": text[:120],
        "link": "/messages",
        "_notification": {"type": "message", "title": "Message sent",
                          "body": text[:120], "link": "/messages"},
    })
    return ok({"message": msg, "conversationId": conv_id}, "Message sent")
