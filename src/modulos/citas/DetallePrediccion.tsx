import NivelRiesgoBadge from "../../nucleo/componentes/NivelRiesgoBadge";
import RotuloSimulado from "../../nucleo/componentes/RotuloSimulado";
import { formatearFechaHora } from "../../nucleo/formato/formato";
import type { PrediccionOut } from "./tipos";

// RF-018, RF-056, RNF-010, RN16: versión, umbral y variables de cada resultado.
export default function DetallePrediccion({ prediccion }: { prediccion: PrediccionOut }) {
  return <article className="citas-prediccion" aria-label={`Predicción #${prediccion.id_prediccion}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">Versión {prediccion.version_modelo}</h3><div><NivelRiesgoBadge nivel={prediccion.nivel_riesgo} />{prediccion.resultado_simulado && <RotuloSimulado />}</div></div>
    <dl className="datos-cita"><div><dt>Probabilidad de inasistencia</dt><dd>{(prediccion.probabilidad_no_show * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %</dd></div>
      <div><dt>Umbral aplicado</dt><dd>{prediccion.umbral_aplicado}</dd></div><div><dt>Fecha de inferencia</dt><dd>{formatearFechaHora(prediccion.fecha_hora_inferencia)}</dd></div>
      <div><dt>Explicabilidad</dt><dd>{prediccion.explicabilidad_resumen || "Sin explicación registrada"}</dd></div>
    </dl>
    <details className="mt-4"><summary>Variables conservadas al calcular el riesgo</summary><dl className="datos-cita citas-instantanea">{Object.entries(prediccion.features_snapshot).map(([nombre, valor]) => <div key={nombre}><dt>{nombre}</dt><dd>{typeof valor === "object" ? JSON.stringify(valor) : String(valor)}</dd></div>)}</dl></details>
  </article>;
}
