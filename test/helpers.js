const { createApp } = require('../src/app');
const { openDb } = require('../src/db');

// Levanta la app en un puerto efímero con BD en memoria.
async function startApp() {
  const db = openDb(':memory:');
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { db, baseUrl, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { startApp };
