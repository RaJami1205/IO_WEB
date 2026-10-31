# Maximiza el valor de la mochila por capacidad y objeto, con aritmética exacta.
# Los topes de copias permiten resolver las tres variantes con la misma recurrencia.
from dataclasses import dataclass, field
from fractions import Fraction


# Conserva valores, decisiones, empates y las copias reconstruidas de la solución.
@dataclass
class Solution:
    tabla_valores: list[list[Fraction]]
    tabla_copias: list[list[int]]
    tabla_opciones: list[list[list[int]]]
    tabla_marcas: list[list[str]]
    copias_elegidas: list[int] = field(default_factory=list)
    hay_empates: bool = False


# Limita las copias por la capacidad disponible y el tope de la variante.
def copias_maximas(capacidad: int, peso: int, tope: int | None) -> int:
    copias_que_caben = capacidad // peso
    if tope is None:
        return copias_que_caben
    return min(tope, copias_que_caben)


def evaluar_celda(solucion: Solution, capacidad: int, objeto: int, peso: int,
                  valor: Fraction, tope: int | None) -> None:
    """prueba cada cantidad de copias y guarda la mejor en la casilla V(capacidad, objeto)
    el total de cada candidato es copias * valor + V(capacidad restante, objeto anterior)
    ante empate gana la menor cantidad de copias
    """
    tabla_valores = solucion.tabla_valores
    limite_copias = copias_maximas(capacidad, peso, tope)
    mejor_valor = None
    copias_empatadas = []

    for copias in range(limite_copias + 1):
        capacidad_restante = capacidad - copias * peso
        valor_objeto = copias * valor
        valor_anterior = tabla_valores[capacidad_restante][objeto - 1]
        total = valor_objeto + valor_anterior

        # el mayor estricto conserva la menor cantidad de copias cuando hay empate
        if mejor_valor is None or total > mejor_valor:
            mejor_valor = total
            copias_empatadas = [copias]
        elif total == mejor_valor:
            copias_empatadas.append(copias)

    copias_elegidas = copias_empatadas[0]
    tabla_valores[capacidad][objeto] = mejor_valor
    solucion.tabla_copias[capacidad][objeto] = copias_elegidas
    solucion.tabla_opciones[capacidad][objeto] = copias_empatadas
    if copias_elegidas > 0:
        solucion.tabla_marcas[capacidad][objeto] = "verde"
    else:
        solucion.tabla_marcas[capacidad][objeto] = "rojo"


# Recorre las decisiones desde V(C,n) para recuperar copias y detectar empates del plan.
def reconstruir(solucion: Solution, capacidad_total: int, pesos: list[int]) -> None:
    cantidad_objetos = len(pesos)
    solucion.copias_elegidas = [0] * cantidad_objetos
    capacidad = capacidad_total

    for objeto in range(cantidad_objetos, 0, -1):
        copias = solucion.tabla_copias[capacidad][objeto]
        solucion.copias_elegidas[objeto - 1] = copias

        # un empate en el camino significa que hay otra solucion con el mismo valor
        if len(solucion.tabla_opciones[capacidad][objeto]) > 1:
            solucion.hay_empates = True

        capacidad = capacidad - copias * pesos[objeto - 1]


# Llena las tablas por objeto y reconstruye una selección de valor máximo.
def solve(capacidad_total: int, pesos: list[int], valores: list[Fraction],
          topes: list[int | None]) -> Solution:
    cantidad_filas = capacidad_total + 1
    cantidad_columnas = len(pesos) + 1

    tabla_valores = []
    tabla_copias = []
    tabla_opciones = []
    tabla_marcas = []
    for _ in range(cantidad_filas):
        tabla_valores.append([Fraction(0)] * cantidad_columnas)
        tabla_copias.append([0] * cantidad_columnas)
        tabla_opciones.append([[0] for _ in range(cantidad_columnas)])
        tabla_marcas.append(["rojo"] * cantidad_columnas)

    solucion = Solution(tabla_valores, tabla_copias, tabla_opciones, tabla_marcas)

    # se llena columna por columna porque cada objeto solo depende del anterior
    for objeto in range(1, cantidad_columnas):
        for capacidad in range(1, cantidad_filas):
            evaluar_celda(solucion, capacidad, objeto, pesos[objeto - 1],
                          valores[objeto - 1], topes[objeto - 1])

    reconstruir(solucion, capacidad_total, pesos)
    return solucion