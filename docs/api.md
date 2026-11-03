# Contrato API

Todas las respuestas son JSON. Los errores tienen la forma `{ "error": "mensaje" }`.

## Vendedores (B1, `src/routes/vendors.js`)

### `POST /api/vendors`
Body: `nombre`*, `documento`*, `categoria`*, `zona`*, `telefono`*, `descripcion`, `horario`.
- Todos son strings; se recortan los espacios. Longitud máxima: 100 (descripción: 500). `telefono`: 7 a 15 dígitos, con `+` opcional al inicio.
- `201` → `{ "id": 1, "edit_token": "<hex 32>" }`. El registro queda con estado `pendiente`.
- `400` si la validación falla; `409` si el `documento` ya existe.

### `GET /api/vendors?zona=&categoria=&q=`
- `200` → array de vendedores **aprobados**. Filtros exactos por `zona` y `categoria` (sin distinguir mayúsculas); `q` busca en nombre y descripción.
- Campos públicos: `id, nombre, categoria, zona, descripcion, horario, telefono`. **Nunca** expone `documento`, `edit_token` ni `estado`.

### `GET /api/vendors/:id`
- `200` → vendedor público (mismos campos); `404` si no existe o no está aprobado.

## Formalización (B3, `src/routes/formalization.js`)

### `GET /api/steps`
- `200` → `[{ id, orden, titulo, descripcion, enlace }]`, ordenados por `orden`.

### `GET /api/vendors/:id/progress`
Header `Authorization: Bearer <edit_token>`. Funciona en cualquier estado.
- `200` → `{ "steps": [{ id, titulo, completado: bool }], "porcentaje": 0-100 }`
- `401` si el token falta o es incorrecto; `404` si el vendedor no existe.

### `PUT /api/vendors/:id/progress`
Mismo header. Body: `{ "step_id": 1, "completado": true }`.
- `200` → igual que GET. `400` si `step_id` no existe o `completado` no es booleano; `401` y `404` igual que GET.

## Administración (B2, `src/routes/admin.js`)
Header `Authorization: Bearer <ADMIN_TOKEN>` (variable de entorno). `503` si `ADMIN_TOKEN` no está configurado; `401` si el token falta o es incorrecto. Comparar con `crypto.timingSafeEqual`.

### `GET /api/admin/vendors?estado=pendiente|aprobado|rechazado`
- `200` → array con todos los campos, excepto `edit_token`. Sin `estado`, devuelve todos. `400` si `estado` no es válido.

### `PATCH /api/admin/vendors/:id`
Body: `{ "estado": "aprobado" | "rechazado" | "pendiente" }`.
- `200` → vendedor actualizado (sin `edit_token`); `400` si el estado no es válido; `404` si no existe.
