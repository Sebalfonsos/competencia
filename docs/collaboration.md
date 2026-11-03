# Colaboración

| Dato | Valor |
|---|---|
| Repositorio | `Sebalfonsos/competencia` |
| Rama principal | `main` |
| Identidad coordinadora (Linux) | `santtiag` |
| Identidad trabajadora (Windows) | `Sebalfonsos` |
| Fase activa | `backend` |
| Entorno | Node.js 26.x (incluye `node:sqlite`), npm 12. Dependencias fijadas en `package-lock.json` |
| Validación | `npm ci` y luego `npm test` (no hay lint ni build) |

## Producto
Plataforma web para que los vendedores ambulantes se registren, aparezcan en un directorio público una vez verificados, sigan una guía de formalización (RUT, registro mercantil, permiso de espacio público, manipulación de alimentos, seguridad social) y sean aprobados por un funcionario. El contrato REST está en [api.md](api.md).

## Estructura y propiedad de archivos
- `src/app.js`, `src/db.js`, `src/server.js`, `test/helpers.js`, `package*.json` y `.github/` son **compartidos**: solo los modifica Linux, salvo que una Issue diga otra cosa.
- `src/routes/<modulo>.js` y `test/<modulo>.test.js`: los modifica únicamente el responsable de la Issue del módulo.
- Cada router exporta `(db) => Router` y ya está montado en `src/app.js`.
- Las pruebas usan `startApp()` de `test/helpers.js`, que levanta la app con la BD en memoria en un puerto efímero.

## Variables de entorno
- `PORT` (por defecto 3000)
- `DB_PATH` (por defecto `data/app.db`)
- `ADMIN_TOKEN`: token del panel de administración. Si falta, `/api/admin/*` responde 503. Nunca se versiona.

## Hito de backend
1. Las tareas B1 (vendedores), B2 (admin) y B3 (formalización) están integradas en `main`.
2. La CI está en verde en Ubuntu y Windows.
3. Cada endpoint de `docs/api.md` tiene pruebas del caso feliz y de sus errores documentados.

## Protección de `main` (pendiente; la configura el dueño, Sebalfonsos)
PR obligatorio, check `CI` requerido, 1 aprobación, sin force-push ni borrado.
