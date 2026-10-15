# Contribuir a IO WEB

## Ramas y Pull Requests

El único flujo permitido es `feature/*` → `dev` → `main`, siempre mediante
Pull Requests. Crea las ramas de trabajo desde `dev`, con nombres descriptivos
en minúsculas y palabras separadas por guiones, por ejemplo
`feature/bootstrap-project` o `feature/reemplazo-equipos`.
No se utilizan ramas `release/*` ni se permite saltar la integración en `dev`.

Están prohibidos los pushes directos a `dev` y `main`, los force pushes y
eludir las protecciones. Mantén los cambios acotados y completa la plantilla
del PR con alcance, archivos afectados y resultados de validación.

## Revisión y validación

Antes del merge, revisa el diff, resuelve las conversaciones y comprueba que
las validaciones aplicables pasan. El objetivo de revisión del equipo es
una aprobación hacia `dev` y dos hacia `main`; su exigencia remota debe
verificarse cuando se incorporen los revisores.

El workflow CI configura Node.js 24 y ejecuta en `frontend/`, en cada push
y PR, `npm ci`, `npm run lint` y `npm run build`. El check se llama
`frontend-quality`. El workflow PR policy valida el origen y destino con
el check `branch-policy`, incluido cuando se cambia el destino del PR.

Estos workflows no configuran protecciones remotas. Después de comprobar
su ejecución en GitHub, queda pendiente exigir ambos checks en las ramas
protegidas. Actualmente no hay backend ni suites de pruebas configuradas:
lint y build no sustituyen las pruebas funcionales. Las pruebas de ambas
capas se incorporarán cuando existan, conforme a los requisitos académicos.

## Arquitectura y alcance

React y TypeScript capturan, validan y presentan resultados. Los algoritmos
y las trazas se calculan exclusivamente en Python/FastAPI. Conserva los
endpoints y esquemas JSON oficiales; contrasta las convenciones matemáticas
pendientes con los materiales de clase antes de implementarlas.

La fase inicial se limita a infraestructura y preparación. El desarrollo
funcional requiere una tarea autorizada con alcance definido.

## Seguridad y uso de IA

No publiques secretos, tokens, credenciales ni archivos `.env`. No incluyas
`AGENTS.md` en commits, PR, entregas o despliegues, ni fuerces su inclusión.
Las variables `VITE_*` son públicas para el navegador y no deben contener
secretos. Revisa también los registros y ejemplos antes de compartirlos.

Cada integrante es responsable de revisar, validar y comprender el código
desarrollado con IA, poder explicarlo y modificarlo durante la defensa oral,
y documentar su uso en la declaración de IA del proyecto.
