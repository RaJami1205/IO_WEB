import math
from fractions import Fraction

from app.algoritmos.problema_mochila.schemas import MochilaRequest, MochilaResponse
from app.algoritmos.problema_mochila.solver import solve


def json_numbers(value):
    if isinstance(value, Fraction):
        if value.denominator == 1:
            return value.numerator
        number = float(value)
        # con los limites del schema nunca deberia pasar pero se protege la salida
        if not math.isfinite(number) or (number == 0 and value != 0):
            raise ValueError("El resultado excede el rango numérico JSON soportado.")
        return number
    if isinstance(value, list):
        return [json_numbers(item) for item in value]
    if isinstance(value, dict):
        return {key: json_numbers(item) for key, item in value.items()}
    return value


def topes_por_variante(request: MochilaRequest) -> list[int | None]:
    if request.variante == "0-1":
        return [1] * len(request.objetos)
    if request.variante == "acotada":
        return [objeto.cantidad for objeto in request.objetos]
    return [None] * len(request.objetos)


def resolver_mochila(request: MochilaRequest) -> MochilaResponse:
    objetos = request.objetos
    capacidad_total = request.capacidad
    cantidad_objetos = len(objetos)
    nombres = [objeto.nombre for objeto in objetos]
    valores = [Fraction(objeto.valor) for objeto in objetos]

    solucion = solve(capacidad_total, [objeto.peso for objeto in objetos], valores,
                     topes_por_variante(request), nombres)

    seleccion = [
        {"indice": posicion + 1, "nombre": nombres[posicion], "cantidad": copias,
         "pesoTotal": copias * objetos[posicion].peso, "valorTotal": copias * valores[posicion]}
        for posicion, copias in enumerate(solucion.copias_elegidas) if copias > 0
    ]
    valor_optimo = json_numbers(solucion.tabla_valores[capacidad_total][cantidad_objetos])
    peso_usado = sum(item["pesoTotal"] for item in seleccion)

    if seleccion:
        conclusion = (f"Con capacidad {capacidad_total} el valor máximo es {valor_optimo}, "
                      f"usando {peso_usado} unidades de peso.")
    else:
        conclusion = f"Ningún objeto cabe en la mochila de capacidad {capacidad_total}. El valor máximo es 0."

    solucion.pasos.append({
        "orden": len(solucion.pasos) + 1, "tipo": "resultado", "explicacion": conclusion,
        "foco": {"tabla": "V", "fila": capacidad_total, "columna": cantidad_objetos}, "cambios": [],
    })
    return MochilaResponse.model_validate(json_numbers({
        "algoritmo": "mochila",
        "resultado": {
            "valorOptimo": valor_optimo, "pesoUsado": peso_usado, "seleccion": seleccion,
            "hayEmpates": solucion.hay_empates, "conclusion": conclusion,
        },
        "tablas": {"V": solucion.tabla_valores, "decision": solucion.tabla_copias,
                   "opciones": solucion.tabla_opciones, "marca": solucion.tabla_marcas},
        "pasos": solucion.pasos,
        "metadatos": {"variante": request.variante, "ejeFilas": "capacidad", "ejeColumnas": "objeto",
                      "indicesDesde": 0, "objetos": nombres},
    }))