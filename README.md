<h1 align="center">💻 IO WEB</h1>
<p align="center"><strong>Simulador interactivo de Programación Dinámica</strong></p>
<p align="center">Investigación de Operaciones · Tecnológico de Costa Rica · 2026</p>

<p align="center">Una herramienta educativa para explorar <strong>cinco algoritmos de Programación Dinámica</strong>: ingresar problemas, visualizar tablas y comprender soluciones. La técnica reutiliza resultados de subproblemas para calcular probabilidades y encontrar decisiones óptimas.</p>


<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&amp;logo=react&amp;logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&amp;logo=vite&amp;logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&amp;logo=fastapi&amp;logoColor=white" alt="FastAPI">
</p>


<p align="center">
  <a href="https://io-web-tau.vercel.app"><strong>App Desplegada</strong></a>
</p>

<p align="center">
  <img src="assets/panel.png" alt="Panel principal de IO WEB con estado del servidor y navegación a los cinco algoritmos" width="100%">
</p>

---

## 📑 Contenido

- [Características principales](#caracteristicas)
- [Algoritmos implementados](#algoritmos)
- [Arquitectura del sistema](#arquitectura)
- [Tecnologías y herramientas](#tecnologias)
- [Estructura del proyecto](#estructura)
- [Requisitos e instalación](#instalacion)
- [Ejecución con un solo comando](#ejecucion)
- [API REST](#api)
- [Pruebas y calidad](#pruebas)
- [Flujo Git y GitHub](#git)
- [Uso responsable de IA](#ia)
- [Equipo y documentación](#equipo)

---

<a id="caracteristicas"></a>

## ✨ Características principales

- Formularios por algoritmo, validación de entradas y carga/guardado de configuraciones JSON.
- Tablas, resultados y conclusiones calculados por el backend.
- Revelado progresivo de tablas en Series, ABB y Matrices; la presentación varía por módulo y no constituye un reproductor uniforme de trazas.
- Menú común con indicador de disponibilidad del servidor.
- API REST, pruebas automatizadas y arranque de desarrollo desde una sola terminal.

---

<a id="algoritmos"></a>

## 🧠 Algoritmos implementados

| Algoritmo | Objetivo | Resultado principal |
| --- | --- | --- |
| Series Deportivas | Calcular la probabilidad de ganar una serie considerando el orden de localías. | Probabilidades de ambos equipos y tabla F. |
| Reemplazo de Equipos | Minimizar el costo de adquisición, mantenimiento y reventa durante un horizonte. | Costo mínimo, tabla G y planes óptimos; la API permite consultar los planes por páginas. |
| Problema de Mochila | Maximizar el valor bajo una capacidad, en variantes 0-1, acotada y no acotada. | Valor óptimo, objetos y cantidades elegidos, tablas de valores y decisiones. |
| Árbol Binario de Búsqueda Óptimo | Minimizar el costo promedio de búsqueda según los pesos de las llaves. | Tablas A y R, costo y raíz; utiliza probabilidades redondeadas a dos decimales según la convención implementada. |
| Multiplicación Óptima de Matrices | Elegir el orden de una cadena de multiplicaciones con menor costo escalar. | Tablas M y P, costo mínimo y parentización óptima. |

---

<a id="arquitectura"></a>

## 🏗️ Arquitectura del sistema

El monorepositorio separa la interfaz y una API sin base de datos. El cálculo matemático permanece en el backend, independiente de su presentación.

```text
Usuario / Navegador
         │
         ▼
React + TypeScript
         │  HTTP / JSON
         ▼
Proxy Vite (/api) · Desarrollo
         │
         ▼
FastAPI + Pydantic
         │
         ▼
Router → Service → Solver Python
         │
         ▼
Resultados JSON → Interfaz React
```

**Frontend:** formularios, validación inmediata, interacción y visualización. React comparte la plantilla de navegación y mantiene vistas por algoritmo.

**Backend:** recepción, validación definitiva, coordinación y Programación Dinámica. Las funciones y módulos cuentan con documentación interna.

| Archivo por algoritmo | Responsabilidad |
| --- | --- |
| `router.py` | Recibir solicitudes HTTP y delegarlas al servicio. |
| `schemas.py` | Definir contratos y validar entradas y respuestas con Pydantic. |
| `service.py` | Coordinar el cálculo y serializar la respuesta. |
| `solver.py` | Resolver el problema matemático en Python. |

**Comunicación:** el cliente intercambia JSON por HTTP. Durante el desarrollo, Vite reenvía `/api` a `http://127.0.0.1:8000`.

---

<a id="tecnologias"></a>

## 🛠️ Tecnologías y herramientas

| Responsabilidad | Herramientas |
| --- | --- |
| Interfaz y navegación | React, TypeScript, React Router, Vite, CSS |
| API y cálculo | Python, FastAPI, Pydantic, Uvicorn |
| Pruebas y calidad | pytest, HTTPX/TestClient, Vitest, Testing Library, jsdom, ESLint, compilador TypeScript |
| Desarrollo y colaboración | Node.js, npm, Git, GitHub, GitHub Actions |

---

<a id="estructura"></a>

## 📂 Estructura del proyecto

```text
IO_WEB/
├── assets/panel.png
├── backend/
│   ├── app/
│   │   ├── algoritmos/      # Cinco módulos con router, schemas, service y solver
│   │   ├── api/            # Health
│   │   ├── core/           # Configuración CORS
│   │   └── main.py
│   ├── tests/
│   └── README.md
├── frontend/src/
│   ├── componentes/        # Menú, formularios y resultados
│   ├── estilos/
│   ├── pruebas json/       # Archivos de ejemplo y referencias
│   └── tests/
├── scripts/dev.mjs
├── .github/workflows/
├── CONTRIBUTING.md
├── package.json
└── README.md
```

---

<a id="instalacion"></a>

## ⚙️ Requisitos e instalación

### 1. Requisitos

- Git para clonar el repositorio.
- **Node.js 22.12.0 o superior**, con npm, según el lanzador raíz. CI utiliza Node.js 24.
- **Python 3.12 o superior**, disponible como `python` en Windows o `python3` en Linux/macOS.
- Puertos **8000** y **5173** disponibles.

### 2. Preparación inicial

```sh
git clone https://github.com/RaJami1205/IO_WEB.git
cd IO_WEB
```

### 3. Instalación de dependencias

Desde la raíz, instala las dependencias del frontend:

```sh
npm --prefix frontend ci
```

Luego crea el entorno e instala las dependencias Python, incluidas las herramientas de pruebas.

**Windows / PowerShell:**

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
```

**Linux / macOS:**

```sh
python3 -m venv backend/.venv
./backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
```

No es necesario activar el entorno virtual. `requirements-dev.txt` incluye `requirements.txt`; este último basta para ejecutar sin herramientas de pruebas. La raíz no tiene dependencias npm que instalar.

---

<a id="ejecucion"></a>

## 🚀 Ejecución con un solo comando

### Arranque

Después de la preparación, ejecuta desde la raíz:

```sh
npm run dev
```

El lanzador nativo de Node.js comprueba los entornos y puertos, inicia FastAPI con recarga y espera su health. Luego inicia Vite con puerto estricto, verifica la interfaz y el health a través del proxy y muestra las URLs. No instala dependencias automáticamente.

### URLs disponibles

| Recurso | Dirección local |
| --- | --- |
| Interfaz | [localhost:5173](http://localhost:5173) |
| Dirección base de la API | [127.0.0.1:8000](http://127.0.0.1:8000) |
| Swagger UI | [127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| Health | [127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) |

### Cierre y supervisión

Frontend y backend siguen siendo procesos separados, administrados desde una terminal. **Pulsa Ctrl+C para solicitar el cierre de ambos.** El lanzador supervisa los procesos y la salud del proxy, y cierra los servicios propios ante un fallo.

Uvicorn conserva sus mensajes de inicio, advertencias y errores, con el registro de accesos desactivado para evitar ruido por las consultas de salud.

Si un puerto está ocupado, el arranque se rechaza sin cerrar al ocupante. El plazo de disponibilidad es de 30 segundos por servicio.

El cierre real con Ctrl+C y el reinicio deben comprobarse en la terminal de destino; no se garantiza la limpieza tras terminar abruptamente el proceso padre. El manejo de grupos y señales de Linux/macOS no se ha validado experimentalmente en esta revisión.

### Ejecución independiente

El frontend también puede iniciarse por separado con `npm --prefix frontend run dev`; necesita la API activa para resolver problemas. El arranque independiente de la API se describe en [backend/README.md](backend/README.md).

---

<a id="despliegue"></a>

## 🚀 Despliegue en Producción

### Frontend — Vercel

La interfaz, desarrollada con **React, TypeScript y Vite**, está alojada en Vercel y disponible en [App Desplegada](https://io-web-tau.vercel.app). La versión pública se publica desde la versión consolidada en la rama `main`.

### Backend — Render

La API, desarrollada con **Python y FastAPI**, está alojada en Render como un **Web Service**. Su dirección base es [https://io-web-backend.onrender.com](https://io-web-backend.onrender.com); su disponibilidad puede consultarse en el [endpoint de salud `/api/health`](https://io-web-backend.onrender.com/api/health).

### Comunicación entre servicios

```text
Usuario → Vercel (React) → Proxy /api → Render (FastAPI)
```

El usuario accede a la aplicación en Vercel. React realiza solicitudes a rutas relativas del origen actual, como `/api/health`, y Vercel las reenvía a Render mediante las rewrites de [frontend/vercel.json](frontend/vercel.json). FastAPI procesa las solicitudes de los cinco algoritmos y devuelve las respuestas que el frontend presenta al usuario.

### Modalidad de despliegue

**GitHub Actions ejecuta las validaciones de integración continua; los despliegues a producción se realizan manualmente.** No se implementó una automatización de CD para publicar cada cambio. Render mantiene **Auto-Deploy desactivado** y la configuración de Vercel deshabilita los despliegues automáticos desde Git mediante `git.deploymentEnabled: false`.

El backend en el plan gratuito de Render puede necesitar un tiempo de reactivación después de un periodo de inactividad. La aplicación contempla verificaciones de conectividad y una espera controlada.

---

<a id="api"></a>

## 🔌 API REST

Con el backend iniciado, [Swagger UI](http://127.0.0.1:8000/docs) permite consultar y probar los contratos actuales; [OpenAPI](http://127.0.0.1:8000/openapi.json) expone sus esquemas.

| Recurso | Método | Endpoint |
| --- | --- | --- |
| Salud | GET | `/api/health` |
| Series Deportivas | POST | `/api/series-deportivas` |
| Reemplazo de Equipos | POST | `/api/reemplazo-equipos` |
| Mochila | POST | `/api/problema-mochila` |
| ABB Óptimo | POST | `/api/abb-optimo` |
| Multiplicación de Matrices | POST | `/api/multiplicacion-matrices` |

Health responde `{"status":"ok"}`. Los solucionadores reciben configuraciones JSON y devuelven resultados y tablas; los detalles adicionales dependen del módulo. Las entradas inválidas se rechazan con HTTP 422. El [README del backend](backend/README.md) contiene ejemplos y convenciones de varios módulos; para el contrato completo vigente, consulta Swagger.

---

<a id="pruebas"></a>

## 🧪 Pruebas y calidad

### Backend

Desde la raíz:

```powershell
# Windows / PowerShell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
cd ..
```

En Linux/macOS, dentro de `backend/`, utiliza `./.venv/bin/python -m pytest -q`. Las pruebas cubren validación, endpoints, resultados matemáticos, casos límite y, según el módulo, reconstrucción de tablas y comparación con enumeraciones independientes.

### Frontend

Desde la raíz, en cualquiera de los sistemas:

```sh
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Vitest y Testing Library verifican validaciones y carga de configuraciones en los componentes. ESLint revisa el código; el build comprueba TypeScript y genera la distribución con Vite. Estas comprobaciones se complementan con pruebas manuales de navegación, resolución de ejercicios y cierre/reinicio del lanzador.

---

<a id="git"></a>

## 🌿 Flujo Git y GitHub

```text
feature/*  ── Pull Request ──>  dev  ── Pull Request ──>  main
```

Las ramas `feature/*` aíslan los cambios; `dev` integra y valida el trabajo conjunto; `main` reúne las versiones consolidadas.

**Política de revisión.** El equipo establece revisión de código, una aprobación hacia `dev`, dos hacia `main`, checks obligatorios, conversaciones resueltas y rama actualizada cuando se requiera. También establece proteger `dev` y `main` frente a pushes directos y cambios que eludan la revisión.

### Checks configurados

Los workflows presentes definen:

- **`frontend-quality`**: instalación reproducible, lint, build y pruebas con Node.js 24.
- **`backend-quality`**: instalación, `pip check` y pytest con Python 3.12.
- **`branch-policy`**: admite únicamente PR de `feature/*` a `dev` y de `dev` a `main`.

La presencia de estos workflows confirma las comprobaciones configuradas, no su último resultado ni la activación de protecciones remotas. Las reglas efectivas deben consultarse en GitHub. Véanse [CI](.github/workflows/ci.yml), [política de PR](.github/workflows/pr-policy.yml) y [guía de contribución](CONTRIBUTING.md).

---

<a id="ia"></a>

## 🤖 Uso responsable de IA

Las **herramientas de IA** apoyaron el análisis conceptual y matemático, la revisión de enfoques e implementaciones, la identificación de casos límite, las pruebas, la depuración y la documentación. Su asistencia incluyó propuestas de implementación y verificación.

**Responsabilidad del equipo.** Los integrantes definieron los requisitos y mantuvieron las decisiones de diseño, la revisión del código, la integración y la aceptación de cambios.

**Validación y comprensión.** Los resultados se contrastaron con ejercicios disponibles y pruebas independientes. Las propuestas de IA se evaluaron dentro de ese proceso; cada integrante conserva la responsabilidad de comprender, explicar y validar el código que presenta.

---

<a id="equipo"></a>

## 👥 Equipo y documentación

Proyecto académico desarrollado por **Raul, Elder y Diego**, según los créditos de la aplicación, para Investigación de Operaciones en el **Tecnológico de Costa Rica**.

- [Repositorio IO WEB](https://github.com/RaJami1205/IO_WEB).
- [Documentación del backend](backend/README.md): instalación independiente, CORS y ejemplos de solicitudes y respuestas.
- [Contribución](CONTRIBUTING.md): flujo de colaboración y responsabilidades de revisión.
- [Archivos JSON de prueba](frontend/src/pruebas%20json): ejemplos de entrada y casos inválidos organizados por problema.

Los documentos de backend y contribución conservan algunas notas históricas de fases iniciales; la estructura, comandos y checks actuales se resumen aquí y se pueden contrastar con el código y los workflows enlazados.
