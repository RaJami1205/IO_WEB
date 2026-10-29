import { useState } from "react";
import "../estilos/Mochila.css";
import type { ChangeEvent, FormEvent } from "react";

type Variante = "acotada" | "0-1" | "no-acotada";
//nombre del objeto
type ObjetoMochila = {
  nombre: string;
  peso: number;
  valor: number;
  cantidad?: number;
};

type ConfiguracionMochila = {
  algoritmo: "mochila";
  variante: Variante;
  capacidad: number;
  objetos: ObjetoMochila[];
};

type RespuestaMochila = {
  resultado: Record<string, unknown>;
  tablas: {
    V: unknown[][];
    decision: unknown[][];
    opciones: unknown[][];
    marca: unknown[][];
  };
  metadatos: Record<string, unknown>;
};

/** Identifica un objeto JSON (excluye null y arreglos). */
function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
//valida que el json cumpla con el formato dado en el requerimiento
// eslint-disable-next-line react-refresh/only-export-components
export function validarConfiguracion(datos: unknown): ConfiguracionMochila {
  if (!esObjeto(datos)) throw new Error("El JSON debe ser un objeto.");
  if (
    Object.keys(datos).some(
      (clave) =>
        !["algoritmo", "variante", "capacidad", "objetos"].includes(clave),
    )
  ) {
    throw new Error("El JSON tiene campos adicionales no permitidos.");
  }
  if (datos.algoritmo !== "mochila") {
    throw new Error("El campo algoritmo debe ser 'mochila'.");
  }
  if (!["acotada", "0-1", "no-acotada"].includes(String(datos.variante))) {
    throw new Error("Variante incorrecta.");
  }
  if (
    typeof datos.capacidad !== "number" ||
    !Number.isInteger(datos.capacidad) ||
    datos.capacidad < 1 ||
    datos.capacidad > 20
  ) {
    throw new Error("La capacidad debe ser un entero entre 1 y 20.");
  }
  if (
    !Array.isArray(datos.objetos) ||
    datos.objetos.length < 1 ||
    datos.objetos.length > 10
  ) {
    throw new Error("Debes proporcionar entre 1 y 10 objetos.");
  }
  //objetos
  const nombres = new Set<string>();
  for (const [indice, objeto] of datos.objetos.entries()) {
    if (
      !esObjeto(objeto) ||
      typeof objeto.nombre !== "string" ||
      objeto.nombre.trim() === "" ||
      typeof objeto.peso !== "number" ||
      !Number.isInteger(objeto.peso) ||
      objeto.peso <= 0 ||
      typeof objeto.valor !== "number" ||
      !Number.isFinite(objeto.valor) ||
      objeto.valor <= 0 ||
      objeto.valor > 1e12 ||
      Number(objeto.valor.toFixed(6)) !== objeto.valor
    ) {
      throw new Error(
        `El objeto ${indice + 1} necesita nombre, peso entero positivo y valor positivo (máximo 10^12 y 6 decimales).`,
      );
    }
    if (
      Object.keys(objeto).some(
        (clave) => !["nombre", "peso", "valor", "cantidad"].includes(clave),
      )
    ) {
      throw new Error(`El objeto ${indice + 1} tiene campos adicionales.`);
    }
    const nombreNormalizado = objeto.nombre.trim().toLocaleLowerCase();
    if (nombres.has(nombreNormalizado)) {
      throw new Error(`El nombre '${objeto.nombre}' está repetido.`);
    }
    nombres.add(nombreNormalizado);
    if (
      datos.variante === "acotada" &&
      (typeof objeto.cantidad !== "number" ||
        !Number.isInteger(objeto.cantidad) ||
        objeto.cantidad <= 0)
    ) {
      throw new Error(
        `El objeto ${indice + 1} necesita cantidad entera mayor que cero.`,
      );
    }
  }

  return datos as ConfiguracionMochila;
}

//valida la respuesta del back
function validarRespuesta(datos: unknown): RespuestaMochila {
  if (
    !esObjeto(datos) ||
    !esObjeto(datos.resultado) ||
    !esObjeto(datos.tablas)
  ) {
    throw new Error("El servidor no devolvió resultado y tablas válidos.");
  }
  const tablas = datos.tablas;
  if (
    !["V", "decision", "opciones", "marca"].every(
      (nombre) =>
        Array.isArray(tablas[nombre]) &&
        (tablas[nombre] as unknown[]).every(Array.isArray),
    )
  ) {
    throw new Error("Faltan matrices de V, decision, opciones o marca.");
  }
  return {
    resultado: datos.resultado,
    tablas: tablas as RespuestaMochila["tablas"],
    metadatos: esObjeto(datos.metadatos) ? datos.metadatos : {},
  };
}

//convierte dato en texto para mostrar
function textoCelda(valor: unknown): string {
  if (valor === null) return "null";
  if (valor === undefined) return "—";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}
//funcion mochila incluye todo el calculo y llamadas durante la ejecucion
export default function Mochila() {
  const [variante, cambiarVariante] = useState<Variante>("0-1");
  const [capacidad, cambiarCapacidad] = useState("");
  const [nombre, cambiarNombre] = useState("");
  const [peso, cambiarPeso] = useState("");
  const [valor, cambiarValor] = useState("");
  const [cantidad, cambiarCantidad] = useState("");
  const [listaEquipos, cambiarListaEquipos] = useState<ObjetoMochila[]>([]);
  const [mostrarTodoResultado, cambiarMostrarTodoResultado] = useState(true);
  const [resultadoBackend, cambiarResultadoBackend] =
    useState<RespuestaMochila | null>(null);
  const [calculando, cambiarCalculando] = useState(false);
  const [mensajeError, cambiarMensajeError] = useState("");
  const [mensajeExito, cambiarMensajeExito] = useState("");

  function limpiarResultados() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    cambiarResultadoBackend(null);
  }

  //metodo que carga el json del usuario y actualiza
  async function cargarArchivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    limpiarResultados();
    try {
      const configuracion = validarConfiguracion(
        //valida que cumpla con los parametros. luego actualiza
        JSON.parse(await archivo.text()),
      );
      cambiarVariante(configuracion.variante);
      cambiarCapacidad(String(configuracion.capacidad));
      cambiarListaEquipos(configuracion.objetos);
      cambiarNombre("");
      cambiarPeso("");
      cambiarValor("");
      cambiarCantidad("");
      cambiarMensajeExito("Configuración cargada.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "No se pudo cargar el JSON.",
      );
    }
    evento.target.value = "";
  }

  //obtiene los parametros actuales para enviar al backend a calcular
  function obtenerConfiguracionActual(): ConfiguracionMochila {
    if (capacidad.trim() === "")
      throw new Error("Ingresa la capacidad de la mochila.");
    const objetos = listaEquipos.map((objeto) =>
      variante === "acotada"
        ? { ...objeto }
        : { nombre: objeto.nombre, peso: objeto.peso, valor: objeto.valor },
    );

    return validarConfiguracion({
      algoritmo: "mochila",
      variante,
      capacidad: Number(capacidad),
      objetos,
    });
  }

  //descarga el json actual a solicitud del usuario
  function guardarConfiguracionJson() {
    cambiarMensajeError("");
    try {
      const archivo = new Blob(
        [JSON.stringify(obtenerConfiguracionActual(), null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "mochila.json";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      cambiarMensajeExito("Archivo JSON guardado.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    }
  }

  //valida y obtiene un nuevo objeto para ingreso a la tabla, se exige cantidad solo cuando se requiere
  function agregarEquipo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpiarResultados();
    if (listaEquipos.length >= 10) {
      cambiarMensajeError("Solo puedes agregar hasta 10 objetos.");
      return;
    }
    if (
      listaEquipos.some(
        (objeto) =>
          objeto.nombre.trim().toLocaleLowerCase() ===
          nombre.trim().toLocaleLowerCase(),
      )
    ) {
      cambiarMensajeError("Ya existe un objeto con ese nombre.");
      return;
    }
    if (
      nombre.trim() === "" ||
      peso.trim() === "" ||
      valor.trim() === "" ||
      !Number.isInteger(Number(peso)) ||
      Number(peso) <= 0 ||
      !Number.isFinite(Number(valor)) ||
      Number(valor) <= 0 ||
      Number(valor) > 1e12 ||
      Number(Number(valor).toFixed(6)) !== Number(valor)
    ) {
      cambiarMensajeError(
        "Ingresa un nombre, peso entero positivo y valor positivo (máximo 10^12 y 6 decimales).",
      );
      return;
    }
    if (
      variante === "acotada" &&
      (cantidad.trim() === "" ||
        !Number.isInteger(Number(cantidad)) ||
        Number(cantidad) <= 0)
    ) {
      cambiarMensajeError("La cantidad debe ser un entero mayor a cero.");
      return;
    }

    cambiarListaEquipos((objetos) => [
      ...objetos,
      {
        nombre: nombre.trim(),
        peso: Number(peso),
        valor: Number(valor),
        ...(variante === "acotada" ? { cantidad: Number(cantidad) } : {}),
      },
    ]);
    cambiarNombre("");
    cambiarPeso("");
    cambiarValor("");
    cambiarCantidad("");
  }

  //elimina objeto de la tabla de equipos
  function eliminarEquipo(indice: number) {
    limpiarResultados();
    cambiarListaEquipos((objetos) => objetos.filter((_, i) => i !== indice));
  }

  //solicita el ingreso de cantidad cuando se escoje el cambio de variable
  function actualizarCantidadObjeto(indice: number, texto: string) {
    limpiarResultados();
    cambiarListaEquipos((objetos) =>
      objetos.map(
        (objeto, i) =>
          i === indice
            ? { ...objeto, cantidad: texto === "" ? undefined : Number(texto) }
            : objeto,
        9,
      ),
    );
  }

  //envia toda la informacion al backen con fastapi
  async function calcularMochila() {
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
        respuesta = await fetch("/api/problema-mochila", {
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
        let mensaje = `Error HTTP ${respuesta.status} del servidor.`;

        try {
          const errorBackend: unknown = await respuesta.json();

          if (esObjeto(errorBackend)) {
            if (typeof errorBackend.detail === "string") {
              mensaje = errorBackend.detail;
            } else if (Array.isArray(errorBackend.detail)) {
              const detalles = errorBackend.detail
                .filter(esObjeto)
                .map((detalle) => {
                  const ubicacion = Array.isArray(detalle.loc)
                    ? detalle.loc.join(".")
                    : "entrada";

                  return `${ubicacion}: ${String(detalle.msg)} (${String(detalle.type)})`;
                });

              if (detalles.length > 0) {
                mensaje = detalles.join(" | ");
              }
            }
          }
        } catch {
          // Si el backend no devuelve un JSON válido, se conserva el mensaje HTTP.
        }

        throw new Error(mensaje);
      }

      const datos: unknown = await respuesta.json();

      cambiarResultadoBackend(validarRespuesta(datos));
      cambiarMostrarTodoResultado(true);
      cambiarMensajeExito("Cálculo completado.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error
          ? error.message
          : "No fue posible calcular el problema de la mochila.",
      );
    } finally {
      cambiarCalculando(false);
    }
  }
  return (
    <div
      className="mochila-pagina"
      style={{ maxHeight: "calc(100dvh - 90px)", overflowY: "auto" }}
    >
      {!resultadoBackend && (
        <>
          <p className="mochila-badge">Investigación de Operaciones</p>

          <h1>Problema de la Mochila</h1>

          {/* 1. DATOS DE ENTRADA           */}

          <section className="mochila-panel">
            <h2>1. Datos de entrada</h2>

            <div className="mochila-grid">
              <label>
                Variante
                <select
                  value={variante}
                  onChange={(evento) => {
                    cambiarVariante(evento.target.value as Variante);
                    limpiarResultados();
                  }}
                >
                  <option value="0-1">0-1</option>
                  <option value="acotada">Acotada</option>
                  <option value="no-acotada">No acotada</option>
                </select>
              </label>

              <label>
                Capacidad de la mochila
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={capacidad}
                  onChange={(evento) => {
                    cambiarCapacidad(evento.target.value);
                    limpiarResultados();
                  }}
                  placeholder="Ej. 10"
                />
              </label>

              <label>
                Cargar configuración JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={cargarArchivoJson}
                />
              </label>
            </div>

            <div className="mochila-acciones">
              <button type="button" onClick={guardarConfiguracionJson}>
                Guardar JSON
              </button>
            </div>
          </section>

          {/* 2. AGREGAR OBJETO            */}

          <section className="mochila-panel">
            <h2>2. Agregar objeto</h2>

            <form onSubmit={agregarEquipo}>
              <div className="mochila-grid">
                <label>
                  Nombre
                  <input
                    value={nombre}
                    onChange={(evento) => cambiarNombre(evento.target.value)}
                    placeholder="Objeto A"
                    required
                  />
                </label>

                <label>
                  Peso
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={peso}
                    onChange={(evento) => cambiarPeso(evento.target.value)}
                    required
                  />
                </label>

                <label>
                  Valor / beneficio
                  <input
                    type="number"
                    min="0.000001"
                    max="1000000000000"
                    step="0.000001"
                    value={valor}
                    onChange={(evento) => cambiarValor(evento.target.value)}
                    required
                  />
                </label>

                {variante === "acotada" && (
                  <label>
                    Cantidad disponible
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={cantidad}
                      onChange={(evento) =>
                        cambiarCantidad(evento.target.value)
                      }
                      required
                    />
                  </label>
                )}
              </div>

              <div className="mochila-acciones">
                <button className="mochila-primario" type="submit">
                  Agregar objeto
                </button>
              </div>
            </form>
          </section>

          {/* 3. OBJETOS AGREGADOS tabla        */}

          <section className="mochila-panel">
            <h2>3. Objetos agregados ({listaEquipos.length})</h2>

            <div className="mochila-desborde">
              <table className="mochila-tabla-objetos">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Peso</th>
                    <th>Valor</th>

                    {variante === "acotada" && <th>Cantidad</th>}

                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {listaEquipos.map((objeto, indice) => (
                    <tr key={indice}>
                      <td>{objeto.nombre}</td>
                      <td>{objeto.peso}</td>
                      <td>{objeto.valor}</td>

                      {variante === "acotada" && (
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="mochila-cantidad-input"
                            aria-label={`Cantidad disponible de ${objeto.nombre}`}
                            value={objeto.cantidad ?? ""}
                            onChange={(evento) =>
                              actualizarCantidadObjeto(
                                indice,
                                evento.target.value,
                              )
                            }
                          />
                        </td>
                      )}

                      <td>
                        <button
                          type="button"
                          onClick={() => eliminarEquipo(indice)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mochila-acciones">
              <button
                className="mochila-primario"
                type="button"
                disabled={calculando}
                onClick={calcularMochila}
              >
                {calculando ? "Calculando..." : "Calcular mochila"}
              </button>
            </div>
          </section>

          {/* MENSAJES DEL SISTEMA         */}

          {mensajeError && (
            <p className="mochila-alerta mochila-error" role="alert">
              {mensajeError}
            </p>
          )}

          {mensajeExito && (
            <p className="mochila-alerta mochila-exito" role="status">
              {mensajeExito}
            </p>
          )}
        </>
      )}

      {/* 4. RESULTADO DEL ALGORITMO   */}
      {resultadoBackend && (
        <>
          <div
            className="mochila-acciones"
            style={{
              justifyContent: "flex-start",
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "#f8fafc",
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
          <section className="mochila-panel">
            <h2>4. Resultado del algoritmo</h2>

            {resultadoBackend ? (
              <>
                {/* RESUMEN DE LA SOLUCIÓN */}

                <div className="mochila-resumen">
                  <h3>Solución óptima</h3>

                  <div className="mochila-resumen-datos">
                    <div className="mochila-dato">
                      <span>Valor óptimo</span>

                      <strong>
                        {textoCelda(resultadoBackend.resultado.valorOptimo)}
                      </strong>
                    </div>

                    <div className="mochila-dato">
                      <span>Peso utilizado</span>

                      <strong>
                        {textoCelda(resultadoBackend.resultado.pesoUsado)}
                        {" / "}
                        {capacidad}
                      </strong>
                    </div>

                    <div className="mochila-dato">
                      <span>Variante</span>

                      <strong>{variante}</strong>
                    </div>

                    <div className="mochila-dato">
                      <span>¿Hay empates?</span>

                      <strong>
                        {resultadoBackend.resultado.hayEmpates === true
                          ? "Sí"
                          : "No"}
                      </strong>
                    </div>
                  </div>

                  {/* OBJETOS DE LA SOLUCIÓN */}

                  <div className="mochila-seleccion">
                    <h4>Objetos seleccionados</h4>

                    {Array.isArray(resultadoBackend.resultado.seleccion) &&
                    resultadoBackend.resultado.seleccion.length > 0 ? (
                      <ul>
                        {resultadoBackend.resultado.seleccion.map(
                          (objeto, indice) => (
                            <li key={indice}>
                              {esObjeto(objeto) ? (
                                <>
                                  <strong>{textoCelda(objeto.nombre)}</strong>

                                  <span>
                                    {" — Cantidad: "}
                                    {textoCelda(objeto.cantidad)}
                                  </span>

                                  <span>
                                    {" | Peso: "}
                                    {textoCelda(objeto.pesoTotal)}
                                  </span>

                                  <span>
                                    {" | Valor: "}
                                    {textoCelda(objeto.valorTotal)}
                                  </span>
                                </>
                              ) : (
                                textoCelda(objeto)
                              )}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p>No se seleccionaron objetos.</p>
                    )}
                  </div>

                  {/* CONCLUSIÓN DEL BACKEND */}

                  <div className="mochila-conclusion">
                    <h4>Conclusión</h4>

                    <p>{textoCelda(resultadoBackend.resultado.conclusion)}</p>
                  </div>
                </div>

                {/* ÚNICA TABLA DE RESULTADOS     */}

                <div className="mochila-bloque">
                  <div className="mochila-tabla-encabezado">
                    <h3>Tabla de programación dinámica</h3>
                  </div>

                  {mostrarTodoResultado && (
                    <>
                      {/* LEYENDA DE LOS COLORES */}

                      <p className="mochila-leyenda">
                        <span className="celda-verde">
                          Verde: utiliza el objeto
                        </span>

                        {" | "}

                        <span className="celda-roja">
                          Rojo: no utiliza el objeto
                        </span>
                      </p>

                      {/* TABLA V CON MARCAS */}

                      <div className="mochila-desborde">
                        <table className="mochila-tabla-resultados">
                          <thead>
                            <tr>
                              <th>Cap.</th>

                              {resultadoBackend.tablas.V[0]?.map((_, indice) =>
                                indice === 0 ? null : (
                                  <th key={indice}>
                                    {listaEquipos[indice - 1]?.nombre ??
                                      `Objeto ${indice}`}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>

                          <tbody>
                            {resultadoBackend.tablas.V.map(
                              (fila, capacidadFila) => (
                                <tr key={capacidadFila}>
                                  <th>{capacidadFila}</th>

                                  {fila.map((dato, indice) =>
                                    indice === 0 ? null : (
                                      <td
                                        key={indice}
                                        className={
                                          resultadoBackend.tablas.marca[
                                            capacidadFila
                                          ]?.[indice] === "verde"
                                            ? "celda-verde"
                                            : resultadoBackend.tablas.marca[
                                                  capacidadFila
                                                ]?.[indice] === "rojo"
                                              ? "celda-roja"
                                              : ""
                                        }
                                        title={`
Valor: ${textoCelda(dato)}

Copias elegidas: ${textoCelda(
                                          resultadoBackend.tablas.decision[
                                            capacidadFila
                                          ]?.[indice],
                                        )}

Opciones: ${textoCelda(
                                          resultadoBackend.tablas.opciones[
                                            capacidadFila
                                          ]?.[indice],
                                        )}

Marca: ${textoCelda(resultadoBackend.tablas.marca[capacidadFila]?.[indice])}
`}
                                      >
                                        {textoCelda(dato)}
                                      </td>
                                    ),
                                  )}
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p></p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
