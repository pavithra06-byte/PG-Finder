import math
import re
from flask import Blueprint, request, current_app
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth, require_role
from app.utils.helpers import (
    error_response, ok, now_iso, valid_id, save_image,
    parse_float, parse_int, parse_bool, haversine_km, format_distance_km, clamp,
)

bp = Blueprint("pgs", __name__)

ROOM_TYPES = ["Single", "Double Sharing", "Triple Sharing", "Four Sharing"]
GENDERS = ["Male", "Female", "Unisex"]
AMENITIES_MASTER = [
    "Wi-Fi", "Food", "AC", "Parking", "Laundry", "CCTV", "Security",
    "Power Backup", "Housekeeping", "Gym", "Hot Water", "Kitchen", "Study Area", "Furnished",
]

FACILITY_TAGS = {
    "college": '["amenity"="college"]',
    "university": '["amenity"="university"]',
    "hospital": '["amenity"="hospital"]',
    "bus_stop": '["highway"="bus_stop"]',
    "railway_station": '["railway"="station"]',
    "restaurant": '["amenity"="restaurant"]',
    "supermarket": '["shop"="supermarket"]',
    "atm": '["amenity"="atm"]',
    "pharmacy": '["amenity"="pharmacy"]',
    "gym": '["leisure"="fitness_centre"]',
}


def serialize_pg(doc, lat=None, lng=None, include_private=False):
    d = dict(doc)
    d["id"] = str(d.pop("_id"))
    d["location"] = (doc.get("location") or {}).get("coordinates")
    if lat is not None and lng is not None and d.get("location"):
        dist = haversine_km(lat, lng, d["location"][1], d["location"][0])
        d["distanceKm"] = round(dist, 2)
        d["distanceText"] = format_distance_km(dist)
    if not include_private:
        d.pop("ownerId", None)
    return d


def _pg_to_geo(doc):
    loc = doc.get("location") or {}
    coords = loc.get("coordinates") or []
    if len(coords) == 2:
        return {"type": "Point", "coordinates": [coords[0], coords[1]]}
    return None


@bp.route("", methods=["GET"])
def list_pgs():
    """Search PGs with optional geospatial radius + filters (server-side filtering)."""
    db = get_db()
    q = request.args.get("q") or ""
    lat = parse_float(request.args.get("lat"))
    lng = parse_float(request.args.get("lng"))
    radius = clamp(parse_int(request.args.get("radius"), 5), 1, 50)
    city = (request.args.get("city") or "").strip()
    district = (request.args.get("district") or "").strip()
    min_rent = parse_float(request.args.get("minRent"))
    max_rent = parse_float(request.args.get("maxRent"))
    room_type = (request.args.get("roomType") or "").strip()
    gender = (request.args.get("gender") or "").strip()
    sort = (request.args.get("sort") or "recommended").strip()
    page = max(1, parse_int(request.args.get("page"), 1))
    per_page = clamp(parse_int(request.args.get("per_page"), 12), 1, 50)
    amenities = [a for a in (request.args.get("amenities") or "").split(",") if a]
    owner_id = (request.args.get("ownerId") or "").strip()
    move_in = (request.args.get("moveInDate") or "").strip()

    match = {}
    if owner_id:
        from app.utils.security import get_current_user

        user = getattr(request, "user", None) or get_current_user()
        if not user or (str(user["_id"]) != owner_id and user.get("role") != "admin"):
            return error_response("Not authorized to view these listings.", 403)
        match["ownerId"] = owner_id
    else:
        match["status"] = "approved"
    if city:
        match["$or"] = [
            {"city": re.compile(re.escape(city), re.IGNORECASE)},
            {"area": re.compile(re.escape(city), re.IGNORECASE)},
            {"address": re.compile(re.escape(city), re.IGNORECASE)},
        ]
    if district:
        match["$or"] = [
            {"district": re.compile(re.escape(district), re.IGNORECASE)},
            {"city": re.compile(re.escape(district), re.IGNORECASE)},
            {"area": re.compile(re.escape(district), re.IGNORECASE)},
            {"address": re.compile(re.escape(district), re.IGNORECASE)},
        ]
    if q:
        match["$or"] = [
            {"name": re.compile(re.escape(q), re.IGNORECASE)},
            {"area": re.compile(re.escape(q), re.IGNORECASE)},
            {"city": re.compile(re.escape(q), re.IGNORECASE)},
        ]
    if min_rent is not None or max_rent is not None:
        rent_match = {}
        if min_rent is not None:
            rent_match["$gte"] = min_rent
        if max_rent is not None:
            rent_match["$lte"] = max_rent
        match["rent.from"] = rent_match
    if room_type:
        match["roomTypes"] = room_type
    if gender:
        match["gender"] = {"$in": [gender, "Unisex"]}
    if amenities:
        match["amenities"] = {"$all": amenities}
    if move_in:
        match["availableNow"] = True

    city_scope = bool(city or district)
    pipeline = []
    if lat is not None and lng is not None and not city_scope:
        pipeline.append({"$geoNear": {
            "near": {"type": "Point", "coordinates": [lng, lat]},
            "distanceField": "geoDistance",
            "maxDistance": radius * 1000,
            "spherical": True,
            "key": "location",
            "query": match,
        }})
        results = list(db.pg_properties.aggregate(pipeline))
        if sort == "nearest":
            results.sort(key=lambda x: x.get("geoDistance", 0))
        elif sort == "lowest_rent":
            results.sort(key=lambda x: (x.get("rent") or {}).get("from", 1e9))
        elif sort == "highest_rated":
            results.sort(key=lambda x: -(x.get("rating") or {}).get("average", 0))
        elif sort == "most_reviewed":
            results.sort(key=lambda x: -(x.get("rating") or {}).get("count", 0))
        elif sort == "newest":
            results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        total = len(results)
        start = (page - 1) * per_page
        results = results[start:start + per_page]
    else:
        total = db.pg_properties.count_documents(match)
        cursor = db.pg_properties.find(match).skip((page - 1) * per_page).limit(per_page)
        if sort == "lowest_rent":
            cursor = cursor.sort([("rent.from", 1)])
        elif sort == "highest_rated":
            cursor = cursor.sort([("rating.average", -1)])
        elif sort == "most_reviewed":
            cursor = cursor.sort([("rating.count", -1)])
        elif sort == "newest":
            cursor = cursor.sort([("createdAt", -1)])
        else:
            cursor = cursor.sort([("rating.average", -1), ("createdAt", -1)])
        results = list(cursor)

    items = []
    for p in results:
        d = dict(p)
        if "geoDistance" in d:
            km = d.pop("geoDistance") / 1000.0
            d["distanceKm"] = round(km, 2)
            d["distanceText"] = format_distance_km(km)
        items.append(serialize_pg(d, lat=lat, lng=lng))

    min_rent_doc = db.pg_properties.find_one({"status": "approved"}, {"rent": 1}, sort=[("rent.from", 1)])
    facets = {
        "minRentFound": ((min_rent_doc or {}).get("rent") or {}).get("from"),
        "total": total,
    }
    return ok({"items": items, "total": total, "page": page, "per_page": per_page, "facets": facets})


@bp.route("/<pg_id>", methods=["GET"])
def pg_detail(pg_id):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    doc = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not doc:
        return error_response("PG not found.", 404)
    if doc.get("status") != "approved":
        from app.utils.security import get_current_user
        user = getattr(request, "user", None) or get_current_user()
        if not user or (str(user["_id"]) != doc.get("ownerId") and user.get("role") != "admin"):
            return error_response("This listing is not published.", 404)

    lat = parse_float(request.args.get("lat"))
    lng = parse_float(request.args.get("lng"))
    data = serialize_pg(doc, lat=lat, lng=lng, include_private=True)
    data["status"] = doc.get("status")

    owner = db.users.find_one({"_id": ObjectId(doc["ownerId"])})
    data["owner"] = {
        "id": str(owner["_id"]) if owner else None,
        "name": (owner or {}).get("name", "PG Owner"),
        "avatar": (owner or {}).get("avatar"),
        "isVerified": (owner or {}).get("isVerified", False),
        "responseTime": "Usually responds within a few hours",
    }
    data["nearbyFacilities"] = None  # fetched lazily via /api/location/nearby
    return ok(data)


@bp.route("", methods=["POST"])
@require_auth
@require_role("owner", "admin")
def create_pg():
    db = get_db()
    if request.user.get("role") == "owner":
        vstatus = (request.user.get("ownerDetails") or {}).get("verificationStatus")
        if vstatus != "approved":
            return error_response("Your owner account must be verified by admin before adding PGs.", 403)
    payload = request.get_json(silent=True) or {}
    data, err = _validate_pg_payload(payload)
    if err:
        return error_response(err, 400)
    data["ownerId"] = str(request.user["_id"])
    data["status"] = "pending"  # pending approval -> approved -> published
    data["createdAt"] = now_iso()
    data["updatedAt"] = now_iso()
    data["rating"] = {"average": 0, "count": 0}
    data["views"] = 0
    res = db.pg_properties.insert_one(data)
    from app.sockets.events import broadcast_to_user
    for admin in db.users.find({"role": "admin"}):
        broadcast_to_user(str(admin["_id"]), "notification:new", {
            "type": "listing:new",
            "title": "New PG listing pending approval",
            "body": f"{request.user['name']} submitted '{data['name']}' for approval.",
            "link": "/admin/listings",
            "_notification": {"type": "listing:new", "title": "New PG listing pending approval",
                              "body": f"{request.user['name']} submitted '{data['name']}' for approval.",
                              "link": "/admin/listings"},
        })
    return ok({"id": str(res.inserted_id), "status": "pending"}, "PG submitted for admin approval")


def _validate_pg_payload(p):
    name = (p.get("name") or "").strip()
    if not name or len(name) < 3:
        return None, "PG name is required (min 3 characters)."
    city = (p.get("city") or "").strip()
    state = (p.get("state") or "").strip()
    address = (p.get("address") or "").strip()
    if not city or not state or not address:
        return None, "City, state and full address are required."
    loc = p.get("location") or {}
    coords = loc.get("coordinates") if isinstance(loc, dict) else None
    if not coords or len(coords) != 2:
        return None, "PG location coordinates are required."
    try:
        lng, lat = float(coords[0]), float(coords[1])
    except (TypeError, ValueError):
        return None, "Invalid location coordinates."
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return None, "Location coordinates out of range."
    rent_from = parse_float(p.get("rent", {}).get("from") if isinstance(p.get("rent"), dict) else p.get("rentFrom"))
    rent_to = parse_float(p.get("rent", {}).get("to") if isinstance(p.get("rent"), dict) else p.get("rentTo"))
    deposit = parse_float(p.get("deposit"))
    if not rent_from or rent_from <= 0:
        return None, "Starting rent is required."
    if not rent_to:
        rent_to = rent_from
    gender = p.get("gender") or "Unisex"
    if gender not in GENDERS:
        return None, "Gender preference must be Male, Female or Unisex."
    room_types = [rt for rt in (p.get("roomTypes") or []) if rt in ROOM_TYPES]
    if not room_types:
        return None, "Select at least one room type."
    amenities = [a for a in (p.get("amenities") or []) if a in AMENITIES_MASTER]
    data = {
        "name": name,
        "description": (p.get("description") or "").strip(),
        "address": address,
        "area": (p.get("area") or "").strip(),
        "district": (p.get("district") or "").strip(),
        "city": city,
        "state": state,
        "pincode": (p.get("pincode") or "").strip(),
        "location": {"type": "Point", "coordinates": [lng, lat]},
        "rent": {"from": rent_from, "to": rent_to},
        "deposit": deposit or 0,
        "maintenance": parse_float(p.get("maintenance")) or 0,
        "foodCharges": parse_float(p.get("foodCharges")) or 0,
        "gender": gender,
        "roomTypes": room_types,
        "amenities": amenities,
        "rules": p.get("rules") or {},
        "foodInfo": (p.get("foodInfo") or "").strip(),
        "images": [i for i in (p.get("images") or []) if isinstance(i, str)][:15],
        "totalRooms": parse_int(p.get("totalRooms")) or 0,
        "furnished": parse_bool(p.get("furnished")),
        "availableNow": parse_bool(p.get("availableNow"), True),
        "nearby": {
            "college": (p.get("nearby") or {}).get("college", ""),
            "hospital": (p.get("nearby") or {}).get("hospital", ""),
            "railwayStation": (p.get("nearby") or {}).get("railwayStation", ""),
            "busStop": (p.get("nearby") or {}).get("busStop", ""),
        },
    }
    return data, None


@bp.route("/<pg_id>", methods=["PUT"])
@require_auth
@require_role("owner", "admin")
def update_pg(pg_id):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    doc = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not doc:
        return error_response("PG not found.", 404)
    if request.user.get("role") != "admin" and str(request.user["_id"]) != doc.get("ownerId"):
        return error_response("You can only edit your own PG listings.", 403)
    payload = request.get_json(silent=True) or {}
    if set(payload.keys()) <= {"images", "availableNow"}:
        update = {}
        if "images" in payload:
            update["images"] = [i for i in payload["images"] if isinstance(i, str)][:15]
        if "availableNow" in payload:
            update["availableNow"] = bool(payload["availableNow"])
        if update:
            update["updatedAt"] = now_iso()
            db.pg_properties.update_one({"_id": ObjectId(pg_id)}, {"$set": update})
        return ok(message="PG updated")
    data, err = _validate_pg_payload(payload)
    if err:
        return error_response(err, 400)
    data["updatedAt"] = now_iso()
    db.pg_properties.update_one({"_id": ObjectId(pg_id)}, {"$set": data})
    return ok(message="PG updated")


@bp.route("/<pg_id>/publish", methods=["POST"])
@require_auth
@require_role("owner")
def toggle_publish(pg_id):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    doc = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not doc or str(request.user["_id"]) != doc.get("ownerId"):
        return error_response("PG not found or not yours.", 404)
    new_status = "unpublished" if doc.get("status") == "approved" else "pending"
    db.pg_properties.update_one({"_id": ObjectId(pg_id)}, {"$set": {"status": new_status, "updatedAt": now_iso()}})
    return ok({"status": new_status}, "Listing updated")


@bp.route("/<pg_id>/images", methods=["POST"])
@require_auth
@require_role("owner")
def upload_images(pg_id):
    if not valid_id(pg_id):
        return error_response("Invalid PG id.", 400)
    db = get_db()
    doc = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
    if not doc or str(request.user["_id"]) != doc.get("ownerId"):
        return error_response("PG not found or not yours.", 404)
    files = request.files.getlist("images")
    if not files:
        return error_response("No images uploaded.", 400)
    urls = []
    for f in files:
        try:
            urls.append(save_image(f, subdir="pgs"))
        except ValueError as e:
            return error_response(str(e), 400)
    images = list(doc.get("images") or []) + urls
    db.pg_properties.update_one({"_id": ObjectId(pg_id)}, {"$set": {"images": images[:15], "updatedAt": now_iso()}})
    return ok({"images": images[:15]}, f"{len(urls)} image(s) uploaded")


@bp.route("/compare", methods=["POST"])
def compare():
    """Compare up to 4 PGs."""
    payload = request.get_json(silent=True) or {}
    ids = [i for i in (payload.get("ids") or []) if valid_id(i)][:4]
    if not ids:
        return error_response("Provide PG ids to compare.", 400)
    db = get_db()
    docs = list(db.pg_properties.find({"_id": {"$in": [ObjectId(i) for i in ids]}, "status": "approved"}))
    items = []
    for d in docs:
        pg = serialize_pg(d)
        rooms = list(db.rooms.find({"pgId": str(d["_id"]), "status": {"$ne": "maintenance"}}))
        pg["rooms"] = [
            {"id": str(r["_id"]), "type": r["type"], "rent": r["rent"],
             "deposit": r.get("deposit", 0), "available": r.get("availableBeds", 0)}
            for r in rooms
        ]
        items.append(pg)
    return ok(items)


@bp.route("/nearby-facilities", methods=["GET"])
def nearby_facilities():
    """Live nearby facilities via OpenStreetMap Overpass for a PG's coordinates."""
    pg_id = request.args.get("pgId")
    lat = parse_float(request.args.get("lat"))
    lng = parse_float(request.args.get("lng"))
    if not pg_id and (lat is None or lng is None):
        return error_response("Provide pgId or lat/lng.", 400)
    if pg_id:
        if not valid_id(pg_id):
            return error_response("Invalid PG id.", 400)
        db = get_db()
        doc = db.pg_properties.find_one({"_id": ObjectId(pg_id)})
        if not doc:
            return error_response("PG not found.", 404)
        coords = (doc.get("location") or {}).get("coordinates")
        lng, lat = coords[0], coords[1]
    facilities = _overpass_nearby(lat, lng)
    return ok(facilities)


def _overpass_nearby(lat, lng, radius_m=3000):
    import requests
    queries = []
    for cat, tag in FACILITY_TAGS.items():
        queries.append(
            f'node{tag}(around:{radius_m},{lat},{lng});'
        )
    out = " ".join(queries)
    body = f"[out:json][timeout:25];({out});out center 30;"
    try:
        resp = requests.post(
            current_app.config["OVERPASS_URL"],
            data={"data": body},
            timeout=20,
            headers={"User-Agent": "pg-finder/1.0 (contact: admin@pgfinder.local)"},
        )
        data = resp.json()
    except Exception:
        return []
    elements = data.get("elements", [])
    cat_of = {}
    results = []
    for el in elements:
        tags = el.get("tags", {}) or {}
        cat = _categorize(tags)
        if not cat:
            continue
        elat = el.get("lat") or (el.get("center") or {}).get("lat")
        elng = el.get("lon") or (el.get("center") or {}).get("lon")
        if elat is None:
            continue
        dist = haversine_km(lat, lng, elat, elng)
        if dist * 1000 > radius_m:
            continue
        name = tags.get("name") or tags.get("brand") or _default_name(cat)
        results.append({
            "name": name,
            "category": cat,
            "distanceKm": round(dist, 1),
            "distanceText": format_distance_km(dist),
            "lat": elat,
            "lng": elng,
        })
    results.sort(key=lambda r: r["distanceKm"])
    seen = {}
    final = []
    for r in results:
        seen[r["category"]] = seen.get(r["category"], 0) + 1
        if seen[r["category"]] <= 6:
            final.append(r)
    return final


def _categorize(tags):
    a = tags.get("amenity")
    h = tags.get("highway")
    if a == "college":
        return "college"
    if a == "university":
        return "university"
    if a == "hospital" or a == "clinic":
        return "hospital"
    if h == "bus_stop":
        return "bus_stop"
    if tags.get("railway") == "station":
        return "railway_station"
    if a == "restaurant" or a == "fast_food" or a == "cafe":
        return "restaurant"
    if tags.get("shop") in ("supermarket", "convenience", "mall"):
        return "supermarket"
    if a == "atm":
        return "atm"
    if a == "pharmacy":
        return "pharmacy"
    if tags.get("leisure") == "fitness_centre" or a == "gym":
        return "gym"
    return None


def _default_name(cat):
    return {
        "college": "College", "university": "University", "hospital": "Hospital",
        "bus_stop": "Bus Stop", "railway_station": "Railway Station",
        "restaurant": "Restaurant", "supermarket": "Supermarket", "atm": "ATM",
        "pharmacy": "Pharmacy", "gym": "Gym",
    }.get(cat, "Facility")


@bp.route("/<pg_id>/views", methods=["POST"])
def increment_views(pg_id):
    if valid_id(pg_id):
        db = get_db()
        db.pg_properties.update_one({"_id": ObjectId(pg_id)}, {"$inc": {"views": 1}})
    return ok()
