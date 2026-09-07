import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO

socketio = SocketIO(cors_allowed_origins="*", async_mode="threading", ping_timeout=20, ping_interval=10)


def create_app():
    from config.config import Config, UPLOAD_FOLDER
    from app.models import init_db

    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}}, supports_credentials=True)

    init_db(app.config["MONGO_URI"])

    socketio.init_app(app)

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(UPLOAD_FOLDER, filename)

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "pg-finder-api", "time": __import__("datetime").datetime.now().isoformat()})

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "Internal server error. Please try again later."}), 500

    @app.errorhandler(Exception)
    def unhandled(e):
        app.logger.exception("Unhandled request error")
        return jsonify({"error": "Internal server error. Please try again later."}), 500

    from app.routes.auth import bp as auth_bp
    from app.routes.users import bp as users_bp
    from app.routes.owners import bp as owners_bp
    from app.routes.pgs import bp as pgs_bp
    from app.routes.rooms import bp as rooms_bp
    from app.routes.amenities import bp as amenities_bp
    from app.routes.bookings import bp as bookings_bp
    from app.routes.visits import bp as visits_bp
    from app.routes.enquiries import bp as enquiries_bp
    from app.routes.reviews import bp as reviews_bp
    from app.routes.messages import bp as messages_bp
    from app.routes.notifications import bp as notifications_bp
    from app.routes.favorites import bp as favorites_bp
    from app.routes.reports import bp as reports_bp
    from app.routes.location import bp as location_bp
    from app.routes.admin import bp as admin_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(owners_bp, url_prefix="/api/owners")
    app.register_blueprint(pgs_bp, url_prefix="/api/pgs")
    app.register_blueprint(rooms_bp, url_prefix="/api/rooms")
    app.register_blueprint(amenities_bp, url_prefix="/api/amenities")
    app.register_blueprint(bookings_bp, url_prefix="/api/bookings")
    app.register_blueprint(visits_bp, url_prefix="/api/visits")
    app.register_blueprint(enquiries_bp, url_prefix="/api/enquiries")
    app.register_blueprint(reviews_bp, url_prefix="/api/reviews")
    app.register_blueprint(messages_bp, url_prefix="/api/messages")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(favorites_bp, url_prefix="/api/favorites")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(location_bp, url_prefix="/api/location")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    from app.sockets import events as _socket_events  # noqa: F401

    return app
