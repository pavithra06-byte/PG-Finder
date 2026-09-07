from datetime import datetime, timezone
from bson import ObjectId
from flask import request, current_app
from flask_socketio import join_room, leave_room, emit, send

from app import socketio
from app.utils.security import decode_token
from app.utils.helpers import new_id, now_iso

online_users = {}


def _get_user_from_token(token=None):
    """Authenticate a socket connection from token (auth payload / query / header)."""
    try:
        if not token:
            data = request.args or {}
            token = (data.get("token") or "").strip()
        if not token:
            auth = (request.headers.get("Authorization") or "")
            if auth.startswith("Bearer "):
                token = auth[7:]
        payload = decode_token(token)
        if not payload or "error" in payload:
            return None
        from app.models import get_db

        try:
            return get_db().users.find_one({"_id": ObjectId(payload["sub"])})
        except Exception:
            return None
    except Exception:
        return None


def user_room(user_id):
    return f"user:{user_id}"


def _get_current_user():
    """Resolve the connected user from the current socket sid."""
    uid = online_users.get(request.sid)
    if not uid:
        return None
    from app.models import get_db

    try:
        return get_db().users.find_one({"_id": ObjectId(uid)})
    except Exception:
        return None


def broadcast_to_user(user_id, event, data):
    """Emit an event to a user's room + write a notification doc."""
    room = user_room(str(user_id))
    try:
        socketio.emit(event, data, to=room)
    except Exception:
        pass
    note = data.get("_notification")
    if note:
        from app.models import get_db

        try:
            get_db().notifications.insert_one(
                {
                    "userId": str(user_id),
                    "type": note.get("type", "general"),
                    "title": note.get("title", "New update"),
                    "body": note.get("body", ""),
                    "link": note.get("link", ""),
                    "read": False,
                    "createdAt": now_iso(),
                }
            )
            socketio.emit("notification:badge", {}, to=room)
        except Exception:
            pass
    return True


@socketio.on("connect")
def on_connect(auth=None):
    token = None
    if isinstance(auth, dict):
        token = auth.get("token") or ""
    user = _get_user_from_token(token)
    if not user:
        return False  # reject unauthenticated sockets
    uid = str(user["_id"])
    online_users[uid] = request.sid
    join_room(user_room(uid))
    join_room(f"role:{user.get('role')}")
    socketio.emit("user:online", {"userId": uid, "online": True}, to=user_room(uid))
    return True


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    for uid, s in list(online_users.items()):
        if s == sid:
            del online_users[uid]
            socketio.emit("user:offline", {"userId": uid, "online": False}, to=user_room(uid))
            break


@socketio.on("join:conversation")
def on_join_conversation(data):
    """Join a conversation room so messages stream to both sides."""
    conv_id = data.get("conversationId", "")
    if conv_id:
        join_room(f"conv:{conv_id}")
        emit("conversation:joined", {"conversationId": conv_id})


@socketio.on("leave:conversation")
def on_leave_conversation(data):
    conv_id = data.get("conversationId", "")
    if conv_id:
        leave_room(f"conv:{conv_id}")


@socketio.on("message:send")
def on_message_send(data):
    """Real-time chat message via socket (persisted by REST normally; this is the live path)."""
    user = _get_current_user()
    if not user:
        return
    conv_id = data.get("conversationId", "")
    text = (data.get("text") or "").strip()
    if not conv_id or not text:
        return
    from app.models import get_db

    db = get_db()
    try:
        conv = db.conversations.find_one({"_id": ObjectId(conv_id)})
    except Exception:
        conv = None
    if not conv or str(user["_id"]) not in [str(p) for p in (conv.get("participants") or [])]:
        return
    msg = {
        "_id": new_id(),
        "conversationId": conv_id,
        "senderId": str(user["_id"]),
        "text": text[:2000],
        "readBy": [str(user["_id"])],
        "createdAt": now_iso(),
    }
    db.messages.insert_one(msg)
    payload = {
        "conversationId": conv_id,
        "message": serialize_message(msg),
        "senderId": str(user["_id"]),
    }
    socketio.emit("message:receive", payload, to=f"conv:{conv_id}")
    for p in (conv.get("participants") or []):
        ps = str(p)
        if ps != str(user["_id"]):
            db.conversations.update_one(
                {"_id": ObjectId(conv_id)},
                {"$set": {"lastMessage": text, "lastMessageAt": now_iso(), "lastSenderId": ps},
                 "$inc": {f"unread.{ps}": 1}},
            )
            broadcast_to_user(ps, "message:new", {
                "conversationId": conv_id, "fromUserId": str(user["_id"]), "preview": text[:120],
                "title": "New message", "body": text[:120],
                "_notification": {"type": "message", "title": "New message",
                                  "body": text[:120], "link": "/messages"},
            })
    broadcast_to_user(str(user["_id"]), "notification:new", {
        "title": "Message sent",
        "body": text[:120],
        "link": "/messages",
        "_notification": {"type": "message", "title": "Message sent",
                          "body": text[:120], "link": "/messages"},
    })


@socketio.on("message:typing")
def on_typing(data):
    user = _get_current_user()
    if not user:
        return
    conv_id = data.get("conversationId", "")
    is_typing = bool(data.get("typing", True))
    if conv_id:
        socketio.emit(
            "message:typing",
            {"conversationId": conv_id, "userId": str(user["_id"]), "typing": is_typing},
            to=f"conv:{conv_id}",
        )


@socketio.on("message:read")
def on_read(data):
    user = _get_current_user()
    if not user:
        return
    conv_id = data.get("conversationId", "")
    if not conv_id:
        return
    from app.models import get_db

    db = get_db()
    db.messages.update_many(
        {"conversationId": conv_id, "senderId": {"$ne": str(user["_id"])}, "readBy": {"$ne": str(user["_id"])}},
        {"$push": {"readBy": str(user["_id"])}},
    )
    try:
        db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": {f"unread.{str(user['_id'])}": 0}})
    except Exception:
        pass
    socketio.emit(
        "message:read",
        {"conversationId": conv_id, "userId": str(user["_id"])},
        to=f"conv:{conv_id}",
    )


@socketio.on("location:updated")
def on_location_updated(data):
    """Location heartbeat — used to refresh nearby results on other open tabs."""
    user = _get_current_user()
    if not user:
        return
    lat = data.get("lat")
    lng = data.get("lng")
    if lat is None or lng is None:
        return
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return
    room = user_room(str(user["_id"]))
    socketio.emit(
        "location:updated",
        {"userId": str(user["_id"]), "lat": lat, "lng": lng},
        to=room,
    )


def serialize_message(doc):
    if not doc:
        return None
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc
