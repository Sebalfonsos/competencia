const test = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

test('health, semilla de pasos y 404 JSON', async () => {
  const app = await startApp();
  try {
    const res = await fetch(`${app.baseUrl}/api/health`);
    assert.deepStrictEqual(await res.json(), { ok: true });
    const { n } = app.db.prepare('SELECT COUNT(*) AS n FROM steps').get();
    assert.strictEqual(n, 5);
    const nf = await fetch(`${app.baseUrl}/api/no-existe`);
    assert.strictEqual(nf.status, 404);
  } finally {
    await app.close();
  }
});
