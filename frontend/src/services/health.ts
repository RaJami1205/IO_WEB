/** Comprueba únicamente health; devuelve una cancelación que invalida todos los intentos. */
export function comprobarSalud(
  finalizar: (disponible: boolean) => void,
  produccion = import.meta.env.PROD,
): () => void {
  const presupuesto = produccion ? 90_000 : 8_000;
  const timeoutSolicitud = produccion ? 10_000 : 3_000;
  const intervalo = produccion ? 3_000 : 1_000;
  let terminado = false;
  let solicitud: AbortController | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let espera: ReturnType<typeof setTimeout> | undefined;

  function cancelar() {
    terminado = true;
    clearTimeout(plazo);
    clearTimeout(timeout);
    clearTimeout(espera);
    solicitud?.abort();
  }

  function completar(disponible: boolean) {
    if (terminado) return;
    cancelar();
    finalizar(disponible);
  }

  function reintentar() {
    if (!terminado) espera = setTimeout(() => { void consultar(); }, intervalo);
  }

  async function consultar() {
    if (terminado) return;
    const actual = new AbortController();
    solicitud = actual;
    const vigente = () => !terminado && !actual.signal.aborted;
    timeout = setTimeout(() => {
      actual.abort();
      reintentar();
    }, timeoutSolicitud);

    try {
      const respuesta = await fetch("/api/health", {
        method: "GET", signal: actual.signal, cache: "no-store",
      });
      if (!vigente()) return;
      if ([502, 503, 504].includes(respuesta.status)) {
        clearTimeout(timeout);
        actual.abort();
        reintentar();
        return;
      }
      if (respuesta.status !== 200) {
        completar(false);
        return;
      }
      let datos: unknown;
      try {
        datos = await respuesta.json();
      } catch {
        if (vigente()) completar(false);
        return;
      }
      if (vigente()) completar(
        typeof datos === "object" && datos !== null &&
        "status" in datos && datos.status === "ok",
      );
    } catch {
      if (vigente()) {
        clearTimeout(timeout);
        actual.abort();
        reintentar();
      }
    }
  }

  // Este plazo también cancela una petición o lectura del cuerpo que siga pendiente.
  const plazo = setTimeout(() => completar(false), presupuesto);
  void consultar();
  return cancelar;
}
