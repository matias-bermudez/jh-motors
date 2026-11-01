const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { dataDir } = require('./config');

fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'jhmotors.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cars (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  marca         TEXT    NOT NULL,
  modelo        TEXT    NOT NULL,
  version       TEXT    NOT NULL DEFAULT '',
  anio          INTEGER NOT NULL,
  km            INTEGER NOT NULL DEFAULT 0,
  combustible   TEXT    NOT NULL,
  transmision   TEXT    NOT NULL,
  marchas       TEXT    NOT NULL DEFAULT '',
  tipo          TEXT    NOT NULL,
  motor         TEXT    NOT NULL DEFAULT '',
  potencia      TEXT    NOT NULL DEFAULT '',
  traccion      TEXT    NOT NULL DEFAULT '',
  puertas       TEXT    NOT NULL DEFAULT '',
  color         TEXT    NOT NULL DEFAULT '',
  padron        TEXT    NOT NULL DEFAULT '',
  sede          TEXT    NOT NULL,
  precio        INTEGER NOT NULL,
  moneda        TEXT    NOT NULL DEFAULT 'USD',
  financiable   INTEGER NOT NULL DEFAULT 1,
  permuta       INTEGER NOT NULL DEFAULT 0,
  duenos        TEXT    NOT NULL DEFAULT '',
  service       TEXT    NOT NULL DEFAULT '',
  documentacion TEXT    NOT NULL DEFAULT '',
  llaves        TEXT    NOT NULL DEFAULT '',
  garantia      TEXT    NOT NULL DEFAULT '',
  equipamiento  TEXT    NOT NULL DEFAULT '[]',
  descripcion   TEXT    NOT NULL DEFAULT '',
  estado        TEXT    NOT NULL DEFAULT 'disponible',
  destacado     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id   INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  file     TEXT    NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS photos_car ON photos(car_id, position);
`);

const CAR_FIELDS = [
  'marca', 'modelo', 'version', 'anio', 'km', 'combustible', 'transmision', 'marchas', 'tipo',
  'motor', 'potencia', 'traccion', 'puertas', 'color', 'padron', 'sede', 'precio', 'moneda',
  'financiable', 'permuta', 'duenos', 'service', 'documentacion', 'llaves', 'garantia',
  'equipamiento', 'descripcion', 'estado', 'destacado'
];

const q = {
  all: db.prepare('SELECT * FROM cars ORDER BY created_at DESC, id DESC'),
  public: db.prepare(`SELECT * FROM cars WHERE estado IN ('disponible','reservado') ORDER BY created_at DESC, id DESC`),
  byId: db.prepare('SELECT * FROM cars WHERE id = ?'),
  photos: db.prepare('SELECT * FROM photos WHERE car_id = ? ORDER BY position, id'),
  allPhotos: db.prepare('SELECT * FROM photos ORDER BY car_id, position, id'),
  photo: db.prepare('SELECT * FROM photos WHERE id = ?'),
  addPhoto: db.prepare('INSERT INTO photos (car_id, file, position) VALUES (?, ?, ?)'),
  movePhoto: db.prepare('UPDATE photos SET position = ? WHERE id = ? AND car_id = ?'),
  delPhoto: db.prepare('DELETE FROM photos WHERE id = ?'),
  insert: db.prepare(`INSERT INTO cars (${CAR_FIELDS.join(', ')}) VALUES (${CAR_FIELDS.map(() => '?').join(', ')})`),
  update: db.prepare(`UPDATE cars SET ${CAR_FIELDS.map((f) => f + ' = ?').join(', ')}, updated_at = datetime('now') WHERE id = ?`),
  setEstado: db.prepare(`UPDATE cars SET estado = ?, updated_at = datetime('now') WHERE id = ?`),
  del: db.prepare('DELETE FROM cars WHERE id = ?')
};

// Agrupa las fotos por auto para no hacer una consulta por tarjeta.
function withPhotos(cars) {
  const byCar = new Map();
  for (const p of q.allPhotos.all()) {
    if (!byCar.has(p.car_id)) byCar.set(p.car_id, []);
    byCar.get(p.car_id).push(p);
  }
  return cars.map((c) => ({ car: c, photos: byCar.get(c.id) || [] }));
}

module.exports = {
  db,
  CAR_FIELDS,
  listPublic: () => withPhotos(q.public.all()),
  listAll: () => withPhotos(q.all.all()),
  get(id) {
    const car = q.byId.get(id);
    return car ? { car, photos: q.photos.all(id) } : null;
  },
  insert(data) {
    return Number(q.insert.run(...CAR_FIELDS.map((f) => data[f])).lastInsertRowid);
  },
  update(id, data) {
    q.update.run(...CAR_FIELDS.map((f) => data[f]), id);
  },
  setEstado: (id, estado) => q.setEstado.run(estado, id),
  remove: (id) => q.del.run(id),
  photos: (carId) => q.photos.all(carId),
  photo: (id) => q.photo.get(id),
  addPhoto: (carId, file, position) => q.addPhoto.run(carId, file, position),
  movePhoto: (id, carId, position) => q.movePhoto.run(position, id, carId),
  deletePhoto: (id) => q.delPhoto.run(id),
  transaction(fn) {
    db.exec('BEGIN');
    try {
      const r = fn();
      db.exec('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
};
