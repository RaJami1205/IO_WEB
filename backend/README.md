# IO WEB API — fundación P0

Requiere Python 3.12 o superior. La verificación local de esta fundación usa
Python 3.14. La API no necesita base de datos ni servicios externos.

## Entorno e instalación (PowerShell)

Desde la raíz del repositorio:

```powershell
cd backend
python --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Los comandos usan directamente el Python del entorno virtual, sin necesidad
de activar scripts ni cambiar la política de ejecución de PowerShell.
Para instalar solo ejecución, usa `-r requirements.txt`. El archivo de
desarrollo incluye el de ejecución. Ambos fijan versiones directas y
transitivas; no se deben instalar paquetes globalmente.

## Arranque

Desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Salud: http://127.0.0.1:8000/api/health — HTTP 200, `{"status":"ok"}`.
- Documentación: http://127.0.0.1:8000/docs.
- OpenAPI: http://127.0.0.1:8000/openapi.json.

## Pruebas

Desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip check
```

Las pruebas usan TestClient, sin servidor externo, y cubren el contrato
Pydantic, OpenAPI, documentación y CORS autorizado/no autorizado.
Las pruebas de Series Deportivas también verifican cálculos y reproducción de eventos.

Las pruebas de Mochila comparan el solver contra fuerza bruta en las tres variantes
y verifican la tabla de referencia, los empates y la reproducción de eventos.

Para ejecutar solo un módulo o un grupo de pruebas por nombre:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_mochila.py
.\.venv\Scripts\python.exe -m pytest -q tests/test_mochila.py -k empate
.\.venv\Scripts\python.exe -m pytest -v tests/test_mochila.py
```

## CORS

El origen predeterminado es `http://localhost:5173`. Para reemplazar la lista,
define `CORS_ORIGINS` antes de arrancar el servidor; usa orígenes separados
por comas, sin rutas ni barra final:

```powershell
$env:CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
```

Una cadena vacía no autoriza ningún origen. Para volver al valor predeterminado:

```powershell
Remove-Item Env:CORS_ORIGINS -ErrorAction SilentlyContinue
```

Se permiten GET y POST y el encabezado Content-Type para JSON, sin credenciales
ni comodines. El middleware responde a los preflight OPTIONS; permitir POST
en CORS no crea endpoints POST. CORS restringe el acceso desde navegadores,
no constituye autenticación. El futuro dominio real de Vercel se incorporará
explícitamente mediante esta variable; no hay producción configurada.

## Organización

`app/main.py` crea la aplicación y registra middleware y router;
`app/api/health.py` contiene el router y su modelo de respuesta;
`app/core/config.py` lee y valida los orígenes de CORS.

Los futuros algoritmos se ubicarán en `app/algoritmos/`, con `router.py`,
`schemas.py`, `service.py` y `solver.py` por módulo. Series Deportivas implementa
esta separación; no se anticipan carpetas ni contratos de los otros algoritmos.

## Series Deportivas (P2)

`POST /api/series-deportivas` recibe el contrato oficial y rechaza entradas
inválidas con HTTP 422. `ph` y `pr` son probabilidades de victoria de A como
local y visitante; no tienen que sumar 1. `formato` exige booleanos estrictos.

Ejemplo PowerShell con el servidor iniciado:

```powershell
$body = '{"algoritmo":"series-deportivas","juegos":7,"ph":0.58,"pr":0.45,"formato":[true,true,false,false,false,true,true]}'
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/series-deportivas' -ContentType 'application/json' -Body $body
```

```powershell
$body = @{
    algoritmo = "series-deportivas"
    juegos = 7
    ph = 0.58
    pr = 0.45
    formato = @($true, $true, $false, $false, $false, $true, $true)
} | ConvertTo-Json -Depth 5

$respuesta = Invoke-RestMethod `
    -Uri "http://127.0.0.1:8000/api/series-deportivas" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

$respuesta.resultado
$respuesta.tablas.F
$respuesta.pasos.Count
```

La respuesta incluye `resultado` (probabilidades, victorias necesarias y
conclusión), la matriz final directamente en `tablas.F`, `pasos` y metadatos
de los ejes. F(i,j) representa victorias restantes de A/B. Solo la conclusión
redondea porcentajes; la matriz y las probabilidades conservan los floats.

La simulación es opcional: desde celdas pendientes, aplicar únicamente
`cambios` en orden reconstruye F. Hay una inicialización, evaluación y
actualización por celda interior, y un resultado: `2*k*k+2` eventos.
Las evaluaciones aportan datos matemáticos, pero no escriben la celda destino.
Retroceder o reiniciar puede hacerse reproduciendo el prefijo de cambios.

Las referencias académicas disponibles son dos ejercicios del Quiz 6.
El caso JSON anterior es una referencia derivada, no un tercer ejercicio
de clase. Sigue pendiente documentar ese tercer ejercicio académico.

## Reemplazo de Equipos (P1)

`POST /api/reemplazo-equipos?offset=0&limite=100` conserva el cuerpo oficial:

```json
{
  "algoritmo": "reemplazo-equipos",
  "costoInicial": 500,
  "plazo": 5,
  "vidaUtil": 3,
  "periodos": [
    {"reventa": 400, "mantenimiento": 30},
    {"reventa": 300, "mantenimiento": 40},
    {"reventa": 250, "mantenimiento": 60}
  ]
}
```

```json
$body = @{
    algoritmo = "reemplazo-equipos"
    costoInicial = 500
    plazo = 5
    vidaUtil = 3
    periodos = @(
        @{ reventa = 400; mantenimiento = 30 }
        @{ reventa = 300; mantenimiento = 40 }
        @{ reventa = 250; mantenimiento = 60 }
    )
} | ConvertTo-Json -Depth 10

$respuesta = Invoke-RestMethod `
    -Uri "http://127.0.0.1:8000/api/reemplazo-equipos" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

$respuesta.resultado | ConvertTo-Json -Depth 10
$respuesta.tablas | ConvertTo-Json -Depth 10
$respuesta.pasos.Count

$pagina = Invoke-RestMethod `
    -Uri "http://127.0.0.1:8000/api/reemplazo-equipos?offset=1&limite=1" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

$pagina.resultado | ConvertTo-Json -Depth 10
```

Los modelos rechazan campos adicionales, booleanos numéricos, cadenas numéricas,
valores no finitos y dimensiones inválidas. Se admiten importes negativos y
reventas mayores que la adquisición: no se imponen supuestos económicos extra.
Los errores de validación de este endpoint conservan HTTP 422 y `detail` con
`loc`, `msg` y `type`; se omite la entrada inválida para no serializar NaN/Infinity.
Este tratamiento es local al módulo y no cambia Series Deportivas ni Health.

El solver puro calcula C(d), G(t), todas las decisiones empatadas y N(t), con
N(T)=1. El conteo usa enteros Python. Para la página, un DFS ordenado salta ramas
completas mediante N(t); nunca enumera todos los planes antes de aplicar offset.
`limite` va de 1 a 100; offset fuera del total devuelve una lista vacía.
El último instante del plan es el fin del horizonte, no un reemplazo adicional.

La aritmética utiliza `Fraction(str(numero))` de la biblioteca estándar:
representa exactamente los decimales interpretados por Python, sin redondeos
intermedios, contexto limitado de Decimal ni tolerancias para los empates.
Este endpoint lee los tokens fraccionarios JSON como Decimal antes de validar,
para conservar sus dígitos sin pasar por float. No acepta cadenas numéricas.
No puede recuperar precisión perdida previamente en el cliente que envía JSON.
Los enteros se conservan como enteros. En la frontera de salida, las fracciones
no enteras se convierten a float, con la aproximación binaria habitual de JSON
en el navegador. Se rechaza con 422 un resultado fraccionario que desborde a
infinito o se reduzca a cero por subdesbordamiento. Las decisiones y empates
se determinan antes de esta conversión. Los enteros fuera del rango seguro de
JavaScript pueden perder precisión al ser leídos por el cliente; este contrato
exige números JSON y no permite sustituirlos por cadenas.

La respuesta contiene directamente las tres tablas finales y la página de planes.
La reproducción opcional parte de listas pendientes y aplica solo `cambios`;
las evaluaciones no modifican tablas. Hay
`2*L + sum(min(L,T-t), t=0..T-1) + T + 3` eventos, incluidos reconstrucción y
resultado, sin duplicar los planes en la traza.

Referencias: el JSON oficial derivado produce costo 640, tres planes y 26 eventos;
el ejercicio manuscrito de clase produce costo 30400 y tres planes.
Faltan otros dos ejercicios realmente resueltos en clase para completar el
requisito académico. El caso cero de T=30/L=10 tiene 531372800 planes y se prueba
consultando páginas al inicio y al final.

## Problema de la Mochila (P5)

`POST /api/problema-mochila` recibe el contrato oficial:

```json
{
  "algoritmo": "mochila",
  "variante": "acotada",
  "capacidad": 15,
  "objetos": [
    { "nombre": "Linterna", "peso": 2, "valor": 10, "cantidad": 3 },
    { "nombre": "Agua",     "peso": 5, "valor": 18, "cantidad": 2 },
    { "nombre": "Botiquín", "peso": 4, "valor": 15, "cantidad": 1 }
  ]
}
```

`variante` es `"0-1"`, `"acotada"` o `"no-acotada"`. `capacidad` va de 1 a 20 y
`objetos` tiene de 1 a 10 elementos. `peso` es un entero positivo y `valor` un
número positivo de hasta 6 decimales y como máximo 10^12. `cantidad` son las
copias disponibles de cada objeto: es obligatoria en la variante acotada y se
ignora en las otras dos. Los nombres no pueden repetirse, sin distinguir
mayúsculas. Los modelos rechazan con 422 campos adicionales, booleanos
numéricos, cadenas numéricas y valores no finitos. Como en Reemplazo de Equipos,
`detail` conserva `loc`, `msg` y `type` y omite la entrada inválida.

Ejemplo PowerShell con el servidor iniciado:

```powershell
$body = @{
    algoritmo = "mochila"
    variante = "acotada"
    capacidad = 15
    objetos = @(
        @{ nombre = "Linterna"; peso = 2; valor = 10; cantidad = 3 }
        @{ nombre = "Agua"; peso = 5; valor = 18; cantidad = 2 }
        @{ nombre = "Botiquín"; peso = 4; valor = 15; cantidad = 1 }
    )
} | ConvertTo-Json -Depth 10

$respuesta = Invoke-RestMethod `
    -Uri "http://127.0.0.1:8000/api/problema-mochila" `
    -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($body))

$respuesta.resultado | ConvertTo-Json -Depth 10
$respuesta.tablas.V | ConvertTo-Json -Compress
$respuesta.pasos.Count
```

El cuerpo se envía como bytes UTF-8 para que los acentos, como en "Botiquín",
lleguen correctamente desde Windows PowerShell.

V(c, j) es el mejor valor con capacidad c usando los objetos 1..j:
V(c, j) = max_k [k·v_j + V(c − k·w_j, j − 1)]. La variante solo cambia el
máximo de copias k: 1 en 0/1, `cantidad` en acotada y sin tope en no acotada.
La tabla se llena columna por columna y la solución se reconstruye desde
V(C, n) hacia atrás.

La respuesta incluye:

- `resultado`: valor óptimo, peso usado, la selección con copias, peso y valor
  de cada objeto, `hayEmpates` y la conclusión.
- `tablas`: `V` con los valores, `decision` con las copias k de cada casilla,
  `opciones` con los k empatados y `marca`. Las filas son la capacidad 0..C y
  las columnas son los objetos, donde la columna 0 significa "sin objetos".
- `pasos` y `metadatos` de los ejes.

`marca` es `verde` si la casilla usa el objeto de su columna (k ≥ 1) y `rojo` si
copia el valor de la izquierda (k = 0). Ante un empate se elige el menor k: la
casilla queda en rojo y se informa `hayEmpates` si el empate afecta a la
solución final. No se paginan soluciones alternativas.

La aritmética usa `Fraction` y los tokens JSON se leen como Decimal, igual que
en Reemplazo de Equipos, así que los empates se detectan sin tolerancias. En la
salida, las fracciones no enteras se convierten a float. Desde celdas
pendientes, aplicar solo `cambios` en orden reconstruye V. Hay
`2 + 2·C·n + n + 1` eventos: dos de inicialización, una evaluación y una
actualización por casilla, una reconstrucción por objeto y el resultado.

Referencias: el JSON oficial produce 43 en 0/1, 63 en acotada y 70 en no acotada,
con 96 eventos. El caso 0/1 con C = 4, A (2, 5), B (2, 5) y C (4, 10) tiene un
empate y devuelve {A, B}. Falta contrastar el módulo con ejercicios resueltos en clase.