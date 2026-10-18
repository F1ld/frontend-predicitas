import { Link, Navigate, Route, Routes } from "react-router-dom";
import RutaProtegida from "./auth/RutaProtegida";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Citas from "./pages/Citas";
import CitaDetalle from "./pages/CitaDetalle";
import Importar from "./pages/Importar";
import { ROLES_ESCRITURA } from "./lib/transiciones";

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<RutaProtegida roles={[...ROLES_ESCRITURA, "TECNICO_IA"]} />}>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/citas" replace />} />
        <Route path="/citas" element={<Citas />} />
        <Route path="/citas/:id" element={<CitaDetalle />} />
        <Route element={<RutaProtegida roles={ROLES_ESCRITURA} />}>
          <Route path="/importar" element={<Importar />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<main className="mx-auto max-w-lg space-y-4 p-8"><h1>Página no encontrada</h1><Link className="boton" to="/citas">Volver al inicio</Link></main>} />
  </Routes>;
}
