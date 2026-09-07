import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")


class Config:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/pg_finder")
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-change-me")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    SOCKET_SECRET = os.getenv("SOCKET_SECRET", "dev-socket-secret-change-me")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "168"))
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "8"))
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
    NOMINATIM_URL = "https://nominatim.openstreetmap.org"
    OVERPASS_URL = "https://overpass-api.de/api/interpreter"
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
    ).split(",")

    LOCATION_UPDATE_THRESHOLD_M = 300
