import type { ChangeEvent, FormEvent } from "react";
import "../estilos/SeriesDeportivas.css";
import { useEffect, useState } from "react";

// Estructura exacta que espera el backend.
type ConfiguracionSerie = {
  algoritmo: "series-deportivas";
  juegos: number;
  ph: number;
  pr: number;
  formato: boolean[];
};

//plantilla inicial
const configuracionInicial: ConfiguracionSerie = {
  algoritmo: "series-deportivas",
  juegos: 7,
  ph: 0.58,
  pr: 0.45,
  formato: [true, true, false, false, false, true, true],
};

// Comprueba que una configuración cumple los requisitos.
function validarConfiguracion(datosRecibidos: unknown): ConfiguracionSerie {
  if (
    typeof datosRecibidos !== "object" ||
    datosRecibidos === null ||
    Array.isArray(datosRecibidos)
  ) {
    throw new Error("La configuración debe ser un objeto JSON.");
  }

  const datos = datosRecibidos as Record<string, unknown>;

  if (datos.algoritmo !== "series-deportivas") {
    throw new Error('El campo "algoritmo" debe ser "series-deportivas".');
  }

  if (
    //validacion de la cantida de juegos
    typeof datos.juegos !== "number" ||
    !Number.isInteger(datos.juegos) ||
    datos.juegos < 1 ||
    datos.juegos > 11 ||
    datos.juegos % 2 === 0
  ) {
    throw new Error("La cantidad de juegos debe ser impar, entre 1 y 11.");
  }

  if (
    //valida las probablidades de la casa
    typeof datos.ph !== "number" ||
    !Number.isFinite(datos.ph) ||
    datos.ph < 0 ||
    datos.ph > 1
  ) {
    throw new Error("La probabilidad como local (ph) debe estar entre 0 y 1.");
  }

  if (
    //valida las probablidades de visitante
    typeof datos.pr !== "number" ||
    !Number.isFinite(datos.pr) ||
    datos.pr < 0 ||
    datos.pr > 1
  ) {
    throw new Error(
      "La probabilidad como visitante (pr) debe estar entre 0 y 1.",
    );
  }

  if (
    //valida el formato de los juegos
    !Array.isArray(datos.formato) ||
    datos.formato.length !== datos.juegos ||
    !datos.formato.every((valor: unknown) => typeof valor === "boolean")
  ) {
    throw new Error(
      'El campo "formato" debe contener un booleano por cada juego.',
    );
  }

  return {
    algoritmo: "series-deportivas",
    juegos: datos.juegos,
    ph: datos.ph,
    pr: datos.pr,
    formato: datos.formato as boolean[],
  };
}
//modficacion de formulario
function SeriesDeportivas() {
  // Datos editables del formulario.
  const [cantidadDeJuegos, cambiarCantidadDeJuegos] = useState(
    configuracionInicial.juegos,
  );

  const [probabilidadComoLocal, cambiarProbabilidadComoLocal] = useState(
    configuracionInicial.ph.toString(),
  );

  const [probabilidadComoVisitante, cambiarProbabilidadComoVisitante] =
    useState(configuracionInicial.pr.toString());

  const [equipoALocalPorJuego, cambiarEquipoALocalPorJuego] = useState<
    boolean[]
  >([...configuracionInicial.formato]);

  // Mensajes y resultados.
  const [mensajeError, cambiarMensajeError] = useState("");
  const [mensajeExito, cambiarMensajeExito] = useState("");
  const [calculando, cambiarCalculando] = useState(false);
  const [tablaProbabilidades, cambiarTablaProbabilidades] = useState<
    number[][] | null
  >(null);

  function limpiarMensajes() {
    cambiarMensajeError("");
    cambiarMensajeExito("");
    cambiarTablaProbabilidades(null);
  }

  // Actualiza la cantidad de juegos y sus localías.
  function actualizarCantidadDeJuegos(nuevaCantidad: number) {
    cambiarCantidadDeJuegos(nuevaCantidad);

    cambiarEquipoALocalPorJuego((localiasAnteriores) =>
      Array.from(
        { length: nuevaCantidad },
        (_, numeroDeJuego) => localiasAnteriores[numeroDeJuego] ?? true,
      ),
    );

    limpiarMensajes();
  }
  const [celdasVisibles, cambiarCeldasVisibles] = useState(0);
  // Cambia si el equipo A es local o visitante.
  function actualizarLocalia(
    posicionDelJuego: number,
    equipoAEsLocal: boolean,
  ) {
    cambiarEquipoALocalPorJuego((localiasAnteriores) =>
      localiasAnteriores.map((esLocal, posicion) =>
        posicion === posicionDelJuego ? equipoAEsLocal : esLocal,
      ),
    );

    limpiarMensajes();
  }

  // Forma el objeto JSON a partir del formulario actual.
  function obtenerConfiguracionActual(): ConfiguracionSerie {
    if (
      probabilidadComoLocal.trim() === "" ||
      probabilidadComoVisitante.trim() === ""
    ) {
      throw new Error("Debes ingresar las dos probabilidades.");
    }

    return validarConfiguracion({
      algoritmo: "series-deportivas",
      juegos: cantidadDeJuegos,
      ph: Number(probabilidadComoLocal),
      pr: Number(probabilidadComoVisitante),
      formato: equipoALocalPorJuego,
    });
  }

  // Lee un JSON y coloca sus valores en el formulario.
  async function cargarArchivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const archivoSeleccionado = evento.target.files?.[0];

    if (!archivoSeleccionado) return;

    limpiarMensajes();

    try {
      const contenidoArchivo = await archivoSeleccionado.text();
      const datosDelArchivo: unknown = JSON.parse(contenidoArchivo);
      const configuracion = validarConfiguracion(datosDelArchivo);

      cambiarCantidadDeJuegos(configuracion.juegos);
      cambiarProbabilidadComoLocal(configuracion.ph.toString());
      cambiarProbabilidadComoVisitante(configuracion.pr.toString());
      cambiarEquipoALocalPorJuego([...configuracion.formato]);

      cambiarMensajeExito(
        "Configuración cargada. Puedes modificar todos los campos.",
      );
    } catch (error) {
      cambiarMensajeError(
        error instanceof SyntaxError
          ? "El archivo no contiene un JSON válido."
          : error instanceof Error
            ? error.message
            : "No se pudo leer el archivo.",
      );
    } finally {
      // Permite seleccionar nuevamente el mismo archivo.
      evento.target.value = "";
    }
  }

  // Descarga la configuración actual como archivo JSON.
  function guardarConfiguracionJson() {
    limpiarMensajes();

    try {
      const configuracion = obtenerConfiguracionActual();
      const contenidoJson = JSON.stringify(configuracion, null, 2);

      const archivo = new Blob([contenidoJson], {
        type: "application/json",
      });

      const direccionTemporal = URL.createObjectURL(archivo);
      const enlaceDescarga = document.createElement("a");

      enlaceDescarga.href = direccionTemporal;
      enlaceDescarga.download = "series-deportivas.json";

      document.body.appendChild(enlaceDescarga);
      enlaceDescarga.click();
      enlaceDescarga.remove();

      URL.revokeObjectURL(direccionTemporal);

      cambiarMensajeExito("Configuración JSON guardada.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración.",
      );
    }
  }

  async function calcularSerie(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpiarMensajes();

    try {
      const configuracion = obtenerConfiguracionActual();

      // Cantidad de victorias necesarias para ganar la serie.
      const victoriasNecesarias = Math.ceil(configuracion.juegos / 2);

      // Simular la matriz que devolverá el backend.
      const ejemplo = generarTablaEjemplo(victoriasNecesarias);

      cambiarTablaProbabilidades(ejemplo);
      cambiarCeldasVisibles(0);

      const totalCeldas = ejemplo.reduce(
        (total, fila) => total + fila.length,
        0,
      );

      for (let i = 1; i <= totalCeldas; i++) {
        await new Promise((resolver) => setTimeout(resolver, 1000));
        cambiarCeldasVisibles(i);
      }

      cambiarMensajeExito("Tabla de prueba generada correctamente.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "Ocurrió un error.",
      );
    }
  }

  // Genera probabilidades ficticias para probar la tabla.
  function generarTablaEjemplo(tamanoMatriz: number): number[][] {
    return Array.from({ length: tamanoMatriz }, (_, numeroFila) =>
      Array.from({ length: tamanoMatriz }, (_, numeroColumna) =>
        Number(
          ((numeroColumna + 1) / (numeroFila + numeroColumna + 2)).toFixed(5),
        ),
      ),
    );
  }

  // Envía la configuración al backend y recibe la matriz.
  async function calcularSerie1(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpiarMensajes();

    try {
      // Obtener y validar configuración del formulario.
      const configuracion = obtenerConfiguracionActual();

      cambiarCalculando(true);

      // Enviar configuración a FastAPI.
      const respuesta = await fetch("/api/series-deportivas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configuracion),
      });

      // Verificar respuesta HTTP.
      if (!respuesta.ok) {
        throw new Error(`El servidor devolvió el error ${respuesta.status}.`);
      }

      // Recibir matriz de probabilidades.
      const resultado: unknown = await respuesta.json();

      // Guardar la matriz recibida.
     const matriz = resultado as number[][];

      cambiarTablaProbabilidades(matriz);
      cambiarCeldasVisibles(0);

      const totalCeldas = matriz.reduce(
        (total, fila) => total + fila.length,
        0,
      );

      for (let i = 1; i <= totalCeldas; i++) {
        await new Promise((resolver) => setTimeout(resolver, 200));
        cambiarCeldasVisibles(i);
      }
      cambiarMensajeExito("Cálculo realizado correctamente.");
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al realizar el cálculo.",
      );
    } finally {
      cambiarCalculando(false);
    }
  }

  return (
    <section className="pagina-series-deportivas">
      <div className="contenedor-series-deportivas">
        <header className="encabezado-series">
          <span className="etiqueta-proyecto">
            ALGORITMO 02 · INVESTIGACIÓN DE OPERACIONES
          </span>

          <h1>Series Deportivas</h1>

          <p>
            Configura las probabilidades y el orden de los partidos para
            calcular la probabilidad de que el equipo A gane la serie.
          </p>
        </header>

        <form className="formulario-series" onSubmit={calcularSerie} noValidate>
          {/* OPCIONES PARA CARGAR O GUARDAR JSON */}
          <div className="seccion-configuracion">
            <div>
              <h2>Configuración de la serie</h2>
              <p>
                Ingresa los datos manualmente o carga un archivo JSON para
                editarlos.
              </p>
            </div>

            <div className="acciones-archivo">
              <label
                htmlFor="archivo-configuracion"
                className="etiqueta-archivo"
              >
                Cargar JSON
              </label>

              <input
                id="archivo-configuracion"
                type="file"
                accept=".json,application/json"
                onChange={cargarArchivoJson}
              />

              <button
                type="button"
                className="boton-secundario"
                onClick={guardarConfiguracionJson}
              >
                Guardar JSON
              </button>
            </div>
          </div>

          {/* DATOS GENERALES */}
          <div className="seccion-formulario">
            <h2>Datos generales</h2>

            <div className="grupo-campos">
              <div className="campo-formulario">
                <label htmlFor="cantidad-juegos">
                  Cantidad máxima de juegos
                </label>

                <select
                  id="cantidad-juegos"
                  value={cantidadDeJuegos}
                  onChange={(evento) =>
                    actualizarCantidadDeJuegos(Number(evento.target.value))
                  }
                >
                  {[1, 3, 5, 7, 9, 11].map((cantidad) => (
                    <option key={cantidad} value={cantidad}>
                      {cantidad}
                    </option>
                  ))}
                </select>

                <small>
                  La serie finaliza cuando un equipo alcanza la mayoría de
                  victorias.
                </small>
              </div>

              <div className="campo-formulario">
                <label htmlFor="probabilidad-local">
                  Probabilidad de ganar como local (ph)
                </label>

                <input
                  id="probabilidad-local"
                  type="number"
                  min="0"
                  max="1"
                  step="any"
                  value={probabilidadComoLocal}
                  onChange={(evento) => {
                    cambiarProbabilidadComoLocal(evento.target.value);
                    limpiarMensajes();
                  }}
                  placeholder="Ejemplo: 0.58"
                  required
                />

                <small>
                  Probabilidad del equipo A cuando juega en casa, entre 0 y 1.
                </small>
              </div>

              <div className="campo-formulario">
                <label htmlFor="probabilidad-visitante">
                  Probabilidad de ganar como visitante (pr)
                </label>

                <input
                  id="probabilidad-visitante"
                  type="number"
                  min="0"
                  max="1"
                  step="any"
                  value={probabilidadComoVisitante}
                  onChange={(evento) => {
                    cambiarProbabilidadComoVisitante(evento.target.value);
                    limpiarMensajes();
                  }}
                  placeholder="Ejemplo: 0.45"
                  required
                />

                <small>
                  Probabilidad del equipo A cuando juega fuera de casa, entre 0
                  y 1.
                </small>
              </div>
            </div>
          </div>

          {/* ORDEN DE LOS PARTIDOS */}
          <div className="seccion-formulario">
            <div className="encabezado-localias">
              <div>
                <h2>Orden de los partidos</h2>
                <p>Selecciona dónde jugará el equipo A en cada partido.</p>
              </div>

              <span className="contador-partidos">
                {cantidadDeJuegos} juegos
              </span>
            </div>

            <div className="lista-partidos">
              {equipoALocalPorJuego.map((equipoAEsLocal, posicionDelJuego) => (
                <div className="tarjeta-partido" key={posicionDelJuego}>
                  <label htmlFor={`localia-juego-${posicionDelJuego}`}>
                    Juego {posicionDelJuego + 1}
                  </label>

                  <select
                    id={`localia-juego-${posicionDelJuego}`}
                    value={equipoAEsLocal ? "local" : "visitante"}
                    onChange={(evento) =>
                      actualizarLocalia(
                        posicionDelJuego,
                        evento.target.value === "local",
                      )
                    }
                  >
                    <option value="local">A es local</option>

                    <option value="visitante">A es visitante</option>
                  </select>
                </div>
              ))}
            </div>

            <p className="explicacion-localias">
              Local = true · Visitante = false en el archivo JSON.
            </p>
          </div>

          {/* VALIDACIONES Y ENVÍO */}
          {mensajeError && (
            <p className="mensaje-error" role="alert">
              {mensajeError}
            </p>
          )}

          {mensajeExito && (
            <p className="mensaje-exito" role="status">
              {mensajeExito}
            </p>
          )}

          <div className="acciones-formulario">
            <button
              type="submit"
              className="boton-calcular"
              disabled={calculando}
            >
              {calculando ? "Calculando..." : "Calcular probabilidad"}
            </button>
          </div>
        </form>

        {tablaProbabilidades !== null && (
          <section className="seccion-resultado">
            <h2>Tabla de probabilidades</h2>

            <div className="contenedor-tabla-probabilidades">
              <table className="tabla-probabilidades">
                <thead>
                  <tr>
                    <th>SD</th>

                    {Array.from(
                      { length: tablaProbabilidades[0]?.length ?? 0 },
                      (_, numeroColumna) => (
                        <th key={numeroColumna}>V {numeroColumna + 1}</th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {tablaProbabilidades.map((fila, numeroFila) => (
                    <tr key={numeroFila}>
                      <th scope="row">C {numeroFila + 1}</th>

                      {fila.map((probabilidad, numeroColumna) => (
                        <td key={numeroColumna}>
                          {numeroFila * fila.length + numeroColumna <
                          celdasVisibles
                            ? probabilidad.toFixed(5)
                            : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

export default SeriesDeportivas;
