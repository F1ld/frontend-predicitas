// RF-009, RF-018 y RNF-007: nombres del contrato M02 y seudónimo de paciente.
export type EstadoCita = "RECIBIDA" | "CONFIRMADA" | "REPROGRAMADA" | "CANCELADA" | "LIBERADA" | "ATENDIDA" | "NO_SHOW";
export type EstadoDestino = Exclude<EstadoCita, "RECIBIDA" | "LIBERADA">;
export type Especialidad = "CARDIOLOGIA" | "TRAUMATOLOGIA" | "PEDIATRIA";
export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

export interface CitaOut {
  id_cita: number;
  id_cita_externa: string;
  paciente_anon_id: string;
  sede: "SAN_ISIDRO";
  especialidad: Especialidad;
  medico: string;
  fecha_hora_cita: string;
  fecha_registro_cita: string;
  antelacion_dias: number;
  tipo_paciente: "NUEVO" | "CONTINUADOR";
  canal_origen: "WEB" | "CALL_CENTER" | "PRESENCIAL";
  franja_horaria: "MANANA" | "TARDE";
  dia_semana: "LUNES" | "MARTES" | "MIERCOLES" | "JUEVES" | "VIERNES" | "SABADO";
  inasistencias_previas: number;
  reprogramaciones_prev: number;
  asistencias_previas: number;
  estado_actual: EstadoCita;
  target_no_show: 0 | 1 | null;
}

export interface RiesgoResumen {
  id_prediccion: number;
  probabilidad_no_show: number;
  nivel_riesgo: NivelRiesgo;
  version_modelo: string;
  fecha_hora_inferencia: string;
  resultado_simulado: boolean;
}

export interface CitaResumenOut extends CitaOut {
  riesgo: RiesgoResumen | null;
  estado_intervencion: "PENDIENTE" | "ENVIADA" | "ENTREGADA" | "RESPONDIDA" | "FALLIDA" | null;
  respuesta_paciente: "CONFIRMA" | "SOLICITA_LIBERACION" | "SOLICITA_REPROG" | "SIN_RESPUESTA" | null;
  tiene_check_in: boolean;
}

export interface HistorialOut {
  id_historial: number;
  id_usuario_actor: number | null;
  estado_anterior: EstadoCita | null;
  estado_nuevo: EstadoCita;
  motivo_cambio: string | null;
  fecha_hora_evento: string;
}

// RF-018: por T-012 se migra el detalle existente. Las secciones nuevas son T-031.
export interface CitaDetalleOut extends CitaOut {
  historial: HistorialOut[];
}

export interface RechazoOut {
  fila: number;
  id_cita_externa: string;
  motivos: string[];
}

export interface ResultadoImportacionOut {
  recibidas: number;
  aceptadas: number;
  rechazadas: number;
  detalle_rechazos: RechazoOut[];
}
