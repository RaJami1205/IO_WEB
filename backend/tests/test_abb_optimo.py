import json
import random
from fractions import Fraction

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.algoritmos.abb_optimo.schemas import AbbRequest
from app.algoritmos.abb_optimo.service import resolver_abb
from app.algoritmos.abb_optimo.solver import solve
from app.main import create_app


def data(llaves=(("while", 12), ("if", 20), ("do", 5.5), ("for", 8))):
    return {"algoritmo": "abb-optimo", "llaves": [{"llave": llave, "peso": peso} for llave, peso in llaves]}


def response(body):
    return resolver_abb(AbbRequest.model_validate(body)).model_dump(exclude_unset=True)


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


# ejercicios resueltos en clase

def test_integrado_beatles(client):
    body = data((("Harrison", 0.18), ("Lennon", 0.32), ("McCartney", 0.39), ("Starr", 0.11)))
    respuesta = client.post("/api/abb-optimo", json=body)

    assert respuesta.status_code == 200
    resultado = respuesta.json()
    llaves = resultado["resultado"]["llavesOrdenadas"]
    assert [item["llave"] for item in llaves] == ["Harrison", "Lennon", "McCartney", "Starr"]
    assert [item["probabilidadRedondeada"] for item in llaves] == [0.18, 0.32, 0.39, 0.11]
    assert resultado["tablas"]["A"] == [
        [0, 0.18, 0.68, 1.46, 1.79],
        [None, 0, 0.32, 1.03, 1.25],
        [None, None, 0, 0.39, 0.61],
        [None, None, None, 0, 0.11],
        [None, None, None, None, 0],
    ]
    assert resultado["tablas"]["R"] == [
        [None, 1, 2, 2, 2],
        [None, None, 2, 3, 3],
        [None, None, None, 3, 3],
        [None, None, None, None, 4],
        [None, None, None, None, None],
    ]
    # en A[1][4] empatan Lennon y McCartney con 1.79 y gana el menor k
    assert resultado["resultado"]["costoPromedio"] == 1.79
    assert resultado["resultado"]["raiz"] == "Lennon"


def test_integrado_quiz_07(client):
    # las llaves se envian desordenadas para comprobar tambien el orden alfabetico
    body = data((("SJ", 0.14), ("Paris", 0.09), ("Atenas", 0.30), ("Praga", 0.09), ("NY", 0.38)))
    respuesta = client.post("/api/abb-optimo", json=body)

    assert respuesta.status_code == 200
    resultado = respuesta.json()
    llaves = resultado["resultado"]["llavesOrdenadas"]
    assert [item["llave"] for item in llaves] == ["Atenas", "NY", "Paris", "Praga", "SJ"]
    assert [item["probabilidadRedondeada"] for item in llaves] == [0.30, 0.38, 0.09, 0.09, 0.14]
    assert resultado["tablas"]["A"] == [
        [0, 0.30, 0.98, 1.16, 1.43, 1.85],
        [None, 0, 0.38, 0.56, 0.83, 1.25],
        [None, None, 0, 0.09, 0.27, 0.55],
        [None, None, None, 0, 0.09, 0.32],
        [None, None, None, None, 0, 0.14],
        [None, None, None, None, None, 0],
    ]
    assert resultado["tablas"]["R"] == [
        [None, 1, 2, 2, 2, 2],
        [None, None, 2, 2, 2, 2],
        [None, None, None, 3, 3, 4],
        [None, None, None, None, 4, 5],
        [None, None, None, None, None, 5],
        [None, None, None, None, None, None],
    ]
    assert resultado["resultado"]["costoPromedio"] == 1.85
    assert resultado["resultado"]["raiz"] == "NY"

#validaciones
@pytest.mark.parametrize("field,value", [
    ("llaves", []), ("llaves", {}), ("llaves", [None]),
    ("llaves", [{"llave": f"k{indice}", "peso": 1} for indice in range(11)]),
    ("algoritmo", "mochila"), ("extra", 1),
])
def test_entrada_invalida(client, field, value):
    assert client.post("/api/abb-optimo", json={**data(), field: value}).status_code == 422


@pytest.mark.parametrize("field,value", [
    ("peso", 0), ("peso", -1), ("peso", True), ("peso", "5"), ("peso", None),
    ("peso", float("nan")), ("peso", float("inf")), ("peso", 0.0000001),
    ("llave", ""), ("llave", "   "), ("llave", "x" * 41), ("llave", 5), ("extra", 1),
])
def test_llave_invalida(field, value):
    body = data()
    body["llaves"][0][field] = value
    with pytest.raises(ValidationError):
        AbbRequest.model_validate(body)


@pytest.mark.parametrize("repetida", ["IF", " if ", "íf"])
def test_llaves_repetidas_dan_422(client, repetida):
    result = client.post("/api/abb-optimo", json=data((("if", 1), (repetida, 2))))
    assert result.status_code == 422
    assert "repetir" in result.json()["detail"][0]["msg"]


@pytest.mark.parametrize("token", ["NaN", "Infinity", "-Infinity", "1e999"])
def test_tokens_no_finitos_o_enormes_dan_422(client, token):
    raw = json.dumps(data()).replace('"peso": 12', '"peso": ' + token)
    result = client.post("/api/abb-optimo", content=raw, headers={"Content-Type": "application/json"})
    assert result.status_code == 422
    assert isinstance(result.json()["detail"], list)


def test_json_malformado(client):
    assert client.post("/api/abb-optimo", content="{", headers={"Content-Type": "application/json"}).status_code == 422