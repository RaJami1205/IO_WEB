# Prepara los límites de cada variante y transforma la solución de mochila en respuesta HTTP.
import math
from fractions import Fraction

from app.algoritmos.problema_mochila.schemas import MochilaRequest, MochilaResponse
from app.algoritmos.problema_mochila.solver import solve


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


# Traduce la variante a un límite de copias por objeto; None indica ausencia de tope.
def topes_por_variante(request: MochilaRequest) -> list[int | None]:
    if request.variante == "0-1":
        return [1] * len(request.objetos)
    if request.variante == "acotada":
        return [objeto.cantidad for objeto in request.objetos]
    return [None] * len(request.objetos)


# Describe únicamente los objetos elegidos, con sus copias y totales de peso y valor.
def armar_seleccion(request: MochilaRequest, valores: list[Fraction], copias_elegidas: list[int]) -> list[dict]:
    seleccion = []
    for posicion, copias in enumerate(copias_elegidas):
        if copias == 0:
            continue
        objeto = request.objetos[posicion]
        seleccion.append({
            "indice": posicion + 1,
            "nombre": objeto.nombre,
            "cantidad": copias,
            "pesoTotal": copias * objeto.peso,
            "valorTotal": copias * valores[posicion],
        })
    return seleccion


# Invoca el solver con valores exactos y construye la selección, tablas y conclusión.
def resolver_mochila(request: MochilaRequest) -> MochilaResponse:
    capacidad_total = request.capacidad
    cantidad_objetos = len(request.objetos)

    nombres = []
    pesos = []
    valores = []
    for objeto in request.objetos:
        nombres.append(objeto.nombre)
        pesos.append(objeto.peso)
        valores.append(Fraction(objeto.valor))

    topes = topes_por_variante(request)
    solucion = solve(capacidad_total, pesos, valores, topes)

    seleccion = armar_seleccion(request, valores, solucion.copias_elegidas)
    valor_optimo = solucion.tabla_valores[capacidad_total][cantidad_objetos]
    peso_usado = 0
    for item in seleccion:
        peso_usado = peso_usado + item["pesoTotal"]

    if seleccion:
        conclusion = (f"Con capacidad {capacidad_total} el valor máximo es {json_numbers(valor_optimo)}, "
                      f"usando {peso_usado} unidades de peso.")
    else:
        conclusion = f"Ningún objeto cabe en la mochila de capacidad {capacidad_total}. El valor máximo es 0."

    respuesta = {
        "algoritmo": "mochila",
        "resultado": {
            "valorOptimo": valor_optimo,
            "pesoUsado": peso_usado,
            "seleccion": seleccion,
            "hayEmpates": solucion.hay_empates,
            "conclusion": conclusion,
        },
        "tablas": {
            "V": solucion.tabla_valores,
            "decision": solucion.tabla_copias,
            "opciones": solucion.tabla_opciones,
            "marca": solucion.tabla_marcas,
        },
        "metadatos": {
            "variante": request.variante,
            "ejeFilas": "capacidad",
            "ejeColumnas": "objeto",
            "indicesDesde": 0,
            "objetos": nombres,
        },
    }
    return MochilaResponse.model_validate(json_numbers(respuesta))