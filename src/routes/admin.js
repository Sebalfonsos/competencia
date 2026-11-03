const { Router } = require('express');
const crypto = require('node:crypto');

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const CAMPOS = 'id, nombre, documento, categoria, zona, descripcion, horario, telefono, estado, creado_en';

// Se hashean ambos valores para comparar buffers de igual longitud sin filtrar la del token.
function tokenValido(recibido, esperado) {
  const a = crypto.createHash('sha256').update(recibido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado) return res.status(503).json({ error: 'Administración no configurada' });
  const match = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  if (!match || !tokenValido(match[1], esperado)) return res.status(401).json({ error: 'No autorizado' });
  next();
}

module.exports = (db) => {
  const router = Router();
  router.use(requireAdmin);

  router.get('/vendors', (req, res) => {
    const { estado } = req.query;
    if (estado === undefined) {
      return res.json(db.prepare(`SELECT ${CAMPOS} FROM vendors ORDER BY id`).all());
    }
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });
    res.json(db.prepare(`SELECT ${CAMPOS} FROM vendors WHERE estado = ? ORDER BY id`).all(estado));
  });

  router.patch('/vendors/:id', (req, res) => {
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : null;
    const vendor = id === null ? undefined : db.prepare(`SELECT ${CAMPOS} FROM vendors WHERE id = ?`).get(id);
    if (!vendor) return res.status(404).json({ error: 'Vendedor no encontrado' });
    const estado = req.body?.estado;
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });
    db.prepare('UPDATE vendors SET estado = ? WHERE id = ?').run(estado, id);
    res.json({ ...vendor, estado });
  });

  return router;
};
