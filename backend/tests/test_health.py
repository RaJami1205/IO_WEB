import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.health import HealthResponse
from app.core.config import get_cors_origins
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    with TestClient(create_app()) as client:
        yield client


def test_health_contract(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert HealthResponse.model_validate(response.json()).status == "ok"
    with pytest.raises(ValidationError):
        HealthResponse(status="error")


def test_openapi_health_response(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    document = response.json()
    schema = document["paths"]["/api/health"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema["$ref"] == "#/components/schemas/HealthResponse"
    assert document["components"]["schemas"]["HealthResponse"]["properties"]["status"]["const"] == "ok"


def test_docs_available(client):
    assert client.get("/docs").status_code == 200


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_local_cors_preflight(client, method):
    response = client.options("/api/health", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "Content-Type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert method in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-credentials" not in response.headers


def test_unauthorized_cors(client):
    headers = {"Origin": "http://unauthorized.example"}
    response = client.options("/api/health", headers={
        **headers, "Access-Control-Request-Method": "GET",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
    response = client.get("/api/health", headers=headers)
    assert "access-control-allow-origin" not in response.headers


def test_configurable_cors(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://127.0.0.1:5173")
    with TestClient(create_app()) as client:
        response = client.get("/api/health", headers={"Origin": "http://127.0.0.1:5173"})
        assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
        response = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
        assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("origin", ["*", "https://*.example", "https://example.com/path"])
def test_invalid_cors_configuration(monkeypatch, origin):
    monkeypatch.setenv("CORS_ORIGINS", origin)
    with pytest.raises(ValueError):
        get_cors_origins()
