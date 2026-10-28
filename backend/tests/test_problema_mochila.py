import json
import random
from fractions import Fraction
from itertools import product

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.algoritmos.problema_mochila.schemas import MochilaRequest
from app.algoritmos.problema_mochila.service import json_numbers, resolver_mochila
from app.algoritmos.problema_mochila.solver import solve
from app.main import create_app

OBJETOS_ENUNCIADO = (("Linterna", 2, 10, 3), ("Agua", 5, 18, 2), ("Botiquín", 4, 15, 1))
OBJETOS_EMPATE = (("A", 2, 5, None), ("B", 2, 5, None), ("C", 4, 10, None))


def data(variante="acotada", capacidad=15, objetos=OBJETOS_ENUNCIADO):
    lista = []
    for nombre, peso, valor, cantidad in objetos:
        objeto = {"nombre": nombre, "peso": peso, "valor": valor}
        if cantidad is not None:
            objeto["cantidad"] = cantidad
        lista.append(objeto)
    return {"algoritmo": "mochila", "variante": variante, "capacidad": capacidad, "objetos": lista}


def response(body):
    return resolver_mochila(MochilaRequest.model_validate(body)).model_dump(exclude_unset=True)


def seleccion(result):
    return [(item["nombre"], item["cantidad"]) for item in result["resultado"]["seleccion"]]


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


@pytest.mark.parametrize("variante,valor,elegidos,peso", [
    ("0-1", 43, [("Linterna", 1), ("Agua", 1), ("Botiquín", 1)], 11),
    ("acotada", 63, [("Linterna", 3), ("Agua", 1), ("Botiquín", 1)], 15),
    ("no-acotada", 70, [("Linterna", 7)], 14),
])
def test_enunciado_en_las_tres_variantes(variante, valor, elegidos, peso):
    result = response(data(variante))
    assert result["resultado"]["valorOptimo"] == valor
    assert result["resultado"]["pesoUsado"] == peso
    assert seleccion(result) == elegidos
    assert result["resultado"]["hayEmpates"] is False
    assert len(result["pasos"]) == 2 + 2 * 15 * 3 + 3 + 1


def test_tabla_acotada_del_documento():
    tablas = response(data())["tablas"]
    assert [fila[1:] for fila in tablas["V"]] == [
        [0, 0, 0], [0, 0, 0], [10, 10, 10], [10, 10, 10], [20, 20, 20], [20, 20, 20],
        [30, 30, 30], [30, 30, 30], [30, 30, 35], [30, 38, 38], [30, 38, 45],
        [30, 48, 48], [30, 48, 48], [30, 48, 53], [30, 56, 56], [30, 56, 63],
    ]
    assert [fila[1:] for fila in tablas["decision"]] == [
        [0, 0, 0], [0, 0, 0], [1, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 0],
        [3, 0, 0], [3, 0, 0], [3, 0, 1], [3, 1, 0], [3, 1, 1],
        [3, 1, 0], [3, 1, 0], [3, 1, 1], [3, 2, 0], [3, 2, 1],
    ]
    assert all(fila[0] == 0 for fila in tablas["V"])
    for fila_copias, fila_marcas in zip(tablas["decision"], tablas["marca"]):
        assert fila_marcas == ["verde" if copias > 0 else "rojo" for copias in fila_copias]


def test_empate_se_resuelve_con_el_menor_k():
    result = response(data("0-1", 4, OBJETOS_EMPATE))
    assert result["resultado"]["valorOptimo"] == 10
    assert seleccion(result) == [("A", 1), ("B", 1)]
    assert result["resultado"]["hayEmpates"] is True
    assert result["tablas"]["opciones"][4][3] == [0, 1]
    assert result["tablas"]["marca"][4][3] == "rojo"
    assert result["tablas"]["marca"][2][2] == "rojo"
    assert "menor k" in result["pasos"][-5]["explicacion"]


def test_ningun_objeto_cabe():
    result = response(data("no-acotada", 3, (("Piano", 5, 100, None),)))
    assert result["resultado"]["valorOptimo"] == 0
    assert result["resultado"]["seleccion"] == []
    assert result["resultado"]["pesoUsado"] == 0
    assert "Ningún objeto cabe" in result["resultado"]["conclusion"]


@pytest.mark.parametrize("variante", ["0-1", "no-acotada"])
def test_cantidad_se_ignora_fuera_de_la_acotada(variante):
    sin_cantidad = tuple((nombre, peso, valor, None) for nombre, peso, valor, _ in OBJETOS_ENUNCIADO)
    assert response(data(variante)) == response(data(variante, objetos=sin_cantidad))


def test_peso_mayor_que_la_capacidad_queda_en_rojo():
    result = response(data("0-1", 3, (("Ligero", 1, 2, None), ("Pesado", 4, 50, None))))
    assert seleccion(result) == [("Ligero", 1)]
    assert all(fila[2] == "rojo" for fila in result["tablas"]["marca"])


@pytest.mark.parametrize("variante,capacidad,objetos", [
    ("0-1", 15, OBJETOS_ENUNCIADO),
    ("acotada", 15, OBJETOS_ENUNCIADO),
    ("no-acotada", 15, OBJETOS_ENUNCIADO),
    ("0-1", 4, OBJETOS_EMPATE),
    ("no-acotada", 20, tuple((f"O{i}", i % 4 + 1, i + 1, None) for i in range(10))),
])
def test_orden_de_pasos_y_reproduccion_exacta(variante, capacidad, objetos):
    result = response(data(variante, capacidad, objetos))
    n = len(objetos)
    pasos = result["pasos"]
    tipos = (["inicializacion"] * 2 + ["evaluacion", "actualizacion"] * (capacidad * n)
             + ["reconstruccion"] * n + ["resultado"])
    assert [paso["tipo"] for paso in pasos] == tipos

    pendiente = [[None] * (n + 1) for _ in range(capacidad + 1)]
    for orden, paso in enumerate(pasos, 1):
        assert paso["orden"] == orden
        if paso["tipo"] in {"evaluacion", "reconstruccion", "resultado"}:
            assert paso["cambios"] == []
        if paso["tipo"] == "evaluacion":
            datos = paso["datos"]
            columna = paso["foco"]["columna"]
            valor = objetos[columna - 1][2]
            for candidato in datos["candidatos"]:
                previa = candidato["celdaPrevia"]
                assert previa["columna"] == columna - 1
                assert pendiente[previa["fila"]][previa["columna"]] is not None
                assert candidato["total"] == candidato["k"] * valor + pendiente[previa["fila"]][previa["columna"]]
            mejor = max(candidato["total"] for candidato in datos["candidatos"])
            empatados = [c["k"] for c in datos["candidatos"] if c["total"] == mejor]
            assert datos["kElegido"] == empatados[0]
            assert datos["empate"] is (len(empatados) > 1)
        for cambio in paso["cambios"]:
            assert pendiente[cambio["fila"]][cambio["columna"]] is None
            pendiente[cambio["fila"]][cambio["columna"]] = cambio["valor"]
            assert cambio["marca"] == ("verde" if cambio["cantidad"] > 0 else "rojo")

    assert pendiente == result["tablas"]["V"]
    assert pasos[-1]["explicacion"] == result["resultado"]["conclusion"]
    assert pasos[-1]["foco"] == {"tabla": "V", "fila": capacidad, "columna": n}


def test_peor_caso_de_los_limites():
    objetos = tuple((f"O{i}", 1, 1, None) for i in range(10))
    result = response(data("no-acotada", 20, objetos))
    assert result["resultado"]["valorOptimo"] == 20
    assert len(result["pasos"]) == 2 + 2 * 20 * 10 + 10 + 1


def test_oraculo_fuerza_bruta():
    generador = random.Random(2026)
    for _ in range(1500):
        n = generador.randint(1, 4)
        capacidad = generador.randint(1, 12)
        pesos = [generador.randint(1, 6) for _ in range(n)]
        valores = [Fraction(generador.randint(1, 30), generador.choice([1, 2, 10])) for _ in range(n)]
        topes = generador.choice([[1] * n, [generador.randint(1, 3) for _ in range(n)], [None] * n])
        limites = [capacidad // peso if tope is None else min(tope, capacidad // peso)
                   for peso, tope in zip(pesos, topes)]

        optimo = max(sum(k * v for k, v in zip(combinacion, valores))
                     for combinacion in product(*[range(limite + 1) for limite in limites])
                     if sum(k * w for k, w in zip(combinacion, pesos)) <= capacidad)
        solucion = solve(capacidad, pesos, valores, topes, [f"o{i}" for i in range(n)])
        copias = solucion.copias_elegidas

        assert solucion.tabla_valores[capacidad][n] == optimo
        assert sum(k * v for k, v in zip(copias, valores)) == optimo
        assert sum(k * w for k, w in zip(copias, pesos)) <= capacidad
        assert all(k <= limite for k, limite in zip(copias, limites))


@pytest.mark.parametrize("field,value", [
    ("capacidad", 0), ("capacidad", 21), ("capacidad", True), ("capacidad", 5.0), ("capacidad", "5"),
    ("variante", "fraccionaria"), ("variante", None),
    ("objetos", []), ("objetos", {}), ("objetos", [None]),
    ("objetos", [{"nombre": f"O{i}", "peso": 1, "valor": 1, "cantidad": 1} for i in range(11)]),
    ("algoritmo", "reemplazo-equipos"), ("extra", 1),
])
def test_entrada_invalida(client, field, value):
    assert client.post("/api/problema-mochila", json={**data(), field: value}).status_code == 422


@pytest.mark.parametrize("field,value", [
    ("peso", 0), ("peso", -1), ("peso", True), ("peso", 2.5), ("peso", "2"), ("peso", None),
    ("valor", 0), ("valor", -1), ("valor", True), ("valor", "10"), ("valor", None),
    ("valor", float("nan")), ("valor", float("inf")), ("valor", 0.0000001), ("valor", 10**12 + 1),
    ("nombre", ""), ("nombre", "   "), ("nombre", "x" * 41), ("nombre", 5),
    ("cantidad", 0), ("cantidad", True), ("cantidad", 1.5), ("extra", 1),
])
def test_objeto_invalido(field, value):
    body = data()
    body["objetos"][0][field] = value
    with pytest.raises(ValidationError):
        MochilaRequest.model_validate(body)


def test_acotada_exige_cantidad_y_nombra_el_objeto(client):
    body = data()
    del body["objetos"][1]["cantidad"]
    result = client.post("/api/problema-mochila", json=body)
    assert result.status_code == 422
    assert "Agua" in result.json()["detail"][0]["msg"]


def test_nombres_repetidos_sin_distinguir_mayusculas(client):
    body = data()
    body["objetos"][1]["nombre"] = " linterna "
    assert client.post("/api/problema-mochila", json=body).status_code == 422


def test_contrato_http(client):
    result = client.post("/api/problema-mochila", json=data())
    assert result.status_code == 200
    body = result.json()
    assert set(body) == {"algoritmo", "resultado", "tablas", "pasos", "metadatos"}
    assert set(body["tablas"]) == {"V", "decision", "opciones", "marca"}
    assert body["metadatos"] == {"variante": "acotada", "ejeFilas": "capacidad", "ejeColumnas": "objeto",
                                 "indicesDesde": 0, "objetos": ["Linterna", "Agua", "Botiquín"]}
    assert body["resultado"]["seleccion"][0] == {"indice": 1, "nombre": "Linterna", "cantidad": 3,
                                                 "pesoTotal": 6, "valorTotal": 30}
    for paso in body["pasos"]:
        for cambio in paso["cambios"]:
            assert type(cambio["valor"]) in (int, float)


def test_decimales_exactos_detectan_empates(client):
    raw = ('{"algoritmo":"mochila","variante":"0-1","capacidad":2,"objetos":['
           '{"nombre":"A","peso":1,"valor":0.1},{"nombre":"B","peso":1,"valor":0.2},'
           '{"nombre":"C","peso":2,"valor":0.3}]}')
    result = client.post("/api/problema-mochila", content=raw, headers={"Content-Type": "application/json"})
    assert result.status_code == 200
    body = result.json()
    assert body["resultado"]["valorOptimo"] == 0.3
    assert body["resultado"]["hayEmpates"] is True
    assert [item["nombre"] for item in body["resultado"]["seleccion"]] == ["A", "B"]


@pytest.mark.parametrize("token", ["NaN", "Infinity", "-Infinity", "1e999"])
def test_tokens_no_finitos_o_enormes_dan_422(client, token):
    raw = json.dumps(data()).replace('"valor": 10', '"valor": ' + token)
    result = client.post("/api/problema-mochila", content=raw, headers={"Content-Type": "application/json"})
    assert result.status_code == 422
    assert isinstance(result.json()["detail"], list)


def test_valor_maximo_permitido(client):
    result = client.post("/api/problema-mochila", json=data("0-1", 1, (("Oro", 1, 10**12, None),)))
    assert result.status_code == 200
    assert result.json()["resultado"]["valorOptimo"] == 10**12


def test_serializacion_rechaza_desborde():
    with pytest.raises(ValueError):
        json_numbers(Fraction(10**400) + Fraction(1, 10))


def test_extra_anidado_y_json_malformado(client):
    body = data()
    body["objetos"][0]["extra"] = 1
    assert client.post("/api/problema-mochila", json=body).status_code == 422
    assert client.post("/api/problema-mochila", content="{", headers={"Content-Type": "application/json"}).status_code == 422