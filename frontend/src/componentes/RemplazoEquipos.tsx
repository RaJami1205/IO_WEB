/** Gestiona períodos de uso y JSON; presenta costos y planes de reemplazo calculados por FastAPI. */
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "../estilos/RemplazoEquipos.css";

/** Representa un período editable de reventa y mantenimiento del mismo equipo. */
type Equipo = {
  valorVenta: number;
  costoMantenimiento: number;
};

/** Define los datos enviados al endpoint de reemplazo y guardados en JSON. */
type ConfiguracionRemplazo = {
  algoritmo: "reemplazo-equipos";
  costoInicial: number;
  plazo: number;
  vidaUtil: number;
  periodos: { reventa: number; mantenimiento: number }[];
};

/** Describe costos, decisiones y la página de planes recibida del backend. */
type RespuestaReemplazo = {
  algoritmo?: string;
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

/** Identifica un objeto JSON excluyendo null y arreglos. */
function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
/** Comprueba los datos generales y que exista un período válido por año de vida útil. */
// eslint-disable-next-line react-refresh/only-export-components
export function validarConfiguracion(datos: unknown): ConfiguracionRemplazo {
  if (!esObjeto(datos)) {
    throw new Error("El JSON debe contener un objeto.");
  }
  if (datos.algoritmo !== "reemplazo-equipos") {
    throw new Error("El algoritmo debe ser 'reemplazo-equipos'.");
  }
  if (
    typeof datos.costoInicial !== "number" ||
    !Number.isFinite(datos.costoInicial) ||
    datos.costoInicial < 0
  ) {
    throw new Error("El costo inicial debe ser un número no negativo.");
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
    throw new Error("Debe haber un período válido por cada año de vida útil.");
  }
  return datos as ConfiguracionRemplazo;
}
/** Comprueba los tipos de los costos, planes y tablas recibidos del backend. */
function validarRespuesta(datos: unknown): RespuestaReemplazo {
  if (
    !esObjeto(datos) ||
    !esObjeto(datos.resultado) ||
    !esObjeto(datos.tablas)
  ) {
    throw new Error("El backend no devolvió resultado y tablas válidos.");
  }
  const resultado = datos.resultado;
  const tablas = datos.tablas;
  /** Acepta únicamente valores numéricos finitos. */
  const numeroValido = (valor: unknown): valor is number =>
    typeof valor === "number" && Number.isFinite(valor);
  /** Comprueba un vector de costos o instantes numéricos. */
  const arregloNumeros = (valor: unknown): valor is number[] =>
    Array.isArray(valor) && valor.every(numeroValido);
  /** Comprueba listas de planes o de siguientes instantes. */
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
    throw new Error("La respuesta del backend tiene tipos inesperados.");
  }
  return datos as RespuestaReemplazo;
}

/** Presenta importes con formato local y hasta seis decimales. */
function formatearNumero(valor: number): string {
  return new Intl.NumberFormat("es-CR", {
    maximumFractionDigits: 6,
  }).format(valor);
}

/** Presenta los instantes de un plan en el orden recibido. */
function formatearRuta(plan: number[]): string {
  return plan.join(" → ");
}

/** Coordina el formulario y presenta las tablas y los planes devueltos por la API. */
export default function RemplazoEquipos() {
  const [costoInicial, cambiarCostoInicial] = useState("");
  const [plazo, cambiarPlazo] = useState("");
  const [vidaUtil, cambiarVidaUtil] = useState("");
  const [valorVenta, cambiarValorVenta] = useState("");
  const [costoMantenimiento, cambiarCostoMantenimiento] = useState("");
  const [listaEquipos, cambiarListaEquipos] = useState<Equipo[]>([]);
  const [resultadoBackend, cambiarResultadoBackend] =
    useState<RespuestaReemplazo | null>(null);
  const [calculando, cambiarCalculando] = useState(false);
  const [mensajeError, cambiarMensajeError] = useState("");
  const [mensajeExito, cambiarMensajeExito] = useState("");

  /** Descarta mensajes y resultados anteriores al editar la configuración. */
  function limpiarResultados() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    cambiarResultadoBackend(null);
  }
  /** Valida un JSON y carga sus períodos e importes en el formulario. */
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
        error instanceof Error ? error.message : "No se pudo leer el JSON.",
      );
    } finally {
      evento.target.value = "";
    }
  }
  /** Construye y valida la solicitud con los períodos actualmente ingresados. */
  function obtenerConfiguracionActual(): ConfiguracionRemplazo {
    if (
      costoInicial.trim() === "" ||
      plazo.trim() === "" ||
      vidaUtil.trim() === ""
    ) {
      throw new Error("Completa costo inicial, plazo y vida útil.");
    }
    if (listaEquipos.length !== Number(vidaUtil)) {
      throw new Error("Agrega un registro por cada año de vida útil.");
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
  /** Descarga la configuración validada como archivo JSON. */
  function guardarConfiguracionJson() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    try {
      const contenido = JSON.stringify(obtenerConfiguracionActual(), null, 2);
      const url = URL.createObjectURL(
        new Blob([contenido], { type: "application/json" }),
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
  /** Valida y agrega un período de reventa y mantenimiento hasta completar la vida útil. */
  function agregarEquipo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpiarResultados();

    if (!Number.isInteger(Number(vidaUtil)) || Number(vidaUtil) < 1) {
      cambiarMensajeError("Primero ingresa una vida útil válida.");
      return;
    }
    if (listaEquipos.length >= Number(vidaUtil)) {
      cambiarMensajeError("Ya agregaste todos los períodos de vida útil.");
      return;
    }
    if (
      valorVenta.trim() === "" ||
      costoMantenimiento.trim() === "" ||
      !Number.isFinite(Number(valorVenta)) ||
      !Number.isFinite(Number(costoMantenimiento)) ||
      Number(valorVenta) < 0 ||
      Number(costoMantenimiento) < 0
    ) {
      cambiarMensajeError(
        "Ingresa un valor de venta y mantenimiento no negativos.",
      );
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
  /** Elimina un período de la lista y descarta el resultado anterior. */
  function eliminarEquipo(indice: number) {
    limpiarResultados();
    cambiarListaEquipos((equipos) => equipos.filter((_, i) => i !== indice));
  }
  /** Comprueba la conexión y solicita los costos y planes de reemplazo al backend. */
  async function calcularReemplazo() {
    if (calculando) return;

    limpiarResultados();
    cambiarCalculando(true);

    try {
      //  VERIFICAR SI EL BACKEND ESTÁ ACTIVO
      try {
        const salud = await fetch("/api/health", {
          signal: AbortSignal.timeout(5000),
        });

        if (!salud.ok) {
          throw new Error("Servidor no disponible");
        }

        const datosSalud: unknown = await salud.json();

        if (!esObjeto(datosSalud) || datosSalud.status !== "ok") {
          throw new Error("Servidor no disponible");
        }
      } catch {
        throw new Error(
          "No se pudo conectar con el servidor. Verifica que el backend esté activo.",
        );
      }

      //  VALIDAR LOS DATOS DEL FORMULARIO
      const configuracion = obtenerConfiguracionActual();

      //ENVIAR LOS DATOS AL BACKEND
      let respuesta: Response;

      try {
        respuesta = await fetch("/api/reemplazo-equipos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(configuracion),
        });
      } catch {
        throw new Error(
          "Se perdió la conexión con el servidor. Inténtalo nuevamente.",
        );
      }

      //  VERIFICAR ERRORES DEVUELTOS POR EL BACKEND
      if (!respuesta.ok) {
        let mensaje = `El servidor devolvió HTTP ${respuesta.status}.`;

        try {
          const errorBackend: unknown = await respuesta.json();

          if (esObjeto(errorBackend)) {
            if (typeof errorBackend.detail === "string") {
              mensaje = errorBackend.detail;
            } else if (Array.isArray(errorBackend.detail)) {
              const errores = errorBackend.detail
                .filter(esObjeto)
                .map((error) => error.msg)
                .filter((msg): msg is string => typeof msg === "string");

              if (errores.length > 0) {
                mensaje = errores.join(". ");
              }
            }
          }
        } catch {
          // Si el backend no devuelve un JSON válido, se conserva el mensaje HTTP.
        }

        throw new Error(mensaje);
      }

      //  PROCESAR LA RESPUESTA
      const datos: unknown = await respuesta.json();

      cambiarResultadoBackend(validarRespuesta(datos));

      cambiarMensajeExito("Cálculo realizado correctamente.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error
          ? error.message
          : "No fue posible calcular el reemplazo de equipos.",
      );
    } finally {
      cambiarCalculando(false);
    }
  }

  return (
    <div
      className="reemplazo-pagina"
      style={{ maxHeight: "calc(100dvh - 90px)", overflowY: "auto" }}
    >
      {!resultadoBackend && (
        <>
          <p className="reemplazo-etiqueta">Investigación de Operaciones</p>
          <h1>Reemplazo de Equipos</h1>

          <section className="reemplazo-panel">
            <div className="reemplazo-titulo-seccion">
              <div>
                <h2>1. Datos generales</h2>
              </div>
              <div className="acciones-archivo-abb">
                <label htmlFor="archivo-abb" className="etiqueta-archivo-abb">
                  Cargar JSON
                </label>
                <input
                  id="archivo-abb"
                  type="file"
                  accept=".json,application/json"
                  onChange={cargarArchivoJson}
                />
                <button
                  type="button"
                  className="boton-secundario-abb"
                  onClick={guardarConfiguracionJson}
                >
                  Guardar JSON
                </button>
              </div>
            </div>

            <div className="formulario-equipos">
              <label>
                Costo inicial
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costoInicial}
                  onChange={(evento) => {
                    cambiarCostoInicial(evento.target.value);
                    limpiarResultados();
                  }}
                  placeholder="Ej. 500"
                />
              </label>
              <label>
                Plazo (años)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={plazo}
                  onChange={(evento) => {
                    cambiarPlazo(evento.target.value);
                    limpiarResultados();
                  }}
                  placeholder="Ej. 5"
                />
              </label>
              <label>
                Vida útil (años)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={vidaUtil}
                  onChange={(evento) => {
                    cambiarVidaUtil(evento.target.value);
                    cambiarListaEquipos([]);
                    limpiarResultados();
                  }}
                  placeholder="Ej. 3"
                />
              </label>
            </div>
          </section>

          <section className="reemplazo-panel">
            <h2>2. Agregar período</h2>
            <p className="reemplazo-ayuda">
              Agrega un período a la vez, hasta completar los {vidaUtil || "?"}{" "}
              años de vida útil.
            </p>
            <form onSubmit={agregarEquipo}>
              <div className="formulario-equipos">
                <label>
                  Valor de reventa
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={valorVenta}
                    onChange={(evento) =>
                      cambiarValorVenta(evento.target.value)
                    }
                    placeholder="Ej. 400"
                    required
                  />
                </label>
                <label>
                  Costo de mantenimiento
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={costoMantenimiento}
                    onChange={(evento) =>
                      cambiarCostoMantenimiento(evento.target.value)
                    }
                    placeholder="Ej. 30"
                    required
                  />
                </label>
              </div>
              <div className="reemplazo-acciones">
                <button type="submit" className="reemplazo-primario">
                  Agregar período
                </button>
              </div>
            </form>
          </section>

          <section className="reemplazo-panel">
            <h2>
              3. Períodos agregados ({listaEquipos.length}/{vidaUtil || "?"})
            </h2>
            <div className="reemplazo-desborde">
              <table className="tabla-equipos">
                <thead>
                  <tr>
                    <th>Año de uso</th>
                    <th>Valor de reventa</th>
                    <th>Mantenimiento</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {listaEquipos.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Todavía no se han agregado períodos.</td>
                    </tr>
                  ) : (
                    listaEquipos.map((equipo, indice) => (
                      <tr key={indice}>
                        <td>{indice + 1}</td>
                        <td>{formatearNumero(equipo.valorVenta)}</td>
                        <td>{formatearNumero(equipo.costoMantenimiento)}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => eliminarEquipo(indice)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="reemplazo-acciones">
              <button
                type="button"
                className="reemplazo-primario"
                onClick={calcularReemplazo}
                disabled={calculando}
              >
                {calculando ? "Calculando..." : "Calcular reemplazo"}
              </button>
            </div>
          </section>

          {mensajeError && (
            <p className="reemplazo-mensaje reemplazo-error" role="alert">
              {mensajeError}
            </p>
          )}
          {mensajeExito && (
            <p className="reemplazo-mensaje reemplazo-exito" role="status">
              {mensajeExito}
            </p>
          )}
        </>
      )}

      {resultadoBackend && (
        <section
          className="reemplazo-panel resultados-reemplazo"
          aria-label="Resultado del reemplazo de equipos"
        >
          <div
            className="reemplazo-acciones"
            style={{
              justifyContent: "flex-start",
              position: "sticky",
              top: 0,
              zIndex: 2,
              marginTop: 0,
              paddingBottom: 12,
              background: "#fff",
            }}
          >
            <button
              type="button"
              onClick={() => {
                cambiarResultadoBackend(null);
                cambiarMensajeExito("");
              }}
            >
              ← Volver
            </button>
          </div>
          <h2>4. Resultado del algoritmo</h2>
          <div className="reemplazo-resumen">
            <div className="reemplazo-indicador">
              <span>Costo mínimo total</span>
              <strong>
                {formatearNumero(resultadoBackend.resultado.costoMinimo)}
              </strong>
            </div>
            <div className="reemplazo-indicador">
              <span>Cantidad de planes óptimos</span>
              <strong>
                {formatearNumero(
                  resultadoBackend.resultado.cantidadPlanesOptimos,
                )}
              </strong>
            </div>
          </div>

          <div className="reemplazo-conclusion">
            <h3>Conclusión</h3>
            <p>{resultadoBackend.resultado.conclusion}</p>
          </div>

          <div className="reemplazo-bloque">
            <h3>Planes óptimos de reemplazo</h3>
            <p>
              Cada número representa un año; los puntos intermedios indican
              cuándo conviene reemplazar el equipo.
            </p>
            {resultadoBackend.resultado.planesOptimos.length === 0 ? (
              <p>El backend no devolvió planes en esta página.</p>
            ) : (
              <ol className="reemplazo-planes">
                {resultadoBackend.resultado.planesOptimos.map(
                  (plan, indice) => (
                    <li key={indice}>
                      <strong>{"Plan " + (indice + 1) + ": "}</strong>
                      {formatearRuta(plan)}
                    </li>
                  ),
                )}
              </ol>
            )}
            {resultadoBackend.resultado.paginacion && (
              <p>
                Mostrando {resultadoBackend.resultado.paginacion.devueltos}{" "}
                planes desde el índice{" "}
                {resultadoBackend.resultado.paginacion.offset}.
                {resultadoBackend.resultado.paginacion.hayMas &&
                  " Hay más planes disponibles en el backend."}
              </p>
            )}
          </div>

          <div className="reemplazo-bloque">
            <h3>Costos por duración</h3>
            <div className="reemplazo-desborde">
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
                            (resultadoBackend.metadatos?.costosIndexadosDesde ??
                              1)}
                        </td>
                        <td>{formatearNumero(costo)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="reemplazo-bloque">
            <h3>Tabla de programación dinámica</h3>
            <p>
              G(t) es el costo mínimo desde el instante t. Los siguientes
              instantes muestran las decisiones óptimas posibles.
            </p>
            <div className="reemplazo-desborde">
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
                      <td>{formatearNumero(costo)}</td>
                      <td>
                        {resultadoBackend.tablas.siguientes[indice]?.join(
                          ", ",
                        ) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {resultadoBackend.metadatos && (
            <p className="reemplazo-ayuda">
              Horizonte: {resultadoBackend.metadatos.instanteInicial ?? 0}
              {" → "}
              {resultadoBackend.metadatos.instanteFinal ?? Number(plazo)}
              {" años."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
