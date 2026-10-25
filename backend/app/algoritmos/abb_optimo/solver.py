import math
from dataclasses import dataclass
from fractions import Fraction


@dataclass
class Solution:
    tabla_a: list[list[Fraction | None]]
    tabla_r: list[list[int | None]]
    probabilidades: list[Fraction | None]


def crear_tablas(cantidad_llaves: int) -> tuple[list[list[Fraction | None]], list[list[int | None]]]:
    #crea A y R con la diagonal de ceros

    cantidad_filas = cantidad_llaves + 2
    cantidad_columnas = cantidad_llaves + 1

    tabla_a = []
    tabla_r = []
    for _ in range(cantidad_filas):
        tabla_a.append([None] * cantidad_columnas)
        tabla_r.append([None] * cantidad_columnas)

    for inicio in range(1, cantidad_llaves + 2):
        tabla_a[inicio][inicio - 1] = Fraction(0)

    return tabla_a, tabla_r


def redondear_probabilidad(peso: Fraction, total: Fraction) -> Fraction:
    #devuelve peso / total redondeado a dos decimales 

    probabilidad = peso / total
    centesimas = probabilidad * 100
    centesimas_redondeadas = math.floor(centesimas + Fraction(1, 2))
    return Fraction(centesimas_redondeadas, 100)


def llenar_diagonal(tabla_a: list[list[Fraction | None]], tabla_r: list[list[int | None]],
                    probabilidades: list[Fraction | None], cantidad_llaves: int) -> None:
    for llave in range(1, cantidad_llaves + 1):
        tabla_a[llave][llave] = probabilidades[llave]
        tabla_r[llave][llave] = llave


def suma_probabilidades(probabilidades: list[Fraction | None], inicio: int, fin: int) -> Fraction:
    """devuelve p_inicio + .. + p_fin"""
    total = Fraction(0)
    for llave in range(inicio, fin + 1):
        total = total + probabilidades[llave]
    return total


def evaluar_casilla(tabla_a: list[list[Fraction | None]], probabilidades: list[Fraction | None],
                    inicio: int, fin: int) -> tuple[Fraction, int, list[tuple[int, Fraction]]]:
    #prueba cada raiz de inicio a fin y elige la de menor costo

    peso_subarbol = suma_probabilidades(probabilidades, inicio, fin)
    candidatos = []
    mejor_costo = None
    mejor_raiz = None

    for raiz in range(inicio, fin + 1):
        costo_izquierdo = tabla_a[inicio][raiz - 1]
        costo_derecho = tabla_a[raiz + 1][fin]
        costo = costo_izquierdo + costo_derecho + peso_subarbol
        candidatos.append((raiz, costo))

        # el menor estricto conserva la primera raiz cuando hay empate
        if mejor_costo is None or costo < mejor_costo:
            mejor_costo = costo
            mejor_raiz = raiz

    return mejor_costo, mejor_raiz, candidatos


def llenar_tablas(tabla_a: list[list[Fraction | None]], tabla_r: list[list[int | None]],
                  probabilidades: list[Fraction | None], cantidad_llaves: int) -> None:
    """llena A y R por grupos de 2 3 .. n llaves
    un subarbol de cierto tamano solo depende de subarboles mas pequenos
    que ya se calcularon en los grupos anteriores
    """
    for tamano_grupo in range(2, cantidad_llaves + 1):
        ultimo_inicio = cantidad_llaves - tamano_grupo + 1

        for inicio in range(1, ultimo_inicio + 1):
            fin = inicio + tamano_grupo - 1
            mejor_costo, mejor_raiz, candidatos = evaluar_casilla(tabla_a, probabilidades, inicio, fin)
            tabla_a[inicio][fin] = mejor_costo
            tabla_r[inicio][fin] = mejor_raiz


def solve(pesos: list[Fraction]) -> Solution:
    #resuelve el arbol optimo a partir de los pesos ya ordenados alfabeticamente
    cantidad_llaves = len(pesos)
    total = sum(pesos)

    probabilidades = [None]
    for peso in pesos:
        probabilidad = redondear_probabilidad(peso, total)
        probabilidades.append(probabilidad)

    tabla_a, tabla_r = crear_tablas(cantidad_llaves)
    llenar_diagonal(tabla_a, tabla_r, probabilidades, cantidad_llaves)
    llenar_tablas(tabla_a, tabla_r, probabilidades, cantidad_llaves)
    return Solution(tabla_a, tabla_r, probabilidades)