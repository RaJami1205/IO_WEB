import os
from urllib.parse import urlsplit


def get_cors_origins() -> list[str]:
    """Lee orígenes HTTP explícitos separados por comas; vacío desactiva CORS."""
    value = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    for origin in origins:
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or "*" in origin
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("CORS_ORIGINS debe contener orígenes HTTP(S) sin rutas ni comodines.")
    return origins
