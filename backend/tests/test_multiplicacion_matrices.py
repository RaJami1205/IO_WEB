from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.algoritmos.Mult_matrices.schemas import MatricesRequest
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


def test_acepta_diez_matrices():
    dimensiones = [2] * 11
    solicitud = MatricesRequest(
        algoritmo="multiplicacion-matrices", dimensiones=dimensiones
    )
    assert solicitud.dimensiones == dimensiones

    respuesta = resolver(dimensiones)
    assert respuesta.status_code == 200
    datos = respuesta.json()
    # Diez matrices 2x2 necesitan nueve multiplicaciones de costo 2³.
    assert datos["resultado"]["costoMinimo"] == 72
    assert len(datos["tablas"]["M"]) == 10
    assert datos["tablas"]["M"][0][9] == 72


@pytest.mark.parametrize("cantidad", [12, 20])
def test_rechaza_exceso_de_dimensiones_antes_del_calculo(cantidad):
    dimensiones = [2] * cantidad
    with pytest.raises(ValidationError) as error:
        MatricesRequest(algoritmo="multiplicacion-matrices", dimensiones=dimensiones)
    assert any(e["loc"] == ("dimensiones",) for e in error.value.errors())

    with patch("app.algoritmos.Mult_matrices.router.resolver_matrices") as servicio:
        respuesta = resolver(dimensiones)
        assert respuesta.status_code == 422
        assert any(
            e["loc"] == ["body", "dimensiones"]
            for e in respuesta.json()["detail"]
        )
        servicio.assert_not_called()


@pytest.mark.parametrize("dimensiones", [[], [2], [2, 0], [2, None], None])
def test_conserva_restricciones_de_dimensiones(dimensiones):
    assert resolver(dimensiones).status_code == 422


def test_rechaza_dimensiones_ausentes():
    respuesta = client.post(
        "/api/multiplicacion-matrices",
        json={"algoritmo": "multiplicacion-matrices"},
    )
    assert respuesta.status_code == 422
