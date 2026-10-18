import { useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Cargando from "../components/Cargando";
import EstadoBadge from "../components/EstadoBadge";
import Mensaje from "../components/Mensaje";
import { api } from "../lib/api";
import { etiqueta, formatearFechaHora } from "../lib/formato";
import { ROLES_ESCRITURA, TRANSICIONES } from "../lib/transiciones";
import { useConsulta } from "../lib/useConsulta";
import Icono from "../components/Icono";

export default function CitaDetalle() {
  const { id } = useParams();
  // Reinicia formulario y mensajes al navegar entre citas sin desmontar la ruta.
  return <Detalle key={id} id={id} />;
}

function Detalle({ id }) {
  const { state } = useLocation();
  const volver = typeof state?.volver === "string" && state.volver.startsWith("/citas?") ? state.volver : "/citas";
  const { tieneRol } = useAuth();
  const { datos: cita, cargando, error, reintentar, actualizar } = useConsulta(`/citas/${id}`);
  const [destino, setDestino] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorCambio, setErrorCambio] = useState("");
  const [exito, setExito] = useState("");
  const dialogo = useRef(null);

  function prepararCambio(estado) {
    setDestino(estado);
    dialogo.current.showModal();
  }

  async function confirmar(evento) {
    evento.preventDefault();
    if (enviando) return;
    const formulario = evento.currentTarget;
    const motivo = String(new FormData(formulario).get("motivo") || "").trim();
    setEnviando(true); setErrorCambio(""); setExito("");
    try {
      const nueva = await api(`/citas/${id}/estado`, { metodo: "POST", json: { estado_nuevo: destino, motivo: motivo || null } });
      actualizar(nueva);
      setExito(`Estado actualizado a ${etiqueta(destino)}.`);
      formulario.reset();
      dialogo.current?.close();
      // El POST devuelve el detalle; también confirmamos el estado persistido con GET.
      try { actualizar(await api(`/citas/${id}`)); }
      catch (fallo) { setErrorCambio(`El cambio se guardó, pero no se pudo refrescar el detalle: ${fallo.message}`); }
    } catch (fallo) {
      dialogo.current?.close();
      setErrorCambio(fallo.status === 409 ? `La cita ya no admite ese cambio. ${fallo.message}` : fallo.message);
      if (fallo.status === 409) reintentar();
    } finally { setEnviando(false); }
  }

  if (cargando) return <Cargando texto="Cargando detalle…" />;
  if (error) return <div className="space-y-4"><Link className="text-teal-800 underline" to={volver}>Volver a la bandeja</Link><Mensaje>{error}</Mensaje><button className="boton-secundario" onClick={reintentar}>Reintentar</button></div>;
  const opciones = TRANSICIONES[cita.estado_actual] || [];
  const campos = [
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
      <section className="tarjeta lg:col-span-2"><div className="seccion-cabecera"><h2><Icono nombre="calendario" />Datos de la cita</h2><p>Información registrada en el piloto.</p></div>
        <dl className="datos-cita">{campos.map(([nombre, valor]) => <div key={nombre}><dt>{nombre}</dt><dd>{valor}</dd></div>)}</dl>
        <div className="desenlace-cita"><p className="font-semibold">Desenlace (target_no_show)</p>
          <p className="mt-1">{cita.target_no_show === null ? "— Pendiente de desenlace" : cita.target_no_show === 0 ? "0 · Asistió" : "1 · No asistió"}</p>
        </div>
      </section>
      <section className="tarjeta acciones-cita"><h2>Acciones</h2><p className="ayuda-seccion">Actualiza el estado cuando tengas la confirmación correspondiente.</p>
        {opciones.length === 0 ? <p className="mt-4 text-sm text-slate-600">Estado final: no admite más cambios.</p> : !tieneRol(...ROLES_ESCRITURA) ? <p className="mt-4 text-sm text-slate-600">Tu rol permite consultar la cita. No tienes permiso para cambiar su estado.</p> : <div className="mt-4 flex flex-col gap-2">{opciones.map((estado) => <button key={estado} className="boton-secundario" disabled={enviando} onClick={() => prepararCambio(estado)}>Marcar como {etiqueta(estado)}</button>)}</div>}
      </section>
    </div>
    <section className="tarjeta"><div className="seccion-cabecera"><h2><Icono nombre="reloj" />Historial de estados</h2><p>El recorrido de esta cita, del cambio más reciente al primero.</p></div>
      <ol className="historial-cita">{[...cita.historial].reverse().map((evento) => <li key={evento.id_historial}>
        <p className="text-sm font-semibold">{etiqueta(evento.estado_anterior)} → {etiqueta(evento.estado_nuevo)}</p>
        <p className="mt-1 text-xs text-slate-500">{formatearFechaHora(evento.fecha_hora_evento)} · {evento.id_usuario_actor === null ? "Actor no registrado" : `Usuario #${evento.id_usuario_actor}`}</p>
        <p className="mt-2 break-words text-sm text-slate-600">{evento.motivo_cambio || "Sin motivo registrado"}</p>
      </li>)}</ol>
      {cita.historial.length === 0 && <p className="mt-4 text-sm text-slate-500">No hay transiciones registradas.</p>}
    </section>
    <dialog ref={dialogo} aria-labelledby="titulo-cambio" onCancel={(evento) => { if (enviando) evento.preventDefault(); }} className="dialogo-cambio">
      <form onSubmit={confirmar} className="space-y-4">
        <h2 id="titulo-cambio">¿Cambiar a {etiqueta(destino)}?</h2>
        <p className="text-sm text-slate-600">Cita {cita.id_cita_externa}. Los estados finales no admiten nuevos cambios.</p>
        <div><label htmlFor="motivo">Motivo (opcional)</label><textarea id="motivo" name="motivo" maxLength={255} rows={3} disabled={enviando} /></div>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className="boton-secundario" disabled={enviando} onClick={() => dialogo.current.close()}>Cancelar</button><button className="boton" disabled={enviando} type="submit">{enviando ? "Guardando…" : "Confirmar cambio"}</button></div>
      </form>
    </dialog>
  </>;
}
