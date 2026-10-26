import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.algoritmos.problema_mochila.schemas import MochilaRequest
from app.main import create_app

OBJETOS_CLASE = (("Botella de Agua", 4, 11, None), ("Calcetines", 3, 7, None), ("Galletas", 5, 12, None))


def data(variante="0-1", capacidad=10, objetos=OBJETOS_CLASE):
    lista = []
    for nombre, peso, valor, cantidad in objetos:
        objeto = {"nombre": nombre, "peso": peso, "valor": valor}
        if cantidad is not None:
            objeto["cantidad"] = cantidad
        lista.append(objeto)
    return {"algoritmo": "mochila", "variante": variante, "capacidad": capacidad, "objetos": lista}


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


# ejercicios resueltos en clase

def test_integrado_clase_botella_calcetines_galletas(client):
    respuesta = client.post("/api/problema-mochila", json=data())

    assert respuesta.status_code == 200
    resultado = respuesta.json()
    assert resultado["resultado"]["valorOptimo"] == 23
    assert resultado["resultado"]["pesoUsado"] == 9
    seleccion = [(item["nombre"], item["cantidad"]) for item in resultado["resultado"]["seleccion"]]
    assert seleccion == [("Botella de Agua", 1), ("Galletas", 1)]

    # se omite la columna 0 que es la de sin objetos
    valores = [fila[1:] for fila in resultado["tablas"]["V"]]
    assert valores == [
        [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 7, 7], [11, 11, 11], [11, 11, 12],
        [11, 11, 12], [11, 18, 18], [11, 18, 19], [11, 18, 23], [11, 18, 23],
    ]
    copias = [fila[1:] for fila in resultado["tablas"]["decision"]]
    assert copias == [
        [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 0, 1],
        [1, 0, 1], [1, 1, 0], [1, 1, 1], [1, 1, 1], [1, 1, 1],
    ]


# validaciones

@pytest.mark.parametrize("field,value", [
    ("capacidad", 0), ("capacidad", 21), ("capacidad", True), ("capacidad", 5.0), ("capacidad", "5"),
    ("variante", "fraccionaria"), ("variante", None),
    ("objetos", []), ("objetos", {}), ("objetos", [None]),
    ("objetos", [{"nombre": f"O{i}", "peso": 1, "valor": 1} for i in range(11)]),
    ("algoritmo", "reemplazo-equipos"), ("extra", 1),
])
def test_entrada_invalida(client, field, value):
    assert client.post("/api/problema-mochila", json={**data(), field: value}).status_code == 422


@pytest.mark.parametrize("field,value", [
    ("peso", 0), ("peso", -1), ("peso", True), ("peso", 2.5), ("peso", "2"), ("peso", None),
    ("valor", 0), ("valor", -1), ("valor", True), ("valor", "10"), ("valor", None),
    ("valor", float("nan")), ("valor", float("inf")), ("valor", 0.0000001),
    ("nombre", ""), ("nombre", "   "), ("nombre", "x" * 41), ("nombre", 5),
    ("cantidad", 0), ("cantidad", True), ("cantidad", 1.5), ("extra", 1),
])
def test_objeto_invalido(field, value):
    body = data()
    body["objetos"][0][field] = value
    with pytest.raises(ValidationError):
        MochilaRequest.model_validate(body)


def test_acotada_exige_cantidad_y_nombra_el_objeto(client):
    objetos = (("Botella de Agua", 4, 11, 2), ("Calcetines", 3, 7, None), ("Galletas", 5, 12, 1))
    respuesta = client.post("/api/problema-mochila", json=data("acotada", 10, objetos))
    assert respuesta.status_code == 422
    assert "Calcetines" in respuesta.json()["detail"][0]["msg"]


def test_nombres_repetidos_sin_distinguir_mayusculas(client):
    body = data()
    body["objetos"][1]["nombre"] = " botella de agua "
    assert client.post("/api/problema-mochila", json=body).status_code == 422


@pytest.mark.parametrize("token", ["NaN", "Infinity", "-Infinity", "1e999"])
def test_tokens_no_finitos_o_enormes_dan_422(client, token):
    raw = json.dumps(data()).replace('"valor": 11', '"valor": ' + token)
    respuesta = client.post("/api/problema-mochila", content=raw, headers={"Content-Type": "application/json"})
    assert respuesta.status_code == 422
    assert isinstance(respuesta.json()["detail"], list)


def test_extra_anidado_y_json_malformado(client):
    body = data()
    body["objetos"][0]["extra"] = 1
    assert client.post("/api/problema-mochila", json=body).status_code == 422
    malformado = client.post("/api/problema-mochila", content="{", headers={"Content-Type": "application/json"})
    assert malformado.status_code == 422