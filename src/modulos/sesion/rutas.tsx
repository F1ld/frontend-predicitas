import Login from "./Login";

/** RF-001: ranura pública de inicio de sesión según contratos/comun.json. */
const rutas = [{ ruta: "/login", elemento: <Login />, roles: ["publico"] as const }];

export default rutas;
