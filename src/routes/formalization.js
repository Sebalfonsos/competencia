const { Router } = require('express');
const crypto = require('node:crypto');

module.exports = (db) => {
  const router = Router();

  router.get('/steps', (req, res) => {
    res.json(db.prepare('SELECT id, orden, titulo, descripcion, enlace FROM steps ORDER BY orden').all());
  });

  // Autentica con el edit_token del vendedor; responde 404/401 y devuelve null si falla.
  function auth(req, res) {
    const v = db.prepare('SELECT id, edit_token FROM vendors WHERE id = ?').get(req.params.id);
    if (!v) { res.status(404).json({ error: 'Vendedor no encontrado' }); return null; }
    const given = Buffer.from((req.get('authorization') || '').replace(/^Bearer /, ''));
    const real = Buffer.from(v.edit_token);
    if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
      res.status(401).json({ error: 'Token inválido' }); return null;
    }
    return v.id;
  }

  function progress(vendorId) {
    const steps = db.prepare(
      `SELECT s.id, s.titulo, COALESCE(vs.completado, 0) AS completado
       FROM steps s LEFT JOIN vendor_steps vs ON vs.step_id = s.id AND vs.vendor_id = ?
       ORDER BY s.orden`
    ).all(vendorId).map((s) => ({ id: s.id, titulo: s.titulo, completado: s.completado === 1 }));
    const hechos = steps.filter((s) => s.completado).length;
    return { steps, porcentaje: steps.length ? Math.round((hechos * 100) / steps.length) : 0 };
  }

  router.get('/vendors/:id/progress', (req, res) => {
    const id = auth(req, res);
    if (id !== null) res.json(progress(id));
  });

  router.put('/vendors/:id/progress', (req, res) => {
    const id = auth(req, res);
    if (id === null) return;
    const { step_id, completado } = req.body || {};
    if (typeof completado !== 'boolean') return res.status(400).json({ error: 'completado debe ser booleano' });
    if (!Number.isInteger(step_id) || !db.prepare('SELECT 1 FROM steps WHERE id = ?').get(step_id)) {
      return res.status(400).json({ error: 'step_id no existe' });
    }
    db.prepare(
      `INSERT INTO vendor_steps (vendor_id, step_id, completado) VALUES (?, ?, ?)
       ON CONFLICT (vendor_id, step_id) DO UPDATE SET completado = excluded.completado`
    ).run(id, step_id, completado ? 1 : 0);
    res.json(progress(id));
  });

  return router;
};
