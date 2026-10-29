from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_multiplicacion_correcta():

    respuesta = client.post(
        "/api/multiplicacion-matrices",
        json={
            "algoritmo": "multiplicacion-matrices",
            "dimensiones": [30, 35, 15, 5, 10]
        }
    )

    assert respuesta.status_code == 200

    datos = respuesta.json()

    assert datos["resultado"]["costoMinimo"] == 9375

    assert datos["tablas"]["M"][0][3] == 9375

    assert datos["tablas"]["P"][0][3] == 3


def test_rechaza_dimension_negativa():

    respuesta = client.post(
        "/api/multiplicacion-matrices",
        json={
            "algoritmo": "multiplicacion-matrices",
            "dimensiones": [30, -5, 10]
        }
    )

    assert respuesta.status_code == 422
