import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

const modulos = [
  {
    numero: "01",
    nombre: "Reemplazo de equipos",
    nombreCorto: "Reemplazo",
    descripcion:
      "Determina cuándo reemplazar un equipo para minimizar los costos durante un período.",
    ruta: "/remplazo-equipos",
  },
  {
    numero: "02",
    nombre: "Series deportivas",
    nombreCorto: "Series deportivas",
    descripcion:
      "Calcula la probabilidad de ganar una serie considerando las condiciones de local y visitante.",
    ruta: "/series-deportivas",
  },
  {
    numero: "03",
    nombre: "Árbol binario óptimo",
    nombreCorto: "Árbol óptimo",
    descripcion:
      "Encuentra la estructura de un árbol de búsqueda que minimiza su costo esperado.",
    ruta: "/ArbolOptimo",
  },
  {
    numero: "04",
    nombre: "Multiplicación de matrices",
    nombreCorto: "Matrices",
    descripcion:
      "Encuentra el orden de multiplicación que requiere menos operaciones.",
    ruta: "/multiplicacion-matrices",
  },
  {
    numero: "05",
    nombre: "Problema de la mochila",
    nombreCorto: "Mochila",
    descripcion:
      "Maximiza el valor de los objetos seleccionados respetando una capacidad.",
    ruta: "/Mochila",
  },
];

type PlantillaGeneralProps = {
  children: ReactNode;
};

type EstadoBackend = "consultando" | "activo" | "inactivo";

type VerificacionBackend = {
  ruta: string;
  estado: EstadoBackend;
};

// Encabezado y pie compartidos por todas las páginas.
export function PlantillaGeneral({ children }: PlantillaGeneralProps) {
  const ubicacion = useLocation();

  const [verificacion, setVerificacion] = useState<VerificacionBackend>({
    ruta: ubicacion.pathname,
    estado: "consultando",
  });

  const estadoBackend: EstadoBackend =
    verificacion.ruta === ubicacion.pathname
      ? verificacion.estado
      : "consultando";

  // Verifica el estado del backend al iniciar y al cambiar de pantalla.
  useEffect(() => {
    const ruta = ubicacion.pathname;
    const controller = new AbortController();
    let montado = true;

    const timeout = setTimeout(() => controller.abort(), 5000);

    const verificarBackend = async () => {
      try {
        const respuesta = await fetch("/api/health", {
          signal: controller.signal,
        });

        if (!respuesta.ok) {
          throw new Error("Servicio no disponible");
        }

        const datos: unknown = await respuesta.json();

        const activo =
          typeof datos === "object" &&
          datos !== null &&
          "status" in datos &&
          datos.status === "ok";

        if (montado) {
          setVerificacion({
            ruta,
            estado: activo ? "activo" : "inactivo",
          });
        }
      } catch {
        if (montado) {
          setVerificacion({
            ruta,
            estado: "inactivo",
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    void verificarBackend();

    return () => {
      montado = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ubicacion.pathname]);

  return (
    <div className="io-shell">
      <header className="io-header">
        <div className="io-container io-header-inner">
          <Link to="/" className="io-brand">
            <span>
              TEC CAL<span className="io-brand-dot">.</span>
              <small>IO WEB</small>
            </span>
          </Link>

          <div role="status" aria-live="polite">
            {estadoBackend === "consultando" && (
              <p>🟡 Verificando conexión...</p>
            )}

            {estadoBackend === "activo" && <p>🟢 Servidor activo</p>}

            {estadoBackend === "inactivo" && (
              <p>
                🔴 Servidor desconectado. No se pudo establecer conexión con el
                servicio.
              </p>
            )}
          </div>

          <nav className="io-nav" aria-label="Navegación principal">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `io-nav-link ${isActive ? "io-active" : ""}`
              }
            >
              Inicio
            </NavLink>

            {modulos.map((modulo) => (
              <div className="io-nav-item" key={modulo.numero}>
                {modulo.ruta ? (
                  <NavLink
                    to={modulo.ruta}
                    aria-describedby={`tooltip-${modulo.numero}`}
                    className={({ isActive }) =>
                      `io-nav-link ${isActive ? "io-active" : ""}`
                    }
                  >
                    {modulo.nombreCorto}
                  </NavLink>
                ) : (
                  <span
                    className="io-nav-link io-disabled"
                    tabIndex={0}
                    aria-disabled="true"
                    aria-describedby={`tooltip-${modulo.numero}`}
                  >
                    {modulo.nombreCorto}
                  </span>
                )}

                <div
                  className="io-tooltip"
                  id={`tooltip-${modulo.numero}`}
                  role="tooltip"
                >
                  <span className="io-tooltip-number">
                    ALGORITMO {modulo.numero}
                  </span>

                  <strong>{modulo.nombre}</strong>

                  <p>{modulo.descripcion}</p>

                  {!modulo.ruta && (
                    <small className="io-tooltip-status">
                      No está disponible ahora
                    </small>
                  )}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </header>

      <main className="io-main">{children}</main>

      <footer className="io-footer">
        <div className="io-container io-footer-inner">
          <div>
            <strong>
              TEC CAL<span className="io-brand-dot">.</span>
            </strong>
            <p>Investigación de Operaciones · IO WEB</p>
          </div>

          <p>Desarrollado por Raul, Elder y Diego</p>

          <span>TEC · 2026</span>
        </div>
      </footer>
    </div>
  );
}

// Página de bienvenida estática.
function VentanaBienvenida() {
  return (
    <section className="io-welcome">
      <div className="io-container">
        <span className="io-welcome-label">PROYECTO ACADÉMICO</span>

        <h1>
          Bienvenidos a <span>IO WEB</span>
        </h1>

        <p>
          Plataforma web para la implementación y visualización de algoritmos de
          Investigación de Operaciones.
        </p>

        <p className="io-welcome-secondary">Tecnológico de Costa Rica · 2026</p>
      </div>
    </section>
  );
}

export default VentanaBienvenida;
