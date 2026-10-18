import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Pagina } from "../../nucleo/api/tipos";
import { useConsulta } from "../../nucleo/api/useConsulta";
import Cargando from "../../nucleo/componentes/Cargando";
import EstadoBadge from "../../nucleo/componentes/EstadoBadge";
import Icono from "../../nucleo/componentes/Icono";
import Mensaje from "../../nucleo/componentes/Mensaje";
import NivelRiesgoBadge from "../../nucleo/componentes/NivelRiesgoBadge";
import RotuloSimulado from "../../nucleo/componentes/RotuloSimulado";
import { etiqueta, formatearFechaHora } from "../../nucleo/formato/formato";
import type { CitaResumenOut } from "./tipos";
import { ESTADOS } from "./transiciones";

const FILTROS = ["desde", "hasta", "especialidad", "estado", "q"] as const;
const LIMITE = 20;

// RF-009, RF-016 y RNF-016: migra la bandeja con filtros en URL y sus cuatro estados.
export default function Bandeja() {
  const [busqueda, setBusqueda] = useSearchParams({ desde: "2026-10-20" });
  const navigate = useNavigate();
  const [errorFiltro, setErrorFiltro] = useState("");
  const offset = Number(busqueda.get("desplazamiento") || 0);
  const desplazamiento = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const consulta = new URLSearchParams({ limite: String(LIMITE), desplazamiento: String(desplazamiento) });
  FILTROS.forEach((nombre) => {
    const valor = busqueda.get(nombre);
    if (valor) consulta.set(nombre, valor);
  });
  const { datos, error, cargando, reintentar } = useConsulta<Pagina<CitaResumenOut>>(`/citas?${consulta}`);
  const volver = `/citas?${busqueda}`;

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const campos = new FormData(evento.currentTarget);
    const filtros = Object.fromEntries(FILTROS.map((nombre) => [nombre, String(campos.get(nombre) || "").trim()]));
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setErrorFiltro("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    setErrorFiltro("");
    setBusqueda(filtros);
  }

  function cambiarPagina(nuevo: number) {
    const siguientes = new URLSearchParams(busqueda);
    siguientes.set("desplazamiento", String(nuevo));
    setBusqueda(siguientes);
  }

  return <>
    <div className="pagina-titulo"><div><p className="sobretitulo">SEGUIMIENTO DEL PACIENTE</p><h1>Bandeja de citas</h1><p>Encuentra una cita y continúa su seguimiento.</p></div><span className="contexto-horario"><Icono nombre="reloj" />Hora de Lima</span></div>
    <form key={busqueda.toString()} onSubmit={aplicar} className="tarjeta filtros-citas">
      <div className="seccion-cabecera"><h2><Icono nombre="filtro" />Buscar una cita</h2><p>Combina los filtros que necesites.</p></div>
      <fieldset disabled={cargando} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><label htmlFor="q">Identificador de cita</label><div className="campo-icono"><Icono nombre="buscar" /><input id="q" name="q" defaultValue={busqueda.get("q") || ""} placeholder="Por ejemplo, CIT-SIM-000324" /></div></div>
        <div><label htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={busqueda.get("desde") || ""} /></div>
        <div><label htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={busqueda.get("hasta") || ""} /></div>
        <div><label htmlFor="especialidad">Especialidad</label><select id="especialidad" name="especialidad" defaultValue={busqueda.get("especialidad") || ""}>
          <option value="">Todas</option>{["CARDIOLOGIA", "TRAUMATOLOGIA", "PEDIATRIA"].map((valor) => <option key={valor} value={valor}>{etiqueta(valor)}</option>)}
        </select></div>
        <div><label htmlFor="estado">Estado</label><select id="estado" name="estado" defaultValue={busqueda.get("estado") || ""}>
          <option value="">Todos</option>{ESTADOS.map((valor) => <option key={valor} value={valor}>{etiqueta(valor)}</option>)}
        </select></div>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className="boton"><Icono nombre="buscar" />Aplicar filtros</button>
          <button type="button" className="boton-secundario" onClick={() => { setErrorFiltro(""); setBusqueda({ desde: "" }); }}>Limpiar</button>
        </div>
      </fieldset>
    </form>
    {errorFiltro && <Mensaje>{errorFiltro}</Mensaje>}
    {cargando ? <Cargando texto="Cargando citas…" /> : error ? <div className="space-y-3"><Mensaje>{error}</Mensaje><button className="boton-secundario" onClick={reintentar}>Reintentar</button></div> : datos && <>
      <div className="resultados-cabecera"><h2>Citas encontradas <span className="contador-citas">{datos.total}</span></h2><p>Abre el detalle para ver el historial y las acciones disponibles.</p></div>
      <div className="tabla-contenedor">
        <table className="w-full tabla-citas"><caption className="sr-only">Citas que cumplen los filtros aplicados</caption>
          <thead><tr>
            <th>Fecha y hora</th><th>Identificador</th><th>Especialidad</th><th>Médico</th><th>Estado</th><th>Riesgo</th><th>Acción</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {datos.items.length === 0 ? <tr><td colSpan={7}><div className="estado-vacio"><Icono nombre="calendario" /><p>No hay citas con esos filtros.</p><span>Prueba otra fecha o utiliza «Limpiar» para ampliar la búsqueda.</span></div></td></tr> : datos.items.map((cita) => <tr key={cita.id_cita} className="fila-cita cursor-pointer"
              onClick={(evento) => { if (!(evento.target instanceof Element) || !evento.target.closest("a")) navigate(`/citas/${cita.id_cita}`, { state: { volver } }); }}>
              <td className="whitespace-nowrap">{formatearFechaHora(cita.fecha_hora_cita)}</td>
              <td className="id-cita">{cita.id_cita_externa}</td><td>{etiqueta(cita.especialidad)}</td><td>{cita.medico}</td>
              <td><EstadoBadge estado={cita.estado_actual} /></td>
              {/* RF-056, RN16 y RNF-017: el riesgo se identifica y el simulado se rotula junto al dato. */}
              <td>{cita.riesgo ? <div className="space-y-1"><NivelRiesgoBadge nivel={cita.riesgo.nivel_riesgo} />{cita.riesgo.resultado_simulado && <RotuloSimulado />}</div> : "Sin predicción"}</td>
              <td><Link className="enlace-detalle" to={`/citas/${cita.id_cita}`} state={{ volver }}>Ver detalle<Icono nombre="flecha" /></Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="paginacion">
        <p>Página {Math.floor(desplazamiento / LIMITE) + 1} de {Math.max(1, Math.ceil(datos.total / LIMITE))}</p>
        <div className="flex gap-2">
          <button className="boton-secundario" disabled={desplazamiento === 0} onClick={() => cambiarPagina(Math.max(0, desplazamiento - LIMITE))}>Anterior</button>
          <button className="boton-secundario" disabled={desplazamiento + LIMITE >= datos.total} onClick={() => cambiarPagina(desplazamiento + LIMITE)}>Siguiente</button>
        </div>
      </div>
    </>}
  </>;
}
