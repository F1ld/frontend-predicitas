import type { Rol } from "../../nucleo/api/tipos";
import Bandeja from "./Bandeja";
import Detalle from "./Detalle";
import Importar from "./Importar";
import { ROLES_ESCRITURA } from "./transiciones";

const rolesLectura: Rol[] = ["ADMINISTRADOR", "RECEPCION", "TECNICO_IA"];

// RF-009, RF-018 y RF-011: ranura M02; App aplica los permisos de cada ruta.
export default [
  { ruta: "/citas", elemento: <Bandeja />, roles: rolesLectura },
  { ruta: "/citas/importar", elemento: <Importar />, roles: ROLES_ESCRITURA },
  { ruta: "/citas/:id", elemento: <Detalle />, roles: rolesLectura },
];
