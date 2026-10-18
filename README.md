# PrediCitas CRP — Frontend

Base T-012: React 18.3, TypeScript estricto, React Router 7, Vite y Tailwind CSS 4 (D-002). Conserva el diseño y las funciones existentes: login, sesión, navegación por rol, bandeja con filtros y paginación, detalle con historial y cambio de estado e importación CSV (D-007). La API valida los permisos y las reglas de negocio.

## Arranque en el worktree de T-012

Usa Node.js 22, también utilizado por la imagen de desarrollo. Ejecuta estos comandos desde `frontend/`:

```powershell
npm ci
# Solo si todavía no existe .env:
Copy-Item .env.example .env
npm run dev -- --host 127.0.0.1 --port 5510 --strictPort
```

Abre http://127.0.0.1:5510. El puerto 5173 pertenece al entorno principal; T-012 usa exclusivamente 5510. `--strictPort` evita que Vite cambie de puerto si está ocupado.

`VITE_API_URL` configura la URL base de FastAPI, sin `/api` ni `/docs`. Por ejemplo: `VITE_API_URL=http://127.0.0.1:8000`. Si falta o está vacía, el cliente usa `http://127.0.0.1:8000`; elimina las barras finales. Reinicia Vite después de cambiarla. Estas variables son públicas en el navegador: no guardes secretos en `VITE_*`.

Para probar contra una API, esta debe permitir el origen exacto `http://127.0.0.1:5510` en su configuración CORS. Una API que solo permita 5173 no admitirá este origen. La configuración del backend pertenece a su tarjeta; las pruebas unitarias usan `fetch` simulado y no necesitan servidor ni base de datos.

## Organización y puntos de entrada

- `src/main.tsx` monta React, `BrowserRouter` y `AuthProvider`. `src/App.tsx` descubre las rutas de cada módulo.
- `src/nucleo/api/` contiene el cliente HTTP, `ApiError`, tipos comunes y `useConsulta` para consultas cancelables.
- `src/nucleo/auth/` mantiene la sesión existente, `useAuth` y `RutaProtegida` (RF-001, RF-002, RF-003 y RNF-004).
- `src/nucleo/layout/` descubre el menú por módulo, lo filtra por rol y contiene el contenedor de la aplicación.
- `src/nucleo/componentes/` reúne mensajes, carga, estados, riesgo, rótulo de simulado, iconos y marca. `src/nucleo/formato/` muestra fechas en `America/Lima`.
- `src/nucleo/sesion/` contiene únicamente la ranura reservada a T-021. La renovación y la inactividad no se implementan en esta base.
- `src/modulos/sesion/` contiene el login migrado. `src/modulos/citas/` contiene bandeja, detalle, importación, tipos y transiciones.
- Las pruebas Vitest y React Testing Library viven junto al código como `*.test.ts` o `*.test.tsx`; `src/pruebas/` contiene su preparación común. `frontend/tests/` pertenece a T-013.

Lee primero `../contratos/comun.json`, el contrato del módulo que vas a mantener y `src/nucleo/layout/ranuras.ts`. Los nombres de campos, rutas y enums deben coincidir con esos contratos. El diseño existente está documentado en `../diseno/design-system.md` (D-007 y RNF-016).

## Cómo agregar un módulo

Crea una carpeta bajo `src/modulos/<modulo>/`. Su `rutas.tsx` debe exportar por defecto un arreglo de objetos con los campos exactos `{ ruta, elemento, roles }` del contrato común. Por ejemplo, con una vista propia `Vista.tsx`:

```tsx
import type { RutaModulo } from "../../nucleo/layout/ranuras";
import Vista from "./Vista";

const rutas: RutaModulo[] = [
  { ruta: "/mi-modulo", elemento: <Vista />, roles: ["ADMINISTRADOR"] },
];

export default rutas;
```

Si necesita navegación, crea `menu.ts` con un arreglo exportado por defecto. Sus campos son exactamente `{ etiqueta, ruta, icono, roles, orden }`:

```ts
import type { EntradaMenu } from "../../nucleo/layout/ranuras";

const menu: EntradaMenu[] = [
  {
    etiqueta: "Mi módulo", ruta: "/mi-modulo", icono: "calendario",
    roles: ["ADMINISTRADOR"], orden: 30,
  },
];

export default menu;
```

No hay que editar el router global ni el layout: ambos descubren esos archivos con `import.meta.glob`, de forma inmediata (`eager`). Los permisos de ruta y menú deben coincidir. El menú se filtra por rol, se ordena por `orden` ascendente y, en caso de empate, por `ruta`. `Icono` ofrece los nombres disponibles; un nombre desconocido muestra el calendario.

Los roles autenticados son `ADMINISTRADOR`, `RECEPCION` y `TECNICO_IA`. Una ruta pública usa `roles: ["publico"]`, como `/login`; el menú solo acepta roles autenticados. `RutaProtegida` muestra la verificación de sesión, redirige a `/login` si no hay usuario y muestra el mensaje de falta de permiso si el rol no está autorizado (RF-003 y RNF-001). Ocultar una acción en el navegador no reemplaza la validación de la API.

La raíz `/` resuelve el inicio por rol: actualmente todos van a `/citas`. Cuando se publique `/panel` con permiso para Administrador y Recepción, esos roles iniciarán allí; Técnico IA conserva `/citas`, según `contratos/comun.json`. La importación está en `/citas/importar`; el acceso anterior `/importar` redirige a esa ruta y conserva su protección por rol. Técnico IA consulta bandeja y detalle; Administrador y Recepción también pueden importar y cambiar estados.

`src/modulos/prueba-ranura/` es un módulo de prueba del descubrimiento real de rutas y menú. Solo exporta entradas cuando `import.meta.env.MODE === "test"`; en desarrollo y en el build normal exporta arreglos vacíos. No publiques la aplicación con `--mode test`.

## Cliente API y sesión

Usa `api<T>` del núcleo con el tipo del contrato. Devuelve `Promise<T | null>`: una respuesta HTTP 204 retorna `null`. Cuando el endpoint devuelve datos, comprueba ese caso antes de usarlos:

```ts
import { api, ApiError } from "../../nucleo/api/cliente";
import type { Pagina } from "../../nucleo/api/tipos";
import type { CitaResumenOut } from "./tipos";

try {
  const pagina = await api<Pagina<CitaResumenOut>>("/citas", {
    params: { limite: 20, desplazamiento: 0 },
  });
  if (pagina === null) throw new Error("El servidor no devolvió la lista de citas.");
  // pagina.items ya tiene los nombres y tipos del contrato de citas.
} catch (fallo: unknown) {
  if (fallo instanceof ApiError) {
    // fallo.status, fallo.codigo, fallo.mensaje y fallo.campos están disponibles.
    // Presenta fallo.mensaje; en una validación, asocia campos con sus controles.
  }
}
```

Las opciones del cliente son `metodo`, `params`, `json`, `form`, `archivo` y `signal`. Usa `json` para un cuerpo JSON, `form` para el formulario del login y `archivo: FormData` para una importación; el navegador establece el límite multipart del archivo. `signal` permite cancelar la petición al desmontar una vista o cambiar filtros. `useConsulta<T>` reúne carga, datos, error, reintento y actualización de una consulta, e impide que una respuesta anterior sustituya a la consulta vigente.

El formato de error esperado es `{ error: { codigo, mensaje, campos } }` (D-017). `campos` es opcional en el contrato y `ApiError` lo expone como un objeto, vacío si no se recibió. Un error en otro formato usa «No se pudo completar la solicitud.». Un fallo de conexión usa `status: 0` y `codigo: "ERROR_CONEXION"`; una cancelación conserva `AbortError`.

El token se guarda en `sessionStorage` con la clave `predicitas_token`; se envía como `Authorization: Bearer`. No se almacenan contraseñas. Un 401 fuera del login, o el código `SESION_INVALIDA`, borra la credencial vigente y emite `predicitas:sesion-expirada`; `AuthProvider` lleva al usuario al login con un aviso. Una respuesta atrasada de una credencial anterior no invalida una sesión nueva. El cierre intenta registrar `/auth/logout` y siempre elimina la sesión local (RF-002 y RNF-004). La renovación y el cierre por inactividad quedan para T-021.

La bandeja conserva los filtros en la URL y los aplica al pulsar el botón; `q` busca el identificador externo. El filtro inicial existente es `desde=2026-10-20`, para la demostración; «Limpiar» elimina esa restricción. Son datos sintéticos y seudonimizados (`paciente_anon_id`), nunca datos personales reales (RNF-007). Cuando llega `riesgo`, se muestra su nivel y, si `resultado_simulado` es `true`, el texto «Resultado simulado: no es desempeño real» junto al dato. Sin riesgo se muestra «Sin predicción» (RF-056, RN16 y RNF-017).

## Comprobaciones

Ejecuta los comandos dentro de `frontend/`. Esta sección describe cómo comprobarlo; la salida real y cualquier limitación se registran en la entrega de T-012.

```powershell
npm ci
npm run typecheck
npm run lint
npm run build
npm run test
```

- `typecheck` ejecuta `tsc --noEmit` en modo estricto, con detección de variables y parámetros sin uso.
- `lint` ejecuta primero TypeScript y luego ESLint. Para usar solo las dependencias aprobadas, ESLint transpila TypeScript en memoria y revisa el JSX resultante, incluidas las reglas de hooks. Sus posiciones de diagnóstico corresponden al JavaScript transpilado y no ofrece corrección automática. El código TypeScript original no se reescribe.
- `build` ejecuta `tsc -b && vite build` y genera `dist/`.
- `test` ejecuta Vitest en `jsdom` con React Testing Library y cobertura V8. El umbral global es 75 % de líneas (D-002); genera salida de texto, `coverage/index.html` y `coverage/coverage-summary.json`.

Comprueba login, bandeja, detalle y diálogo de cambio de estado, e importación en 360, 768, 1024 y 1440 px. Recorre los controles con Tab, Enter y Escape donde corresponda; revisa el foco, el enlace «Ir al contenido», los estados de carga/vacío/error y la consola y red del navegador (RNF-016). Las pruebas con `fetch` simulado no sustituyen una comprobación contra la API.

Para revisar el build, detén antes el servidor que use 5510:

```powershell
npm run preview -- --host 127.0.0.1 --port 5510 --strictPort
```

## Imagen de desarrollo

`Dockerfile` usa `node:22-alpine`, instala con `npm ci` y arranca Vite en `0.0.0.0:5173`. `.dockerignore` excluye dependencias locales, resultados de build/cobertura, pruebas externas y archivos de entorno locales. Desde `frontend/`:

```powershell
docker build -t predicitas-web-t012 .
docker run --rm -p 5510:5173 predicitas-web-t012
```

El puerto 5173 es interno al contenedor; este comando publica el puerto propio 5510 en el equipo. La API configurada en `VITE_API_URL` debe ser accesible desde el navegador y permitir ese origen. El entorno principal y Compose se integran en T-010.
