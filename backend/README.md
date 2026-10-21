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
