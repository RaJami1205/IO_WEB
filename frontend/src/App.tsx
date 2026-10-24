import { Routes, Route } from "react-router-dom";

import VentanaBienvenida, {
  PlantillaGeneral,
} from "./componentes/VentanaBienvenida";

import SeriesDeportivas from "./componentes/SeriesDeportivas";
import RemplazoEquipos from "./componentes/RemplazoEquipos";

function App() {
  return (
    <PlantillaGeneral>
      <Routes>
        <Route path="/" element={<VentanaBienvenida />} />

        <Route path="/series-deportivas" element={<SeriesDeportivas />} />

        <Route path="/remplazo-equipos" element={<RemplazoEquipos />} />
      </Routes>
    </PlantillaGeneral>
  );
}

export default App;
