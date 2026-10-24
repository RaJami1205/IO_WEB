import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type Variante = "acotada" | "0/1" | "no acotada";

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

// La salida conserva los nombres originales del JSON que envía FastAPI.
// No se supone una estructura fija para resultado, tablas ni metadatos.
type RespuestaMochila = Record<string, unknown>;

// Mantener la ruta que ya utilizabas; confirma las mayúsculas con tu backend.
const API_MOCHILA = "http://127.0.0.1:8000/api/Mochila";

/** Identifica un objeto JSON (excluye null y arreglos). */
function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Verifica que los datos de entrada cumplan el formato del problema Mochila. */
function validarConfiguracion(datos: unknown): ConfiguracionMochila {
  if (!esObjeto(datos)) throw new Error("El JSON debe ser un objeto.");
  if (datos.algoritmo !== "mochila") {
    throw new Error("El campo algoritmo debe ser 'mochila'.");
  }
  if (!["acotada", "0/1", "no acotada"].includes(String(datos.variante))) {
    throw new Error("Variante incorrecta.");
  }
  if (
    typeof datos.capacidad !== "number" ||
    !Number.isFinite(datos.capacidad) ||
    datos.capacidad < 0
  ) {
    throw new Error("La capacidad debe ser un número no negativo.");
  }
  if (!Array.isArray(datos.objetos) || datos.objetos.length === 0) {
    throw new Error("Debes proporcionar al menos un objeto.");
  }

  for (const [indice, objeto] of datos.objetos.entries()) {
    if (
      !esObjeto(objeto) ||
      typeof objeto.nombre !== "string" ||
      objeto.nombre.trim() === "" ||
      typeof objeto.peso !== "number" ||
      !Number.isFinite(objeto.peso) ||
      objeto.peso <= 0 ||
      typeof objeto.valor !== "number" ||
      !Number.isFinite(objeto.valor) ||
      objeto.valor <= 0
    ) {
      throw new Error(
        `El objeto ${indice + 1} debe tener nombre, peso y valor válidos.`,
      );
    }
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

/** Acepta cualquier JSON de respuesta que sea objeto, sin inventar campos. */
function validarRespuesta(datos: unknown): RespuestaMochila {
  if (!esObjeto(datos)) {
    throw new Error("El servidor debe devolver un objeto JSON.");
  }
  return datos;
}

/** Convierte un dato simple en texto. Los objetos se muestran con sus propias claves. */
function textoCelda(valor: unknown): string {
  if (valor === null) return "null";
  if (valor === undefined) return "—";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/**
 * Pinta un campo del backend usando exactamente su nombre.
 * Soporta: valor simple, objeto, arreglo, lista de objetos o matriz numérica.
 * No dibuja ninguna propiedad llamada 'pasos'.
 */
function CampoResultado({ nombre, dato }: { nombre: string; dato: unknown }) {
  if (nombre === "pasos") return null;

  if (Array.isArray(dato)) {
    if (dato.length === 0) {
      return (
        <div className="mochila-bloque">
          <h4>{nombre}</h4>
          <p>Sin registros.</p>
        </div>
      );
    }

    // Tabla bidimensional: tantas filas y columnas como devuelve FastAPI.
    if (dato.every(Array.isArray)) {
      const filas = dato as unknown[][];
      const columnas = Math.max(0, ...filas.map((fila) => fila.length));
      return (
        <div className="mochila-bloque">
          <h4>{nombre}</h4>
          <div className="mochila-desborde">
            <table>
              <thead>
                <tr>
                  <th>Fila / Columna</th>
                  {Array.from({ length: columnas }, (_, i) => (
                    <th key={i}>{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => (
                  <tr key={i}>
                    <th>{i}</th>
                    {Array.from({ length: columnas }, (_, j) => (
                      <td key={j}>{textoCelda(fila[j])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Lista de objetos: columnas obtenidas de los nombres reales del JSON.
    if (dato.every(esObjeto)) {
      const registros = dato as Record<string, unknown>[];
      const columnas = Array.from(
        new Set(
          registros.flatMap((registro) =>
            Object.keys(registro).filter((clave) => clave !== "pasos"),
          ),
        ),
      );
      return (
        <div className="mochila-bloque">
          <h4>{nombre}</h4>
          <div className="mochila-desborde">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {columnas.map((clave) => (
                    <th key={clave}>{clave}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((registro, i) => (
                  <tr key={i}>
                    <th>{i + 1}</th>
                    {columnas.map((clave) => (
                      <td key={clave}>{textoCelda(registro[clave])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Arreglo plano: se presenta completo con índices visibles.
    return (
      <div className="mochila-bloque">
        <h4>{nombre}</h4>
        <div className="mochila-desborde">
          <table>
            <thead>
              <tr>
                <th>Índice</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {dato.map((valor, i) => (
                <tr key={i}>
                  <th>{i}</th>
                  <td>{textoCelda(valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (esObjeto(dato)) {
    return (
      <div className="mochila-bloque">
        <h3>{nombre}</h3>
        <div className="mochila-subcampos">
          {Object.entries(dato)
            .filter(([clave]) => clave !== "pasos")
            .map(([clave, valor]) => (
              <CampoResultado key={clave} nombre={clave} dato={valor} />
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mochila-dato">
      <span>{nombre}</span>
      <strong>{textoCelda(dato)}</strong>
    </div>
  );
}

export default function Mochila() {
  const [variante, cambiarVariante] = useState<Variante>("0/1");
  const [capacidad, cambiarCapacidad] = useState("");
  const [nombre, cambiarNombre] = useState("");
  const [peso, cambiarPeso] = useState("");
  const [valor, cambiarValor] = useState("");
  const [cantidad, cambiarCantidad] = useState("");
  const [listaEquipos, cambiarListaEquipos] = useState<ObjetoMochila[]>([]);
  const [indicesSeleccionados, cambiarIndicesSeleccionados] = useState<
    number[]
  >([]);
  const [soloSeleccionados, cambiarSoloSeleccionados] = useState(false);
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

  /** Carga el JSON de entrada y selecciona todos los objetos importados. */
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
      cambiarIndicesSeleccionados(configuracion.objetos.map((_, i) => i));
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
   * Solo incluye los objetos marcados en la tabla.
   */
  function obtenerConfiguracionActual(): ConfiguracionMochila {
    if (capacidad.trim() === "")
      throw new Error("Ingresa la capacidad de la mochila.");
    const objetos = listaEquipos
      .filter((_, i) => indicesSeleccionados.includes(i))
      .map((objeto) =>
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
    if (
      nombre.trim() === "" ||
      peso.trim() === "" ||
      valor.trim() === "" ||
      !Number.isFinite(Number(peso)) ||
      Number(peso) <= 0 ||
      !Number.isFinite(Number(valor)) ||
      Number(valor) <= 0
    ) {
      cambiarMensajeError("Ingresa nombre, peso y valor válidos.");
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
    cambiarIndicesSeleccionados((indices) => [...indices, listaEquipos.length]);
    cambiarNombre("");
    cambiarPeso("");
    cambiarValor("");
    cambiarCantidad("");
  }

  /** Quita un objeto y reajusta los índices de selección. */
  function eliminarEquipo(indice: number) {
    limpiarResultados();
    cambiarListaEquipos((objetos) => objetos.filter((_, i) => i !== indice));
    cambiarIndicesSeleccionados((indices) =>
      indices.filter((i) => i !== indice).map((i) => (i > indice ? i - 1 : i)),
    );
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

  /** Marca o desmarca un objeto para incluirlo en el cálculo. */
  function cambiarSeleccion(indice: number) {
    limpiarResultados();
    cambiarIndicesSeleccionados((actual) =>
      actual.includes(indice)
        ? actual.filter((i) => i !== indice)
        : [...actual, indice],
    );
  }

  /** Selecciona todos los objetos de una vez. */
  function seleccionarTodos() {
    limpiarResultados();
    cambiarIndicesSeleccionados(listaEquipos.map((_, i) => i));
  }

  /** Envía el JSON a FastAPI y guarda la respuesta completa para visualizarla. */
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
      if (!respuesta.ok)
        throw new Error(`Error HTTP ${respuesta.status} del servidor.`);
      cambiarResultadoBackend(validarRespuesta(await respuesta.json()));
      cambiarMensajeExito("Cálculo completado.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "No se pudo calcular.",
      );
    } finally {
      cambiarCalculando(false);
    }
  }

  const objetosVisibles = listaEquipos
    .map((objeto, indice) => ({ objeto, indice }))
    .filter(
      ({ indice }) =>
        !soloSeleccionados || indicesSeleccionados.includes(indice),
    );
  const camposDeRespuesta = resultadoBackend
    ? Object.entries(resultadoBackend).filter(
        ([clave]) =>
          clave !== "pasos" && (mostrarTodoResultado || clave === "resultado"),
      )
    : [];

  return (
    <div className="mochila">
      <h1>Problema de la Mochila</h1>

      <form onSubmit={agregarEquipo}>
        <h2>Datos generales</h2>

        <label>
          Cargar archivo JSON:
          <input
            type="file"
            accept=".json,application/json"
            onChange={cargarArchivoJson}
          />
        </label>

        <button type="button" onClick={guardarConfiguracionJson}>
          Guardar archivo JSON
        </button>

        <div className="formulario-mochila">
          <label>
            Variante:
            <select
              value={variante}
              onChange={(evento) => {
                cambiarVariante(evento.target.value as Variante);
                limpiarResultados();
              }}
            >
              <option value="0/1">0/1</option>
              <option value="acotada">Acotada</option>
              <option value="no acotada">No acotada</option>
            </select>
          </label>

          <label>
            Capacidad:
            <input
              type="number"
              min="0"
              step="any"
              value={capacidad}
              onChange={(evento) => {
                cambiarCapacidad(evento.target.value);
                limpiarResultados();
              }}
              required
            />
          </label>
        </div>

        <h2>Agregar objeto</h2>
        <div className="formulario-mochila">
          <label>
            Nombre:
            <input
              value={nombre}
              onChange={(evento) => cambiarNombre(evento.target.value)}
              required
            />
          </label>

          <label>
            Peso:
            <input
              type="number"
              min="0"
              step="any"
              value={peso}
              onChange={(evento) => cambiarPeso(evento.target.value)}
              required
            />
          </label>

          <label>
            Valor:
            <input
              type="number"
              min="0"
              step="any"
              value={valor}
              onChange={(evento) => cambiarValor(evento.target.value)}
              required
            />
          </label>

          {variante === "acotada" && (
            <label>
              Cantidad:
              <input
                type="number"
                min="1"
                step="1"
                value={cantidad}
                onChange={(evento) => cambiarCantidad(evento.target.value)}
                required
              />
            </label>
          )}

          <button type="submit">Agregar objeto</button>
        </div>
      </form>

      {mensajeError && <p role="alert">{mensajeError}</p>}
      {mensajeExito && <p role="status">{mensajeExito}</p>}

      <h2>Objetos agregados ({listaEquipos.length})</h2>
      <div className="acciones-mochila">
        <button type="button" onClick={seleccionarTodos}>
          Seleccionar todos
        </button>
        <button
          type="button"
          onClick={() => {
            cambiarIndicesSeleccionados([]);
            limpiarResultados();
          }}
        >
          Deseleccionar todos
        </button>
        <button
          type="button"
          onClick={() => cambiarSoloSeleccionados(!soloSeleccionados)}
        >
          {soloSeleccionados ? "Mostrar todos" : "Mostrar solo seleccionados"}
        </button>
      </div>

      <table className="tabla-mochila">
        <thead>
          <tr>
            <th>Seleccionar</th>
            <th>Nombre</th>
            <th>Peso</th>
            <th>Valor</th>
            {variante === "acotada" && <th>Cantidad</th>}
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {objetosVisibles.map(({ objeto, indice }) => (
            <tr key={indice}>
              <td>
                <input
                  type="checkbox"
                  checked={indicesSeleccionados.includes(indice)}
                  onChange={() => cambiarSeleccion(indice)}
                />
              </td>
              <td>{objeto.nombre}</td>
              <td>{objeto.peso}</td>
              <td>{objeto.valor}</td>
              {variante === "acotada" && (
                <td>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={objeto.cantidad ?? ""}
                    onChange={(evento) =>
                      actualizarCantidadObjeto(indice, evento.target.value)
                    }
                  />
                </td>
              )}
              <td>
                <button type="button" onClick={() => eliminarEquipo(indice)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={calcularMochila} disabled={calculando}>
        {calculando ? "Calculando..." : "Calcular"}
      </button>

      {resultadoBackend && (
        <section className="resultados-mochila">
          <h2>Resultado del algoritmo</h2>

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

          {camposDeRespuesta.map(([campo, dato]) => (
            <CampoResultado key={campo} nombre={campo} dato={dato} />
          ))}
        </section>
      )}
    </div>
  );
}
