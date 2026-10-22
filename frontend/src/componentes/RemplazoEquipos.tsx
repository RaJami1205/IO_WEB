import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "../estilos/RemplazoEquipos.css";

type Equipo = {
  valorVenta: number;
  costoMantenimiento: number;
};

// Estructura del JSON devuelto por el backend.
type ConfiguracionRemplazo = {
  algoritmo: "reemplazo-equipos";
  costoInicial: number;
  plazo: number;
  vidaUtil: number;
  periodos: { reventa: number; mantenimiento: number }[];
};

// Estructura del JSON devuelto por el backend.
type RespuestaReemplazo = {
  algoritmo: string;
  resultado: {
    costoMinimo: number;
    cantidadPlanesOptimos: number;
    planesOptimos: number[][];
    conclusion: string;
    paginacion?: {
      offset: number;
      limite: number;
      devueltos: number;
      hayMas: boolean;
    };
  };
  tablas: {
    costosPorDuracion: number[];
    G: number[];
    siguientes: number[][];
  };
  pasos?: unknown[];
  metadatos?: {
    instanteInicial?: number;
    instanteFinal?: number;
    costosIndexadosDesde?: number;
    planesIncluyenInicioFin?: boolean;
  };

  planesIncluyenInicioFin?: boolean;
};

//valida si el valor es un objeto (no null ni array) y lo tipa como Record<string, unknown>
function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function validarConfiguracion(datosRecibidos: unknown): ConfiguracionRemplazo {
  if (!esObjeto(datosRecibidos)) {
    throw new Error("El JSON debe ser un objeto.");
  }

  const datos = datosRecibidos;
  if (datos.algoritmo !== "reemplazo-equipos") {
    throw new Error("El algoritmo debe ser 'reemplazo-equipos'.");
  }
  if (
    typeof datos.costoInicial !== "number" ||
    !Number.isFinite(datos.costoInicial) ||
    datos.costoInicial < 0
  ) {
    throw new Error("Costo inicial inválido.");
  }
  if (
    typeof datos.plazo !== "number" ||
    !Number.isInteger(datos.plazo) ||
    datos.plazo < 1
  ) {
    throw new Error("El plazo debe ser un entero mayor que cero.");
  }
  if (
    typeof datos.vidaUtil !== "number" ||
    !Number.isInteger(datos.vidaUtil) ||
    datos.vidaUtil < 1
  ) {
    throw new Error("La vida útil debe ser un entero mayor que cero.");
  }
  if (
    !Array.isArray(datos.periodos) ||
    datos.periodos.length !== datos.vidaUtil ||
    !datos.periodos.every(
      (periodo: unknown) =>
        esObjeto(periodo) &&
        typeof periodo.reventa === "number" &&
        Number.isFinite(periodo.reventa) &&
        periodo.reventa >= 0 &&
        typeof periodo.mantenimiento === "number" &&
        Number.isFinite(periodo.mantenimiento) &&
        periodo.mantenimiento >= 0,
    )
  ) {
    throw new Error(
      "Debe existir un período válido por cada año de vida útil.",
    );
  }

  return datos as ConfiguracionRemplazo;
}

// Valida la respuesta del backend y la tipa como RespuestaReemplazo.
function validarRespuesta(datosRecibidos: unknown): RespuestaReemplazo {
  if (
    !esObjeto(datosRecibidos) ||
    !esObjeto(datosRecibidos.resultado) ||
    !esObjeto(datosRecibidos.tablas)
  ) {
    throw new Error("La respuesta del backend no tiene resultado o tablas.");
  }

  const resultado = datosRecibidos.resultado;
  const tablas = datosRecibidos.tablas;
  const numeroValido = (valor: unknown): valor is number =>
    typeof valor === "number" && Number.isFinite(valor);
  const arregloNumeros = (valor: unknown): valor is number[] =>
    Array.isArray(valor) && valor.every(numeroValido);
  const arregloRutas = (valor: unknown): valor is number[][] =>
    Array.isArray(valor) && valor.every(arregloNumeros);

  if (
    !numeroValido(resultado.costoMinimo) ||
    !numeroValido(resultado.cantidadPlanesOptimos) ||
    !arregloRutas(resultado.planesOptimos) ||
    typeof resultado.conclusion !== "string" ||
    !arregloNumeros(tablas.costosPorDuracion) ||
    !arregloNumeros(tablas.G) ||
    !arregloRutas(tablas.siguientes)
  ) {
    throw new Error("El backend devolvió un resultado con tipos inesperados.");
  }

  return datosRecibidos as RespuestaReemplazo;
}

/** Convierte un plan [0, 1, 2, 5] en el texto '0 → 1 → 2 → 5'. */
function formatearRuta(plan: number[]): string {
  return plan.join(" → ");
}

export default function RemplazoEquipos() {
  // Datos generales del problema.
  const [costoInicial, cambiarCostoInicial] = useState("");
  const [plazo, cambiarPlazo] = useState("");
  const [vidaUtil, cambiarVidaUtil] = useState("");

  // Campos temporales para agregar UN equipo/año a la vez.
  const [valorVenta, cambiarValorVenta] = useState("");
  const [costoMantenimiento, cambiarCostoMantenimiento] = useState("");

  // Lista consolidada y estados del cálculo.
  const [listaEquipos, cambiarListaEquipos] = useState<Equipo[]>([]);
  const [resultadoBackend, cambiarResultadoBackend] =
    useState<RespuestaReemplazo | null>(null);
  const [calculando, cambiarCalculando] = useState(false);
  const [mensajeError, cambiarMensajeError] = useState("");
  const [mensajeExito, cambiarMensajeExito] = useState("");

  /** Borra avisos y resultados anteriores cuando cambian los datos. */
  function limpiarResultados() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    cambiarResultadoBackend(null);
  }

  // Carga un archivo JSON, lo valida y actualiza los inputs del formulario.
  async function cargarArchivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    limpiarResultados();
    try {
      const configuracion = validarConfiguracion(
        JSON.parse(await archivo.text()),
      );
      cambiarCostoInicial(String(configuracion.costoInicial));
      cambiarPlazo(String(configuracion.plazo));
      cambiarVidaUtil(String(configuracion.vidaUtil));
      cambiarListaEquipos(
        configuracion.periodos.map((periodo) => ({
          valorVenta: periodo.reventa,
          costoMantenimiento: periodo.mantenimiento,
        })),
      );
      cambiarValorVenta("");
      cambiarCostoMantenimiento("");
      cambiarMensajeExito("Archivo JSON cargado correctamente.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "No se pudo cargar el JSON.",
      );
    }
    evento.target.value = "";
  }

  // Valida los inputs del formulario y devuelve la configuración tipada.
  function obtenerConfiguracionActual(): ConfiguracionRemplazo {
    if (
      costoInicial.trim() === "" ||
      plazo.trim() === "" ||
      vidaUtil.trim() === ""
    ) {
      throw new Error("Completa costo inicial, plazo y vida útil.");
    }
    if (listaEquipos.length !== Number(vidaUtil)) {
      throw new Error("Debes agregar un registro por cada año de vida útil.");
    }

    return validarConfiguracion({
      algoritmo: "reemplazo-equipos",
      costoInicial: Number(costoInicial),
      plazo: Number(plazo),
      vidaUtil: Number(vidaUtil),
      periodos: listaEquipos.map((equipo) => ({
        reventa: equipo.valorVenta,
        mantenimiento: equipo.costoMantenimiento,
      })),
    });
  }

  /** Descarga como JSON la configuración validada que actualmente muestra el formulario. */
  function guardarConfiguracionJson() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    try {
      const contenidoJson = JSON.stringify(
        obtenerConfiguracionActual(),
        null,
        2,
      );
      const url = URL.createObjectURL(
        new Blob([contenidoJson], { type: "application/json" }),
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "reemplazo-equipos.json";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      cambiarMensajeExito("Configuración JSON guardada.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    }
  }

  /** Valida y añade un período a listaEquipos; después limpia sus dos inputs. */
  function agregarEquipo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpiarResultados();
    if (
      valorVenta.trim() === "" ||
      costoMantenimiento.trim() === "" ||
      !Number.isFinite(Number(valorVenta)) ||
      !Number.isFinite(Number(costoMantenimiento)) ||
      Number(valorVenta) < 0 ||
      Number(costoMantenimiento) < 0
    ) {
      cambiarMensajeError("Ingresa un valor de venta y mantenimiento válidos.");
      return;
    }
    if (!Number.isInteger(Number(vidaUtil)) || Number(vidaUtil) < 1) {
      cambiarMensajeError("Primero ingresa una vida útil válida.");
      return;
    }
    if (listaEquipos.length >= Number(vidaUtil)) {
      cambiarMensajeError("Ya agregaste todos los períodos de la vida útil.");
      return;
    }

    cambiarListaEquipos((equipos) => [
      ...equipos,
      {
        valorVenta: Number(valorVenta),
        costoMantenimiento: Number(costoMantenimiento),
      },
    ]);
    cambiarValorVenta("");
    cambiarCostoMantenimiento("");
  }

  /** Elimina un período de la lista, para poder corregirlo sin reiniciar todo. */
  function eliminarEquipo(indice: number) {
    limpiarResultados();
    cambiarListaEquipos((equipos) => equipos.filter((_, i) => i !== indice));
  }

  // Envía la configuración al backend y guarda la respuesta en estado.
  async function calcularReemplazo() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    cambiarResultadoBackend(null);
    if (calculando) return;

    try {
      const configuracion = obtenerConfiguracionActual();
      cambiarCalculando(true);

      // Ajusta esta URL solo si la ruta real de tu backend es diferente.
      const respuesta = await fetch(
        "http://127.0.0.1:8000/api/reemplazo-equipos",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configuracion),
        },
      );

      if (!respuesta.ok) {
        throw new Error(
          `El servidor devolvió el error HTTP ${respuesta.status}.`,
        );
      }

      const datos: unknown = await respuesta.json();
      cambiarResultadoBackend(validarRespuesta(datos));
      cambiarMensajeExito("Cálculo realizado correctamente.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error
          ? error.message
          : "No se pudo calcular el reemplazo.",
      );
    } finally {
      cambiarCalculando(false);
    }
  }

  return (
    <div className="remplazo-equipos">
      <h1>Reemplazo de Equipos</h1>

      <form onSubmit={agregarEquipo}>
        <h2>Datos generales</h2>
        <label>
          Cargar archivo JSON:{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={cargarArchivoJson}
          />
        </label>
        <button type="button" onClick={guardarConfiguracionJson}>
          Guardar archivo JSON
        </button>
        <p>Ingresa un registro por cada año de vida útil.</p>

        <div className="formulario-equipos">
          <label>
            Costo inicial:
            <input
              type="number"
              min="0"
              step="any"
              value={costoInicial}
              onChange={(evento) => {
                cambiarCostoInicial(evento.target.value);
                limpiarResultados();
              }}
              required
            />
          </label>
          <label>
            Plazo:
            <input
              type="number"
              min="1"
              step="1"
              value={plazo}
              onChange={(evento) => {
                cambiarPlazo(evento.target.value);
                limpiarResultados();
              }}
              required
            />
          </label>
          <label>
            Vida útil:
            <input
              type="number"
              min="1"
              step="1"
              value={vidaUtil}
              onChange={(evento) => {
                cambiarVidaUtil(evento.target.value);
                limpiarResultados();
              }}
              required
            />
          </label>
        </div>

        <h2>Agregar equipo</h2>
        <div className="formulario-equipos">
          <label>
            Valor de venta:
            <input
              type="number"
              min="0"
              step="any"
              value={valorVenta}
              onChange={(evento) => cambiarValorVenta(evento.target.value)}
              required
            />
          </label>
          <label>
            Costo de mantenimiento:
            <input
              type="number"
              min="0"
              step="any"
              value={costoMantenimiento}
              onChange={(evento) =>
                cambiarCostoMantenimiento(evento.target.value)
              }
              required
            />
          </label>
          <button type="submit">Agregar equipo</button>
        </div>
      </form>

      {mensajeError && <p role="alert">{mensajeError}</p>}
      {mensajeExito && <p role="status">{mensajeExito}</p>}

      <h2>
        Equipos agregados ({listaEquipos.length}/{vidaUtil || "?"})
      </h2>
      <table className="tabla-equipos">
        <thead>
          <tr>
            <th>Año de uso</th>
            <th>Valor de venta</th>
            <th>Mantenimiento</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {listaEquipos.map((equipo, indice) => (
            <tr key={indice}>
              <td>{indice + 1}</td>
              <td>{equipo.valorVenta}</td>
              <td>{equipo.costoMantenimiento}</td>
              <td>
                <button type="button" onClick={() => eliminarEquipo(indice)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={calcularReemplazo} disabled={calculando}>
        {calculando ? "Calculando..." : "Calcular"}
      </button>

      {resultadoBackend && (
        <section
          className="resultados-reemplazo"
          aria-label="Resultado del reemplazo de equipos"
        >
          <h2>Resultado óptimo</h2>
          <h3>Costo mínimo total: {resultadoBackend.resultado.costoMinimo}</h3>
          <p>{resultadoBackend.resultado.conclusion}</p>
          <p>
            <strong>Cantidad total de planes óptimos:</strong>{" "}
            {resultadoBackend.resultado.cantidadPlanesOptimos}
          </p>

          <h3>Rutas óptimas de reemplazo</h3>
          <p>
            Cada número es un año. Los años intermedios indican cuándo
            reemplazar el equipo.
          </p>
          {resultadoBackend.resultado.planesOptimos.length === 0 ? (
            <p>El servidor no devolvió planes en esta página.</p>
          ) : (
            <ol>
              {resultadoBackend.resultado.planesOptimos.map((plan, indice) => (
                <li key={indice}>
                  <strong>Plan {indice + 1}:</strong> {formatearRuta(plan)}
                </li>
              ))}
            </ol>
          )}
          {resultadoBackend.resultado.paginacion && (
            <p>
              Mostrando {resultadoBackend.resultado.paginacion.devueltos} planes
              {` (desde el índice ${resultadoBackend.resultado.paginacion.offset}).`}
              {resultadoBackend.resultado.paginacion.hayMas &&
                " Hay más planes disponibles en el backend."}
            </p>
          )}

          <h3>Costos por duración</h3>
          <table className="tabla-equipos">
            <thead>
              <tr>
                <th>Años de uso</th>
                <th>Costo neto</th>
              </tr>
            </thead>
            <tbody>
              {resultadoBackend.tablas.costosPorDuracion.map(
                (costo, indice) => (
                  <tr key={indice}>
                    <td>
                      {indice +
                        (resultadoBackend.metadatos?.costosIndexadosDesde ?? 1)}
                    </td>
                    <td>{costo}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          <h3>Tabla de programación dinámica</h3>
          <p>
            G(t) es el costo mínimo acumulado desde el instante t hasta el
            final; "Siguientes" indica los próximos años posibles de una
            decisión óptima.
          </p>
          <table className="tabla-equipos">
            <thead>
              <tr>
                <th>Instante (t)</th>
                <th>G(t)</th>
                <th>Siguientes instantes óptimos</th>
              </tr>
            </thead>
            <tbody>
              {resultadoBackend.tablas.G.map((costo, indice) => (
                <tr key={indice}>
                  <td>
                    {indice +
                      (resultadoBackend.metadatos?.instanteInicial ?? 0)}
                  </td>
                  <td>{costo}</td>
                  <td>
                    {resultadoBackend.tablas.siguientes[indice]?.join(", ") ||
                      "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {resultadoBackend.metadatos && (
            <p>
              <strong>Horizonte:</strong>{" "}
              {resultadoBackend.metadatos.instanteInicial ?? 0}
              {" → "}
              {resultadoBackend.metadatos.instanteFinal ?? Number(plazo)}
              {" años."}
            </p>
          )}

          {resultadoBackend.pasos && resultadoBackend.pasos.length > 0 && (
            <details>
              <summary>Ver pasos devueltos por el backend</summary>
              <pre>{JSON.stringify(resultadoBackend.pasos, null, 2)}</pre>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
