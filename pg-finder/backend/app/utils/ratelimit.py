import time
from collections import defaultdict
from flask import request, jsonify
from functools import wraps

_hits = defaultdict(list)


def rate_limit(max_requests=10, window_seconds=60):
    """Allow max_requests per window per client IP."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
            now = time.time()
            key = (ip, request.path)
            _hits[key] = [t for t in _hits[key] if now - t < window_seconds]
            if len(_hits[key]) >= max_requests:
                return jsonify({"error": f"Too many requests. Please try again in {window_seconds}s."}), 429
            _hits[key].append(now)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
