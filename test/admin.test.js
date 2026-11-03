const test = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

const TOKEN = 'token-de-prueba';

function insertVendor(db, documento, estado = 'pendiente') {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO vendors (nombre, documento, categoria, zona, telefono, estado, edit_token)
              VALUES (?, ?, 'comida', 'centro', '3001234567', ?, 'secreto')`)
    .run(`Vendedor ${documento}`, documento, estado);
  return Number(lastInsertRowid);
}

function request(app, path, { token = TOKEN, method = 'GET', body } = {}) {
  const headers = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${app.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('API de administración', async (t) => {
  const app = await startApp();
  const previo = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = TOKEN;
  t.after(async () => {
    if (previo === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = previo;
    await app.close();
  });

  const pendiente = insertVendor(app.db, '100');
  const aprobado = insertVendor(app.db, '200', 'aprobado');
  insertVendor(app.db, '300', 'rechazado');

  await t.test('503 si ADMIN_TOKEN no está configurado', async () => {
    delete process.env.ADMIN_TOKEN;
    try {
      const res = await request(app, '/api/admin/vendors');
      assert.strictEqual(res.status, 503);
      assert.ok((await res.json()).error);
    } finally {
      process.env.ADMIN_TOKEN = TOKEN;
    }
  });

  await t.test('401 sin token o con token incorrecto', async () => {
    for (const token of [null, 'incorrecto', `${TOKEN}x`]) {
      const res = await request(app, '/api/admin/vendors', { token });
      assert.strictEqual(res.status, 401);
      assert.ok((await res.json()).error);
    }
    const patch = await request(app, `/api/admin/vendors/${pendiente}`, { token: 'incorrecto', method: 'PATCH', body: { estado: 'aprobado' } });
    assert.strictEqual(patch.status, 401);
  });

  await t.test('GET lista todos sin edit_token', async () => {
    const res = await request(app, '/api/admin/vendors');
    assert.strictEqual(res.status, 200);
    const vendors = await res.json();
    assert.strictEqual(vendors.length, 3);
    for (const v of vendors) {
      assert.ok(!('edit_token' in v));
      assert.ok('documento' in v && 'estado' in v);
    }
  });

  await t.test('GET filtra por estado', async () => {
    const res = await request(app, '/api/admin/vendors?estado=aprobado');
    assert.strictEqual(res.status, 200);
    const vendors = await res.json();
    assert.deepStrictEqual(vendors.map((v) => v.id), [aprobado]);
  });

  await t.test('GET 400 con estado no válido', async () => {
    const res = await request(app, '/api/admin/vendors?estado=otro');
    assert.strictEqual(res.status, 400);
    assert.ok((await res.json()).error);
  });

  await t.test('PATCH cambia el estado', async () => {
    const res = await request(app, `/api/admin/vendors/${pendiente}`, { method: 'PATCH', body: { estado: 'aprobado' } });
    assert.strictEqual(res.status, 200);
    const vendor = await res.json();
    assert.strictEqual(vendor.id, pendiente);
    assert.strictEqual(vendor.estado, 'aprobado');
    assert.ok(!('edit_token' in vendor));
    const { estado } = app.db.prepare('SELECT estado FROM vendors WHERE id = ?').get(pendiente);
    assert.strictEqual(estado, 'aprobado');
  });

  await t.test('PATCH 400 con estado no válido o ausente', async () => {
    for (const body of [{ estado: 'otro' }, {}]) {
      const res = await request(app, `/api/admin/vendors/${aprobado}`, { method: 'PATCH', body });
      assert.strictEqual(res.status, 400);
    }
    const sinBody = await request(app, `/api/admin/vendors/${aprobado}`, { method: 'PATCH' });
    assert.strictEqual(sinBody.status, 400);
  });

  await t.test('PATCH 404 si el vendedor no existe', async () => {
    for (const id of ['9999', 'abc']) {
      const res = await request(app, `/api/admin/vendors/${id}`, { method: 'PATCH', body: { estado: 'aprobado' } });
      assert.strictEqual(res.status, 404);
      assert.ok((await res.json()).error);
    }
  });
});
