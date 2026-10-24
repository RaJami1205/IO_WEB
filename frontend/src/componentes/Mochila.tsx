import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type Variante = "acotada" | "0-1" | "no-acotada";

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

const API_MOCHILA = "http://127.0.0.1:8000/api/problema-mochila";

/** Identifica un objeto JSON (excluye null y arreglos). */
function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Verifica que los datos de entrada cumplan el formato del problema Mochila. */
function validarConfiguracion(datos: unknown): ConfiguracionMochila {
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

/** Valida las secciones oficiales sin asumir nombres dentro de resultado. */
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

/** Convierte un dato simple en texto para mostrar los campos originales del JSON. */
function textoCelda(valor: unknown): string {
  if (valor === null) return "null";
  if (valor === undefined) return "—";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

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

  /** Limpia avisos y datos calculados para no mostrar resultados desactualizados. */
  function limpiarResultados() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    cambiarResultadoBackend(null);
  }

  /** Carga el JSON de entrada y actualiza la lista de objetos. */
  async function cargarArchivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    limpiarResultados();
    try {
      const configuracion = validarConfiguracion(
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

  /**
   * Genera el cuerpo del POST con los campos exactos del backend:
   * algoritmo, variante, capacidad y objetos (nombre, peso, valor, cantidad).
   * Incluye todos los objetos agregados a la lista.
   */
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

  /** Descarga el JSON de entrada que se enviaría al servidor. */
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

  /** Valida y agrega un objeto a la tabla; cantidad solo se exige en acotada. */
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

  /** Elimina un objeto de la lista. */
  function eliminarEquipo(indice: number) {
    limpiarResultados();
    cambiarListaEquipos((objetos) => objetos.filter((_, i) => i !== indice));
  }

  /** Permite editar la cantidad disponible cuando se cambia a variante acotada. */
  function actualizarCantidadObjeto(indice: number, texto: string) {
    limpiarResultados();
    cambiarListaEquipos((objetos) =>
      objetos.map((objeto, i) =>
        i === indice
          ? { ...objeto, cantidad: texto === "" ? undefined : Number(texto) }
          : objeto,
      ),
    );
  }

  /** Envía el JSON a FastAPI y guarda resultado, tablas y metadatos; no muestra pasos. */
  async function calcularMochila() {
    if (calculando) return;
    limpiarResultados();
    try {
      const configuracion = obtenerConfiguracionActual();
      cambiarCalculando(true);
      const respuesta = await fetch(API_MOCHILA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configuracion),
      });
      if (!respuesta.ok) {
        if (respuesta.status === 422) {
          const errorBackend: unknown = await respuesta.json();
          if (esObjeto(errorBackend) && Array.isArray(errorBackend.detail)) {
            const detalles = errorBackend.detail
              .filter(esObjeto)
              .map((detalle) => {
                const ubicacion = Array.isArray(detalle.loc)
                  ? detalle.loc.join(".")
                  : "entrada";
                return `${ubicacion}: ${String(detalle.msg)} (${String(detalle.type)})`;
              });
            throw new Error(
              detalles.join(" | ") || "Datos rechazados por el servidor.",
            );
          }
        }
        throw new Error(`Error HTTP ${respuesta.status} del servidor.`);
      }
      cambiarResultadoBackend(validarRespuesta(await respuesta.json()));
      cambiarMostrarTodoResultado(true);
      cambiarMensajeExito("Cálculo completado.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "No se pudo calcular.",
      );
    } finally {
      cambiarCalculando(false);
    }
  }

  return (
    <div className="mochila-pagina">
      <p className="mochila-badge">Investigación de Operaciones</p>
      <h1>Problema de la Mochila</h1>
      <p>
        Mochila 0-1, acotada y no-acotada. El cálculo se realiza en FastAPI.
      </p>

      <section className="mochila-panel">
        <h2>1. Datos de entrada</h2>
        <div className="mochila-grid">
          <label>
            Variante
            <select
              value={variante}
              onChange={(e) => {
                cambiarVariante(e.target.value as Variante);
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
              onChange={(e) => {
                cambiarCapacidad(e.target.value);
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

      <section className="mochila-panel">
        <h2>2. Agregar objeto</h2>
        <form onSubmit={agregarEquipo}>
          <div className="mochila-grid">
            <label>
              Nombre
              <input
                value={nombre}
                onChange={(e) => cambiarNombre(e.target.value)}
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
                onChange={(e) => cambiarPeso(e.target.value)}
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
                onChange={(e) => cambiarValor(e.target.value)}
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
                  onChange={(e) => cambiarCantidad(e.target.value)}
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

      <section className="mochila-panel">
        <h2>3. Objetos ({listaEquipos.length})</h2>
        <div className="mochila-desborde">
          <table>
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
                        onChange={(e) =>
                          actualizarCantidadObjeto(indice, e.target.value)
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

      <section className="mochila-panel">
        <h2>4. Resultado del algoritmo</h2>
        {resultadoBackend ? (
          <>
            <div className="mochila-acciones">
              <button
                type="button"
                onClick={() => cambiarMostrarTodoResultado(true)}
              >
                Mostrar todo
              </button>
              <button
                type="button"
                onClick={() => cambiarMostrarTodoResultado(false)}
              >
                Solo resultado
              </button>
            </div>

            {/* Resumen: los nombres se toman directamente del resultado JSON. */}
            <div className="mochila-bloque">
              <h3>Solución óptima</h3>
              <div className="mochila-subcampos">
                {Object.entries(resultadoBackend.resultado).map(
                  ([clave, dato]) => (
                    <div className="mochila-dato" key={clave}>
                      <h4>{clave}</h4>
                      {Array.isArray(dato) && dato.every(esObjeto) ? (
                        <div className="mochila-desborde">
                          <table>
                            <thead>
                              <tr>
                                <th>#</th>
                                {Array.from(
                                  new Set(
                                    dato.flatMap((objeto) =>
                                      Object.keys(objeto),
                                    ),
                                  ),
                                ).map((campo) => (
                                  <th key={campo}>{campo}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {dato.map((objeto, indice) => (
                                <tr key={indice}>
                                  <th>{indice + 1}</th>
                                  {Array.from(
                                    new Set(
                                      dato.flatMap((registro) =>
                                        Object.keys(registro),
                                      ),
                                    ),
                                  ).map((campo) => (
                                    <td key={campo}>
                                      {textoCelda(objeto[campo])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {dato.length === 0 && (
                            <p>Sin objetos seleccionados.</p>
                          )}
                        </div>
                      ) : (
                        <p>
                          {clave === "hayEmpates" && typeof dato === "boolean"
                            ? dato
                              ? "Sí"
                              : "No"
                            : textoCelda(dato)}
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Las cuatro matrices se leen de tablas: V, decision, opciones, marca. */}
            {mostrarTodoResultado && (
              <>
                <h3>Tablas de programación dinámica</h3>
                <p>
                  Filas: capacidad de 0 a {capacidad}. Columnas: objeto 0
                  (ninguno) y objetos del 1 al {listaEquipos.length}.
                </p>
                <p>
                  Verde: se utiliza el objeto de la columna. Rojo: se conserva
                  el resultado de la columna anterior. En empates se elige el
                  menor k.
                </p>

                {(["V", "decision", "opciones", "marca"] as const).map(
                  (nombreTabla) => (
                    <div className="mochila-bloque" key={nombreTabla}>
                      <h4>
                        {nombreTabla === "V" &&
                          "V — Valor óptimo por capacidad"}
                        {nombreTabla === "decision" &&
                          "decision — Copias elegidas (k)"}
                        {nombreTabla === "opciones" &&
                          "opciones — Copias empatadas"}
                        {nombreTabla === "marca" &&
                          "marca — Uso de cada objeto"}
                      </h4>
                      <div className="mochila-desborde">
                        <table className="mochila-tabla-resultados">
                          <thead>
                            <tr>
                              <th>Capacidad</th>
                              {Array.from(
                                {
                                  length:
                                    resultadoBackend.tablas[nombreTabla][0]
                                      ?.length ?? 0,
                                },
                                (_, indice) => (
                                  <th key={indice}>
                                    {indice === 0
                                      ? "0 — Sin objetos"
                                      : `${indice} — ${listaEquipos[indice - 1]?.nombre ?? "Objeto"}`}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {resultadoBackend.tablas[nombreTabla].map(
                              (fila, capacidadFila) => (
                                <tr key={capacidadFila}>
                                  <th>{capacidadFila}</th>
                                  {fila.map((dato, indice) => (
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
                                    >
                                      {Array.isArray(dato)
                                        ? dato.length > 0
                                          ? dato.join(", ")
                                          : "—"
                                        : textoCelda(dato)}
                                    </td>
                                  ))}
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ),
                )}

                <div className="mochila-bloque">
                  <h3>Metadatos de los ejes</h3>
                  {Object.entries(resultadoBackend.metadatos).length > 0 ? (
                    Object.entries(resultadoBackend.metadatos).map(
                      ([clave, dato]) => (
                        <p key={clave}>
                          <strong>{clave}:</strong> {textoCelda(dato)}
                        </p>
                      ),
                    )
                  ) : (
                    <p>El servidor no incluyó metadatos adicionales.</p>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <p></p>
        )}
      </section>
    </div>
  );
}
