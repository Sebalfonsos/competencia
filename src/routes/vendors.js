const { Router } = require('express');
const crypto = require('node:crypto');

const PUBLIC = 'id, nombre, categoria, zona, descripcion, horario, telefono';
const FIELDS = { // campo: [requerido, longitud máxima]
  nombre: [true, 100], documento: [true, 100], categoria: [true, 100], zona: [true, 100],
  telefono: [true, 100], descripcion: [false, 500], horario: [false, 100],
};
const SQLITE_CONSTRAINT_UNIQUE = 2067;

function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Cuerpo JSON requerido' };
  const out = {};
  for (const [campo, [requerido, max]] of Object.entries(FIELDS)) {
    const v = body[campo] ?? '';
    if (typeof v !== 'string') return { error: `${campo} debe ser texto` };
    out[campo] = v.trim();
    if (requerido && !out[campo]) return { error: `${campo} es obligatorio` };
    if (out[campo].length > max) return { error: `${campo} supera ${max} caracteres` };
  }
  if (!/^\+?\d{7,15}$/.test(out.telefono)) return { error: 'telefono debe tener entre 7 y 15 dígitos' };
  return { data: out };
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

module.exports = (db) => {
  const router = Router();

  router.post('/vendors', (req, res) => {
    const { error, data } = validate(req.body);
    if (error) return res.status(400).json({ error });
    const edit_token = crypto.randomBytes(16).toString('hex');
    try {
      const { lastInsertRowid } = db.prepare(
        `INSERT INTO vendors (nombre, documento, categoria, zona, telefono, descripcion, horario, edit_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(data.nombre, data.documento, data.categoria, data.zona, data.telefono, data.descripcion, data.horario, edit_token);
      res.status(201).json({ id: Number(lastInsertRowid), edit_token });
    } catch (err) {
      if (err.errcode === SQLITE_CONSTRAINT_UNIQUE) return res.status(409).json({ error: 'El documento ya está registrado' });
      throw err;
    }
  });

  router.get('/vendors', (req, res) => {
    const where = ["estado = 'aprobado'"];
    const params = [];
    const zona = str(req.query.zona), categoria = str(req.query.categoria), q = str(req.query.q);
    if (zona) { where.push('zona = ? COLLATE NOCASE'); params.push(zona); }
    if (categoria) { where.push('categoria = ? COLLATE NOCASE'); params.push(categoria); }
    if (q) {
      // ponytail: LIKE solo ignora mayúsculas en ASCII (no tildes); usar FTS5 si la búsqueda se queda corta
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push("(nombre LIKE ? ESCAPE '\\' OR descripcion LIKE ? ESCAPE '\\')");
      params.push(like, like);
    }
    res.json(db.prepare(`SELECT ${PUBLIC} FROM vendors WHERE ${where.join(' AND ')} ORDER BY nombre`).all(...params));
  });

  router.get('/vendors/:id', (req, res) => {
    const v = db.prepare(`SELECT ${PUBLIC} FROM vendors WHERE id = ? AND estado = 'aprobado'`).get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Vendedor no encontrado' });
    res.json(v);
  });

  return router;
};
