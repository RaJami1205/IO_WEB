// Inicia Vite y FastAPI con sus entornos locales y supervisa disponibilidad y cierre.
import { spawn, spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const windows = process.platform === 'win32';
const python = join(backend, '.venv', windows ? 'Scripts' : 'bin', windows ? 'python.exe' : 'python');
const vite = join(frontend, 'node_modules', 'vite', 'bin', 'vite.js');
const backendUrl = 'http://127.0.0.1:8000';
const frontendUrl = 'http://localhost:5173';
const startupTimeout = 30_000;
const cancellation = new AbortController();
const services = [];
let shutdown;

// Comprueba rutas concretas sin instalar ni sustituir los entornos del proyecto.
async function requirePath(path, directory, message) {
  const info = await stat(path).catch(() => null);
  if (!info || (directory ? !info.isDirectory() : !info.isFile())) {
    throw new Error(message);
  }
}

// Verifica versiones, carpetas y dependencias antes de crear servidores.
async function checkPrerequisites() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error('Se requiere Node.js 22.12.0 o superior.');
  }
  await requirePath(backend, true, 'No existe la carpeta backend.');
  await requirePath(frontend, true, 'No existe la carpeta frontend.');
  await requirePath(python, false, 'No existe el intérprete del entorno virtual en backend/.venv. Consulta backend/README.md.');
  await requirePath(vite, false, 'No se encontró Vite. Instala previamente las dependencias desde frontend/.');
  const result = spawnSync(python, ['-B', '-c',
    'import sys; assert sys.version_info >= (3, 12), "Se requiere Python 3.12+"; import uvicorn, fastapi, pydantic'], {
    cwd: backend, shell: false, encoding: 'utf8', timeout: 10_000, windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error('No se pudo comprobar Python 3.12+ y las dependencias del backend. Revisa backend/.venv y requirements.txt.');
  }
}

// Prueba el enlace del puerto y lo libera; los errores reales del servidor siguen supervisados.
async function checkPort(host, port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', (error) => reject(new Error(
      error.code === 'EADDRINUSE'
        ? `El puerto ${port} (${host}) está ocupado. No se cerrará el proceso que lo utiliza.`
        : `No se pudo comprobar ${host}:${port}: ${error.message}`,
    )));
    server.listen({ host, port, exclusive: true }, () => server.close(resolvePort));
  });
}

// Inicia un servicio sin shell y conserva su PID y confirmación de salida.
function startService(name, executable, args, cwd) {
  cancellation.signal.throwIfAborted();
  console.log(`${name}: iniciando...`);
  const child = spawn(executable, args, {
    cwd, shell: false, stdio: 'inherit', detached: !windows, windowsHide: true,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
  });
  const service = { name, child, ended: false };
  services.push(service);
  service.done = new Promise((resolveDone) => {
    child.once('error', (error) => {
      service.ended = true;
      resolveDone();
      if (!shutdown) void stop(1, `${name}: no se pudo iniciar: ${error.message}`);
    });
    child.once('exit', (code, signal) => {
      service.ended = true;
      resolveDone();
      if (!shutdown) {
        void stop(code && code > 0 ? code : 1,
          `${name} terminó inesperadamente (${signal ?? `código ${code}`}).`);
      }
    });
  });
  return service;
}

// Comprueba HTTP con cancelación y un tiempo máximo por consulta.
async function available(url, health = false) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(1500)]),
      redirect: 'error',
    });
    if (health) return response.status === 200 && (await response.json()).status === 'ok';
    const ok = response.status === 200;
    await response.body?.cancel();
    return ok;
  } catch {
    return false;
  }
}

// Espera respuestas HTTP correctas sin confundir un proceso creado con un servidor listo.
async function waitReady(service, checks) {
  const deadline = Date.now() + startupTimeout;
  while (Date.now() < deadline) {
    cancellation.signal.throwIfAborted();
    if (service.ended) throw new Error(`${service.name} terminó durante el arranque.`);
    if ((await Promise.all(checks.map(([url, health]) => available(url, health)))).every(Boolean)) {
      // Da margen a un fallo de enlace del hijo para no aceptar un servidor ajeno en una carrera.
      await delay(300, undefined, { signal: cancellation.signal });
      if (!service.ended) {
        console.log(`${service.name}: disponible.`);
        return;
      }
    }
    await delay(250, undefined, { signal: cancellation.signal });
  }
  throw new Error(`${service.name} no estuvo disponible en ${startupTimeout / 1000} segundos. Revisa sus mensajes.`);
}

// Detecta caídas persistentes del trabajador de Uvicorn, tolerando recargas breves.
async function monitorHealth() {
  let unavailableSince;
  while (!cancellation.signal.aborted) {
    await delay(2000, undefined, { signal: cancellation.signal });
    const healthy = await available(`${frontendUrl}/api/health`, true);
    if (healthy) unavailableSince = undefined;
    else {
      unavailableSince ??= Date.now();
      if (Date.now() - unavailableSince >= startupTimeout) {
        throw new Error('La API o su proxy llevan 30 segundos sin responder correctamente.');
      }
    }
  }
}

// Envía señales únicamente al grupo creado para este servicio en Linux/macOS.
function signalGroup(service, signal) {
  if (!service.child.pid) return;
  try {
    process.kill(-service.child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

// Elimina el árbol de un hijo propio en Windows, sin buscar procesos por nombre o puerto.
async function killWindowsTree(service) {
  if (service.ended || !service.child.pid) return;
  const taskkill = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
  await new Promise((resolveKill, reject) => {
    const killer = spawn(taskkill, ['/PID', String(service.child.pid), '/T', '/F'], {
      shell: false, windowsHide: true, stdio: 'ignore',
    });
    killer.once('error', reject);
    killer.once('exit', (code) => {
      if (code === 0 || service.ended) resolveKill();
      else reject(new Error(`No se pudo cerrar el árbol de ${service.name} (PID ${service.child.pid}).`));
    });
  });
}

// Espera un cierre acotado y cancela el temporizador si los hijos terminan antes.
async function waitForChildren(timeout) {
  let timer;
  try {
    await Promise.race([
      Promise.all(services.map((service) => service.done)),
      new Promise((resolveWait) => { timer = setTimeout(resolveWait, timeout); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Centraliza el apagado; llamadas repetidas comparten la misma operación de limpieza.
function stop(code, reason, signal) {
  if (shutdown) return shutdown;
  cancellation.abort();
  process.exitCode = code;
  if (reason) console.error(`ERROR: ${reason}`);
  shutdown = Promise.resolve().then(async () => {
    if (services.length) console.log('IO WEB: deteniendo los servicios...');
    try {
      if (windows) {
        // Ctrl+C llega también a los hijos de la consola; primero permite su cierre normal.
        if (signal === 'SIGINT') await waitForChildren(2000);
        await Promise.all(services.map(killWindowsTree));
      } else {
        for (const service of services) signalGroup(service, signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
        await waitForChildren(2000);
        for (const service of services) signalGroup(service, 'SIGKILL');
      }
      await waitForChildren(3000);
      if (services.some((service) => !service.ended)) {
        throw new Error('Un proceso propio no confirmó su cierre. Revisa los PID mostrados por los servidores.');
      }
    } catch (error) {
      console.error(`ERROR de cierre: ${error.message}`);
      process.exitCode = 1;
    }
  });
  return shutdown;
}

process.on('SIGINT', () => { void stop(130, undefined, 'SIGINT'); });
process.on('SIGTERM', () => { void stop(143, undefined, 'SIGTERM'); });

// Arranca en orden, confirma el proxy y mantiene la supervisión hasta el apagado.
async function main() {
  console.log('IO WEB — Inicio de desarrollo');
  await checkPrerequisites();
  await checkPort('127.0.0.1', 8000);
  await checkPort('localhost', 5173);
  const api = startService('Backend', python, [
    '-m', 'uvicorn', 'app.main:app', '--reload', '--no-access-log', '--host', '127.0.0.1', '--port', '8000',
  ], backend);
  await waitReady(api, [[`${backendUrl}/api/health`, true]]);
  await checkPort('localhost', 5173);
  const ui = startService('Frontend', process.execPath, [vite, '--host', 'localhost', '--port', '5173', '--strictPort'], frontend);
  await waitReady(ui, [[`${frontendUrl}/`, false], [`${frontendUrl}/api/health`, true]]);
  console.log(`\nInterfaz: ${frontendUrl}\nAPI Docs: ${backendUrl}/docs\nPresiona Ctrl+C para detener ambos servidores.`);
  await monitorHealth();
}

try {
  await main();
} catch (error) {
  if (!cancellation.signal.aborted) await stop(1, error.message);
} finally {
  if (shutdown) await shutdown;
}
