const test = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let app, vendor;
test.before(async () => {
  app = await startApp();
  const r = app.db.prepare(
    "INSERT INTO vendors (nombre, documento, categoria, zona, telefono, edit_token) VALUES ('Ana', 'f-1', 'Frutas', 'Centro', '3001234567', 'tok-ana')"
  ).run();
  vendor = { id: Number(r.lastInsertRowid), token: 'tok-ana' };
});
test.after(() => app.close());

const call = async (method, path, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${app.baseUrl}${path}`, { method, headers, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const url = () => `/api/vendors/${vendor.id}/progress`;

test('GET /api/steps ordenado por orden', async () => {
  const r = await call('GET', '/api/steps');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.length, 5);
  assert.deepStrictEqual(r.body.map((s) => s.orden), [1, 2, 3, 4, 5]);
  assert.ok(r.body.every((s) => s.titulo && 'enlace' in s));
});

test('progreso inicial en 0% y vendedor pendiente permitido', async () => {
  const r = await call('GET', url(), { token: vendor.token });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.porcentaje, 0);
  assert.strictEqual(r.body.steps.length, 5);
  assert.ok(r.body.steps.every((s) => s.completado === false));
});

test('PUT marca y desmarca pasos y recalcula el porcentaje', async () => {
  let r = await call('PUT', url(), { token: vendor.token, body: { step_id: 1, completado: true } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.porcentaje, 20);
  r = await call('PUT', url(), { token: vendor.token, body: { step_id: 2, completado: true } });
  assert.strictEqual(r.body.porcentaje, 40);
  r = await call('PUT', url(), { token: vendor.token, body: { step_id: 1, completado: false } });
  assert.strictEqual(r.body.porcentaje, 20);
  r = await call('GET', url(), { token: vendor.token });
  assert.deepStrictEqual(r.body.steps.filter((s) => s.completado).map((s) => s.id), [2]);
});

test('401 sin token o con token incorrecto', async () => {
  assert.strictEqual((await call('GET', url())).status, 401);
  assert.strictEqual((await call('GET', url(), { token: 'otro' })).status, 401);
  assert.strictEqual((await call('PUT', url(), { token: 'tok-anX', body: { step_id: 1, completado: true } })).status, 401);
});

test('404 si el vendedor no existe', async () => {
  assert.strictEqual((await call('GET', '/api/vendors/99999/progress', { token: vendor.token })).status, 404);
  assert.strictEqual((await call('PUT', '/api/vendors/99999/progress', { token: vendor.token, body: { step_id: 1, completado: true } })).status, 404);
});

test('400 con step_id o completado inválidos', async () => {
  for (const body of [{ step_id: 999, completado: true }, { step_id: '1', completado: true }, { step_id: 1, completado: 'si' }, { step_id: 1 }, {}]) {
    assert.strictEqual((await call('PUT', url(), { token: vendor.token, body })).status, 400, JSON.stringify(body));
  }
});
