const express = require('express');
const path = require('node:path');
const { openDb } = require('./db');

// Cada router recibe la BD; cada tarea edita solo su archivo de rutas.
function createApp(db = openDb()) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', require('./routes/vendors')(db));
  app.use('/api', require('./routes/formalization')(db));
  app.use('/api/admin', require('./routes/admin')(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Error interno' : err.message });
  });
  return app;
}

module.exports = { createApp };
