const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const STEPS = [
  [1, 'Inscribirse en el RUT', 'Obtén tu Registro Único Tributario ante la DIAN. Es gratuito y se puede hacer en línea.', 'https://www.dian.gov.co'],
  [2, 'Registro mercantil', 'Matricúlate como persona natural comerciante en la Cámara de Comercio de tu ciudad.', 'https://www.rues.org.co'],
  [3, 'Permiso de uso del espacio público', 'Solicita ante la alcaldía el permiso o la inscripción en el registro de vendedores informales.', ''],
  [4, 'Curso de manipulación de alimentos', 'Si vendes alimentos, certifícate en manipulación higiénica de alimentos.', ''],
  [5, 'Seguridad social', 'Afíliate a salud y ahorra para tu vejez con BEPS (Colpensiones).', 'https://www.colpensiones.gov.co'],
];

function openDb(file = process.env.DB_PATH || path.join('data', 'app.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      documento TEXT NOT NULL UNIQUE,
      categoria TEXT NOT NULL,
      zona TEXT NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      horario TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
      edit_token TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS steps (
      id INTEGER PRIMARY KEY,
      orden INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      enlace TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS vendor_steps (
      vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      step_id INTEGER NOT NULL REFERENCES steps(id),
      completado INTEGER NOT NULL DEFAULT 0 CHECK (completado IN (0,1)),
      PRIMARY KEY (vendor_id, step_id)
    );
  `);
  const insert = db.prepare('INSERT OR IGNORE INTO steps (id, orden, titulo, descripcion, enlace) VALUES (?, ?, ?, ?, ?)');
  for (const [orden, titulo, descripcion, enlace] of STEPS) insert.run(orden, orden, titulo, descripcion, enlace);
  return db;
}

module.exports = { openDb };
