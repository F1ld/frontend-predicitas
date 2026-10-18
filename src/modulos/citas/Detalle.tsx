import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, ApiError } from "../../nucleo/api/cliente";
import { useConsulta } from "../../nucleo/api/useConsulta";
import { useAuth } from "../../nucleo/auth/useAuth";
import Cargando from "../../nucleo/componentes/Cargando";
import EstadoBadge from "../../nucleo/componentes/EstadoBadge";
import Icono from "../../nucleo/componentes/Icono";
import Mensaje from "../../nucleo/componentes/Mensaje";
import { etiqueta, formatearFechaHora } from "../../nucleo/formato/formato";
import DetallePrediccion from "./DetallePrediccion";
import DetalleSecciones from "./DetalleSecciones";
import { mensajeErrorCitas } from "./errores";
import type { CheckInOut, CitaDetalleOut, EstadoDestino, PrediccionOut } from "./tipos";
import { ROLES_ESCRITURA, TRANSICIONES } from "./transiciones";
import "./citas.css";

export default function CitaDetalle() {
  const { id = "" } = useParams();
  // RF-018: cada cita conserva sus propios formularios y mensajes.
  return <Detalle key={id} id={id} />;
}

function diaLima(instante: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instante));
}

// RN01, RF-018 a RF-024, RF-104: el servidor confirma cada cambio y su historial.
function Detalle({ id }: { id: string }) {
  const { state } = useLocation();
  const estadoNavegacion: unknown = state;
  const rutaAnterior = typeof estadoNavegacion === "object" && estadoNavegacion !== null && "volver" in estadoNavegacion ? estadoNavegacion.volver : null;
  const volver = typeof rutaAnterior === "string" && rutaAnterior.startsWith("/citas?") ? rutaAnterior : "/citas";
  const { tieneRol } = useAuth();
  const { datos: cita, cargando, error, reintentar, actualizar } = useConsulta<CitaDetalleOut>(`/citas/${id}`);
  const [destino, setDestino] = useState<EstadoDestino | "">("");
  const [enviando, setEnviando] = useState(false);
  const [registrandoLlegada, setRegistrandoLlegada] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [errorCambio, setErrorCambio] = useState("");
  const [errorLlegada, setErrorLlegada] = useState("");
  const [errorPrediccion, setErrorPrediccion] = useState("");
  const [exito, setExito] = useState("");
  const [resultadoRiesgo, setResultadoRiesgo] = useState<PrediccionOut | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const dialogo = useRef<HTMLDialogElement>(null);
  // RF-019 y RF-104: el bloqueo inmediato evita dos eventos antes del render.
  const accionEnCurso = useRef(false);

  // RF-104: actualiza la elegibilidad al pasar la hora o el día en Lima.
  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(reloj);
  }, []);

  function prepararCambio(estado: EstadoDestino) {
    setDestino(estado); setErrorCambio("");
    dialogo.current?.querySelector("form")?.reset();
    dialogo.current?.showModal();
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (accionEnCurso.current || !destino) return;
    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;
    const campos = new FormData(formulario);
    const motivo = String(campos.get("motivo") || "").trim();
    const peticion: { estado_nuevo: EstadoDestino; motivo: string | null; nueva_fecha_hora_cita?: string; liberar_cupo?: boolean; id_intervencion?: number } = { estado_nuevo: destino, motivo: motivo || null };
    // RF-021 a RF-024: los campos de un destino nunca se envían para otro.
    if (destino === "REPROGRAMADA") peticion.nueva_fecha_hora_cita = `${String(campos.get("nueva_fecha_hora_cita"))}:00-05:00`;
    if (destino === "CANCELADA" && campos.get("liberar_cupo") === "on") peticion.liberar_cupo = true;
    if (destino === "CONFIRMADA" && campos.get("id_intervencion")) peticion.id_intervencion = Number(campos.get("id_intervencion"));
    accionEnCurso.current = true;
    setEnviando(true); setErrorCambio(""); setExito("");
    try {
      const nueva = await api<CitaDetalleOut>(`/citas/${id}/estado`, { metodo: "POST", json: peticion });
      if (!nueva) throw new Error("El servidor no devolvió el estado actualizado.");
      actualizar(nueva); setExito(`Estado actualizado a ${etiqueta(destino)}.`);
      formulario.reset(); dialogo.current?.close();
      // RF-019: el GET vuelve a consultar el estado persistido después del POST.
      try {
        const persistida = await api<CitaDetalleOut>(`/citas/${id}`);
        if (!persistida) throw new Error("El servidor no devolvió el detalle.");
        actualizar(persistida);
      } catch (fallo) { setErrorCambio(`El cambio se guardó, pero no se pudo refrescar el detalle: ${mensajeErrorCitas(fallo)}`); }
    } catch (fallo) {
      dialogo.current?.close(); setErrorCambio(mensajeErrorCitas(fallo));
      if (fallo instanceof ApiError && fallo.status === 409) reintentar();
    } finally { accionEnCurso.current = false; setEnviando(false); }
  }

  async function registrarLlegada(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (accionEnCurso.current || !cita) return;
    const observacion = String(new FormData(evento.currentTarget).get("observacion") || "").trim();
    accionEnCurso.current = true;
    setRegistrandoLlegada(true); setErrorLlegada(""); setExito("");
    try {
      const llegada = await api<CheckInOut>(`/citas/${id}/check-in`, { metodo: "POST", json: { observacion: observacion || null } });
      if (!llegada) throw new Error("El servidor no devolvió el check-in registrado.");
      actualizar({ ...cita, check_in: llegada });
      setExito("Llegada registrada (check-in). El estado de la cita se conserva.");
    } catch (fallo) {
      setErrorLlegada(mensajeErrorCitas(fallo));
      if (fallo instanceof ApiError && fallo.status === 409) reintentar();
    } finally { accionEnCurso.current = false; setRegistrandoLlegada(false); }
  }

  // RF-052, RF-056, RF-098, RF-103, RN16: el resultado no cambia el estado de cita.
  async function calcularRiesgo() {
    if (accionEnCurso.current || !cita) return;
    accionEnCurso.current = true;
    setCalculando(true); setErrorPrediccion(""); setResultadoRiesgo(null);
    try {
      const resultado = await api<PrediccionOut>(`/citas/${id}/prediccion`, { metodo: "POST" });
      if (!resultado) throw new Error("El servidor no devolvió la predicción.");
      setResultadoRiesgo(resultado);
      // RF-018, RF-057, RF-099: una versión existente puede ser anterior a otra.
      // El riesgo más reciente sigue encabezando el historial y la elegibilidad.
      const predicciones = [resultado, ...cita.predicciones.filter((previa) => previa.id_prediccion !== resultado.id_prediccion)]
        .sort((a, b) => new Date(b.fecha_hora_inferencia).getTime() - new Date(a.fecha_hora_inferencia).getTime() || b.id_prediccion - a.id_prediccion);
      actualizar({ ...cita, predicciones });
    } catch (fallo) { setErrorPrediccion(mensajeErrorCitas(fallo)); }
    finally { accionEnCurso.current = false; setCalculando(false); }
  }

  if (cargando) return <Cargando texto="Cargando detalle…" />;
  if (error) return <div className="space-y-4"><Link className="text-teal-800 underline" to={volver}>Volver a la bandeja</Link><Mensaje>{error}</Mensaje><button className="boton-secundario" onClick={reintentar}>Reintentar</button></div>;
  if (!cita) return <div className="space-y-4"><Link className="enlace-volver" to={volver}>← Volver a la bandeja</Link><Mensaje>No se encontró la cita.</Mensaje></div>;
  const opciones = TRANSICIONES[cita.estado_actual];
  const puedeEscribir = tieneRol(...ROLES_ESCRITURA);
  const activa = opciones.length > 0;
  const citaFutura = new Date(cita.fecha_hora_cita).getTime() > ahora;
  const citaHoy = diaLima(new Date(cita.fecha_hora_cita).getTime()) === diaLima(ahora);
  const ocupada = enviando || registrandoLlegada || calculando;
  const ultimaPrediccion = cita.predicciones[0];
  // RF-057, RN07: M05 valida además opt-out de otras citas y modo sombra.
  const puedeIntervenir = puedeEscribir && activa && citaFutura && ultimaPrediccion && ultimaPrediccion.nivel_riesgo !== "BAJO"
    && !cita.intervenciones.some((intervencion) => intervencion.consentimiento_optout)
    && (cita.intervenciones.length === 0 || (cita.intervenciones.length === 1 && cita.intervenciones[0].estado_intervencion === "FALLIDA"));
  const campos: [string, ReactNode][] = [
    ["Identificador interno", cita.id_cita], ["Paciente (seudónimo)", cita.paciente_anon_id],
    ["Sede", etiqueta(cita.sede)], ["Especialidad", etiqueta(cita.especialidad)], ["Médico", cita.medico],
    ["Fecha y hora", formatearFechaHora(cita.fecha_hora_cita)], ["Registro", formatearFechaHora(cita.fecha_registro_cita)],
    ["Antelación", `${cita.antelacion_dias} días`], ["Tipo de paciente", cita.tipo_paciente],
    ["Canal de origen", cita.canal_origen], ["Franja", etiqueta(cita.franja_horaria)], ["Día", cita.dia_semana],
    ["Asistencias previas", cita.asistencias_previas], ["Inasistencias previas", cita.inasistencias_previas],
    ["Reprogramaciones previas", cita.reprogramaciones_prev],
  ];
  return <>
    <Link className="enlace-volver" to={volver}>← Volver a la bandeja</Link>
    <div className="pagina-titulo"><div><p className="sobretitulo">DETALLE Y SEGUIMIENTO</p><h1 className="break-words">Cita {cita.id_cita_externa}</h1><p>{etiqueta(cita.especialidad)} <span aria-hidden="true">·</span> {formatearFechaHora(cita.fecha_hora_cita)}</p></div><EstadoBadge estado={cita.estado_actual} /></div>
    {errorCambio && <Mensaje>{errorCambio}</Mensaje>}{exito && <Mensaje tipo="exito">{exito}</Mensaje>}
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <section className="tarjeta lg:col-span-2" aria-labelledby="titulo-datos"><div className="seccion-cabecera"><h2 id="titulo-datos"><Icono nombre="calendario" />Datos de la cita</h2><p>Información registrada en el piloto.</p></div>
        <dl className="datos-cita">{campos.map(([nombre, valor]) => <div key={nombre}><dt>{nombre}</dt><dd>{valor}</dd></div>)}</dl>
        <div className="desenlace-cita"><p className="font-semibold">Desenlace (target_no_show)</p><p className="mt-1">{cita.target_no_show === null ? "— Pendiente de desenlace" : cita.target_no_show === 0 ? "0 · Asistió" : "1 · No asistió"}</p></div>
      </section>
      <section className="tarjeta acciones-cita" aria-labelledby="titulo-acciones"><h2 id="titulo-acciones">Acciones</h2><p className="ayuda-seccion">Actualiza el estado cuando tengas la confirmación correspondiente.</p>
        {!puedeEscribir && <p className="mt-4 text-sm text-slate-600">Tu rol permite consultar la cita. No tienes permiso para cambiar su estado.</p>}
        {!activa ? <p className="mt-4 text-sm text-slate-600">Estado final: no admite más cambios.</p> : puedeEscribir && <div className="mt-4 flex flex-col gap-2">{opciones.map((estado) => <button key={estado} className="boton-secundario" disabled={ocupada} onClick={() => prepararCambio(estado)}>Marcar como {etiqueta(estado)}</button>)}</div>}
        <div className="citas-vinculos mt-4 flex flex-col gap-3"><Link className="text-teal-800 underline" to={`/citas/${id}/trazabilidad`}>Ver trazabilidad</Link>{puedeIntervenir && <Link className="text-teal-800 underline" to={`/intervenciones?id_cita=${id}`}>Crear intervención</Link>}</div>
      </section>
    </div>
    <section className="tarjeta" aria-labelledby="titulo-check-in"><div className="seccion-cabecera"><h2 id="titulo-check-in"><Icono nombre="check" />Check-in</h2><p>Registra la llegada sin cambiar el estado de la cita.</p></div>
      {errorLlegada && <Mensaje>{errorLlegada}</Mensaje>}
      {cita.check_in ? <dl className="datos-cita"><div><dt>Llegada registrada</dt><dd>{formatearFechaHora(cita.check_in.fecha_hora_check_in)}</dd></div><div><dt>Registrada por</dt><dd>Usuario #{cita.check_in.id_usuario}</dd></div></dl> : <>
        <p className="citas-seccion-vacia">No hay llegada registrada.</p>
        {puedeEscribir && activa && <form onSubmit={registrarLlegada} className="mt-4 space-y-3">
          {!citaHoy && <p id="ayuda-check-in" className="text-sm text-slate-600">El check-in solo se registra el día de la cita, en hora de Lima.</p>}
          <div><label htmlFor="observacion-check-in">Observación de llegada (opcional)</label><textarea id="observacion-check-in" name="observacion" maxLength={255} rows={2} disabled={ocupada || !citaHoy} /></div>
          <button type="submit" className="boton" disabled={ocupada || !citaHoy} aria-describedby={!citaHoy ? "ayuda-check-in" : undefined}>{registrandoLlegada ? "Registrando llegada…" : "Registrar llegada (check-in)"}</button>
        </form>}
      </>}
    </section>
    <section className="tarjeta" aria-labelledby="titulo-predicciones"><div className="seccion-cabecera"><h2 id="titulo-predicciones">Predicciones de inasistencia</h2><p>El riesgo orienta el acompañamiento al paciente; no es una decisión clínica ni restringe la atención.</p></div>
      {puedeEscribir && activa && citaFutura && <button className="boton-secundario" disabled={ocupada} onClick={calcularRiesgo}>{calculando ? "Calculando riesgo…" : "Calcular riesgo"}</button>}
      {errorPrediccion && <div className="mt-4"><Mensaje>{errorPrediccion}</Mensaje></div>}
      {resultadoRiesgo && <div className="mt-4"><Mensaje tipo="exito">{resultadoRiesgo.ya_existia ? "Se muestra la predicción existente para la versión activa; no se creó un duplicado." : "Riesgo calculado. El resultado se incorporó al historial de predicciones."}</Mensaje></div>}
      {cita.predicciones.length === 0 ? <p className="citas-seccion-vacia">No hay predicciones registradas.</p> : <ol className="citas-lista-detalle">{cita.predicciones.map((prediccion) => <li key={prediccion.id_prediccion}><DetallePrediccion prediccion={prediccion} /></li>)}</ol>}
    </section>
    <DetalleSecciones cita={cita} />
    <section className="tarjeta" aria-labelledby="titulo-historial"><div className="seccion-cabecera"><h2 id="titulo-historial"><Icono nombre="reloj" />Historial de estados</h2><p>El recorrido de esta cita, del cambio más reciente al primero.</p></div>
      <ol className="historial-cita">{[...cita.historial].reverse().map((evento) => <li key={evento.id_historial}>
        <p className="text-sm font-semibold">{etiqueta(evento.estado_anterior)} → {etiqueta(evento.estado_nuevo)}</p><p className="mt-1 text-xs text-slate-500">{formatearFechaHora(evento.fecha_hora_evento)} · {evento.id_usuario_actor === null ? "Actor no registrado" : `Usuario #${evento.id_usuario_actor}`}</p><p className="mt-2 break-words text-sm text-slate-600">{evento.motivo_cambio || "Sin motivo registrado"}</p>
      </li>)}</ol>{cita.historial.length === 0 && <p className="citas-seccion-vacia">No hay transiciones registradas.</p>}
    </section>
    <dialog ref={dialogo} aria-labelledby="titulo-cambio" aria-describedby="ayuda-cambio" onCancel={(evento) => { if (enviando) evento.preventDefault(); }} className="dialogo-cambio">
      <form onSubmit={confirmar} className="space-y-4"><h2 id="titulo-cambio">¿Cambiar a {etiqueta(destino)}?</h2><p id="ayuda-cambio" className="text-sm text-slate-600">Cita {cita.id_cita_externa}. Los estados finales no admiten nuevos cambios.</p>
        {destino === "REPROGRAMADA" && <div><label htmlFor="nueva-fecha-cita">Nueva fecha y hora de cita (Lima)</label><input id="nueva-fecha-cita" name="nueva_fecha_hora_cita" type="datetime-local" required disabled={enviando} aria-describedby="ayuda-reprogramacion" /><p id="ayuda-reprogramacion" className="mt-1 text-xs text-slate-600">Registra la fecha acordada en el sistema externo. Los domingos están fuera del piloto.</p></div>}
        {destino === "CANCELADA" && citaFutura && <label className="citas-check-control"><input type="checkbox" name="liberar_cupo" disabled={enviando} />Liberar cupo para reasignación</label>}
        {destino === "CONFIRMADA" && <div><label htmlFor="intervencion-confirmacion">Intervención que obtuvo la confirmación (opcional)</label><select id="intervencion-confirmacion" name="id_intervencion" disabled={enviando}><option value="">Sin intervención asociada</option>{cita.intervenciones.map((intervencion) => <option key={intervencion.id_intervencion} value={intervencion.id_intervencion}>#{intervencion.id_intervencion} · {intervencion.canal_contacto} · {intervencion.respuesta_paciente || "Sin respuesta"}</option>)}</select></div>}
        <div><label htmlFor="motivo">Motivo (opcional)</label><textarea id="motivo" name="motivo" maxLength={255} rows={3} disabled={enviando} /></div>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className="boton-secundario" disabled={enviando} onClick={() => dialogo.current?.close()}>Cancelar</button><button className="boton" disabled={enviando} type="submit">{enviando ? "Guardando…" : "Confirmar cambio"}</button></div>
      </form>
    </dialog>
  </>;
}
