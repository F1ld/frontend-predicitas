import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rol, Usuario } from "../../nucleo/api/tipos";
import { ContextoSesion, type ContextoAuth } from "../../nucleo/auth/contexto";
import DetalleCupo from "./DetalleCupo";
import type { CandidatoOut, CupoDetalleOut, CupoOut, ReasignacionOut } from "./tipos";

// RF-074 a RF-082, RN03, RN05, RN11, RNF-028 y RNF-029:
// Pruebas unitarias completas de Detalle y Reasignación Asistida de Cupo (M06-V03)

const cupoInicial: CupoDetalleOut = {
  id_cupo_liberado: 42,
  id_cita_origen: 301,
  id_cita_externa_origen: "CIT-EXT-0042",
  especialidad: "CARDIOLOGIA",
  medico: "Dra. Cardióloga Sintética",
  fecha_hora_cupo: "2026-10-25T14:00:00-05:00",
  franja_horaria: "TARDE",
  estado_cupo: "DISPONIBLE",
  origen_liberacion: "INTERVENCION_VOLUNTARIA",
  liberado_en: "2026-10-24T10:00:00-05:00",
  oferta_vigente: null,
  reasignacion: null,
  historial_ofertas: [],
};

const candidatoUno: CandidatoOut = {
  id_candidato: 801,
  paciente_anon_id: "PAC-SIM-0801",
  especialidad_req: "CARDIOLOGIA",
  franja_preferida: "TARDE",
  estado_candidato: "ACTIVO",
  prioridad_registro: 1,
  fecha_registro: "2026-10-22T09:00:00-05:00",
};

const candidatoDos: CandidatoOut = {
  id_candidato: 802,
  paciente_anon_id: "PAC-SIM-0802",
  especialidad_req: "CARDIOLOGIA",
  franja_preferida: "INDIFERENTE",
  estado_candidato: "ACTIVO",
  prioridad_registro: 2,
  fecha_registro: "2026-10-22T10:30:00-05:00",
};

const fetchSimulado = vi.fn<typeof fetch>();

function respuesta(datos: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorApi(codigo: string, mensaje: string, status = 409, campos?: Record<string, string>) {
  return respuesta({ error: { codigo, mensaje, ...(campos ? { campos } : {}) } }, status);
}

function montar(rol: Rol = "RECEPCION", idCupo = "42") {
  const usuario: Usuario = {
    id_usuario: 5,
    nombre_completo: "Operador de Reasignación",
    correo_institucional: "operador@predicitas.crp",
    rol,
    activo: true,
    creado_en: "2026-10-18T10:00:00-05:00",
    actualizado_en: null,
  };
  const contexto: ContextoAuth = {
    usuario,
    cargando: false,
    mensajeSesion: "",
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    tieneRol: vi.fn((...roles: Rol[]) => roles.includes(rol)),
  };
  return {
    ...render(
      <ContextoSesion.Provider value={contexto}>
        <MemoryRouter initialEntries={[`/cupos/${idCupo}`]}>
          <Routes>
            <Route path="/cupos/:id" element={<DetalleCupo />} />
          </Routes>
        </MemoryRouter>
      </ContextoSesion.Provider>
    ),
    contexto,
  };
}

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal("fetch", fetchSimulado);
  sessionStorage.clear();

  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("M06-V03 Consulta de cupo, propuestas y permisos (RF-074, RF-075, RN05, RNF-028)", () => {
  it("muestra carga mientras se consultan el cupo y los candidatos", () => {
    fetchSimulado.mockImplementation(() => new Promise<Response>(() => undefined));
    montar();
    expect(screen.getByText("Cargando cupo y propuestas…")).toBeInTheDocument();
  });

  it("bloquea el acceso y no realiza peticiones para TECNICO_IA", () => {
    montar("TECNICO_IA");
    expect(screen.getByRole("alert")).toHaveTextContent("No tienes permiso para acceder a los cupos liberados.");
    expect(screen.queryByRole("heading", { name: /Cupo #/ })).not.toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("muestra error contractual si falla la lectura del cupo y permite reintentar", async () => {
    fetchSimulado
      .mockResolvedValueOnce(errorApi("ERROR_INTERNO", "Error al consultar el cupo.", 500))
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([candidatoUno]));

    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Error al consultar el cupo.");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();
    expect(screen.getByText("Propuesta 1 · PAC-SIM-0801")).toBeInTheDocument();
  });

  it("informa cuando el cupo no existe (404)", async () => {
    fetchSimulado.mockResolvedValueOnce(errorApi("NO_ENCONTRADO", "Cupo no encontrado.", 404));
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró el registro solicitado. Actualiza la vista para consultar los datos vigentes."
    );
  });

  it("renderiza datos del cupo, candidatos propuestos en orden sin scores y aviso sin ofertas", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([candidatoUno, candidatoDos]));

    montar("ADMINISTRADOR");
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();
    expect(screen.getByText("CIT-EXT-0042")).toBeInTheDocument();
    expect(screen.getByText("Dra. Cardióloga Sintética")).toBeInTheDocument();
    expect(screen.getByText("Propuesta 1 · PAC-SIM-0801")).toBeInTheDocument();
    expect(screen.getByText("Propuesta 2 · PAC-SIM-0802")).toBeInTheDocument();

    // RN05: Sin score, urgencia ni prioridad clínica
    expect(screen.queryByText(/score|probabilidad|urgencia clínica/i)).not.toBeInTheDocument();
    expect(screen.getByText("No hay oferta vigente.")).toBeInTheDocument();
    expect(screen.getByText("No hay reasignación registrada.")).toBeInTheDocument();
    expect(screen.getByText("No hay ofertas registradas.")).toBeInTheDocument();
  });
});

describe("M06-E07 Registro de oferta de cupo (RF-077)", () => {
  it("permite registrar oferta a un candidato compatible y actualiza estado", async () => {
    const cupoEnOferta: CupoOut = {
      ...cupoInicial,
      estado_cupo: "EN_OFERTA",
      oferta_vigente: {
        id_candidato: candidatoUno.id_candidato,
        paciente_anon_id: candidatoUno.paciente_anon_id,
        id_operador: 5,
        fecha_hora_oferta: "2026-10-24T11:00:00-05:00",
      },
    };

    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      // POST oferta
      .mockResolvedValueOnce(respuesta(cupoEnOferta, 201))
      // Refresco tras mutación
      .mockResolvedValueOnce(respuesta({ ...cupoEnOferta, historial_ofertas: [], reasignacion: null }))
      .mockResolvedValueOnce(respuesta([candidatoUno]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    const botonOfrecer = screen.getByRole("button", { name: `Ofrecer cupo a ${candidatoUno.paciente_anon_id}` });
    await userEvent.click(botonOfrecer);

    await waitFor(() => {
      const llamadaOferta = fetchSimulado.mock.calls.find(([, opt]) => opt?.method === "POST");
      expect(llamadaOferta).toBeDefined();
      expect(String(llamadaOferta?.[0])).toContain("/cupos/42/oferta");
      expect(JSON.parse(String(llamadaOferta?.[1]?.body))).toEqual({ id_candidato: candidatoUno.id_candidato });
    });

    expect(
      await screen.findByText("Oferta registrada. Espera la respuesta del paciente antes de confirmar la reasignación.")
    ).toBeInTheDocument();
  });

  it.each([
    ["CUPO_NO_DISPONIBLE", "El cupo ya no está disponible para ofrecerlo. Revisa su estado actualizado."],
    ["CUPO_EXPIRADO", "El cupo está vencido: no admite ofertas ni reasignación."],
    ["CANDIDATO_NO_COMPATIBLE", "El candidato ya no es compatible con el cupo. Revisa las propuestas actualizadas."],
    ["CANDIDATO_CON_OFERTA", "El candidato tiene una oferta vigente. Cierra la oferta antes de continuar."],
  ])("informa error de negocio %s al intentar ofrecer", async (codigo, mensajeEsperado) => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      .mockResolvedValueOnce(errorApi(codigo, "Conflicto", 409))
      // Refresco tras 409
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: `Ofrecer cupo a ${candidatoUno.paciente_anon_id}` }));
    expect(await screen.findByText(mensajeEsperado)).toBeInTheDocument();
  });
});

describe("M06-E08 Cierre de oferta (RF-078)", () => {
  const cupoConOferta: CupoDetalleOut = {
    ...cupoInicial,
    estado_cupo: "EN_OFERTA",
    oferta_vigente: {
      id_candidato: candidatoUno.id_candidato,
      paciente_anon_id: candidatoUno.paciente_anon_id,
      id_operador: 5,
      fecha_hora_oferta: "2026-10-24T11:00:00-05:00",
    },
  };

  it("cierra oferta por rechazo con respuesta RECHAZA", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      .mockResolvedValueOnce(respuesta(cupoInicial, 200))
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([candidatoUno]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar oferta: rechazó" }));

    await waitFor(() => {
      const llamada = fetchSimulado.mock.calls.find(([, opt]) => String(opt?.body).includes("RECHAZA"));
      expect(llamada).toBeDefined();
      expect(String(llamada?.[0])).toContain("/cupos/42/oferta/cerrar");
      expect(JSON.parse(String(llamada?.[1]?.body))).toEqual({ respuesta: "RECHAZA" });
    });

    expect(await screen.findByText("Oferta cerrada: el paciente rechazó el cupo.")).toBeInTheDocument();
  });

  it("cierra oferta por falta de respuesta con respuesta SIN_RESPUESTA", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      .mockResolvedValueOnce(respuesta(cupoInicial, 200))
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([candidatoUno]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar oferta: sin respuesta" }));

    await waitFor(() => {
      const llamada = fetchSimulado.mock.calls.find(([, opt]) => String(opt?.body).includes("SIN_RESPUESTA"));
      expect(llamada).toBeDefined();
      expect(JSON.parse(String(llamada?.[1]?.body))).toEqual({ respuesta: "SIN_RESPUESTA" });
    });

    expect(await screen.findByText("Oferta cerrada: no hubo respuesta del paciente.")).toBeInTheDocument();
  });

  it("gestiona error 409 SIN_OFERTA_VIGENTE al cerrar oferta", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      .mockResolvedValueOnce(errorApi("SIN_OFERTA_VIGENTE", "No hay oferta", 409))
      .mockResolvedValueOnce(respuesta(cupoInicial))
      .mockResolvedValueOnce(respuesta([]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar oferta: rechazó" }));
    expect(
      await screen.findByText("No hay una oferta vigente para este candidato. Actualiza el cupo antes de continuar.")
    ).toBeInTheDocument();
  });
});

describe("M06-E09 Reasignación Asistida con Confirmación Humana Explícita (RF-079, RF-081, RF-082, RN03, RN11, RNF-029)", () => {
  const cupoConOferta: CupoDetalleOut = {
    ...cupoInicial,
    estado_cupo: "EN_OFERTA",
    oferta_vigente: {
      id_candidato: candidatoUno.id_candidato,
      paciente_anon_id: candidatoUno.paciente_anon_id,
      id_operador: 5,
      fecha_hora_oferta: "2026-10-24T11:00:00-05:00",
    },
  };

  it("abre el diálogo modal y permite cancelarlo", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));
    expect(screen.getByRole("heading", { name: "Confirmar reasignación" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialogo = document.querySelector("dialog");
    expect(dialogo?.hasAttribute("open")).toBe(false);
  });

  it("el botón de envío permanece deshabilitado hasta marcar la casilla Y seleccionar el medio", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));

    const botonRegistrar = screen.getByRole("button", { name: "Registrar reasignación" });
    const casillaConfirmacion = screen.getByLabelText("Confirmé la reasignación con el paciente");
    const selectMedio = screen.getByLabelText("Medio de confirmación");

    // Ambos desmarcados -> botón deshabilitado
    expect(botonRegistrar).toBeDisabled();

    // Solo casilla marcada -> sigue deshabilitado
    await userEvent.click(casillaConfirmacion);
    expect(casillaConfirmacion).toBeChecked();
    expect(botonRegistrar).toBeDisabled();

    // Casilla desmarcada y solo medio seleccionado -> sigue deshabilitado
    await userEvent.click(casillaConfirmacion);
    expect(casillaConfirmacion).not.toBeChecked();
    await userEvent.selectOptions(selectMedio, "LLAMADA_CONFIRMADA");
    expect(botonRegistrar).toBeDisabled();

    // Ambos listos -> habilitado
    await userEvent.click(casillaConfirmacion);
    expect(casillaConfirmacion).toBeChecked();
    expect(botonRegistrar).toBeEnabled();
  });

  it("rechaza el envío programático si la casilla de confirmación no está marcada (false/null/omitida)", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));

    const formulario = screen.getByRole("dialog").querySelector("form")!;
    // Intentar submit directo sin marcar casilla
    fireEvent.submit(formulario);

    expect(screen.getByText("Marca la confirmación después de hablar con el paciente.")).toBeInTheDocument();
    // No debe haber ninguna llamada a POST /reasignacion
    const llamadaReasigna = fetchSimulado.mock.calls.find(([, opt]) => String(opt?.body).includes("confirmacion_humana"));
    expect(llamadaReasigna).toBeUndefined();
  });

  it("envía confirmacion_humana: true literal, medio y observaciones, y muestra el aviso de agendamiento externo (RN03)", async () => {
    const reasignacionExitosa: ReasignacionOut = {
      id_reasignacion: 901,
      id_cupo_liberado: 42,
      id_candidato: candidatoUno.id_candidato,
      paciente_anon_id: candidatoUno.paciente_anon_id,
      id_operador_confirma: 5,
      confirmacion_humana: true,
      medio_confirmacion: "LLAMADA_CONFIRMADA",
      observaciones: "Aceptó cita para la tarde",
      fecha_hora_reasigna: "2026-10-24T11:15:00-05:00",
    };

    const cupoReasignado: CupoDetalleOut = {
      ...cupoConOferta,
      estado_cupo: "REASIGNADO",
      oferta_vigente: null,
      reasignacion: reasignacionExitosa,
    };

    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      // POST reasignación
      .mockResolvedValueOnce(respuesta(reasignacionExitosa, 201))
      // Refresco tras mutación
      .mockResolvedValueOnce(respuesta(cupoReasignado));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));

    const casilla = screen.getByLabelText("Confirmé la reasignación con el paciente");
    const selectMedio = screen.getByLabelText("Medio de confirmación");
    const inputObservaciones = screen.getByLabelText("Observaciones (opcional)");

    await userEvent.click(casilla);
    await userEvent.selectOptions(selectMedio, "LLAMADA_CONFIRMADA");
    await userEvent.type(inputObservaciones, "Aceptó cita para la tarde");

    const botonRegistrar = screen.getByRole("button", { name: "Registrar reasignación" });
    expect(botonRegistrar).toBeEnabled();
    await userEvent.click(botonRegistrar);

    await waitFor(() => {
      const llamada = fetchSimulado.mock.calls.find(([, opt]) => String(opt?.body).includes("confirmacion_humana"));
      expect(llamada).toBeDefined();
      expect(String(llamada?.[0])).toContain("/cupos/42/reasignacion");

      const cuerpo = JSON.parse(String(llamada?.[1]?.body));
      expect(cuerpo).toEqual({
        id_candidato: candidatoUno.id_candidato,
        confirmacion_humana: true, // Literal boolean true
        medio_confirmacion: "LLAMADA_CONFIRMADA",
        observaciones: "Aceptó cita para la tarde",
      });
      // Verificación estricta de tipo boolean true
      expect(cuerpo.confirmacion_humana).toBe(true);
      expect(typeof cuerpo.confirmacion_humana).toBe("boolean");
    });

    // RN03: Aviso de que PrediCitas no agenda
    const avisos = await screen.findAllByText("Agenda la cita en el sistema de la clínica: PrediCitas no agenda");
    expect(avisos.length).toBeGreaterThanOrEqual(1);
  });

  it("gestiona error 422 CONFIRMACION_REQUERIDA devuelto por la API", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      .mockResolvedValueOnce(
        errorApi("CONFIRMACION_REQUERIDA", "Confirmación obligatoria", 422)
      );

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));
    await userEvent.click(screen.getByLabelText("Confirmé la reasignación con el paciente"));
    await userEvent.selectOptions(screen.getByLabelText("Medio de confirmación"), "PRESENCIAL");
    await userEvent.click(screen.getByRole("button", { name: "Registrar reasignación" }));

    expect(
      await screen.findByText("Debes confirmar explícitamente la reasignación con el paciente antes de registrarla.")
    ).toBeInTheDocument();
  });

  it("gestiona error 409 CUPO_REASIGNADO devuelto por la API", async () => {
    fetchSimulado
      .mockResolvedValueOnce(respuesta(cupoConOferta))
      .mockResolvedValueOnce(respuesta([candidatoUno]))
      .mockResolvedValueOnce(errorApi("CUPO_REASIGNADO", "Ya fue reasignado", 409))
      // Refresco tras 409
      .mockResolvedValueOnce(respuesta({ ...cupoConOferta, estado_cupo: "REASIGNADO" }));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar reasignación" }));
    await userEvent.click(screen.getByLabelText("Confirmé la reasignación con el paciente"));
    await userEvent.selectOptions(screen.getByLabelText("Medio de confirmación"), "PRESENCIAL");
    await userEvent.click(screen.getByRole("button", { name: "Registrar reasignación" }));

    expect(
      await screen.findByText("El cupo ya fue reasignado. No se puede confirmar otra reasignación.")
    ).toBeInTheDocument();
  });
});

describe("Estados especiales de cupo: EXPIRADO y REASIGNADO", () => {
  it("un cupo EXPIRADO no consulta candidatos y avisa que no admite ofertas", async () => {
    const cupoExpirado: CupoDetalleOut = {
      ...cupoInicial,
      estado_cupo: "EXPIRADO",
    };

    fetchSimulado.mockResolvedValueOnce(respuesta(cupoExpirado));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();
    expect(screen.getByText("El cupo expiró y no admite ofertas ni reasignación.")).toBeInTheDocument();
    expect(screen.getByText("No se proponen candidatos para este estado del cupo.")).toBeInTheDocument();

    // Solo 1 llamada a GET /cupos/42, ninguna a /candidatos
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(String(fetchSimulado.mock.calls[0][0])).not.toContain("/candidatos");
  });

  it("un cupo REASIGNADO muestra los datos de la reasignación previa y el aviso de agendamiento", async () => {
    const cupoReasignado: CupoDetalleOut = {
      ...cupoInicial,
      estado_cupo: "REASIGNADO",
      reasignacion: {
        id_reasignacion: 777,
        id_cupo_liberado: 42,
        id_candidato: 801,
        paciente_anon_id: "PAC-SIM-0801",
        id_operador_confirma: 9,
        confirmacion_humana: true,
        medio_confirmacion: "PRESENCIAL",
        observaciones: "Reasignado en ventanilla",
        fecha_hora_reasigna: "2026-10-24T12:00:00-05:00",
      },
    };

    fetchSimulado.mockResolvedValueOnce(respuesta(cupoReasignado));

    montar();
    expect(await screen.findByRole("heading", { name: "Cupo #42" })).toBeInTheDocument();
    expect(screen.getByText("El cupo ya fue reasignado y no admite una nueva asignación.")).toBeInTheDocument();
    expect(screen.getByText("PAC-SIM-0801")).toBeInTheDocument();
    expect(screen.getByText("#777")).toBeInTheDocument();
    expect(screen.getAllByText("Presencial").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Reasignado en ventanilla")).toBeInTheDocument();
    expect(screen.getByText("Agenda la cita en el sistema de la clínica: PrediCitas no agenda")).toBeInTheDocument();

    // No llama a /candidatos
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
});
