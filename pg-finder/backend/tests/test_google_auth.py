import json
import unittest
from unittest.mock import Mock, patch

from flask import Flask
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import jwt

from app.routes.auth import _verify_google_token


class GoogleTokenVerificationTests(unittest.TestCase):
    def _build_google_token(self, *, issuer, audience, key_id="kid-123"):
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        jwk = json.loads(
            jwt.algorithms.RSAAlgorithm.to_jwk(public_key)
        )
        jwk["kid"] = key_id
        payload = {
            "iss": issuer,
            "aud": audience,
            "sub": "google-user-123",
            "email": "test.user@example.com",
            "email_verified": True,
            "name": "Test User",
            "picture": "https://example.com/avatar.jpg",
        }
        token = jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": key_id})
        return token, jwk

    @patch("app.routes.auth.http_requests.get")
    def test_accepts_accounts_google_issuer_variant(self, mock_get):
        app = Flask(__name__)
        app.config["GOOGLE_CLIENT_ID"] = "client-123"
        token, jwk = self._build_google_token(
            issuer="accounts.google.com",
            audience="client-123",
        )

        mock_response = Mock()
        mock_response.json.return_value = {"keys": [jwk]}
        mock_get.return_value = mock_response

        with app.app_context():
            decoded = _verify_google_token(token)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["email"], "test.user@example.com")


if __name__ == "__main__":
    unittest.main()
