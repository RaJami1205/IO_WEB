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
No son pruebas de algoritmos ni están integradas todavía en GitHub Actions.

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
`schemas.py`, `service.py` y `solver.py` por módulo. Esta fundación no crea
esas carpetas ni fija contratos de tablas, pasos o resultados P1–P5.
