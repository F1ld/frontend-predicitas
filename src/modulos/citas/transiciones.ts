import type { Rol } from "../../nucleo/api/tipos";
import type { EstadoCita, EstadoDestino } from "./tipos";

// RF-019 y RF-020: conserva las transiciones actuales; el servidor las valida.
export const TRANSICIONES: Readonly<Record<EstadoCita, readonly EstadoDestino[]>> = {
  RECIBIDA: ["CONFIRMADA", "REPROGRAMADA", "CANCELADA", "ATENDIDA", "NO_SHOW"],
  CONFIRMADA: ["REPROGRAMADA", "CANCELADA", "ATENDIDA", "NO_SHOW"],
  REPROGRAMADA: ["CONFIRMADA", "CANCELADA", "ATENDIDA", "NO_SHOW"],
  CANCELADA: [], LIBERADA: [], ATENDIDA: [], NO_SHOW: [],
};
export const ESTADOS = Object.keys(TRANSICIONES) as EstadoCita[];
export const ROLES_ESCRITURA: Rol[] = ["ADMINISTRADOR", "RECEPCION"];
