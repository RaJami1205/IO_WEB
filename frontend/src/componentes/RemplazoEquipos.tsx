import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "../estilos/RemplazoEquipos.css";

type Equipo = {
  valorVenta: number;
  costoMantenimiento: number;
};

type ConfiguracionRemplazo = {
  algoritmo: "reemplazo-equipos";
  costoInicial: number;
  plazo: number;
  vidaUtil: number;
  periodos: {
    reventa: number;
    mantenimiento: number;
  }[];
};

function RemplazoEquipos() {
  // Datos generales
  const [costoInicial, cambiarCostoInicial] = useState("");
  const [plazo, cambiarPlazo] = useState("");
  const [vidaUtil, cambiarVidaUtil] = useState("");

  // Datos de un equipo
  const [valorVenta, cambiarValorVenta] = useState("");
  const [costoMantenimiento, cambiarCostoMantenimiento] = useState("");

  // Lista de equipos agregados
  const [listaEquipos, cambiarListaEquipos] = useState<Equipo[]>([]);
  const [mensajeError, cambiarMensajeError] = useState("");

  // Lee un JSON y coloca sus valores en el formulario.
  async function cargarArchivoJson(evento: ChangeEvent<HTMLInputElement>) {
    const archivoSeleccionado = evento.target.files?.[0];

    if (!archivoSeleccionado) return;

    try {
      const contenidoArchivo = await archivoSeleccionado.text();
      const datosDelArchivo: unknown = JSON.parse(contenidoArchivo);
      const configuracion = validarConfiguracion(datosDelArchivo);
      cambiarCostoInicial(configuracion.costoInicial.toString());
      cambiarPlazo(configuracion.plazo.toString());
      cambiarVidaUtil(configuracion.vidaUtil.toString());
      cambiarListaEquipos(
        configuracion.periodos.map((periodo) => ({
          valorVenta: periodo.reventa,
          costoMantenimiento: periodo.mantenimiento,
        })),
      );
    } catch (error) {
      cambiarMensajeError(
        error instanceof Error ? error.message : "Error desconocido.",
      );
    }
  }

  function validarConfiguracion(
    datosRecibidos: unknown,
  ): ConfiguracionRemplazo {
    if (
      typeof datosRecibidos !== "object" ||
      datosRecibidos === null ||
      Array.isArray(datosRecibidos)
    ) {
      throw new Error("El JSON debe ser un objeto.");
    }

    const datos = datosRecibidos as Record<string, unknown>;

    if (datos.algoritmo !== "reemplazo-equipos") {
      throw new Error("Algoritmo incorrecto.");
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
      throw new Error("Plazo inválido.");
    }

    if (
      typeof datos.vidaUtil !== "number" ||
      !Number.isInteger(datos.vidaUtil) ||
      datos.vidaUtil < 1
    ) {
      throw new Error("Vida útil inválida.");
    }

    if (
      !Array.isArray(datos.periodos) ||
      datos.periodos.length !== datos.vidaUtil ||
      !datos.periodos.every((periodo: unknown) => {
        if (
          typeof periodo !== "object" ||
          periodo === null ||
          Array.isArray(periodo)
        )
          return false;

        const valores = periodo as Record<string, unknown>;

        return (
          typeof valores.reventa === "number" &&
          Number.isFinite(valores.reventa) &&
          valores.reventa >= 0 &&
          typeof valores.mantenimiento === "number" &&
          Number.isFinite(valores.mantenimiento) &&
          valores.mantenimiento >= 0
        );
      })
    ) {
      throw new Error("Los períodos contienen datos inválidos.");
    }

    return datos as ConfiguracionRemplazo;
  }

  // Agregar un equipo a la lista
  function agregarEquipo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    cambiarMensajeError("");

    if (
      valorVenta.trim() === "" ||
      costoMantenimiento.trim() === "" ||
      !Number.isFinite(Number(valorVenta)) ||
      !Number.isFinite(Number(costoMantenimiento)) ||
      Number(valorVenta) < 0 ||
      Number(costoMantenimiento) < 0
    ) {
      cambiarMensajeError("Ingresa valores válidos para el equipo.");
      return;
    }

    if (!Number.isInteger(Number(vidaUtil)) || Number(vidaUtil) < 1) {
      cambiarMensajeError("Ingresa una vida útil válida.");
      return;
    }

    if (listaEquipos.length >= Number(vidaUtil)) {
      cambiarMensajeError(
        "Ya agregaste todos los registros correspondientes a la vida útil.",
      );
      return;
    }

    const nuevoEquipo: Equipo = {
      valorVenta: Number(valorVenta),
      costoMantenimiento: Number(costoMantenimiento),
    };

    cambiarListaEquipos((equiposAnteriores) => [
      ...equiposAnteriores,
      nuevoEquipo,
    ]);

    // Limpiar los campos para el siguiente equipo
    cambiarValorVenta("");
    cambiarCostoMantenimiento("");
  }

  // Preparar los datos para el backend
  function calcularReemplazo() {
    cambiarMensajeError("");

    if (
      costoInicial.trim() === "" ||
      plazo.trim() === "" ||
      vidaUtil.trim() === "" ||
      !Number.isFinite(Number(costoInicial)) ||
      Number(costoInicial) < 0 ||
      !Number.isInteger(Number(plazo)) ||
      Number(plazo) < 1 ||
      !Number.isInteger(Number(vidaUtil)) ||
      Number(vidaUtil) < 1
    ) {
      cambiarMensajeError("Revisa los datos generales.");
      return;
    }

    if (listaEquipos.length !== Number(vidaUtil)) {
      cambiarMensajeError(
        "Debes agregar un registro por cada año de vida útil.",
      );
      return;
    }

    const configuracion: ConfiguracionRemplazo = {
      costoInicial: Number(costoInicial),
      plazo: Number(plazo),
      vidaUtil: Number(vidaUtil),
      periodos: listaEquipos,
    };

    console.log("Configuración para el backend:", configuracion);

    // Aquí se agregará el fetch a FastAPI
  }

  return (
    <div className="remplazo-equipos">
      <h1>Reemplazo de Equipos</h1>

      <form onSubmit={agregarEquipo}>
        <h2>Datos generales</h2>
        cargar archivo JSON:
        <input type="file" accept=".json" onChange={cargarArchivoJson} />
        <p>
          O ingresa los datos manualmente. Asegúrate de agregar un registro por
          cada año de vida útil.
        </p>
        <div className="formulario-equipos">
          <label>
            Costo inicial:
            <input
              type="number"
              min="0"
              value={costoInicial}
              onChange={(evento) => cambiarCostoInicial(evento.target.value)}
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
              onChange={(evento) => cambiarPlazo(evento.target.value)}
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
                cambiarListaEquipos([]);
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
              value={costoMantenimiento}
              onChange={(evento) =>
                cambiarCostoMantenimiento(evento.target.value)
              }
              required
            />
          </label>

          <button type="submit">Agregar Equipo</button>
        </div>
      </form>

      {mensajeError && <p role="alert">{mensajeError}</p>}

      <h2>Equipos agregados</h2>

      <table className="tabla-equipos">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Valor de venta</th>
            <th>Costo de mantenimiento</th>
          </tr>
        </thead>

        <tbody>
          {listaEquipos.map((equipo, indice) => (
            <tr key={indice}>
              <td> {indice + 1}</td>
              <td>{equipo.valorVenta}</td>
              <td>{equipo.costoMantenimiento}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={calcularReemplazo}>
        Calcular
      </button>
    </div>
  );
}

export default RemplazoEquipos;
