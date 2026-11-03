const test = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

const base = { nombre: 'Ana Pérez', documento: '1001', categoria: 'Frutas', zona: 'Centro', telefono: '+573001234567', descripcion: 'Mango y piña picada', horario: '7am-2pm' };

let app;
test.before(async () => { app = await startApp(); });
test.after(() => app.close());

const post = (body) => fetch(`${app.baseUrl}/api/vendors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = async (path) => { const r = await fetch(`${app.baseUrl}${path}`); return { status: r.status, body: await r.json() }; };
const aprobar = (id) => app.db.prepare("UPDATE vendors SET estado = 'aprobado' WHERE id = ?").run(id);

test('registro válido devuelve id y token y queda pendiente', async () => {
  const r = await post({ ...base, nombre: '  Ana Pérez  ' });
  assert.strictEqual(r.status, 201);
  const { id, edit_token } = await r.json();
  assert.ok(Number.isInteger(id));
  assert.match(edit_token, /^[0-9a-f]{32}$/);
  const row = app.db.prepare('SELECT nombre, estado FROM vendors WHERE id = ?').get(id);
  assert.deepStrictEqual({ ...row }, { nombre: 'Ana Pérez', estado: 'pendiente' });
});

test('documento duplicado devuelve 409', async () => {
  const r = await post({ ...base, documento: 'dup-1' });
  assert.strictEqual(r.status, 201);
  assert.strictEqual((await post({ ...base, documento: 'dup-1' })).status, 409);
});

test('validación devuelve 400', async () => {
  const casos = [
    { ...base, documento: 'v1', nombre: '' },
    { ...base, documento: 'v2', zona: undefined },
    { ...base, documento: 'v3', categoria: 123 },
    { ...base, documento: 'v4', telefono: '12ab' },
    { ...base, documento: 'v5', telefono: '123' },
    { ...base, documento: 'v6', nombre: 'x'.repeat(101) },
    { ...base, documento: 'v7', descripcion: 'x'.repeat(501) },
  ];
  for (const c of casos) assert.strictEqual((await post(c)).status, 400, JSON.stringify(c));
  const sinCuerpo = await fetch(`${app.baseUrl}/api/vendors`, { method: 'POST' });
  assert.strictEqual(sinCuerpo.status, 400);
});

test('directorio: solo aprobados, campos públicos y filtros', async () => {
  const ids = {};
  for (const [doc, extra] of [
    ['d-1', { nombre: 'Beto Arepas', categoria: 'Comidas', zona: 'Norte', descripcion: 'Arepas de huevo' }],
    ['d-2', { nombre: 'Carla Jugos', categoria: 'Bebidas', zona: 'Norte', descripcion: 'Jugos 100%' }],
    ['d-3', { nombre: 'Dora Dulces', categoria: 'Comidas', zona: 'Sur', descripcion: 'Cocadas' }],
  ]) ids[doc] = (await (await post({ ...base, documento: doc, ...extra })).json()).id;
  aprobar(ids['d-1']); aprobar(ids['d-2']); // d-3 queda pendiente

  const todos = await get('/api/vendors');
  assert.strictEqual(todos.status, 200);
  const nombres = todos.body.map((v) => v.nombre);
  assert.ok(nombres.includes('Beto Arepas') && nombres.includes('Carla Jugos'));
  assert.ok(!nombres.includes('Dora Dulces'));
  for (const v of todos.body) assert.deepStrictEqual(Object.keys(v).sort(), ['categoria', 'descripcion', 'horario', 'id', 'nombre', 'telefono', 'zona']);

  assert.deepStrictEqual((await get('/api/vendors?zona=norte&categoria=COMIDAS')).body.map((v) => v.nombre), ['Beto Arepas']);
  assert.deepStrictEqual((await get('/api/vendors?q=arepa')).body.map((v) => v.nombre), ['Beto Arepas']);
  assert.deepStrictEqual((await get('/api/vendors?q=100%25')).body.map((v) => v.nombre), ['Carla Jugos']);
  assert.deepStrictEqual((await get('/api/vendors?q=%25')).body.map((v) => v.nombre), ['Carla Jugos']); // % literal, no comodín
  assert.deepStrictEqual((await get('/api/vendors?zona=Sur')).body, []);
});

test('perfil: 200 si aprobado, 404 si pendiente o inexistente', async () => {
  const { id } = await (await post({ ...base, documento: 'p-1' })).json();
  assert.strictEqual((await get(`/api/vendors/${id}`)).status, 404);
  aprobar(id);
  const r = await get(`/api/vendors/${id}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.id, id);
  assert.ok(!('documento' in r.body) && !('edit_token' in r.body) && !('estado' in r.body));
  assert.strictEqual((await get('/api/vendors/99999')).status, 404);
  assert.strictEqual((await get('/api/vendors/abc')).status, 404);
});
