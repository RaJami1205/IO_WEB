
import { Routes, Route } from "react-router-dom";

import VentanaBienvenida, {
  PlantillaGeneral,
} from "./componentes/VentanaBienvenida";

import SeriesDeportivas from "./componentes/SeriesDeportivas";

function App() {
  return (
    <PlantillaGeneral>
      <Routes>
        <Route
          path="/"
          element={<VentanaBienvenida />}
        />

        <Route
          path="/series-deportivas"
          element={<SeriesDeportivas />}
        />
      </Routes>
    </PlantillaGeneral>
  );
}

export default App;
