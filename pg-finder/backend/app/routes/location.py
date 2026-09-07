import re
from flask import Blueprint, request, current_app
from bson import ObjectId
from app.models import get_db
from app.utils.security import require_auth
from app.utils.helpers import (
    error_response, ok, now_iso, parse_float, haversine_km, format_distance_km,
    valid_id,
)

bp = Blueprint("location", __name__)


def _valid_coords(lat, lng):
    return lat is not None and lng is not None and -90 <= lat <= 90 and -180 <= lng <= 180


def _nominatim(url, params):
    import requests

    params = {**params, "format": "jsonv2", "limit": params.get("limit", 5)}
    try:
        resp = requests.get(
            url,
            params=params,
            timeout=12,
            headers={"User-Agent": "pg-finder/1.0 (location discovery)", "Accept-Language": "en"},
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


@bp.route("/reverse", methods=["GET"])
def reverse_geocode():
    """lat, lng -> readable place name (city/area/state)."""
    lat = parse_float(request.args.get("lat"))
    lng = parse_float(request.args.get("lng"))
    if not _valid_coords(lat, lng):
        return error_response("Valid lat/lng parameters are required.", 400)
    data = _nominatim(
        f"{current_app.config['NOMINATIM_URL']}/reverse",
        {"lat": lat, "lon": lng, "zoom": 14},
    )
    if not data:
        return error_response("Reverse geocoding failed. Try a manual location search.", 502, "geocode_failed")
    address = data.get("address") or {}
    display = data.get("display_name") or ""
    city = (
        address.get("city") or address.get("town") or address.get("village")
        or address.get("county") or ""
    )
    state = address.get("state") or ""
    area = (
        address.get("suburb") or address.get("neighbourhood") or address.get("road")
        or ""
    )
    result = {
        "lat": float(data.get("lat", lat)),
        "lng": float(data.get("lon", lng)),
        "displayName": display[:200],
        "city": city,
        "state": state,
        "area": area,
        "label": ", ".join([x for x in [area or city, state] if x]) or display[:60],
    }
    return ok(result)


@bp.route("/search", methods=["GET"])
def search_location():
    """Manual location search: 'Chennai', 'Anna Nagar', landmarks... -> coordinates."""
    q = (request.args.get("q") or "").strip()
    if not q or len(q) < 2:
        return error_response("Enter at least 2 characters to search a location.", 400)
    data = _nominatim(
        f"{current_app.config['NOMINATIM_URL']}/search",
        {"q": q, "limit": 8, "countrycodes": "in", "addressdetails": 1},
    )
    if data is None:
        return error_response("Location search is temporarily unavailable. Try again.", 502, "search_failed")
    results = []
    for item in data:
        lat, lng = parse_float(item.get("lat")), parse_float(item.get("lon"))
        if not _valid_coords(lat, lng):
            continue
        address = item.get("address") or {}
        city = (
            address.get("city") or address.get("town") or address.get("village")
            or address.get("county") or ""
        )
        state = address.get("state") or ""
        area = address.get("suburb") or address.get("neighbourhood") or address.get("road") or ""
        results.append({
            "lat": lat,
            "lng": lng,
            "displayName": item.get("display_name", "")[:200],
            "city": city,
            "state": state,
            "area": area,
            "type": item.get("type", ""),
            "label": ", ".join([x for x in [area or city, state] if x]) or item.get("display_name", "")[:60],
        })
    if not results:
        return error_response("No locations found. Try a different name.", 404, "not_found")
    return ok(results)


@bp.route("/popular", methods=["GET"])
def popular_locations():
    """Popular Indian cities for the landing page + counts of nearby PGs."""
    db = get_db()
    cities = db.locations.find({"popular": True}).sort("order", 1)
    out = []
    for c in cities:
        coords = (c.get("loc") or {}).get("coordinates") or []
        count = 0
        if len(coords) == 2:
            count = db.pg_properties.count_documents({
                "status": "approved",
                "location": {
                    "$geoWithin": {
                        "$centerSphere": [[coords[0], coords[1]], 15 / 6378.1],
                    }
                },
            })
        out.append({
            "name": c.get("name"),
            "state": c.get("state", ""),
            "lat": coords[1] if len(coords) == 2 else None,
            "lng": coords[0] if len(coords) == 2 else None,
            "pgCount": count,
        })
    return ok(out)


@bp.route("/distance", methods=["GET"])
def distance():
    """Actual distance between two coordinate pairs."""
    lat1 = parse_float(request.args.get("lat1"))
    lng1 = parse_float(request.args.get("lng1"))
    lat2 = parse_float(request.args.get("lat2"))
    lng2 = parse_float(request.args.get("lng2"))
    if not _valid_coords(lat1, lng1) or not _valid_coords(lat2, lng2):
        return error_response("Valid coordinates are required.", 400)
    km = haversine_km(lat1, lng1, lat2, lng2)
    return ok({"distanceKm": round(km, 2), "distanceText": format_distance_km(km)})


@bp.route("/nearby", methods=["GET"])
def nearby_pgs():
    """Geo query wrapper: lat/lng + radius -> nearest approved PGs with real distance."""
    lat = parse_float(request.args.get("lat"))
    lng = parse_float(request.args.get("lng"))
    radius = request.args.get("radius")
    try:
        radius = max(1, min(50, int(radius or 5)))
    except (TypeError, ValueError):
        radius = 5
    if not _valid_coords(lat, lng):
        return error_response("Valid lat/lng are required.", 400)

    db = get_db()
    pipeline = [
        {"$geoNear": {
            "near": {"type": "Point", "coordinates": [lng, lat]},
            "distanceField": "geoDistance",
            "maxDistance": radius * 1000,
            "spherical": True,
            "key": "location",
            "query": {"status": "approved"},
        }},
        {"$sort": {"geoDistance": 1}},
    ]
    results = list(db.pg_properties.aggregate(pipeline))
    items = []
    for p in results:
        d = dict(p)
        km = d.pop("geoDistance") / 1000.0
        d["distanceKm"] = round(km, 2)
        d["distanceText"] = format_distance_km(km)
        d["id"] = str(d.pop("_id"))
        d["location"] = (d.get("location") or {}).get("coordinates")
        d.pop("ownerId", None)
        items.append(d)
    return ok({"items": items, "total": len(items), "radius": radius,
               "center": {"lat": lat, "lng": lng}})


@bp.route("/within", methods=["GET"])
def within_radius():
    """How many PGs exist within a radius (for 'expand search' UX)."""
    lat = parse_float(request.args.get("lat"))
    lng = parse_float(request.args.get("lng"))
    if not _valid_coords(lat, lng):
        return error_response("Valid lat/lng are required.", 400)
    db = get_db()
    out = {}
    for r in (1, 3, 5, 10, 25):
        out[str(r)] = db.pg_properties.count_documents({
            "status": "approved",
            "location": {
                "$geoWithin": {
                    "$centerSphere": [[lng, lat], r / 6378.1],
                }
            },
        })
    return ok(out)
