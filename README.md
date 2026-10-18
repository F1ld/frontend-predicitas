# PrediCitas CRP — Frontend

React + Vite + Tailwind. Alcance del sábado 17/10/2026: login, sesión, navegación por rol, bandeja con filtros y paginación, detalle con historial y cambio de estado, e importación CSV. FastAPI valida permisos y reglas de negocio.

## Arranque local

En PowerShell, desde esta carpeta:

```powershell
npm ci
# Solo si todavía no tienes .env:
Copy-Item .env.example .env
npm run dev -- --host 127.0.0.1 --strictPort
```

Abre http://127.0.0.1:5173. El backend debe estar disponible en http://127.0.0.1:8000.

`VITE_API_URL` del archivo `.env` indica la URL base de FastAPI, sin `/docs`. Ejemplo: `VITE_API_URL=http://127.0.0.1:8000`. Una variable ausente o vacía usa esa dirección local. Reinicia Vite tras cambiarla. Solo coloca configuración pública en variables `VITE_*`: el navegador puede verlas.

## Comprobaciones

```powershell
npm run lint
npm run build
```

Para revisar el build en el mismo origen permitido por CORS, detén Vite y ejecuta:

```powershell
npm run preview -- --host 127.0.0.1 --port 5173 --strictPort
```

## Organización

- `src/pages`: Login, Citas, CitaDetalle e Importar.
- `src/components`: layout y presentación reutilizable.
- `src/auth`: contexto, hook de sesión y protección por rol.
- `src/lib`: cliente HTTP, consultas cancelables, formato y transiciones.
- `src/App.jsx`: rutas. `src/main.jsx`: montaje, BrowserRouter y AuthProvider.

El token se guarda en `sessionStorage`. Un 401 fuera del login elimina la sesión y muestra el aviso de expiración. El logout intenta registrar el evento en la API y siempre elimina la sesión local; el backend actual no revoca el JWT. No se almacenan contraseñas.

La bandeja aplica los filtros al pulsar el botón y los conserva en la URL. Sugiere el 20/10/2026 como fecha inicial de la demo; «Limpiar» elimina esa restricción. La búsqueda `q` corresponde al identificador externo.

Guía completa: `../Docs_Context/Validacion_Frontend_Sabado.md`.

## Versionado

El repositorio Git existente está dentro de `backend/`; no incluye esta carpeta. `git add .` desde `backend/` no versiona el frontend. Antes de cerrar el avance, decide la organización de repositorios para incluir también frontend y documentación. Esta implementación no mueve ni reinicializa el repositorio existente.
