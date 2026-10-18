/** T-012 · RF-001/003/009/011/018/019/020/056, RN16, RNF-007/016/017.
 * Verificación real del navegador con API interceptada y datos exclusivamente sintéticos.
 * Ejecutar con Vite ya iniciado en 5510: node verificacion/navegador.mjs
 * No escribe en frontend/tests/, no usa la base de datos ni instala dependencias.
 */
import { chromium } from "file:///D:/.gemini/antigravity/scratch/antonella/node_modules/playwright-core/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const capturas = path.resolve(frontend, "../diseno/capturas-t012");
const origen = "http://127.0.0.1:5510";
const api = "http://127.0.0.1:8000";
const informe = { inicio: new Date().toISOString(), entorno: { frontend: origen, api, modo: "API simulada con page.route; sin acceso a datos compartidos" }, backend: {}, comprobaciones: [], capturas: [], consola: [], recursos404: [], fallosRed: [], peticionesApi: [] };
const anchuras = [360, 768, 1024, 1440];
const base = {
  id_cita: 12012, id_cita_externa: "CIT-SIM-T012-001", paciente_anon_id: "PAC-SIM-T012-001", sede: "SAN_ISIDRO", especialidad: "CARDIOLOGIA", medico: "Profesional sintético 01",
  fecha_hora_cita: "2026-10-20T09:00:00-05:00", fecha_registro_cita: "2026-10-15T09:00:00-05:00", antelacion_dias: 5, tipo_paciente: "NUEVO", canal_origen: "WEB", franja_horaria: "MANANA", dia_semana: "MARTES", inasistencias_previas: 0, asistencias_previas: 0, reprogramaciones_prev: 0, estado_actual: "RECIBIDA", target_no_show: null,
};
const riesgo = { id_prediccion: 12012, probabilidad_no_show: 0.72, nivel_riesgo: "ALTO", version_modelo: "simulador-t012", fecha_hora_inferencia: "2026-10-18T10:00:00-05:00", resultado_simulado: true };
const csv = "id_cita_externa,paciente_anon_id,sede,especialidad,medico,fecha_hora_cita,fecha_registro_cita,tipo_paciente,canal_origen\nCIT-SIM-T012-002,PAC-SIM-T012-002,SAN_ISIDRO,CARDIOLOGIA,Profesional sintetico 02,2026-10-20T10:00:00-05:00,2026-10-15T09:00:00-05:00,NUEVO,WEB\nCIT-SIM-T012-001,PAC-SIM-T012-001,SAN_ISIDRO,CARDIOLOGIA,Profesional sintetico 01,2026-10-20T09:00:00-05:00,2026-10-15T09:00:00-05:00,NUEVO,WEB\n";

function comprobar(nombre, evidencia) { informe.comprobaciones.push({ nombre, resultado: "PASS", evidencia }); }
async function visible(locator) { await locator.waitFor({ state: "visible", timeout: 12000 }); }
async function menuActivo(page, etiqueta, ancho, vista) {
  const activas=await page.locator('nav[aria-label="Principal"] a[aria-current="page"]').allTextContents();
  assert.deepEqual(activas,[etiqueta], `${vista}: una única entrada activa del menú`);
  comprobar(`Menú activo ${vista} ${ancho}px`,activas);
}
async function screenshot(page, nombre, fullPage=true) {
  await page.screenshot({ path: path.join(capturas, nombre), fullPage, animations: "disabled" });
  informe.capturas.push(`diseno/capturas-t012/${nombre}`);
}
async function inspeccionar(page, vista, ancho) {
  const medida = await page.evaluate(() => {
    const rect = (selector) => { const e = document.querySelector(selector); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
    const pares = [[".login-bienvenida", ".login-formulario"], [".cabecera-fila .marca-enlace", ".perfil"], [".navegacion-fila nav", ".nota-navegacion"], [".pagina-titulo > div", ".contexto-horario"], [".datos-cita", ".acciones-cita"], [".importacion-principal", ".importacion-ayuda"]];
    const solapes = pares.map(([a,b]) => ({ a,b,ra:rect(a),rb:rect(b) })).filter(({ra,rb}) => ra && rb && Math.min(ra.right,rb.right)-Math.max(ra.x,rb.x)>1 && Math.min(ra.bottom,rb.bottom)-Math.max(ra.y,rb.y)>1);
    const logo = document.querySelector("img.marca");
    const logos = logo ? { natural: logo.naturalWidth / logo.naturalHeight, declarada: Number(logo.getAttribute("width"))/Number(logo.getAttribute("height")), renderizado: logo.getBoundingClientRect().width / logo.getBoundingClientRect().height, alt: logo.alt, completo: logo.complete } : null;
    const scroll = [...document.querySelectorAll(".tabla-contenedor, .overflow-x-auto")].map(e=>({ ancho:e.clientWidth,contenido:e.scrollWidth }));
    const selector=document.querySelector(".selector-archivo"), tarjeta=selector?.closest(".tarjeta");
    const contencion=selector&&tarjeta ? {contenido:rect(".selector-archivo"),tarjeta:rect(".importacion-principal"),padding:parseFloat(getComputedStyle(tarjeta).paddingLeft)} : null;
    return { viewport: innerWidth, documento: document.documentElement.scrollWidth, h1:document.querySelectorAll("h1").length, main:document.querySelectorAll("main").length, navegacion:document.querySelectorAll('nav[aria-label="Principal"]').length, solapes, logos, scroll, contencion };
  });
  assert.ok(medida.documento <= ancho + 1, `${vista} ${ancho}: overflow de documento ${medida.documento}`);
  assert.equal(medida.h1, 1, `${vista}: un h1`); assert.equal(medida.main, 1, `${vista}: un main`);
  assert.deepEqual(medida.solapes, [], `${vista}: solapes entre regiones principales`);
  if(medida.contencion) assert.ok(medida.contencion.contenido.right <= medida.contencion.tarjeta.right-medida.contencion.padding+1, `${vista} ${ancho}: selector fuera del contenido de la tarjeta: ${JSON.stringify(medida.contencion)}`);
  assert.ok(medida.logos?.completo && medida.logos.alt === "PrediCitas CRP");
  assert.ok(Math.abs(medida.logos.declarada - medida.logos.renderizado) < 0.06, `La marca mantiene su proporción: ${JSON.stringify(medida.logos)}`);
  if (vista !== "login") assert.equal(medida.navegacion, 1);
  comprobar(`${vista}: estructura y composición ${ancho}px`, medida);
}

async function simular(page, ancho) {
  const estado = { rol: "RECEPCION", expirado: false, modo: "datos", cambios: [], importaciones: [], detalle: { ...base, historial:[{id_historial:120120, id_usuario_actor:12012, estado_anterior:null, estado_nuevo:"RECIBIDA", motivo_cambio:"Carga sintética de verificación T-012", fecha_hora_evento:"2026-10-15T09:00:00-05:00"}], check_in:null, predicciones:[], intervenciones:[], cupo_liberado:null, reasignacion:null } };
  page.on("console", msg => { if (["error", "warning"].includes(msg.type())) informe.consola.push({ ancho, tipo:msg.type(), texto:msg.text() }); });
  page.on("pageerror", error => informe.consola.push({ ancho, tipo:"pageerror", texto:error.message }));
  page.on("response", response => { if (response.status() === 404) informe.recursos404.push({ ancho, url:response.url() }); });
  page.on("requestfailed", request => { if (request.failure()?.errorText !== "net::ERR_ABORTED") informe.fallosRed.push({ ancho, url:request.url(), error:request.failure()?.errorText }); });
  await page.route(`${api}/**`, async route => {
    const request = route.request(); const url = new URL(request.url());
    if (request.method() === "OPTIONS") { await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,OPTIONS"}}); return; }
    const dato = { ancho, metodo:request.method(), ruta:url.pathname, query:url.search, authorization:Boolean(request.headers().authorization) };
    informe.peticionesApi.push(dato);
    const responder = (body, status=200) => route.fulfill({ status, contentType:"application/json", headers:{"access-control-allow-origin":"*"}, body:JSON.stringify(body) });
    if (url.pathname === "/auth/login") { const form = new URLSearchParams(request.postData()); assert.equal(form.get("username"), "recepcion@predicitas.crp"); assert.equal(form.get("password"), "Sintetica012"); dato.campos=[...form.keys()]; return responder({access_token:"token-sintetico-t012",token_type:"bearer",expires_in:1800}); }
    if (url.pathname === "/auth/me") {
      if (estado.expirado) return responder({error:{codigo:"SESION_INVALIDA",mensaje:"La sesión ya no es válida.",campos:{}}},401);
      return responder({id_usuario:12012,nombre_completo:estado.rol === "TECNICO_IA" ? "Técnico sintético T-012" : "Recepción sintética T-012",correo_institucional:"recepcion@predicitas.crp",rol:estado.rol,activo:true,creado_en:"2026-10-15T09:00:00-05:00",actualizado_en:null});
    }
    if (url.pathname === "/auth/logout") return route.fulfill({status:204,headers:{"access-control-allow-origin":"*"}});
    if (url.pathname === "/citas" && request.method() === "GET") {
      if (estado.modo === "cargando") await new Promise(resolve=>setTimeout(resolve,700));
      if (estado.modo === "error") return responder({error:{codigo:"ERROR_INTERNO",mensaje:"Error sintético de verificación T-012.",campos:{}}},500);
      const items = estado.modo === "vacio" ? [] : [{...base,riesgo,estado_intervencion:null,respuesta_paciente:null,tiene_check_in:false},{...base,id_cita:12013,id_cita_externa:"CIT-SIM-T012-003",paciente_anon_id:"PAC-SIM-T012-003",riesgo:null,estado_intervencion:null,respuesta_paciente:null,tiene_check_in:false}];
      return responder({total:items.length,limite:20,desplazamiento:0,items});
    }
    if (url.pathname === `/citas/${base.id_cita}`) return responder(estado.detalle);
    if (url.pathname === `/citas/${base.id_cita}/estado`) {
      const body=request.postDataJSON(); assert.deepEqual(Object.keys(body).sort(),["estado_nuevo","motivo"]); assert.equal(body.estado_nuevo,"CONFIRMADA"); estado.cambios.push(body); dato.json=body;
      estado.detalle={...estado.detalle,estado_actual:body.estado_nuevo,historial:[...estado.detalle.historial,{id_historial:120121,id_usuario_actor:12012,estado_anterior:"RECIBIDA",estado_nuevo:body.estado_nuevo,motivo_cambio:body.motivo,fecha_hora_evento:"2026-10-18T10:00:00-05:00"}]}; return responder(estado.detalle);
    }
    if (url.pathname === "/citas/importar" && request.method()==="POST") { assert.match(request.headers()["content-type"],/^multipart\/form-data; boundary=/); assert.match(request.postData(),/name="archivo"; filename="citas-sinteticas-t012.csv"/); estado.importaciones.push({multipart:true,archivo:"citas-sinteticas-t012.csv"}); return responder({recibidas:2,aceptadas:1,rechazadas:1,detalle_rechazos:[{fila:2,id_cita_externa:"CIT-SIM-T012-001",motivos:["Identificador externo duplicado (dato sintético T-012)."]}]}); }
    throw new Error(`Petición no prevista ${request.method()} ${url.pathname}`);
  });
  return estado;
}

await mkdir(capturas,{recursive:true});
try { const response=await fetch(`${api}/health`,{signal:AbortSignal.timeout(3500)}); informe.backend={status:response.status,cuerpo:await response.text(),conclusion:"Solo GET /health; flujos contra API simulada para no modificar datos compartidos."}; }
catch(error) { informe.backend={disponible:false,error:error.message,conclusion:"Backend no disponible. Se aplica fallback fetch simulado autorizado por tareas/T-012-base-frontend.md; no se comprueba persistencia real."}; }
let browser;
try {
  browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,"ms-playwright/chromium-1243/chrome-win64/chrome.exe"),headless:true});
  for (const ancho of anchuras) {
    const context=await browser.newContext({viewport:{width:ancho,height:900},locale:"es-PE",timezoneId:"America/Lima",reducedMotion:"reduce"});
    const page=await context.newPage(); const estado=await simular(page,ancho);
    await page.goto(`${origen}/login`); await visible(page.getByRole("heading",{name:"Iniciar sesión",exact:true}));
    await inspeccionar(page,"login",ancho); await screenshot(page,`login-${ancho}.png`);
    await page.keyboard.press("Tab"); assert.equal(await page.locator("#correo").evaluate(e=>e===document.activeElement),true);
    await page.keyboard.insertText("recepcion@predicitas.crp"); await page.keyboard.press("Tab"); assert.equal(await page.locator("#clave").evaluate(e=>e===document.activeElement),true);
    await page.keyboard.insertText("Sintetica012"); await page.keyboard.press("Tab"); assert.equal(await page.getByRole("button",{name:"Ingresar",exact:true}).evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press("Enter"); await visible(page.getByRole("heading",{name:"Bandeja de citas",exact:true})); await visible(page.getByText(base.id_cita_externa,{exact:true}));
    assert.equal(await page.evaluate(()=>Boolean(sessionStorage.getItem("predicitas_token"))),true);
    await visible(page.getByText("Resultado simulado: no es desempeño real",{exact:true})); await visible(page.getByText("Sin predicción",{exact:true}));
    comprobar(`Login por teclado ${ancho}px`, "Tab correo → contraseña → Ingresar; Enter → bandeja; token solo en sessionStorage.");
    await menuActivo(page,"Citas",ancho,"bandeja");
    await inspeccionar(page,"bandeja",ancho); await screenshot(page,`bandeja-${ancho}.png`);
    await page.goto(`${origen}/citas`); await visible(page.getByText(base.id_cita_externa,{exact:true}));
    await page.keyboard.press("Tab"); assert.equal(await page.getByRole("link",{name:"Ir al contenido",exact:true}).evaluate(e=>e===document.activeElement),true);
    const foco=await page.getByRole("link",{name:"Ir al contenido",exact:true}).evaluate(e=>({top:e.getBoundingClientRect().top,outline:getComputedStyle(e).outlineStyle})); assert.ok(foco.top>=0); assert.notEqual(foco.outline,"none");
    await page.keyboard.press("Enter"); assert.equal(await page.locator("main").evaluate(e=>e===document.activeElement),true);
    comprobar(`Saltar al contenido y foco visible ${ancho}px`,foco);
    await page.getByRole("link",{name:"Ver detalle",exact:false}).first().focus(); await page.keyboard.press("Enter"); await visible(page.getByRole("heading",{name:`Cita ${base.id_cita_externa}`,exact:true}));
    await menuActivo(page,"Citas",ancho,"detalle");
    await visible(page.getByText("Carga sintética de verificación T-012",{exact:true})); await inspeccionar(page,"detalle",ancho); await screenshot(page,`detalle-${ancho}.png`);
    const confirmar=page.getByRole("button",{name:"Marcar como Confirmada",exact:true}); await confirmar.focus(); await page.keyboard.press("Enter"); await visible(page.getByRole("dialog"));
    assert.equal(await page.locator("#motivo").evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press("Tab"); assert.equal(await page.getByRole("button",{name:"Cancelar",exact:true}).evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press("Tab"); assert.equal(await page.getByRole("button",{name:"Confirmar cambio",exact:true}).evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog").isVisible(),false); assert.equal(estado.cambios.length,0);
    await confirmar.focus(); await page.keyboard.press("Enter"); await visible(page.getByRole("dialog")); await page.keyboard.insertText("Confirmación sintética de verificación T-012");
    await screenshot(page,`dialogo-${ancho}.png`,false); await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
    await visible(page.getByText("Estado actualizado a Confirmada.",{exact:true})); await visible(page.getByText("Confirmación sintética de verificación T-012",{exact:true})); assert.equal(estado.cambios.length,1);
    comprobar(`Detalle, diálogo y cambio por teclado ${ancho}px`,{escapeSinMutacion:true,ordenFoco:"motivo → Cancelar → Confirmar cambio",post:estado.cambios[0],historial:true});
    await page.getByRole("link",{name:"Importar CSV",exact:true}).focus(); await page.keyboard.press("Enter"); await visible(page.getByRole("heading",{name:"Importar citas",exact:true}));
    await menuActivo(page,"Importar CSV",ancho,"importar");
    await inspeccionar(page,"importar",ancho); await screenshot(page,`importar-${ancho}.png`);
    await page.locator("#archivo").setInputFiles({name:"citas-sinteticas-t012.csv",mimeType:"text/csv",buffer:Buffer.from(csv,"utf8")});
    await page.getByRole("button",{name:"Importar archivo",exact:true}).focus(); await page.keyboard.press("Enter"); await visible(page.getByRole("heading",{name:"Resultado de la importación",exact:true}));
    await visible(page.getByText("Identificador externo duplicado (dato sintético T-012).",{exact:true})); assert.equal(estado.importaciones.length,1);
    await inspeccionar(page,"importar-resultado",ancho); await screenshot(page,`importar-resultado-${ancho}.png`);
    comprobar(`Importación y rechazo ${ancho}px`,{recibidas:2,aceptadas:1,rechazadas:1,...estado.importaciones[0]});
    await page.goto(`${origen}/importar`); await visible(page.getByRole("heading",{name:"Importar citas",exact:true})); assert.equal(new URL(page.url()).pathname,"/citas/importar"); comprobar(`Alias /importar ${ancho}px`,"Redirige a /citas/importar.");
    const movimiento=await page.locator(".boton").first().evaluate(e=>({preferencia:matchMedia("(prefers-reduced-motion: reduce)").matches,transicion:getComputedStyle(e).transitionDuration})); assert.equal(movimiento.preferencia,true); assert.equal(movimiento.transicion,"0s"); comprobar(`Movimiento reducido ${ancho}px`,movimiento);
    estado.rol="TECNICO_IA"; await page.goto(`${origen}/citas`); await visible(page.getByText(base.id_cita_externa,{exact:true})); assert.equal(await page.getByRole("link",{name:"Importar CSV",exact:true}).count(),0);
    await page.getByRole("link",{name:"Ver detalle",exact:false}).first().click(); await visible(page.getByText("Tu rol permite consultar la cita. No tienes permiso para cambiar su estado.",{exact:true})); assert.equal(await page.getByRole("button",{name:/Marcar como/}).count(),0);
    await page.goto(`${origen}/citas/importar`); await visible(page.getByRole("heading",{name:"No tienes permiso para esta sección",exact:true})); comprobar(`Permisos TECNICO_IA ${ancho}px`,"Consulta bandeja/detalle; importación sin menú ni acceso directo y sin botones de cambio.");
    estado.expirado=true; await page.goto(`${origen}/citas`); await visible(page.getByRole("heading",{name:"Iniciar sesión",exact:true})); await visible(page.getByText("Tu sesión expiró. Inicia sesión nuevamente.",{exact:true})); assert.equal(await page.evaluate(()=>sessionStorage.getItem("predicitas_token")),null); comprobar(`SESION_INVALIDA ${ancho}px`,"401 borra token, avisa al usuario y vuelve a /login.");
    if(ancho===360) {
      estado.expirado=false; estado.rol="RECEPCION"; await page.evaluate(()=>sessionStorage.setItem("predicitas_token","token-sintetico-t012"));
      estado.modo="cargando"; await page.goto(`${origen}/citas`); await visible(page.getByText("Cargando citas…",{exact:true})); await visible(page.getByText(base.id_cita_externa,{exact:true})); await page.waitForLoadState("networkidle"); comprobar("Bandeja cargando (navegador)","Estado visible durante respuesta diferida y reemplazado por datos.");
      estado.modo="vacio"; await page.goto(`${origen}/citas`); await visible(page.getByText("No hay citas con esos filtros.",{exact:true})); await page.waitForLoadState("networkidle"); comprobar("Bandeja vacía (navegador)","Mensaje visible con respuesta items: [].");
      estado.modo="error"; await page.goto(`${origen}/citas`); await visible(page.getByText("Error sintético de verificación T-012.",{exact:true})); estado.modo="datos"; await page.getByRole("button",{name:"Reintentar",exact:true}).click(); await visible(page.getByText(base.id_cita_externa,{exact:true})); comprobar("Bandeja error y reintento (navegador)","Error contractual 500 visible y recuperación posterior.");
    }
    await context.close();
  }
  assert.equal(informe.recursos404.length,0,"Sin recursos 404");
  assert.equal(informe.fallosRed.length,0,"Sin fallos de red inesperados");
  const consolaInesperada=informe.consola.filter(e=>e.tipo==="pageerror" || !/Failed to load resource: the server responded with a status of (401|500)/.test(e.texto));
  assert.deepEqual(consolaInesperada,[],"Sin errores o avisos inesperados de consola");
  comprobar("Consola y recursos",{recursos404:0,fallosRed:0,excepciones:0,mensajesEsperados:informe.consola.length,detalle:"Solo mensajes de red 401/500 de los escenarios de error provocados."});
  informe.resultado="PASS";
} catch(error) { informe.resultado="FAIL"; informe.error={mensaje:error.message,stack:error.stack}; process.exitCode=1; }
finally {
  await browser?.close(); informe.fin=new Date().toISOString();
  await writeFile(path.join(frontend,"verificacion/navegador.json"),JSON.stringify(informe,null,2)+"\n","utf8");
  const texto=[`T-012 · Verificación de navegador: ${informe.resultado}`,`Inicio: ${informe.inicio}`,`Fin: ${informe.fin}`,`Backend: ${JSON.stringify(informe.backend)}`,`Modalidad: ${informe.entorno.modo}`,`Viewports: ${anchuras.join(", ")} px × 900 px`,`Comprobaciones aprobadas: ${informe.comprobaciones.length}`,`Capturas: ${informe.capturas.length}`, ...informe.comprobaciones.map(c=>`PASS ${c.nombre}: ${JSON.stringify(c.evidencia)}`), ...(informe.error?[`FAIL ${informe.error.stack}`]:[]),`Límite: la API está simulada; no se afirma persistencia real del backend.`].join("\n")+"\n";
  await writeFile(path.join(frontend,"verificacion/navegador.txt"),texto,"utf8"); console.log(texto);
}
