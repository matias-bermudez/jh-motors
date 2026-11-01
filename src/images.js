const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { dataDir } = require('./config');

const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Cada foto se guarda en varios tamaños para que la web cargue rápido en celulares.
const SIZES = { lg: 1600, md: 800, sm: 400 };

async function savePhoto(buffer) {
  const base = crypto.randomUUID();
  const img = sharp(buffer, { failOn: 'none' }).rotate(); // respeta la orientación del celular
  await Promise.all([
    ...Object.entries(SIZES).map(([size, width]) =>
      img.clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: size === 'sm' ? 70 : 78 })
        .toFile(path.join(uploadsDir, `${base}-${size}.webp`))
    ),
    // JPG 1200x630 para la vista previa del link en WhatsApp, Facebook, etc.
    img.clone()
      .resize({ width: 1200, height: 630, fit: 'cover' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(uploadsDir, `${base}-og.jpg`))
  ]);
  return base;
}

function deletePhotoFiles(base) {
  for (const name of [...Object.keys(SIZES).map((s) => `${base}-${s}.webp`), `${base}-og.jpg`]) {
    fs.rm(path.join(uploadsDir, name), { force: true }, () => {});
  }
}

function photoUrls(base) {
  return {
    lg: `/uploads/${base}-lg.webp`,
    md: `/uploads/${base}-md.webp`,
    sm: `/uploads/${base}-sm.webp`,
    og: `/uploads/${base}-og.jpg`
  };
}

module.exports = { uploadsDir, savePhoto, deletePhotoFiles, photoUrls };
