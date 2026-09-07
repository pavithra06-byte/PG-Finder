from pymongo import MongoClient
from pymongo import ASCENDING, DESCENDING, GEO2D

_client = None
_db = None


def init_db(uri: str, db_name: str = None):
    global _client, _db
    _client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    db_name = db_name or (uri.rsplit("/", 1)[-1] if "/" in uri.split("@")[-1] else "pg_finder")
    if not db_name or db_name in ("mongodb", "localhost:27017"):
        db_name = "pg_finder"
    _db = _client[db_name]
    _db.command("ping")
    create_indexes(_db)
    return _db


def get_db():
    global _db
    if _db is None:
        raise RuntimeError("Database not initialised. Call init_db() first.")
    return _db


def create_indexes(db):
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.users.create_index([("role", ASCENDING)])

    db.pg_properties.create_index([("location", "2dsphere")])
    db.pg_properties.create_index([("city", ASCENDING), ("status", ASCENDING)])
    db.pg_properties.create_index([("rent.from", ASCENDING)])
    db.pg_properties.create_index([("roomTypes", ASCENDING)])
    db.pg_properties.create_index([("amenities", ASCENDING)])
    db.pg_properties.create_index([("ownerId", ASCENDING)])

    db.rooms.create_index([("pgId", ASCENDING), ("status", ASCENDING)])

    db.bookings.create_index([("status", ASCENDING)])
    db.bookings.create_index([("moveInDate", ASCENDING)])
    db.bookings.create_index([("tenantId", ASCENDING), ("status", ASCENDING)])
    db.bookings.create_index([("pgId", ASCENDING), ("roomId", ASCENDING), ("status", ASCENDING)])

    db.reviews.create_index([("rating", DESCENDING)])
    db.reviews.create_index([("pgId", ASCENDING)])
    db.reviews.create_index([("tenantId", ASCENDING), ("pgId", ASCENDING)], unique=True)

    db.messages.create_index([("conversationId", ASCENDING), ("createdAt", ASCENDING)])
    db.conversations.create_index([("participants", ASCENDING)])
    db.notifications.create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])
    db.favorites.create_index([("tenantId", ASCENDING), ("pgId", ASCENDING)], unique=True)
    db.enquiries.create_index([("pgId", ASCENDING), ("createdAt", DESCENDING)])
    db.visit_requests.create_index([("pgId", ASCENDING), ("createdAt", DESCENDING)])
    db.locations.create_index([("name", ASCENDING)])
    db.locations.create_index([("loc", "2dsphere")])
