# Ordena las llaves, invoca el solver y serializa costos, probabilidades y tablas del ABB.
import math
from fractions import Fraction

from app.algoritmos.abb_optimo.schemas import AbbRequest, AbbResponse, clave_alfabetica
from app.algoritmos.abb_optimo.solver import solve


# Convierte recursivamente fracciones a enteros o flotantes representables en JSON.
def json_numbers(value):
    if isinstance(value, Fraction):
        if value.denominator == 1:
            return value.numerator
        # con los limites del schema nunca deberia pasar pero se protege la salida
        try:
            number = float(value)
        except OverflowError as exc:
            raise ValueError("El resultado excede el rango numérico JSON soportado.") from exc
        if not math.isfinite(number) or (number == 0 and value != 0):
            raise ValueError("El resultado excede el rango numérico JSON soportado.")
        return number
    if isinstance(value, list):
        return [json_numbers(item) for item in value]
    if isinstance(value, dict):
        return {key: json_numbers(item) for key, item in value.items()}
    return value


# Ordena las llaves con la misma normalización usada para detectar duplicados.
def ordenar_llaves(request: AbbRequest) -> list:
    return sorted(request.llaves, key=lambda item: clave_alfabetica(item.llave))


# Asocia cada llave ordenada con su peso y sus probabilidades exacta y redondeada.
def describir_llaves(nombres: list[str], pesos: list[Fraction], probabilidades: list[Fraction | None]) -> list[dict]:
    total = sum(pesos)
    descripcion = []
    for posicion in range(1, len(nombres) + 1):
        descripcion.append({
            "posicion": posicion,
            "llave": nombres[posicion - 1],
            "peso": pesos[posicion - 1],
            "probabilidad": pesos[posicion - 1] / total,
            "probabilidadRedondeada": probabilidades[posicion],
        })
    return descripcion


# Coordina el cálculo y construye la respuesta sin la fila auxiliar cero.
def resolver_abb(request: AbbRequest) -> AbbResponse:
    llaves_ordenadas = ordenar_llaves(request)
    nombres = [item.llave for item in llaves_ordenadas]
    pesos = [Fraction(item.peso) for item in llaves_ordenadas]
    cantidad_llaves = len(nombres)

    solucion = solve(pesos)

    costo_promedio = solucion.tabla_a[1][cantidad_llaves]
    raiz = nombres[solucion.tabla_r[1][cantidad_llaves] - 1]
    conclusion = (f"El costo promedio mínimo de búsqueda es {float(costo_promedio):.2f} "
                  f"y la raíz del árbol óptimo es {raiz}.")

    # la fila 0 de las tablas no se usa y no se envia
    return AbbResponse.model_validate(json_numbers({
        "algoritmo": "abb-optimo",
        "resultado": {
            "costoPromedio": costo_promedio,
            "raiz": raiz,
            "llavesOrdenadas": describir_llaves(nombres, pesos, solucion.probabilidades),
            "conclusion": conclusion,
        },
        "tablas": {"A": solucion.tabla_a[1:], "R": solucion.tabla_r[1:]},
        "metadatos": {"filasDesde": 1, "columnasDesde": 0, "decimales": 2},
    }))