/** Gestiona las dimensiones y el JSON de matrices; muestra el óptimo y anima las tablas de FastAPI. */
import { useConexionCalculo } from "../hooks/useConexionCalculo";
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import "../estilos/MultiplicacionMatrices.css";

/** Representa la cadena mediante n+1 dimensiones compartidas por matrices consecutivas. */
type ConfiguracionMatrices = {
  algoritmo: "multiplicacion-matrices";
  dimensiones: number[];
};

/** Reúne las tablas y los campos de resultado que utiliza la vista. */
type RespuestaMatrices = {
  M: unknown[][];
  P: unknown[][];
  resultado: Record<string, unknown>;
  parentizacion: string | null;
  costoMinimo: number | null;
};

const MAX_MATRICES = 10;

/** Identifica un objeto JSON excluyendo null y arreglos. */
function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Valida de una a diez matrices con dimensiones enteras positivas y sin campos adicionales. */
// eslint-disable-next-line react-refresh/only-export-components
export function validarConfiguracion(datos: unknown): ConfiguracionMatrices {
  if (!esObjeto(datos)) {
    throw new Error("El JSON debe contener un objeto.");
  }
  if (
    Object.keys(datos).some(
      (clave) => !["algoritmo", "dimensiones"].includes(clave),
    )
  ) {
    throw new Error("El JSON contiene campos adicionales no permitidos.");
  }
  if (datos.algoritmo !== "multiplicacion-matrices") {
    throw new Error('El algoritmo debe ser "multiplicacion-matrices".');
  }
  if (
    !Array.isArray(datos.dimensiones) ||
    datos.dimensiones.length < 2 ||
    datos.dimensiones.length > MAX_MATRICES + 1
  ) {
    throw new Error(
      "Ingresa entre 2 y 11 dimensiones (entre 1 y 10 matrices).",
    );
  }
  if (
    !datos.dimensiones.every(
      (dimension: unknown) =>
        typeof dimension === "number" &&
        Number.isSafeInteger(dimension) &&
        dimension > 0,
    )
  ) {
    throw new Error("Todas las dimensiones deben ser enteros positivos.");
  }

  return {
    algoritmo: "multiplicacion-matrices",
    dimensiones: datos.dimensiones as number[],
  };
}

/** Comprueba que la tabla recibida sea un arreglo de filas. */
function esMatriz(valor: unknown): valor is unknown[][] {
  return Array.isArray(valor) && valor.every(Array.isArray);
}

/** Extrae M, P, costo y parentización de las variantes de respuesta reconocidas por la vista. */
function validarRespuesta(datos: unknown): RespuestaMatrices {
  if (!esObjeto(datos)) {
    throw new Error("El backend debe devolver un objeto JSON.");
  }
  const tablas = esObjeto(datos.tablas) ? datos.tablas : datos;
  const M = tablas.M ?? tablas.m;
  const P = tablas.P ?? tablas.p;
  if (!esMatriz(M) || !esMatriz(P)) {
    throw new Error(
      "La respuesta del backend debe incluir las matrices M y P.",
    );
  }

  const resultado = esObjeto(datos.resultado) ? datos.resultado : {};
  const expresiones = [
    resultado.parentizacion,
    resultado.parentizacionOptima,
    resultado.asociacionOptima,
    resultado.asociacion,
    resultado.ordenOptimo,
    resultado.expresion,
    resultado.cadena,
    datos.parentizacion,
    datos.parentizacionOptima,
    datos.asociacionOptima,
    datos.asociacion,
    typeof datos.resultado === "string" ? datos.resultado : undefined,
  ];
  const parentizacion =
    expresiones.find(
      (valor): valor is string =>
        typeof valor === "string" && valor.trim() !== "",
    ) ?? null;

  const posiblesCostos = [
    resultado.costoMinimo,
    resultado.costoOptimo,
    resultado.multiplicacionesMinimas,
    resultado.minimo,
    datos.costoMinimo,
    datos.costoOptimo,
  ];
  const costoMinimo =
    posiblesCostos.find(
      (valor): valor is number =>
        typeof valor === "number" && Number.isFinite(valor),
    ) ?? null;

  return { M, P, resultado, parentizacion, costoMinimo };
}
/** Convierte valores de celda a texto y representa los ausentes o no finitos con un guion. */
function textoCelda(valor: unknown): string {
  if (valor === undefined || valor === null) return "—";
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? String(valor) : "—";
  }
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/** Cuenta las posiciones que debe recorrer la animación de la tabla. */
function cantidadCeldas(matriz: unknown[][]): number {
  return matriz.reduce((total, fila) => total + fila.length, 0);
}

/** Presenta las celdas recibidas hasta el avance indicado, con etiquetas de índice ajustables. */
function TablaAnimada({
  nombre,
  explicacion,
  matriz,
  celdasVisibles,
  indiceInicial,
}: {
  nombre: string;
  explicacion: string;
  matriz: unknown[][];
  celdasVisibles: number;
  indiceInicial: number;
}) {
  const columnas = Math.max(0, ...matriz.map((fila) => fila.length));
  let indiceCelda = 0;

  return (
    <div className="matriz-resultado-bloque">
      <div className="matriz-resultado-titulo">
        <h3>{"Matriz " + nombre}</h3>
        <p>{explicacion}</p>
      </div>
      <div className="matriz-tabla-desborde">
        <table className="matriz-tabla" aria-label={"Matriz " + nombre}>
          <thead>
            <tr>
              <th scope="col">i / j</th>
              {Array.from({ length: columnas }, (_, columna) => (
                <th key={columna} scope="col">
                  {columna + indiceInicial}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.map((fila, numeroFila) => (
              <tr key={numeroFila}>
                <th scope="row">{numeroFila + indiceInicial}</th>
                {Array.from({ length: columnas }, (_, columna) => {
                  const existe = columna < fila.length;
                  const indiceActual = existe ? indiceCelda++ : -1;
                  const visible = existe && indiceActual < celdasVisibles;
                  return (
                    <td
                      key={columna}
                      className={
                        !existe
                          ? "matriz-celda-vacia"
                          : visible
                            ? "matriz-celda-visible"
                            : "matriz-celda-pendiente"
                      }
                    >
                      {visible ? textoCelda(fila[columna]) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Coordina el formulario, la consulta del óptimo y la revelación de las tablas M y P. */
export default function MultiplicacionMatrices() {
  const [cantidadMatrices, cambiarCantidadMatrices] = useState(4);
  const [dimensiones, cambiarDimensiones] = useState<string[]>(
    Array.from({ length: 5 }, () => ""),
  );
  const [mensajeError, cambiarMensajeError] = useState("");
  const [mensajeExito, cambiarMensajeExito] = useState("");
  const { fase, iniciar } = useConexionCalculo();
  const calculando = fase !== "reposo";
  const [respuestaBackend, cambiarRespuestaBackend] =
    useState<RespuestaMatrices | null>(null);
  const [celdasVisibles, cambiarCeldasVisibles] = useState(0);

  /** Borra mensajes, respuesta y avance de la animación. */
  function limpiarResultados() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    cambiarRespuestaBackend(null);
    cambiarCeldasVisibles(0);
  }
  /** Ajusta la cantidad de matrices y conserva las dimensiones que aún corresponden. */
  function actualizarCantidadMatrices(cantidad: number) {
    if (
      !Number.isInteger(cantidad) ||
      cantidad < 1 ||
      cantidad > MAX_MATRICES
    ) {
      return;
    }
    limpiarResultados();
    cambiarCantidadMatrices(cantidad);
    cambiarDimensiones((anteriores) =>
      Array.from({ length: cantidad + 1 }, (_, i) => anteriores[i] ?? ""),
    );
  }
  /** Edita una dimensión de la cadena y descarta el resultado anterior. */
  function actualizarDimension(indice: number, texto: string) {
    limpiarResultados();
    cambiarDimensiones((anteriores) =>
      anteriores.map((valor, i) => (i === indice ? texto : valor)),
    );
  }
  /** Convierte los campos completos a una cadena de dimensiones validada. */
  function obtenerConfiguracionActual(): ConfiguracionMatrices {
    if (dimensiones.length !== cantidadMatrices + 1) {
      throw new Error("Faltan dimensiones para la cantidad de matrices.");
    }
    if (dimensiones.some((dimension) => dimension.trim() === "")) {
      throw new Error("Completa todas las dimensiones antes de calcular.");
    }
    return validarConfiguracion({
      algoritmo: "multiplicacion-matrices",
      dimensiones: dimensiones.map(Number),
    });
  }
  /** Carga las dimensiones de un JSON válido en los campos editables. */
  async function cargarArchivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    limpiarResultados();

    try {
      const configuracion = validarConfiguracion(
        JSON.parse(await archivo.text()),
      );
      cambiarCantidadMatrices(configuracion.dimensiones.length - 1);
      cambiarDimensiones(configuracion.dimensiones.map(String));
      cambiarMensajeExito("Archivo cargado. Puedes editar las dimensiones.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof SyntaxError
          ? "El archivo no contiene un JSON válido."
          : error instanceof Error
            ? error.message
            : "No se pudo leer el archivo.",
      );
    } finally {
      evento.target.value = "";
    }
  }

  /** Descarga la configuración validada como archivo JSON. */
  function guardarConfiguracionJson() {
    limpiarResultados();
    try {
      const contenido = JSON.stringify(obtenerConfiguracionActual(), null, 2);
      const url = URL.createObjectURL(
        new Blob([contenido], { type: "application/json" }),
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "multiplicacion-matrices.json";
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
  /** Comprueba la conexión y solicita al backend el costo, la parentización y las tablas. */
  async function calcularMatrices() {
    const operacion = iniciar();
    if (!operacion) return;

    limpiarResultados();

    try {
      const configuracion = obtenerConfiguracionActual();
      const cuerpo = JSON.stringify(configuracion);
      await operacion.esperarConexion();
      operacion.iniciarPost();

      let respuesta: Response;

      try {
        respuesta = await operacion.esperar(fetch("/api/multiplicacion-matrices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: cuerpo,
          signal: operacion.signal,
        }));
      } catch {
        throw new Error(
          "Se perdió la conexión con el servidor. Inténtalo nuevamente.",
        );
      }

      if (!respuesta.ok) {
        let detalle = `El servidor devolvió HTTP ${respuesta.status}.`;

        try {
          const errorBackend: unknown = await operacion.esperar(respuesta.json());

          if (esObjeto(errorBackend)) {
            if (typeof errorBackend.detail === "string") {
              detalle = errorBackend.detail;
            } else if (Array.isArray(errorBackend.detail)) {
              const errores = errorBackend.detail
                .filter(esObjeto)
                .map((error) => error.msg)
                .filter((msg): msg is string => typeof msg === "string");

              if (errores.length > 0) {
                detalle = errores.join(". ");
              }
            }
          }
        } catch {
          // Si el backend no devuelve un JSON válido, se conserva el mensaje HTTP.
        }

        throw new Error(detalle);
      }

      const datos: unknown = await operacion.esperar(respuesta.json());
      operacion.finPost();
      operacion.comprobar();

      cambiarRespuestaBackend(validarRespuesta(datos));
      cambiarMensajeExito("Cálculo completado.");
    } catch (error) {
      if (!operacion.vigente()) return;
      const causa = operacion.signal.aborted ? operacion.signal.reason : error;
      cambiarMensajeError(
        causa instanceof Error
          ? causa.message
          : "No fue posible calcular la multiplicación de matrices.",
      );
    } finally {
      operacion.finalizar();
    }
  }

  /** Revela las celdas de ambas tablas y cancela el temporizador al cambiar la respuesta. */
  useEffect(() => {
    if (!respuestaBackend) return;

    const total = Math.max(
      cantidadCeldas(respuestaBackend.M),
      cantidadCeldas(respuestaBackend.P),
    );

    if (total === 0) return;

    let indice = 0;
    const intervalo = window.setInterval(() => {
      indice += 1;
      cambiarCeldasVisibles(indice);
      if (indice >= total) window.clearInterval(intervalo);
    }, 75);

    return () => window.clearInterval(intervalo);
  }, [respuestaBackend]);

  const otrosResultados = respuestaBackend
    ? Object.entries(respuestaBackend.resultado).filter(
        ([nombre, valor]) =>
          ![
            "costoMinimo",
            "costoOptimo",
            "multiplicacionesMinimas",
            "parentizacion",
            "parentizacionOptima",
            "asociacionOptima",
            "asociacion",
            "ordenOptimo",
            "expresion",
            "cadena",
          ].includes(nombre) &&
          (typeof valor === "number" ||
            typeof valor === "string" ||
            typeof valor === "boolean"),
      )
    : [];

  return (
    <section className="pagina-multiplicacion-matrices">
      <div className="contenedor-multiplicacion-matrices">
        {respuestaBackend === null ? (
          <>
            <header className="encabezado-matrices">
              <span className="etiqueta-matrices">
                PROYECTO 04 · INVESTIGACIÓN DE OPERACIONES
              </span>
              <h1>Multiplicación de Matrices</h1>
            </header>

            <div className="formulario-matrices">
              <div className="seccion-configuracion-matrices">
                <div>
                  <h2>Configuración del problema</h2>
                </div>
                <div className="acciones-archivo-matrices">
                  <label
                    htmlFor="archivo-configuracion-matrices"
                    className="etiqueta-archivo-matrices"
                  >
                    Cargar JSON
                  </label>
                  <input
                    id="archivo-configuracion-matrices"
                    type="file"
                    accept=".json,application/json"
                    onChange={cargarArchivoJson}
                  />
                  <button
                    type="button"
                    className="boton-secundario-matrices"
                    onClick={guardarConfiguracionJson}
                  >
                    Guardar JSON
                  </button>
                </div>
              </div>

              <div className="seccion-formulario-matrices">
                <div className="encabezado-seccion-matrices">
                  <div>
                    <h2>Datos generales</h2>
                  </div>
                  <span className="contador-matrices">
                    {cantidadMatrices} matrices
                  </span>
                </div>
                <div className="campo-numero-matrices">
                  <label htmlFor="numero-matrices">
                    Número de matrices (n)
                  </label>
                  <select
                    id="numero-matrices"
                    value={cantidadMatrices}
                    onChange={(evento) =>
                      actualizarCantidadMatrices(Number(evento.target.value))
                    }
                  >
                    {Array.from({ length: MAX_MATRICES }, (_, i) => i + 1).map(
                      (cantidad) => (
                        <option key={cantidad} value={cantidad}>
                          {cantidad}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div className="seccion-formulario-matrices">
                <h2>Dimensiones de la cadena</h2>

                <div className="grupo-dimensiones-matrices">
                  {dimensiones.map((dimension, indice) => (
                    <div className="campo-dimension-matrices" key={indice}>
                      <label htmlFor={"dimension-" + indice}>
                        {"D" + indice}
                      </label>
                      <input
                        id={"dimension-" + indice}
                        type="number"
                        min="1"
                        step="1"
                        placeholder={"Ej. " + (indice === 0 ? "30" : "15")}
                        value={dimension}
                        onChange={(evento) =>
                          actualizarDimension(indice, evento.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="vista-previa-matrices">
                  <h3>Cadena de matrices</h3>
                  <div className="lista-matrices">
                    {Array.from({ length: cantidadMatrices }, (_, i) => (
                      <div className="tarjeta-matriz" key={i}>
                        <strong>{"A" + (i + 1)}</strong>
                        <span>
                          {(dimensiones[i] || "?") +
                            " × " +
                            (dimensiones[i + 1] || "?")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {mensajeError && (
                <p className="mensaje-error-matrices" role="alert">
                  {mensajeError}
                </p>
              )}
              {mensajeExito && (
                <p className="mensaje-exito-matrices" role="status">
                  {mensajeExito}
                </p>
              )}
              <div className="acciones-formulario-matrices">
                <button
                  type="button"
                  className="boton-calcular-matrices"
                  onClick={calcularMatrices}
                  disabled={calculando}
                >
                  {calculando ? (fase === "conectando" ? "Conectando con el servidor…" : "Calculando…") : "Calcular asociación óptima"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="pantalla-resultado-matrices">
            <div className="barra-resultado-matrices">
              <button
                type="button"
                className="boton-secundario-matrices"
                onClick={limpiarResultados}
              >
                ← Volver
              </button>
              <span className="contador-matrices">
                {cantidadMatrices} matrices procesadas
              </span>
            </div>

            <div className="seccion-resultado-matrices">
              <h2>Resultado de Multiplicación de Matrices</h2>

              <div className="resumen-matrices">
                <div className="dato-resumen-matrices">
                  <span>Matrices</span>
                  <strong>{cantidadMatrices}</strong>
                </div>
                {respuestaBackend.costoMinimo !== null && (
                  <div className="dato-resumen-matrices">
                    <span>Costo mínimo de multiplicaciones</span>
                    <strong>{respuestaBackend.costoMinimo}</strong>
                  </div>
                )}
                {otrosResultados.map(([nombre, valor]) => (
                  <div className="dato-resumen-matrices" key={nombre}>
                    <span>{nombre}</span>
                    <strong>{textoCelda(valor)}</strong>
                  </div>
                ))}
              </div>

              <div className="asociacion-optima-matrices">
                <h3>Asociación óptima</h3>
                {respuestaBackend.parentizacion ? (
                  <p className="expresion-matrices">
                    {respuestaBackend.parentizacion}
                  </p>
                ) : (
                  <p className="sin-asociacion-matrices"></p>
                )}
              </div>

              <div className="tablas-resultado-matrices">
                <TablaAnimada
                  nombre="M"
                  explicacion="Costos mínimos de las multiplicaciones"
                  matriz={respuestaBackend.M}
                  celdasVisibles={celdasVisibles}
                  indiceInicial={
                    respuestaBackend.M.length === cantidadMatrices ? 1 : 0
                  }
                />
                <TablaAnimada
                  nombre="P"
                  explicacion="Posiciones óptimas para colocar los paréntesis"
                  matriz={respuestaBackend.P}
                  celdasVisibles={celdasVisibles}
                  indiceInicial={
                    respuestaBackend.P.length === cantidadMatrices ? 1 : 0
                  }
                />
              </div>
              <p className="nota-resultado-matrices"></p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
