import os
import re
import uuid
import math
from datetime import datetime, timezone
from bson import ObjectId
from flask import jsonify, current_app
from werkzeug.utils import secure_filename

ID_PATTERN = re.compile(r"^[a-f0-9]{24}$")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(ObjectId())


def valid_id(value):
    return bool(value) and ID_PATTERN.match(str(value))


def to_obj(value):
    return ObjectId(value)


def iso_to_dt(iso_str):
    if not iso_str:
        return None
    try:
        return datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")


def clamp(value, lo, hi):
    return max(lo, min(hi, value))



def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance in kilometres between two coordinate pairs."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def format_distance_km(km):
    """'0.7 km', '1.4 km', '5.6 km' style formatting."""
    if km < 1:
        return f"{round(km * 1000)} m"
    return f"{round(km, 1)} km"



def allowed_file(filename):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_EXTENSIONS"]


def save_image(file, subdir="general"):
    """Validate + save an uploaded image. Returns relative URL path or raises ValueError."""
    if not file or not file.filename:
        raise ValueError("No file provided")
    if not allowed_file(file.filename):
        raise ValueError("File type not allowed. Use PNG, JPG, JPEG, WEBP or GIF.")
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    max_bytes = current_app.config["MAX_UPLOAD_MB"] * 1024 * 1024
    if size > max_bytes:
        raise ValueError(f"File too large (max {current_app.config['MAX_UPLOAD_MB']} MB)")

    base = os.path.join(current_app.config["UPLOAD_FOLDER"], subdir)
    os.makedirs(base, exist_ok=True)
    name = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    path = os.path.join(base, name)
    file.save(path)

    try:
        from PIL import Image

        im = Image.open(path)
        im.thumbnail((1600, 1600))
        im.convert("RGB").save(path, "JPEG", quality=82)
        if not name.lower().endswith((".jpg", ".jpeg")):
            name = name.rsplit(".", 1)[0] + ".jpg"
            os.rename(path, os.path.join(base, name))
    except Exception:
        pass

    return f"/uploads/{subdir}/{name}"


def error_response(message, status=400, code=None):
    body = {"error": message}
    if code:
        body["code"] = code
    return jsonify(body), status


def ok(data=None, message=None):
    body = {"success": True}
    if data is not None:
        body["data"] = data
    if message:
        body["message"] = message
    return jsonify(body)


def paginate_args():
    page = max(1, parse_int(request_arg("page"), 1))
    per_page = clamp(parse_int(request_arg("per_page"), 12), 1, 50)
    return page, per_page


def request_arg(name):
    from flask import request

    val = request.args.get(name)
    if val is None and request.is_json:
        val = request.get_json(silent=True) or {}
        val = val.get(name) if isinstance(val, dict) else None
    return val
