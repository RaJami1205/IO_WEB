/** Gestiona llaves y archivos JSON; presenta las probabilidades y tablas A y R de FastAPI. */
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "../estilos/ArbolOptimo.css";

type LlaveABB = {
  llave: string;
  peso: number;
};

/** Conserva las llaves en el orden ingresado para enviarlas y exportarlas. */
type ConfiguracionABB = {
  algoritmo: "abb-optimo";
  llaves: LlaveABB[];
};

/** Mantiene el peso como texto mientras se edita en el formulario. */
type LlaveFormulario = {
  llave: string;
  peso: string;
};

/** Asocia cada llave ordenada por el backend con sus probabilidades informadas. */
type LlaveOrdenadaABB = {
  posicion: number;
  llave: string;
  peso: number;
  probabilidad: number;
  probabilidadRedondeada: number;
};

type ResultadoABB = {
  costoPromedio: number;
  raiz: string;
  llavesOrdenadas: LlaveOrdenadaABB[];
  conclusion: string;
};

/** Contiene las tablas de costos y raíces junto al resumen y sus convenciones de índices. */
type RespuestaABB = {
  A: (number | null)[][];
  R: (number | null)[][];
  resultado: ResultadoABB;
  metadatos: Record<string, unknown>;
};

const MAX_LLAVES = 10;
// Verifica que un dato sea un objeto válido, descartando valores nulos y arreglos.
function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Normaliza espacios externos, mayúsculas y acentos para detectar duplicados, conservando ñ. */
function normalizarLlave(llave: string): string {
  return llave
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/n\u0303/g, "ñ")
    .replace(/[\u0300-\u036f]/g, "");
}
// Valida que la configuración cumpla los requisitos del algoritmo ABB óptimo.
// eslint-disable-next-line react-refresh/only-export-components
export function validarConfiguracion(datos: unknown): ConfiguracionABB {
  if (!esObjeto(datos)) {
    throw new Error("La configuración debe ser un objeto JSON.");
  }
  if (
    Object.keys(datos).some((campo) => !["algoritmo", "llaves"].includes(campo))
  ) {
    throw new Error("El JSON contiene campos adicionales no permitidos.");
  }
  if (datos.algoritmo !== "abb-optimo") {
    throw new Error('El algoritmo debe ser "abb-optimo".');
  }
  if (
    !Array.isArray(datos.llaves) ||
    datos.llaves.length < 1 ||
    datos.llaves.length > MAX_LLAVES
  ) {
    throw new Error("Solo se permiten entre 1 y 10 llaves");
  }

  const nombres = new Set<string>();
  const llaves: LlaveABB[] = [];

  for (const [indice, elemento] of datos.llaves.entries()) {
    if (
      !esObjeto(elemento) ||
      Object.keys(elemento).some((campo) => !["llave", "peso"].includes(campo))
    ) {
      throw new Error(`La llave ${indice + 1} contiene campos inválidos.`);
    }
    if (
      typeof elemento.llave !== "string" ||
      elemento.llave.trim().length < 1 ||
      elemento.llave.trim().length > 40
    ) {
      throw new Error(
        `La llave ${indice + 1} debe tener entre 1 y 40 caracteres.`,
      );
    }
    if (
      typeof elemento.peso !== "number" ||
      !Number.isFinite(elemento.peso) ||
      elemento.peso < 0
    ) {
      throw new Error(
        `El peso de la llave ${indice + 1} debe ser un número no negativo y mayor que cero.`,
      );
    }
    if (elemento.peso === 0) {
      throw new Error(
        `El peso de la llave ${indice + 1} debe ser mayor que cero.`,
      );
    }
    if (
      elemento.peso > 1e12 ||
      Number(elemento.peso.toFixed(6)) !== elemento.peso
    ) {
      throw new Error(
        `El peso de la llave ${indice + 1} permite como máximo 6 decimales y 10^12.`,
      );
    }

    const nombre = elemento.llave.trim();
    const normalizado = normalizarLlave(nombre);
    if (nombres.has(normalizado)) {
      throw new Error('La llave "' + nombre + '" está repetida.');
    }
    nombres.add(normalizado);
    llaves.push({ llave: nombre, peso: elemento.peso });
  }

  return { algoritmo: "abb-optimo", llaves };
}
// Comprueba que los datos recibidos tengan la estructura de una matriz cuadrada.
function esMatriz(valor: unknown): valor is (number | null)[][] {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every(
      (fila) =>
        Array.isArray(fila) &&
        fila.length === valor.length &&
        fila.every(
          (celda: unknown) =>
            celda === null ||
            (typeof celda === "number" && Number.isFinite(celda)),
        ),
    )
  );
}
// Valida la respuesta que devuelve el backend después de realizar el cálculo.
function validarRespuesta(datos: unknown): RespuestaABB {
  if (!esObjeto(datos)) {
    throw new Error("El backend no devolvió un objeto JSON.");
  }
  if (!esObjeto(datos.tablas)) {
    throw new Error("El servidor no devolvió las tablas A y R.");
  }
  const tablas = datos.tablas;
  const A = tablas.A;
  const R = tablas.R;

  if (!esMatriz(A) || !esMatriz(R) || A.length !== R.length) {
    throw new Error(
      "Las matrices A y R del servidor tienen un formato inválido.",
    );
  }

  const resultado = datos.resultado;
  if (
    !esObjeto(resultado) ||
    typeof resultado.costoPromedio !== "number" ||
    !Number.isFinite(resultado.costoPromedio) ||
    typeof resultado.raiz !== "string" ||
    typeof resultado.conclusion !== "string" ||
    !Array.isArray(resultado.llavesOrdenadas) ||
    resultado.llavesOrdenadas.length !== A.length - 1 ||
    !resultado.llavesOrdenadas.every(
      (item: unknown) =>
        esObjeto(item) &&
        typeof item.posicion === "number" &&
        Number.isInteger(item.posicion) &&
        typeof item.llave === "string" &&
        typeof item.peso === "number" &&
        typeof item.probabilidad === "number" &&
        typeof item.probabilidadRedondeada === "number" &&
        Number.isFinite(item.probabilidad) &&
        Number.isFinite(item.probabilidadRedondeada),
    )
  ) {
    throw new Error(
      "El servidor no devolvió el resumen y las probabilidades esperadas.",
    );
  }

  const metadatos = esObjeto(datos.metadatos) ? datos.metadatos : {};
  return {
    A,
    R,
    resultado: resultado as ResultadoABB,
    metadatos,
  };
}
// Convierte diferentes tipos de datos a texto para mostrarlos en las tablas.
function textoCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? String(Number(valor.toFixed(5))) : "—";
  }
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/** Cuenta las celdas aplicables que debe revelar la animación, excluyendo null. */
function cantidadCeldas(matriz: (number | null)[][]): number {
  return matriz.reduce(
    (total, fila) => total + fila.filter((celda) => celda !== null).length,
    0,
  );
}
/** Revela las celdas aplicables de A o R con los índices de fila y columna del backend. */
function TablaAnimada({
  nombre,
  explicacion,
  matriz,
  celdasVisibles,
}: {
  nombre: string;
  explicacion: string;
  matriz: (number | null)[][];
  celdasVisibles: number;
}) {
  const columnas = Math.max(0, ...matriz.map((fila) => fila.length));
  let indiceCelda = 0;

  return (
    <div className="abb-tabla-bloque">
      <div className="abb-tabla-titulo">
        <h3>{"Matriz " + nombre}</h3>
        <p>{explicacion}</p>
      </div>
      <div className="abb-tabla-desborde">
        <table className="abb-tabla" aria-label={"Matriz " + nombre}>
          <thead>
            <tr>
              <th scope="col">i / j</th>
              {Array.from({ length: columnas }, (_, columna) => (
                <th key={columna} scope="col">
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.map((fila, numeroFila) => (
              <tr key={numeroFila}>
                <th scope="row">{numeroFila + 1}</th>
                {Array.from({ length: columnas }, (_, columna) => {
                  const existeCelda =
                    columna < fila.length && fila[columna] !== null;
                  const indiceActual = existeCelda ? indiceCelda++ : -1;
                  const visible = existeCelda && indiceActual < celdasVisibles;
                  return (
                    <td
                      key={columna}
                      className={
                        !existeCelda
                          ? "abb-celda-vacia"
                          : visible
                            ? "abb-celda-visible"
                            : "abb-celda-pendiente"
                      }
                    >
                      {visible
                        ? nombre === "A"
                          ? (fila[columna] as number).toFixed(2)
                          : textoCelda(fila[columna])
                        : ""}
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

/** Coordina el formulario de llaves, la consulta a la API y la presentación del ABB óptimo. */
export default function ArbolOptimo() {
  const [listaLlaves, cambiarListaLlaves] = useState<LlaveFormulario[]>([]);
  const [nuevaLlave, cambiarNuevaLlave] = useState("");
  const [nuevoPeso, cambiarNuevoPeso] = useState("");
  const [mensajeError, cambiarMensajeError] = useState("");
  const [mensajeExito, cambiarMensajeExito] = useState("");
  const [calculando, cambiarCalculando] = useState(false);
  const [respuestaBackend, cambiarRespuestaBackend] =
    useState<RespuestaABB | null>(null);
  const [celdasVisibles, cambiarCeldasVisibles] = useState(0);

  /** Borra la respuesta, el avance de la animación y los mensajes anteriores. */
  function limpiarResultados() {
    cambiarRespuestaBackend(null);
    cambiarCeldasVisibles(0);
    cambiarMensajeError("");
    cambiarMensajeExito("");
  }
  /** Valida las llaves agregadas y exige resolver cualquier entrada aún pendiente. */
  function obtenerConfiguracionActual(): ConfiguracionABB {
    if (nuevaLlave.trim() !== "" || nuevoPeso.trim() !== "") {
      throw new Error(
        "Tienes una llave pendiente. Agrégala o limpia los campos antes de calcular.",
      );
    }
    if (listaLlaves.some((item) => item.peso.trim() === "")) {
      throw new Error("Todas las llaves deben tener un peso.");
    }
    return validarConfiguracion({
      algoritmo: "abb-optimo",
      llaves: listaLlaves.map((item) => ({
        llave: item.llave,
        peso: Number(item.peso),
      })),
    });
  }
  /** Valida y agrega una llave con peso, comprobando duplicados y el límite de cantidad. */
  function agregarLlave(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpiarResultados();

    try {
      if (listaLlaves.length >= MAX_LLAVES) {
        throw new Error("Se permiten como máximo 10 llaves.");
      }
      if (nuevoPeso.trim() === "") {
        throw new Error("Debe agregar un peso mayor que cero.");
      }
      validarConfiguracion({
        algoritmo: "abb-optimo",
        llaves: [{ llave: nuevaLlave, peso: Number(nuevoPeso) }],
      });
      if (
        listaLlaves.some(
          (item) => normalizarLlave(item.llave) === normalizarLlave(nuevaLlave),
        )
      ) {
        throw new Error(`La llave "${nuevaLlave.trim()}" está repetida.`);
      }

      cambiarListaLlaves((actuales) => [
        ...actuales,
        { llave: nuevaLlave.trim(), peso: nuevoPeso },
      ]);
      cambiarNuevaLlave("");
      cambiarNuevoPeso("");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "No se pudo agregar la llave.",
      );
    }
  }
  /** Elimina una llave y descarta los resultados calculados previamente. */
  function eliminarLlave(indice: number) {
    limpiarResultados();
    cambiarListaLlaves((actuales) => actuales.filter((_, i) => i !== indice));
  }
  /** Valida el JSON y carga sus llaves respetando el orden del archivo. */
  async function cargarArchivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    limpiarResultados();

    try {
      const configuracion = validarConfiguracion(
        JSON.parse(await archivo.text()),
      );
      cambiarListaLlaves(
        configuracion.llaves.map((item) => ({
          llave: item.llave,
          peso: String(item.peso),
        })),
      );
      cambiarNuevaLlave("");
      cambiarNuevoPeso("");
      cambiarMensajeExito("JSON cargado correctamente.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof SyntaxError
          ? "El archivo no contiene un JSON válido."
          : error instanceof Error
            ? error.message
            : "No se pudo cargar el archivo.",
      );
    } finally {
      evento.target.value = "";
    }
  }
  /** Descarga la configuración validada en el orden de ingreso. */
  function guardarConfiguracionJson() {
    limpiarResultados();
    try {
      const contenido = JSON.stringify(obtenerConfiguracionActual(), null, 2);
      const url = URL.createObjectURL(
        new Blob([contenido], { type: "application/json" }),
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "abb-optimo.json";
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
  /** Comprueba la conexión y solicita al backend el costo, la raíz y las tablas del ABB. */
  async function calcularArbol() {
    if (calculando) return;

    limpiarResultados();
    cambiarCalculando(true);

    try {
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

      const configuracion = obtenerConfiguracionActual();

      let respuesta: Response;

      try {
        respuesta = await fetch("/api/abb-optimo", {
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

      if (!respuesta.ok) {
        let detalle = `El servidor devolvió HTTP ${respuesta.status}.`;

        try {
          const errorBackend: unknown = await respuesta.json();

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

      const datos: unknown = await respuesta.json();

      cambiarRespuestaBackend(validarRespuesta(datos));
      cambiarMensajeExito("Cálculo completado.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error
          ? error.message
          : "No fue posible calcular el árbol óptimo.",
      );
    } finally {
      cambiarCalculando(false);
    }
  }

  /** Revela las celdas aplicables de A y R y libera el temporizador al cambiar la respuesta. */
  useEffect(() => {
    if (!respuestaBackend) return;

    const total = Math.max(
      cantidadCeldas(respuestaBackend.A),
      cantidadCeldas(respuestaBackend.R),
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

  return (
    <section className="pagina-abb-optimo">
      <div className="contenedor-abb-optimo">
        {respuestaBackend === null ? (
          <>
            <header className="encabezado-abb">
              <span className="etiqueta-abb">
                PROYECTO 03 · INVESTIGACIÓN DE OPERACIONES
              </span>
              <h1>Árbol Binario de Búsqueda Óptimo</h1>
            </header>

            <div className="formulario-abb">
              <div className="seccion-configuracion-abb">
                <div>
                  <h2>Configuración del problema</h2>
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

              <div className="seccion-formulario-abb">
                <div className="encabezado-seccion-abb">
                  <h2>Agregar llave</h2>
                  <span className="contador-abb">
                    {listaLlaves.length} / {MAX_LLAVES} llaves
                  </span>
                </div>
                <form onSubmit={agregarLlave}>
                  <div className="grupo-campos-abb">
                    <div className="campo-formulario-abb">
                      <label htmlFor="nueva-llave-abb">Texto o código</label>
                      <input
                        id="nueva-llave-abb"
                        type="text"
                        maxLength={40}
                        placeholder="Ej. while"
                        value={nuevaLlave}
                        onChange={(evento) =>
                          cambiarNuevaLlave(evento.target.value)
                        }
                      />
                    </div>
                    <div className="campo-formulario-abb">
                      <label htmlFor="nuevo-peso-abb">Peso asociado</label>
                      <input
                        id="nuevo-peso-abb"
                        type="number"
                        min="0.000001"
                        max="1000000000000"
                        step="0.000001"
                        placeholder="Ej. 12.5"
                        value={nuevoPeso}
                        onChange={(evento) =>
                          cambiarNuevoPeso(evento.target.value)
                        }
                      />
                    </div>
                    <div className="accion-agregar-abb">
                      <button type="submit" className="boton-primario-abb">
                        Agregar llave
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="seccion-formulario-abb">
                <div className="encabezado-seccion-abb">
                  <div>
                    <h2>Llaves agregadas</h2>
                  </div>
                </div>
                <div className="tabla-entrada-scroll-abb">
                  <table className="tabla-entrada-abb">
                    <thead>
                      <tr>
                        <th>Orden</th>
                        <th>Llave</th>
                        <th>Peso</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaLlaves.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="sin-registros-abb">
                            Agrega al menos una llave para iniciar.
                          </td>
                        </tr>
                      ) : (
                        listaLlaves.map((item, indice) => (
                          <tr key={indice}>
                            <td>{indice + 1}</td>
                            <td style={{ textAlign: "center" }}>
                              {item.llave}
                            </td>
                            <td style={{ textAlign: "center" }}>{item.peso}</td>
                            <td>
                              <button
                                type="button"
                                className="boton-eliminar-abb"
                                onClick={() => eliminarLlave(indice)}
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
              </div>

              {mensajeError && (
                <p className="mensaje-error-abb" role="alert">
                  {mensajeError}
                </p>
              )}
              {mensajeExito && (
                <p className="mensaje-exito-abb" role="status">
                  {mensajeExito}
                </p>
              )}
              <div className="acciones-formulario-abb">
                <button
                  type="button"
                  className="boton-primario-abb"
                  disabled={calculando}
                  onClick={calcularArbol}
                >
                  {calculando ? "Calculando..." : "Calcular árbol óptimo"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="pantalla-resultado-abb">
            <div className="barra-resultado-abb">
              <button
                type="button"
                className="boton-secundario-abb"
                onClick={limpiarResultados}
              >
                ← Volver
              </button>
              <span className="contador-abb">
                {listaLlaves.length} llaves procesadas
              </span>
            </div>

            <div className="seccion-resultado-abb">
              <div className="resumen-abb">
                <div className="dato-resumen-abb">
                  <span>Llaves ingresadas</span>
                  <strong>{listaLlaves.length}</strong>
                </div>
                <div className="dato-resumen-abb">
                  <span>Costo promedio mínimo</span>
                  <strong>
                    {respuestaBackend.resultado.costoPromedio.toFixed(2)}
                  </strong>
                </div>
                <div className="dato-resumen-abb">
                  <span>Raíz óptima</span>
                  <strong>{respuestaBackend.resultado.raiz}</strong>
                </div>
              </div>

              <p className="nota-resultado-abb">
                {respuestaBackend.resultado.conclusion}
              </p>

              <div className="tabla-entrada-scroll-abb">
                <h3>Llaves ordenadas y probabilidades utilizadas</h3>
                <table className="tabla-entrada-abb">
                  <thead>
                    <tr>
                      <th>Posición</th>
                      <th>Llave</th>
                      <th>Peso</th>
                      <th>Prob. exacta</th>
                      <th>Prob. utilizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respuestaBackend.resultado.llavesOrdenadas.map((item) => (
                      <tr key={item.posicion}>
                        <td>{item.posicion}</td>
                        <td>{item.llave}</td>
                        <td>{textoCelda(item.peso)}</td>
                        <td>{item.probabilidad.toFixed(6)}</td>
                        <td>{item.probabilidadRedondeada.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tablas-resultado-abb">
                <TablaAnimada
                  nombre="A"
                  explicacion="Costos de los subárboles"
                  matriz={respuestaBackend.A}
                  celdasVisibles={celdasVisibles}
                />
                <TablaAnimada
                  nombre="R"
                  explicacion="Posiciones de las raíces;"
                  matriz={respuestaBackend.R}
                  celdasVisibles={celdasVisibles}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
