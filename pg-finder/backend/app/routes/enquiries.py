from flask import Blueprint, request
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import error_response, ok, now_iso, valid_id
from app.sockets.events import broadcast_to_user

bp = Blueprint("enquiries", __name__)

TOPICS = ["Availability", "Rent", "Deposit", "Food", "AC", "Wi-Fi", "Rules", "Visitors", "Facilities", "General"]


def _serialize(db, e):
    d = dict(e)
    d["id"] = str(d.pop("_id"))
    pg = db.pg_properties.find_one({"_id": ObjectId(d["pgId"])}) if valid_id(d.get("pgId")) else None
    d["pg"] = {"id": d.get("pgId"), "name": (pg or {}).get("name", "PG")}
    tenant = db.users.find_one({"_id": ObjectId(d["tenantId"])}) if valid_id(d.get("tenantId")) else None
    d["tenant"] = {"id": d.get("tenantId"), "name": (tenant or {}).get("name", "Tenant"),
                   "avatar": (tenant or {}).get("avatar")}
    return d


@bp.route("", methods=["GET"])
@require_auth
def list_enquiries():
    db = get_db()
    user = request.user
    match = {}
    if user.get("role") == "tenant":
        match["tenantId"] = str(user["_id"])
    elif user.get("role") == "owner":
        pgs = [p["_id"] for p in db.pg_properties.find({"ownerId": str(user["_id"])})]
        match["pgId"] = {"$in": [value for pg_id in pgs for value in (pg_id, str(pg_id))]}
    items = list(db.enquiries.find(match).sort("createdAt", -1).limit(200))
    return ok([_serialize(db, e) for e in items])


@bp.route("", methods=["POST"])
@require_auth
@require_role("tenant", "admin")
def create_enquiry():
    payload = request.get_json(silent=True) or {}
    pg_id = payload.get("pgId")
    topic = payload.get("topic") or "General"
    question = (payload.get("question") or "").strip()
    if not valid_id(pg_id):
        return error_response("PG is required.", 400)
    if topic not in TOPICS:
        topic = "General"
    if not question or len(question) < 5:
        return error_response("Please write your question (min 5 characters).", 400)

    db = get_db()
    pg = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not pg or pg.get("status") != "approved":
        return error_response("PG not found.", 404)
    enquiry = {
        "tenantId": str(request.user["_id"]),
        "pgId": pg_id,
        "pgName": pg.get("name"),
        "topic": topic,
        "question": question[:1000],
        "answer": None,
        "answeredAt": None,
        "status": "open",
        "createdAt": now_iso(),
    }
    res = db.enquiries.insert_one(enquiry)
    owner = db.users.find_one({"_id": ObjectId(pg.get("ownerId"))})
    if owner:
        broadcast_to_user(str(owner["_id"]), "enquiry:new", {
            "enquiryId": str(res.inserted_id),
            "pgName": pg.get("name"),
            "tenantName": request.user.get("name"),
            "topic": topic,
            "preview": question[:100],
            "title": "New enquiry",
            "body": f"{request.user['name']} asked about {topic.lower()} at {pg.get('name')}: {question[:80]}...",
            "link": "/owner/enquiries",
            "_notification": {"type": "enquiry:new", "title": "New enquiry",
                              "body": f"{request.user['name']} asked about {topic.lower()} at {pg.get('name')}.",
                              "link": "/owner/enquiries"},
        })
    return ok({"id": str(res.inserted_id), "status": "open"}, "Enquiry sent to the owner")


@bp.route("/<enquiry_id>/reply", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def reply_enquiry(enquiry_id):
    if not valid_id(enquiry_id):
        return error_response("Invalid enquiry id.", 400)
    db = get_db()
    e = db.enquiries.find_one({"_id": ObjectId(enquiry_id)})
    if not e:
        return error_response("Enquiry not found.", 404)
    pg = db.pg_properties.find_one({"_id": ObjectId(e["pgId"])})
    if request.user.get("role") != "admin" and (not pg or str(request.user["_id"]) != pg.get("ownerId")):
        return error_response("Not your enquiry.", 403)
    answer = (request.get_json(silent=True) or {}).get("answer", "").strip()
    if not answer:
        return error_response("Answer is required.", 400)
    db.enquiries.update_one(
        {"_id": ObjectId(enquiry_id)},
        {"$set": {"answer": answer[:2000], "answeredAt": now_iso(), "status": "answered"}},
    )
    tenant = db.users.find_one({"_id": ObjectId(e["tenantId"])})
    if tenant:
        broadcast_to_user(str(tenant["_id"]), "enquiry:reply", {
            "enquiryId": enquiry_id,
            "pgName": e.get("pgName"),
            "title": "Enquiry answered",
            "body": f"The owner of {e.get('pgName')} replied to your question.",
            "link": "/tenant/enquiries",
            "_notification": {"type": "enquiry:reply", "title": "Enquiry answered",
                              "body": f"The owner of {e.get('pgName')} replied to your enquiry.",
                              "link": "/tenant/enquiries"},
        })
    return ok(message="Reply sent to the tenant")


@bp.route("/<enquiry_id>", methods=["DELETE"])
@require_auth
def delete_enquiry(enquiry_id):
    if not valid_id(enquiry_id):
        return error_response("Invalid enquiry id.", 400)
    db = get_db()
    e = db.enquiries.find_one({"_id": ObjectId(enquiry_id)})
    if not e:
        return error_response("Enquiry not found.", 404)
    user = request.user
    if user.get("role") == "tenant" and str(user["_id"]) != e.get("tenantId"):
        return error_response("Not your enquiry.", 403)
    if user.get("role") == "owner":
        pg = db.pg_properties.find_one({"_id": ObjectId(e["pgId"])})
        if not pg or str(user["_id"]) != pg.get("ownerId"):
            return error_response("Not your enquiry.", 403)
    db.enquiries.delete_one({"_id": ObjectId(enquiry_id)})
    return ok(message="Enquiry deleted")
