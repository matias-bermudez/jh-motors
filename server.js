const path = require('node:path');
const express = require('express');
const compression = require('compression');
const multer = require('multer');

const config = require('./src/config');
const db = require('./src/db');
const auth = require('./src/auth');
const icon = require('./src/icons');
const { uploadsDir, savePhoto, deletePhotoFiles } = require('./src/images');
const { OPTIONS, TIPOS_CHIPS, present, similares, fromForm } = require('./src/cars');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.locals.site = config;
app.locals.icon = icon;
app.locals.assetVersion = Date.now().toString(36);

app.use(compression());
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
// Los nombres de las fotos son únicos, así que se pueden cachear para siempre.
app.use('/uploads', express.static(uploadsDir, { maxAge: '365d', immutable: true }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const abs = (p) => config.siteUrl + p;
const publicCars = () => db.listPublic().map(present);
const sedesList = Object.values(config.sedes);
const isPlaceholder = (s) => !s || /^\[.*\]$/.test(s);

function dealerLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    '@id': abs('/#automotora'),
    name: config.siteName,
    url: abs('/'),
    logo: abs('/favicon.svg'),
    telephone: '+' + config.whatsapp.number,
    sameAs: [config.instagram.url],
    areaServed: { '@type': 'AdministrativeArea', name: 'Canelones, Uruguay' },
    currenciesAccepted: 'USD, UYU',
    department: sedesList.map((s) => ({
      '@type': 'AutoDealer',
      name: `${config.siteName} ${s.nombre}`,
      telephone: '+' + config.whatsapp.number,
      address: Object.assign(
        { '@type': 'PostalAddress', addressLocality: s.localidad, addressRegion: s.departamento, addressCountry: 'UY' },
        isPlaceholder(s.direccion) ? {} : { streetAddress: s.direccion }
      ),
      ...(isPlaceholder(s.horario) ? {} : { openingHours: s.horario })
    }))
  };
}

// ——— Páginas públicas ———

app.get('/', (req, res) => {
  const cars = publicCars();
  const uniq = (k) => [...new Set(cars.map((c) => c[k]))].sort((a, b) => a.localeCompare(b, 'es'));
  const destacado = cars.find((c) => c.destacado && c.cover && !c.reservado) || null;
  const marcasTop = uniq('marca').slice(0, 6).join(', ');

  res.render('home', {
    cars,
    destacado,
    filtros: {
      marcas: uniq('marca'),
      combs: uniq('combustible'),
      cajas: uniq('transmision'),
      tipos: TIPOS_CHIPS.filter((t) => cars.some((c) => c.tipo === t))
    },
    seo: {
      title: 'JH Motors | Autos usados en venta en Toledo y Atlántida, Canelones',
      description: `Automotora en Toledo y Atlántida, Canelones. ${cars.length ? cars.length + ' autos en venta' : 'Autos en venta'}${marcasTop ? ' (' + marcasTop + ')' : ''}, consignaciones y financiación hasta el 100% o en 36 cuotas fijas.`,
      canonical: abs('/'),
      image: destacado ? abs(destacado.cover.og) : null,
      preloadImage: destacado ? destacado.cover.lg : null,
      jsonLd: [
        dealerLd(),
        { '@context': 'https://schema.org', '@type': 'WebSite', name: config.siteName, url: abs('/'), inLanguage: 'es-UY' },
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Catálogo de autos en venta',
          itemListElement: cars.slice(0, 60).map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: c.absUrl, name: c.nombreLargo }))
        }
      ]
    }
  });
});

app.get('/autos/:slug', (req, res, next) => {
  const m = /-(\d+)$/.exec(req.params.slug);
  const found = m && db.get(Number(m[1]));
  if (!found) return next();
  const car = present(found);
  // Si cambió la marca/modelo, el link viejo redirige al nuevo.
  if (req.params.slug !== car.slug) return res.redirect(301, car.url);

  const availability = car.vendido ? 'SoldOut' : car.reservado ? 'LimitedAvailability' : 'InStock';
  const desc = `${car.nombreLargo}, ${car.kmFmt}, ${car.combustible.toLowerCase()}, ${car.transmision.toLowerCase()}. ${car.precioFmt}.` +
    (car.financiable ? ' Financiación hasta el 100%.' : '') +
    ` Vení a verlo a JH Motors ${car.sede}, Canelones.`;

  res.render('detail', {
    car,
    similares: similares(car, publicCars()),
    seo: {
      title: `${car.nombreLargo} · ${car.kmFmt} · ${car.precioFmt} | JH Motors`,
      ogTitle: `${car.nombreLargo} — ${car.precioFmt}`,
      description: desc,
      canonical: car.absUrl,
      ogType: 'product',
      image: car.cover ? abs(car.cover.og) : null,
      preloadImage: car.cover ? car.cover.lg : null,
      noindex: car.vendido,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Car',
          name: car.nombreLargo,
          sku: car.ref,
          url: car.absUrl,
          description: car.descripcion || desc,
          image: car.fotos.map((f) => abs(f.lg)),
          brand: { '@type': 'Brand', name: car.marca },
          model: car.modelo,
          vehicleConfiguration: car.version || undefined,
          vehicleModelDate: String(car.anio),
          bodyType: car.tipo,
          fuelType: car.combustible,
          vehicleTransmission: car.transmision,
          color: car.color || undefined,
          numberOfDoors: car.puertas ? Number(car.puertas) : undefined,
          vehicleEngine: car.motor ? { '@type': 'EngineSpecification', name: car.motor } : undefined,
          driveWheelConfiguration: car.traccion || undefined,
          mileageFromOdometer: { '@type': 'QuantitativeValue', value: car.km, unitCode: 'KMT' },
          itemCondition: 'https://schema.org/UsedCondition',
          offers: {
            '@type': 'Offer',
            price: car.precio,
            priceCurrency: car.moneda,
            availability: 'https://schema.org/' + availability,
            itemCondition: 'https://schema.org/UsedCondition',
            url: car.absUrl,
            seller: { '@id': abs('/#automotora') }
          }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Catálogo', item: abs('/') },
            { '@type': 'ListItem', position: 2, name: car.tipo, item: abs('/?tipo=' + encodeURIComponent(car.tipo)) },
            { '@type': 'ListItem', position: 3, name: car.titulo, item: car.absUrl }
          ]
        },
        dealerLd()
      ]
    }
  });
});

app.get('/vende-tu-auto', (req, res) => {
  res.render('sell', {
    seo: {
      title: 'Vendé o consigná tu auto | JH Motors Toledo y Atlántida',
      description: 'Vendé tu auto, dejalo en consignación o entregalo como parte de pago en JH Motors (Toledo y Atlántida, Canelones). Completá los datos y nos llega directo por WhatsApp.',
      canonical: abs('/vende-tu-auto'),
      jsonLd: [dealerLd()]
    }
  });
});
app.get(['/vender', '/vende'],(req, res) => res.redirect(301, '/vende-tu-auto'));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${abs('/sitemap.xml')}\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const day = (d) => (d || '').slice(0, 10);
  const cars = publicCars();
  const latest = cars.map((c) => day(c.updated_at)).sort().pop();
  const urls = [
    { loc: abs('/'), lastmod: latest, priority: '1.0' },
    { loc: abs('/vende-tu-auto'), priority: '0.6' },
    ...cars.map((c) => ({ loc: c.absUrl, lastmod: day(c.updated_at), priority: '0.8', images: c.fotos.slice(0, 10).map((f) => abs(f.lg)) }))
  ];
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    urls.map((u) =>
      `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority>` +
      (u.images || []).map((i) => `<image:image><image:loc>${esc(i)}</image:loc></image:image>`).join('') +
      '</url>'
    ).join('\n') +
    '\n</urlset>\n'
  );
});

// ——— Panel de administración ———

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 40 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

function withUpload(req, res, next) {
  upload.array('fotos', 40)(req, res, (err) => {
    if (err) req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Alguna foto pesa más de 25 MB.' :
      err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Máximo 40 fotos por vez.' : 'No se pudieron leer las fotos.';
    next();
  });
}

const NEW_CAR = {
  marca: '', modelo: '', version: '', anio: '', km: '', tipo: 'Sedán', combustible: 'Nafta', transmision: 'Manual',
  marchas: '', motor: '', potencia: '', traccion: '', puertas: '', color: '', padron: '', precio: '', moneda: 'USD',
  sede: Object.keys(config.sedes)[0], estado: 'disponible', financiable: 1, permuta: 0, destacado: 0,
  duenos: '', service: '', documentacion: '', llaves: '', garantia: '', equipamiento: '[]', descripcion: ''
};

function renderForm(res, { car, isNew, errors = [], msg = '' }) {
  const marcas = [...new Set(['Audi', 'BAIC', 'BMW', 'BYD', 'Changan', 'Chery', 'Chevrolet', 'Citroën', 'DFSK', 'Fiat', 'Ford', 'Geely',
    'Great Wall', 'Haval', 'Honda', 'Hyundai', 'JAC', 'Jeep', 'Jetour', 'Kia', 'Mazda', 'Mercedes-Benz', 'MG', 'Mitsubishi', 'Nissan',
    'Peugeot', 'RAM', 'Renault', 'Subaru', 'Suzuki', 'Toyota', 'Volkswagen', 'Volvo', ...db.listAll().map((x) => x.car.marca)])].sort();
  res.status(errors.length ? 422 : 200).render('admin/form', {
    car, isNew, errors, msg, marcas, options: OPTIONS, sedes: Object.keys(config.sedes)
  });
}

// Fotos: borra las marcadas, aplica el orden elegido y agrega las nuevas al final.
async function applyPhotos(carId, body, files) {
  const current = db.photos(carId);
  const ids = new Set(current.map((p) => p.id));
  const toDelete = String(body.photo_delete || '').split(',').map(Number).filter((id) => ids.has(id));
  const ordered = String(body.photo_order || '').split(',').map(Number).filter((id) => ids.has(id) && !toDelete.includes(id));
  const rest = current.map((p) => p.id).filter((id) => !ordered.includes(id) && !toDelete.includes(id));
  const saved = [];
  for (const f of files || []) saved.push(await savePhoto(f.buffer));

  db.transaction(() => {
    for (const id of toDelete) db.deletePhoto(id);
    [...ordered, ...rest].forEach((id, i) => db.movePhoto(id, carId, i));
    const start = ordered.length + rest.length;
    saved.forEach((file, i) => db.addPhoto(carId, file, start + i));
  });
  for (const id of toDelete) deletePhotoFiles(current.find((p) => p.id === id).file);
}

app.get('/admin/login', (req, res) => {
  if (auth.isLoggedIn(req)) return res.redirect('/admin');
  res.render('admin/login', { error: null, enabled: auth.enabled() });
});

app.post('/admin/login', (req, res) => {
  const ip = req.ip;
  if (auth.tooManyAttempts(ip)) {
    return res.status(429).render('admin/login', { error: 'Demasiados intentos. Esperá 15 minutos.', enabled: auth.enabled() });
  }
  if (!auth.checkCredentials(req.body.user || '', req.body.pass || '')) {
    auth.recordFailure(ip);
    return res.status(401).render('admin/login', { error: 'Usuario o contraseña incorrectos.', enabled: auth.enabled() });
  }
  auth.login(req, res);
  res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  auth.logout(req, res);
  res.redirect('/admin/login');
});

app.use('/admin', auth.requireAdmin);

const MSGS = { creado: 'Auto publicado.', guardado: 'Cambios guardados.', eliminado: 'Auto eliminado.', estado: 'Estado actualizado.' };

app.get('/admin', (req, res) => {
  const cars = db.listAll().map(present);
  const counts = { disponible: 0, reservado: 0, vendido: 0 };
  for (const c of cars) counts[c.estado] = (counts[c.estado] || 0) + 1;
  res.render('admin/list', { cars, counts, msg: MSGS[req.query.ok] || '' });
});

app.get('/admin/autos/nuevo', (req, res) => {
  renderForm(res, { car: present({ car: Object.assign({ id: 0 }, NEW_CAR), photos: [] }), isNew: true });
});

app.post('/admin/autos', withUpload, async (req, res, next) => {
  try {
    const { data, errors } = fromForm(req.body);
    if (req.uploadError) errors.push(req.uploadError);
    if (errors.length) {
      if (req.files && req.files.length) errors.push('Volvé a elegir las fotos.');
      return renderForm(res, { car: present({ car: Object.assign({ id: 0 }, data), photos: [] }), isNew: true, errors });
    }
    const id = db.insert(data);
    await applyPhotos(id, {}, req.files);
    res.redirect(`/admin/autos/${id}?ok=creado`);
  } catch (e) { next(e); }
});

app.get('/admin/autos/:id', (req, res, next) => {
  const found = db.get(Number(req.params.id));
  if (!found) return next();
  renderForm(res, { car: present(found), isNew: false, msg: MSGS[req.query.ok] || '' });
});

app.post('/admin/autos/:id', withUpload, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const found = db.get(id);
    if (!found) return next();
    const { data, errors } = fromForm(req.body);
    if (req.uploadError) errors.push(req.uploadError);
    if (errors.length) {
      if (req.files && req.files.length) errors.push('Volvé a elegir las fotos nuevas.');
      return renderForm(res, { car: present({ car: Object.assign({}, found.car, data), photos: found.photos }), isNew: false, errors });
    }
    db.update(id, data);
    await applyPhotos(id, req.body, req.files);
    res.redirect(`/admin/autos/${id}?ok=guardado`);
  } catch (e) { next(e); }
});

app.post('/admin/autos/:id/estado', (req, res) => {
  if (OPTIONS.estados.includes(req.body.estado)) db.setEstado(Number(req.params.id), req.body.estado);
  res.redirect('/admin?ok=estado');
});

app.post('/admin/autos/:id/eliminar', (req, res) => {
  const id = Number(req.params.id);
  const photos = db.photos(id);
  db.remove(id);
  for (const p of photos) deletePhotoFiles(p.file);
  res.redirect('/admin?ok=eliminado');
});

// ——— Errores ———

app.use((req, res) => {
  res.status(404).render('404', {
    seo: { title: 'Página no encontrada | JH Motors', description: 'La página que buscás no existe o el auto ya no está publicado.', noindex: true }
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Ocurrió un error. Probá de nuevo en un momento.');
});

app.listen(config.port, () => {
  console.log(`JH Motors en ${config.siteUrl}  (WhatsApp: ${config.whatsapp.display})`);
  if (!auth.enabled()) console.warn('Aviso: ADMIN_PASSWORD no está definido; el panel /admin está desactivado.');
});
