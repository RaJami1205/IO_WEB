/** Define las rutas del menú y de los cinco algoritmos dentro de la plantilla común. */
import { Routes, Route } from "react-router-dom";

import VentanaBienvenida, {
  PlantillaGeneral,
} from "./componentes/VentanaBienvenida";

import SeriesDeportivas from "./componentes/SeriesDeportivas";
import RemplazoEquipos from "./componentes/RemplazoEquipos";
import Mochila from "./componentes/Mochila";
import ArbolOptimo from "./componentes/ArbolOptimo";
import MultiplicacionMatrices from "./componentes/MultiplicacionMatrices";
/** Selecciona la vista correspondiente a la ruta actual. */
function App() {
  return (
    <PlantillaGeneral>
      <Routes>
        <Route path="/" element={<VentanaBienvenida />} />

        <Route path="/series-deportivas" element={<SeriesDeportivas />} />

        <Route path="/remplazo-equipos" element={<RemplazoEquipos />} />

        <Route path="/Mochila" element={<Mochila />} />
        <Route path="/ArbolOptimo" element={<ArbolOptimo />} />
        <Route
          path="/multiplicacion-matrices"
          element={<MultiplicacionMatrices />}
        />
      </Routes>
    </PlantillaGeneral>
  );
}

export default App;
