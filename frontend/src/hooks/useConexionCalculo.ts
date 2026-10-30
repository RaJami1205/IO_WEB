import { useEffect, useRef, useState } from "react";
import { comprobarSalud } from "../services/health";

type Fase = "reposo" | "conectando" | "calculando";

/** Una operación local conserva autoridad hasta finalizar o abandonar la pantalla. */
export function useConexionCalculo() {
  const [fase, cambiarFase] = useState<Fase>("reposo");
  const montado = useRef(false);
  const activa = useRef<ReturnType<typeof crearOperacion> | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      activa.current?.finalizar();
    };
  }, []);

  function crearOperacion() {
    const controlador = new AbortController();
    const { signal } = controlador;
    let plazo: ReturnType<typeof setTimeout> | undefined;
    let postIniciado = false;
    const vigente = () => montado.current && activa.current === operacion;
    function comprobar() {
      if (!vigente() || signal.aborted) {
        throw signal.reason ?? new Error("Operación cancelada.");
      }
    }
    // Termina incluso si el transporte ignora AbortSignal al leer el cuerpo.
    function esperar<T>(promesa: Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        const cancelar = () => reject(signal.reason);
        signal.addEventListener("abort", cancelar, { once: true });
        promesa.then((valor) => {
          signal.removeEventListener("abort", cancelar);
          try { comprobar(); resolve(valor); } catch (error) { reject(error); }
        }, (error: unknown) => {
          signal.removeEventListener("abort", cancelar);
          reject(error);
        });
        if (signal.aborted) cancelar();
      });
    }
    function finPost() { clearTimeout(plazo); }
    function finalizar() {
      finPost();
      controlador.abort(new Error("Operación cancelada."));
      if (activa.current === operacion) {
        activa.current = null;
        if (montado.current) cambiarFase("reposo");
      }
    }
    async function esperarConexion() {
      comprobar();
      cambiarFase("conectando");
      await new Promise<void>((resolve, reject) => {
        let cancelarSalud = () => {};
        const cancelar = () => { cancelarSalud(); reject(signal.reason); };
        signal.addEventListener("abort", cancelar, { once: true });
        cancelarSalud = comprobarSalud((disponible) => {
          signal.removeEventListener("abort", cancelar);
          if (disponible) resolve();
          else reject(new Error("No se pudo conectar con el servidor. Intenta nuevamente."));
        });
      });
      comprobar();
    }
    function iniciarPost() {
      comprobar();
      if (postIniciado) throw new Error("La solicitud ya fue iniciada.");
      postIniciado = true;
      cambiarFase("calculando");
      plazo = setTimeout(() => controlador.abort(new Error(
        "El cálculo superó los 30 segundos de espera. Intenta nuevamente.",
      )), 30000);
    }
    function pausa(ms: number) {
      return new Promise<void>((resolve, reject) => {
        comprobar();
        const cancelar = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", cancelar);
          try { comprobar(); resolve(); } catch (error) { reject(error); }
        }, ms);
        signal.addEventListener("abort", cancelar, { once: true });
      });
    }
    const operacion = { signal, vigente, comprobar, esperar, esperarConexion,
      iniciarPost, finPost, pausa, finalizar };
    return operacion;
  }

  function iniciar() {
    if (!montado.current || activa.current) return null;
    const operacion = crearOperacion();
    activa.current = operacion;
    return operacion;
  }
  return { fase, iniciar };
}
