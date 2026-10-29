from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def resolver(dimensiones):
    return client.post(
        "/api/multiplicacion-matrices",
        json={
            "algoritmo": "multiplicacion-matrices",
            "dimensiones": dimensiones,
        },
    )


def test_multiplicacion_correcta():
    respuesta = resolver([30, 35, 15, 5, 10])

    assert respuesta.status_code == 200

    datos = respuesta.json()

    assert datos["resultado"]["costoMinimo"] == 9375
    assert datos["tablas"]["M"][0][3] == 9375
    assert datos["tablas"]["P"][0][3] == 3


def test_rechaza_dimension_negativa():
    assert resolver([30, -5, 10]).status_code == 422


def test_una_sola_matriz_no_cuesta_nada():
    datos = resolver([10, 20]).json()

    assert datos["resultado"]["costoMinimo"] == 0
    assert datos["resultado"]["parentizacion"] == "A1"


def test_dos_matrices():
    datos = resolver([10, 20, 30]).json()

    assert datos["resultado"]["costoMinimo"] == 6000
    assert datos["resultado"]["parentizacion"] == "(A1 × A2)"


def test_tres_matrices_elige_el_mejor_orden():
    # (A1 x A2) x A3 = 1500 + 3000 = 4500; A1 x (A2 x A3) = 27000
    datos = resolver([10, 30, 5, 60]).json()

    assert datos["resultado"]["costoMinimo"] == 4500
    assert datos["resultado"]["parentizacion"] == "((A1 × A2) × A3)"
