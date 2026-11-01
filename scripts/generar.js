// Arma el sitio estático en _site/ a partir de src/ y de los autos de JH Motors en Supabase
// (base compartida de la Plataforma Automotoras, concesionaria = 'jh-motors').
// Cada auto tiene su propia página (/autos/<slug>/) con su título, descripción y datos estructurados
// para Google. Las fotos se bajan y se publican junto con la web, así las visitas no consumen Supabase.
// GitHub Actions lo corre en cada push a main, cuando se guarda un auto en el panel y cada 15 minutos.
//
//   node scripts/generar.js                   → para publicar
//   node scripts/generar.js --local           → para probar: python3 -m http.server 8792 -d _site
//   SOLO_SI_CAMBIO=1 node scripts/generar.js  → no hace nada si los autos y los datos del negocio no cambiaron desde la última publicación
//   AUTOS_JSON=filas.json node scripts/generar.js --local → usa esas filas (mismo formato que la API) en vez de Supabase
//   NEGOCIO_JSON=fila.json node scripts/generar.js --local → usa esa fila de `negocios` en vez de la de Supabase
//
// Sin dependencias, solo Node 18+.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, '_site');
const ESTATICOS = ['css', 'js', 'img', 'fonts'];

// Se cargan los mismos archivos que usa el navegador.
const ctx = vm.createContext({ window: {} });
const correr = (f) => vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
correr('js/config.js');
correr('js/common.js');
const C = ctx.window.JH_CONFIG;
const JH = ctx.window.JH;
const { esc, miles, icon } = JH;

const SITIO = C.sitio.replace(/\/?$/, '/');
const BASE = process.argv.includes('--local') ? '/' : new URL(SITIO).pathname;
const HOY = new Date().toISOString().slice(0, 10);
const TIPOS = ['auto', 'camioneta', 'utilitario'];
const SEDES = C.sedes.map((s) => s.nombre);
// Los datos que vienen con [CORCHETES] son textos de relleno del diseño: se muestran, pero no van a Google.
const relleno = (s) => !s || /^\[.*\]$/.test(s);

let AUTOS;

async function main() {
  // ---- Datos ----
  const [filas, negocio] = await Promise.all([
    process.env.AUTOS_JSON ? JSON.parse(fs.readFileSync(process.env.AUTOS_JSON, 'utf8')) : leerSupabase(),
    leerNegocio()
  ]);
  // Los datos del negocio de la base pisan a js/config.js en todas las páginas.
  Object.assign(C, configDeNegocio(negocio));
  const autos = filas.map(deFila).filter(Boolean);

  const hash = crypto.createHash('sha256').update(JSON.stringify({ autos: filas, negocio })).digest('hex').slice(0, 16);
  if (process.env.SOLO_SI_CAMBIO) {
    const anterior = await fetch(SITIO + 'estado.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (anterior && anterior.hash === hash) {
      console.log('Los autos y los datos del negocio no cambiaron desde la última publicación, no hay nada para publicar.');
      salida('cambio', 'false');
      return;
    }
  }

  fs.rmSync(SALIDA, { recursive: true, force: true });
  for (const dir of ESTATICOS) fs.cpSync(path.join(RAIZ, dir), path.join(SALIDA, dir), { recursive: true });
  // El navegador (Vendé tu auto, panel) usa la misma config, ya con los datos del negocio.
  escribir('js/config.js', '// Generado por scripts/generar.js: js/config.js con los datos del negocio de Supabase (panel → Datos del negocio).\n' +
    'window.JH_CONFIG = ' + JSON.stringify(C, null, 2) + ';\n');
  await bajarFotos(autos);
  // Más nuevos primero.
  AUTOS = autos.sort((a, b) => b.creado.localeCompare(a.creado));

  generarPaginas();
  escribir('estado.json', JSON.stringify({ hash, generado: new Date().toISOString(), autos: AUTOS.length }) + '\n');
  salida('cambio', 'true');
  console.log(`Listo: ${AUTOS.length} autos (${process.env.AUTOS_JSON ? process.env.AUTOS_JSON : 'Supabase'}). indexar=${C.indexar} → _site/`);
}

// ---- Supabase ----

// Las claves nuevas (sb_publishable_...) van solo en apikey; las viejas (anon, JWT) también en Authorization.
function cabeceras() {
  const headers = { apikey: C.supabaseKey };
  if (!C.supabaseKey.startsWith('sb_')) headers.Authorization = 'Bearer ' + C.supabaseKey;
  return headers;
}

async function leerSupabase() {
  const res = await fetch(`${C.supabaseUrl}/rest/v1/autos?select=*&concesionaria=eq.${encodeURIComponent(C.concesionaria)}&order=created_at.desc`, { headers: cabeceras() });
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`);
  return res.json();
}

// Datos del negocio que el dueño edita desde el panel (WhatsApp, Instagram, dirección y horario de los locales).
// Si la tabla todavía no existe, no hay fila o no se puede leer, se usa js/config.js tal cual.
async function leerNegocio() {
  if (process.env.NEGOCIO_JSON) {
    const x = JSON.parse(fs.readFileSync(process.env.NEGOCIO_JSON, 'utf8'));
    return (Array.isArray(x) ? x[0] : x) || null;
  }
  const res = await fetch(`${C.supabaseUrl}/rest/v1/negocios?select=*&concesionaria=eq.${encodeURIComponent(C.concesionaria)}`, { headers: cabeceras() }).catch(() => null);
  if (!res || !res.ok) {
    console.warn(`Aviso: no se pudieron leer los datos del negocio (${res ? res.status : 'sin conexión'}), se usa js/config.js.`);
    return null;
  }
  return (await res.json())[0] || null;
}

// Fila de negocios → claves de JH_CONFIG (solo las que tienen valor; null = queda lo de config.js).
// JH tiene dos locales: la dirección y el horario de cada uno van en extra.sedes
// ({ "Toledo": { "direccion": "...", "horario": "..." } }); ahí un texto vacío = no se muestra.
function configDeNegocio(n) {
  if (!n) return {};
  const mapa = { whatsapp: 'whatsapp', telefono: 'whatsappLabel', instagram: 'instagram' };
  const c = Object.fromEntries(Object.entries(mapa).filter(([k]) => n[k]).map(([k, clave]) => [clave, n[k]]));
  const sedes = (n.extra && n.extra.sedes) || {};
  c.sedes = C.sedes.map((s) => {
    const x = sedes[s.nombre] || {};
    const sede = Object.assign({}, s);
    for (const k of ['direccion', 'horario']) if (typeof x[k] === 'string') sede[k] = x[k];
    return sede;
  });
  return c;
}

// Fila de la base → auto listo para las plantillas. Si a un auto le falta algo, se saltea (no rompe la web).
// Los vendidos y los borradores no llegan con la clave pública; igual se filtran por si vienen de AUTOS_JSON.
function deFila(r) {
  if (r.publicado === false || r.estado === 'vendido') return null;
  const falta = ['slug', 'marca', 'modelo', 'anio', 'combustible', 'transmision'].filter((k) => r[k] === null || r[k] === undefined || r[k] === '');
  if (falta.length || !TIPOS.includes(r.tipo)) {
    console.warn(`Aviso: se saltea el auto ${r.id} (${r.marca} ${r.modelo}), falta: ${falta.join(', ') || 'tipo'}`);
    return null;
  }
  const x = r.extra || {};
  const { modelo, version } = JH.partirModelo(r);
  const moneda = r.moneda === 'UYU' ? 'UYU' : 'USD';
  const ruta = `autos/${r.slug}/`;
  const dir = `img/autos/${r.slug}/`;
  return {
    id: r.id, slug: r.slug, ref: JH.ref(r.id), ruta, url: SITIO + ruta,
    marca: r.marca, modelo, version, anio: r.anio,
    titulo: `${r.marca} ${modelo} ${r.anio}`,
    nombreLargo: [r.marca, modelo, version, r.anio].filter(Boolean).join(' '),
    // extra.sin_km: el dueño no sabe los km (campo vacío en el panel). Un 0 escrito es un 0 km.
    km: r.km || 0, sinKm: x.sin_km === true,
    kmFmt: x.sin_km === true ? 'Km a consultar' : miles(r.km || 0) + ' km',
    carroceria: r.carroceria || { auto: 'Auto', camioneta: 'Camioneta', utilitario: 'Utilitario' }[r.tipo],
    combustible: r.combustible, transmision: r.transmision, marchas: r.marchas,
    motor: r.motor || '', potencia: x.potencia || '', traccion: r.traccion || '',
    puertas: r.puertas, color: r.color || '', padron: x.padron || '',
    sede: SEDES.includes(x.sede) ? x.sede : '',
    precio: r.precio || null, moneda,
    precioFmt: JH.precio(r.precio, moneda),
    dolares: JH.enDolares(r.precio, moneda),
    entregaFmt: r.precio ? JH.precio(Math.round(r.precio / 2), moneda) : '',
    financiable: x.financiable === true,
    permuta: !!r.acepta_permuta,
    duenos: r.duenos, service: x.service || '', documentacion: x.documentacion || '', llaves: x.llaves || '', garantia: x.garantia || '',
    equipamiento: r.equipamiento || [],
    descripcion: r.descripcion || '',
    reservado: r.estado === 'reservado',
    destacado: !!r.destacado,
    electrico: r.combustible === 'Eléctrico',
    creado: r.created_at,
    actualizado: (r.updated_at || r.created_at).slice(0, 10),
    fotos: [],
    // Rutas en el bucket; bajarFotos() completa `fotos` con las que se pudieron bajar.
    _fotos: (r.fotos || []).map((p) => ({ p, archivo: dir + path.posix.basename(p) }))
  };
}

// Las fotos no cambian nunca (nombre = uuid): se guardan en .cache/fotos/ y solo se bajan las nuevas.
// GitHub Actions conserva esa carpeta entre publicaciones (actions/cache), así no se gasta cupo de Supabase.
const CACHE_FOTOS = path.join(RAIZ, '.cache', 'fotos');

async function bajarFotos(autos) {
  const url = (p) => `${C.supabaseUrl}/storage/v1/object/public/fotos/${p.split('/').map(encodeURIComponent).join('/')}`;
  const bajar = async (p, destino) => {
    const cache = path.join(CACHE_FOTOS, p);
    if (!fs.existsSync(cache)) {
      const res = await fetch(url(p)).catch(() => null);
      if (!res || !res.ok) return false;
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      fs.writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
    }
    const f = path.join(SALIDA, destino);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.copyFileSync(cache, f);
    return true;
  };
  const tareas = autos.flatMap((a) => a._fotos.map((f) => async () => {
    const chica = f.archivo.replace(/\.jpg$/, '_m.jpg');
    f.ok = await bajar(f.p, f.archivo);
    f.chica = f.ok && (await bajar(f.p.replace(/\.jpg$/, '_m.jpg'), chica)) ? chica : f.archivo;
    if (!f.ok) console.warn(`Aviso: no se pudo bajar la foto ${f.p} de ${a.slug}`);
  }));
  // De a 6 descargas a la vez.
  const cola = tareas.slice();
  await Promise.all(Array.from({ length: 6 }, async () => { while (cola.length) await cola.shift()(); }));
  for (const a of autos) {
    a.fotos = a._fotos.filter((f) => f.ok).map((f) => ({ grande: f.archivo, chica: f.chica }));
    delete a._fotos;
  }
}

function salida(clave, valor) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`);
}

// ---- Plantillas: {{ clave.sub }} y {{> parcial }} ----
// Los valores se insertan tal cual: todo texto que venga de la base pasa por esc() antes.

const parciales = {};
for (const f of fs.readdirSync(path.join(SRC, '_partials'))) {
  parciales[path.basename(f, '.html')] = fs.readFileSync(path.join(SRC, '_partials', f), 'utf8');
}

function render(tpl, datos) {
  return tpl.replace(/\{\{\s*(>\s*)?([\w.-]+)\s*\}\}/g, (_, parcial, clave) => {
    if (parcial) {
      if (!(clave in parciales)) throw new Error(`No existe el parcial ${clave}`);
      return render(parciales[clave], datos);
    }
    const v = clave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), datos);
    if (v === undefined) throw new Error(`Falta el dato {{${clave}}}`);
    return String(v);
  });
}

function jsonld(...objs) {
  return objs.map((o) => '<script type="application/ld+json">' +
    JSON.stringify(o).replace(/</g, '\\u003c') + '</script>').join('\n');
}

// ?v=<hash del archivo>: cuando cambia un css/js, el navegador no usa la copia vieja (Pages cachea 10 min).
const versiones = {};
function v(rel) {
  versiones[rel] = versiones[rel] || crypto.createHash('sha1').update(fs.readFileSync(path.join(SALIDA, rel))).digest('hex').slice(0, 8);
  return versiones[rel];
}

function scripts(raiz, nombres) {
  return nombres.map((n) => `<script src="${raiz}js/${n}.js?v=${v(`js/${n}.js`)}" defer></script>`).join('\n');
}

// Íconos que usan las plantillas.
const IC = {
  wa18: icon.wa(18), wa20: icon.wa(20),
  flecha18: icon.arrowRight(18), atras16: icon.arrowLeft(16),
  aviso16: icon.warning(16, 'flex-shrink: 0; margin-top: 1px'),
  camara24: icon.camera(24, '#FF3B30'),
  buscar: icon.search(),
  check18: icon.check(18, 'flex-shrink: 0')
};

const PIE_DOLARES = '<span>Precios en dólares, sujetos a cambio sin previo aviso.</span>';
const instagramUrl = () => `https://www.instagram.com/${C.instagram}/`;

// ruta: '' (inicio), 'autos/<slug>/', '404.html'...
function pagina(plantilla, ruta, datos) {
  const prof = ruta.endsWith('/') ? ruta.split('/').length - 1 : 0;
  // El 404 se sirve en cualquier URL, por eso usa rutas absolutas.
  const raiz = ruta === '404.html' ? BASE : prof ? '../'.repeat(prof) : './';
  const d = Object.assign({
    raiz,
    v: { css: v('css/site.css') },
    canonical: SITIO + ruta,
    robots: C.indexar ? '<meta name="robots" content="index, follow, max-image-preview:large">' : '<meta name="robots" content="noindex">',
    ogTipo: 'website',
    ogImagen: '',
    precarga: '',
    jsonld: '',
    nav: { catalogo: '', vender: '' },
    wa: { href: esc(JH.waUrl()), label: esc(C.whatsappLabel) },
    instagram: { url: esc(instagramUrl()), usuario: esc(C.instagram) },
    sedesNombres: esc(SEDES.join(' · ')),
    pie: PIE_DOLARES,
    ic: IC,
    anio: new Date().getFullYear()
  }, datos);
  d.ogTitulo = d.ogTitulo || d.titulo;
  d.scripts = scripts(raiz, d.js || []);
  const html = render(fs.readFileSync(path.join(SRC, plantilla), 'utf8'), d);
  escribir(ruta === '' || ruta.endsWith('/') ? ruta + 'index.html' : ruta, html);
}

function escribir(rel, contenido) {
  const f = path.join(SALIDA, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenido);
}

// Imagen para la vista previa del link (WhatsApp, Facebook) y precarga de la foto principal.
function metaImagen(rel) {
  const abs = esc(SITIO + rel);
  return `<meta property="og:image" content="${abs}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${abs}">`;
}
function precargar(raiz, foto, sizes) {
  return `<link rel="preload" as="image" href="${esc(raiz + foto.grande)}" imagesrcset="${esc(raiz + foto.chica)} 640w, ${esc(raiz + foto.grande)} 1600w" imagesizes="${sizes}" fetchpriority="high">`;
}

// ---- Datos estructurados (schema.org) ----

const NEGOCIO_ID = SITIO + '#automotora';
function dealerLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    '@id': NEGOCIO_ID,
    name: 'JH Motors',
    url: SITIO,
    logo: SITIO + 'img/favicon.svg',
    telephone: '+' + C.whatsapp,
    sameAs: [instagramUrl()],
    areaServed: { '@type': 'AdministrativeArea', name: 'Canelones, Uruguay' },
    currenciesAccepted: 'USD, UYU',
    department: C.sedes.map((s) => ({
      '@type': 'AutoDealer',
      name: `JH Motors ${s.nombre}`,
      telephone: '+' + C.whatsapp,
      address: Object.assign(
        { '@type': 'PostalAddress', addressLocality: s.nombre, addressRegion: 'Canelones', addressCountry: 'UY' },
        relleno(s.direccion) ? {} : { streetAddress: s.direccion }
      ),
      openingHours: s.horarioSchema ? s.horarioSchema.split(',').map((h) => h.trim()) : undefined
    }))
  };
}

function migas(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item }))
  };
}

function autoLd(a, descripcion) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: a.nombreLargo,
    sku: a.ref,
    url: a.url,
    description: a.descripcion || descripcion,
    image: a.fotos.length ? a.fotos.map((f) => SITIO + f.grande) : undefined,
    brand: { '@type': 'Brand', name: a.marca },
    model: a.modelo,
    vehicleConfiguration: a.version || undefined,
    vehicleModelDate: String(a.anio),
    bodyType: a.carroceria,
    fuelType: a.combustible,
    vehicleTransmission: a.transmision,
    color: a.color || undefined,
    numberOfDoors: a.puertas || undefined,
    numberOfPreviousOwners: a.duenos || undefined,
    vehicleEngine: a.motor ? { '@type': 'EngineSpecification', name: a.motor } : undefined,
    driveWheelConfiguration: a.traccion || undefined,
    mileageFromOdometer: a.sinKm ? undefined : { '@type': 'QuantitativeValue', value: a.km, unitCode: 'KMT' },
    itemCondition: 'https://schema.org/UsedCondition',
    offers: a.precio ? {
      '@type': 'Offer',
      price: a.precio,
      priceCurrency: a.moneda,
      availability: a.reservado ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      url: a.url,
      seller: { '@id': NEGOCIO_ID }
    } : undefined
  };
}

// ---- Piezas de HTML ----

const opciones = (lista) => lista.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('\n');
const unicos = (k) => [...new Set(AUTOS.map((a) => a[k]))].sort((x, y) => x.localeCompare(y, 'es'));
const mapsBuscar = (s) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.mapa);
const autoHref = (a, raiz) => raiz + a.ruta;

// Tarjeta del catálogo. Los data-* los usa js/catalogo.js para filtrar y ordenar.
function card(a, i, raiz) {
  const media = a.fotos.length
    ? `<img class="cover" src="${esc(raiz + a.fotos[0].chica)}" srcset="${esc(raiz + a.fotos[0].chica)} 640w, ${esc(raiz + a.fotos[0].grande)} 1600w" sizes="(max-width: 640px) 100vw, 400px" alt="${esc(a.nombreLargo)}" width="640" height="400" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async">`
    : icon.car('46%');
  const dato = (ic, t) => `<span style="display: flex; align-items: center; gap: 8px">${ic}${esc(t)}</span>`;
  return `<a class="card" href="${esc(autoHref(a, raiz))}" data-car
  data-marca="${esc(a.marca)}" data-comb="${esc(a.combustible)}" data-caja="${esc(a.transmision)}" data-tipo="${esc(a.carroceria)}"
  data-precio="${a.dolares ? Math.round(a.dolares) : ''}" data-km="${a.sinKm ? '' : a.km}" data-anio="${a.anio}" data-orden="${i}"
  data-q="${esc((a.marca + ' ' + a.modelo + ' ' + a.version).toLowerCase())}"
  style="display: flex; flex-direction: column; background: #131315; border: 1px solid #232327; border-radius: 16px; overflow: hidden; text-decoration: none; color: #F5F5F4">
<div class="ph" style="position: relative; aspect-ratio: 16 / 10; display: flex; align-items: center; justify-content: center">
${media}
<div style="position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; gap: 8px">
<div style="display: flex; gap: 6px">
<span style="padding: 5px 10px; border-radius: 999px; background: rgba(10,10,11,0.82); font-size: 12px; font-weight: 600; color: #E4E4E7">${esc(a.carroceria)}</span>
${a.electrico ? '<span style="padding: 5px 10px; border-radius: 999px; background: #E7F0FB; font-size: 12px; font-weight: 700; color: #123A66">Eléctrico</span>' : ''}
${a.reservado ? '<span style="padding: 5px 10px; border-radius: 999px; background: #F5C76B; font-size: 12px; font-weight: 700; color: #2E2410">Reservado</span>' : ''}
</div>
<span style="padding: 5px 10px; border-radius: 999px; background: rgba(10,10,11,0.82); font-size: 12px; color: #B4B4BC">Ref. ${a.ref}</span>
</div>
</div>
<div style="padding: 18px 18px 20px; display: flex; flex-direction: column; gap: 16px; flex-grow: 1">
<div style="display: flex; flex-direction: column; gap: 3px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #A1A1AA">${esc(a.marca)}</span>
<h3 style="margin: 0; font-size: 21px; line-height: 1.15; font-weight: 700; font-stretch: 108%">${esc(a.modelo)}</h3>
<span style="font-size: 14px; color: #A1A1AA">${esc(a.version)}</span>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; font-size: 14px; color: #D4D4D8">
${dato(icon.calendar(), a.anio)}
${dato(icon.gauge(), a.kmFmt)}
${dato(icon.fuel(), a.combustible)}
${dato(icon.gearbox(), a.transmision)}
${dato(icon.engine(), a.motor || '—')}
${dato(icon.pin(), a.sede || '—')}
</div>
<div style="margin-top: auto; padding-top: 16px; border-top: 1px solid #232327; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px 12px">
<div style="display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 12px; color: #A1A1AA">${a.precio ? 'Precio contado' : 'Precio'}</span>
<span style="font-size: 25px; line-height: 1.1; font-weight: 800; font-stretch: 112%; white-space: nowrap">${a.precioFmt}</span>
</div>
<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: #FF3B30; white-space: nowrap">Ver detalle${icon.arrowRight(16)}</span>
</div>
</div>
</a>`;
}

// ---- Páginas ----

function generarPaginas() {
  generarInicio();
  for (const a of AUTOS) generarAuto(a);

  // Vendé tu auto
  pagina('vende.html', 'vende-tu-auto/', {
    titulo: 'Vendé o consigná tu auto | JH Motors Toledo y Atlántida',
    descripcion: 'Vendé tu auto, dejalo en consignación o entregalo como parte de pago en JH Motors (Toledo y Atlántida, Canelones). Completá los datos y nos llega directo por WhatsApp.',
    jsonld: jsonld(dealerLd(), migas([['Inicio', SITIO], ['Vendé tu auto', SITIO + 'vende-tu-auto/']])),
    nav: { catalogo: '', vender: ' aria-current="page" style="color: #FFFFFF"' },
    js: ['config', 'common', 'vender'],
    waInternacional: esc('+598 ' + C.whatsappLabel.replace(/^0/, '')),
    pie: `<a href="${esc(instagramUrl())}" target="_blank" rel="noopener">Instagram @${esc(C.instagram)}</a>`
  });

  // 404 (GitHub Pages lo sirve para cualquier URL que no exista, ej. un auto vendido)
  pagina('404.html', '404.html', {
    titulo: 'Página no encontrada | JH Motors',
    descripcion: 'La página que buscás no existe o el auto ya no está publicado.',
    robots: '<meta name="robots" content="noindex">'
  });

  // Panel del dueño
  pagina('admin.html', 'admin/', {
    titulo: 'Panel · JH Motors',
    descripcion: 'Panel de administración de JH Motors.',
    robots: '<meta name="robots" content="noindex, nofollow">',
    js: ['config', 'common'],
    v: { css: v('css/site.css'), admin: v('js/admin.js') }
  });

  // Direcciones cortas que llevan a otra página.
  redirigir('autos/', '#catalogo');
  redirigir('vender/', 'vende-tu-auto/');
  redirigir('vende/', 'vende-tu-auto/');

  // sitemap.xml y robots.txt
  const ultimo = AUTOS.map((a) => a.actualizado).sort().pop() || HOY;
  const urls = [
    { loc: SITIO, lastmod: ultimo, prio: '1.0' },
    { loc: SITIO + 'vende-tu-auto/', lastmod: HOY, prio: '0.6' },
    ...AUTOS.map((a) => ({ loc: a.url, lastmod: a.actualizado, prio: '0.8', fotos: a.fotos.slice(0, 10).map((f) => SITIO + f.grande) }))
  ];
  escribir('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.prio}</priority>` +
      (u.fotos || []).map((f) => `<image:image><image:loc>${esc(f)}</image:loc></image:image>`).join('') + '</url>').join('\n') +
    '\n</urlset>\n');
  escribir('robots.txt', `User-agent: *\nAllow: /\nDisallow: ${BASE}admin/\n\nSitemap: ${SITIO}sitemap.xml\n`);
}

function generarInicio() {
  const raiz = './';
  const destacado = AUTOS.find((a) => a.destacado && a.fotos.length && !a.reservado) || null;
  const marcasTop = unicos('marca').slice(0, 6).join(', ');
  const tipos = ['Todos'].concat(JH.OPCIONES.carrocerias.filter((t) => AUTOS.some((a) => a.carroceria === t)),
    unicos('carroceria').filter((t) => !JH.OPCIONES.carrocerias.includes(t)));

  const hero = destacado
    ? `<a class="ph" href="${esc(autoHref(destacado, raiz))}" style="flex: 1 1 520px; min-width: 0; aspect-ratio: 4 / 3; border-radius: 20px; border: 1px solid #232327; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; text-decoration: none">
<img class="cover" src="${esc(raiz + destacado.fotos[0].grande)}" srcset="${esc(raiz + destacado.fotos[0].chica)} 640w, ${esc(raiz + destacado.fotos[0].grande)} 1600w" sizes="(max-width: 1100px) 100vw, 620px" alt="${esc(destacado.nombreLargo)}" width="1600" height="1200" fetchpriority="high">
<span style="position: absolute; left: 20px; bottom: 16px; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: rgba(10,10,11,0.85); font-size: 13px; color: #E4E4E7">
${icon.camera(16)}
Destacado: ${esc(destacado.titulo)} · ${destacado.precioFmt}
</span>
</a>`
    : `<div class="ph" style="flex: 1 1 520px; min-width: 0; aspect-ratio: 4 / 3; border-radius: 20px; border: 1px solid #232327; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden">
${icon.carSplit()}
</div>`;

  const aviso = C.avisoOficial ? `<div style="background: #1A0E0D; border-bottom: 1px solid #3B1A17">
<div style="max-width: 1280px; margin: 0 auto; padding: 10px 24px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 14px; line-height: 1.4; color: #F3D6D3; text-align: center">
${icon.warning(18)}
<p style="margin: 0">Nuestro único WhatsApp oficial es el <strong style="color: #FFFFFF">${esc(C.whatsappLabel)}</strong>. Si te escriben desde otro número en nombre de JH Motors, no respondas.</p>
</div>
</div>` : '';

  const sedesPie = C.sedes.map((s) => `<div style="display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5">
<span style="font-weight: 700">Local ${esc(s.nombre)}</span>
${s.direccion ? `<span style="color: #A1A1AA">${esc(s.direccion)}</span>` : ''}
${s.horario ? `<span style="color: #A1A1AA">${esc(s.horario)}</span>` : ''}
<a href="${esc(mapsBuscar(s))}" target="_blank" rel="noopener">Cómo llegar</a>
</div>`).join('\n');

  pagina('index.html', '', {
    titulo: 'JH Motors | Autos usados en venta en Toledo y Atlántida, Canelones',
    descripcion: esc(`Automotora en Toledo y Atlántida, Canelones. ${AUTOS.length ? AUTOS.length + ' autos en venta' : 'Autos en venta'}` +
      `${marcasTop ? ' (' + marcasTop + ')' : ''}, consignaciones y financiación hasta el 100% o en 36 cuotas fijas.`),
    ogImagen: destacado ? metaImagen(destacado.fotos[0].grande) : '',
    precarga: destacado ? precargar(raiz, destacado.fotos[0], '(max-width: 1100px) 100vw, 620px') : '',
    jsonld: jsonld(dealerLd(),
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'JH Motors', url: SITIO, inLanguage: 'es-UY' },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Catálogo de autos en venta',
        itemListElement: AUTOS.slice(0, 60).map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: a.url, name: a.nombreLargo }))
      }),
    nav: { catalogo: ' aria-current="page" style="color: #FFFFFF"', vender: '' },
    js: ['catalogo'],
    aviso,
    stockTexto: esc(C.stockTexto),
    hero,
    numeros: C.numeros.map(([valor, texto]) => `<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 32px; font-weight: 800; font-stretch: 115%; line-height: 1.1">${esc(valor)}</span><span style="font-size: 14px; color: #A1A1AA">${esc(texto)}</span></div>`).join('\n'),
    conteo: AUTOS.length === 1 ? '1 auto disponible' : AUTOS.length + ' autos disponibles',
    filtros: {
      marcas: opciones(unicos('marca')),
      combs: opciones(unicos('combustible')),
      cajas: opciones(unicos('transmision')),
      tipos: tipos.map((t) => `<button type="button" class="chip toggle" data-tipo="${esc(t)}" aria-pressed="${t === 'Todos'}" style="height: 44px; padding: 0 18px; border-radius: 999px; font-size: 15px">${esc(t)}</button>`).join('\n')
    },
    grilla: AUTOS.map((a, i) => card(a, i, raiz)).join(''),
    grillaOculta: AUTOS.length ? '' : ' hidden',
    vacioOculto: AUTOS.length ? ' hidden' : '',
    waBuscar: esc(JH.waUrl('Hola JH Motors, estoy buscando un auto y no lo encontré en el catálogo.')),
    waFinanciar: esc(JH.waUrl('Hola JH Motors, quiero consultar por financiación.')),
    sedesPie
  });
}

// Autos parecidos: misma carrocería primero, después el precio más cercano.
function similares(a, n) {
  const lejos = (o) => (a.dolares && o.dolares ? Math.abs(o.dolares - a.dolares) : Infinity);
  return AUTOS.filter((o) => o.id !== a.id)
    .sort((x, y) => (y.carroceria === a.carroceria) - (x.carroceria === a.carroceria) || (lejos(x) - lejos(y) || 0))
    .slice(0, n);
}

function generarAuto(a) {
  const raiz = '../../';
  const sede = C.sedes.find((s) => s.nombre === a.sede);
  const fotos = a.fotos;
  const SIZES = '(max-width: 1100px) 100vw, 800px';
  const etiqueta = (fondo, color, texto, lado) => `<span style="position: absolute; ${lado}: 18px; top: 16px; padding: 6px 12px; border-radius: 999px; background: ${fondo}; font-size: 13px;${color === '#2E2410' ? ' font-weight: 700;' : ''} color: ${color}">${texto}</span>`;

  // Galería
  let principal;
  if (fotos.length) {
    principal = `<img class="cover" data-main src="${esc(raiz + fotos[0].grande)}" srcset="${esc(raiz + fotos[0].chica)} 640w, ${esc(raiz + fotos[0].grande)} 1600w" sizes="${SIZES}" alt="${esc(a.nombreLargo)} — foto 1" width="1600" height="1000" fetchpriority="high">
<span style="position: absolute; right: 18px; top: 16px; padding: 6px 12px; border-radius: 999px; background: rgba(10,10,11,0.85); font-size: 13px; color: #E4E4E7" data-counter>1 / ${fotos.length}</span>`;
    if (fotos.length > 1) {
      const flecha = (lado, label, attr, ic) => `<button type="button" class="arrow" aria-label="${label}" ${attr} style="position: absolute; ${lado}: 16px; top: 50%; margin-top: -24px; width: 48px; height: 48px; border-radius: 999px; border: 0; background: rgba(10,10,11,0.85); color: #F5F5F4; display: flex; align-items: center; justify-content: center">
${ic}
</button>`;
      principal += '\n' + flecha('left', 'Foto anterior', 'data-prev', icon.chevronLeft(20)) + '\n' + flecha('right', 'Foto siguiente', 'data-next', icon.chevronRight(20));
    }
  } else {
    principal = icon.car('44%', '#4A4A52', 1.6) + '\n' + etiqueta('rgba(10,10,11,0.85)', '#E4E4E7', 'Fotos próximamente', 'left');
  }
  if (a.reservado) principal += '\n' + etiqueta('#F5C76B', '#2E2410', 'Reservado', 'left');

  const miniaturas = fotos.length > 1
    ? `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(96px, 100%), 1fr)); gap: 10px">
${fotos.map((f, i) => `<button type="button" class="thumb ph" aria-pressed="${i === 0}" aria-label="Ver foto ${i + 1}" data-thumb data-grande="${esc(raiz + f.grande)}" data-chica="${esc(raiz + f.chica)}" style="aspect-ratio: 4 / 3; border-radius: 10px; padding: 0">
<img src="${esc(raiz + f.chica)}" alt="" width="640" height="480" loading="lazy" decoding="async">
</button>`).join('\n')}
</div>`
    : '';

  const claves = [['Año', a.anio], ['Kilómetros', a.kmFmt], ['Combustible', a.combustible], ['Transmisión', a.transmision]]
    .map(([l, val]) => `<div style="background: #0A0A0B; border: 1px solid #222226; border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 12px; color: #A1A1AA">${l}</span>
<span style="font-size: 16px; font-weight: 700">${esc(val)}</span>
</div>`).join('\n');

  const financiacion = a.financiable && a.precio ? `<div style="background: #0A0A0B; border: 1px solid #3B1A17; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px">
<span style="font-size: 15px; font-weight: 700; color: #FF3B30">Financiación propia</span>
<span style="font-size: 15px; line-height: 1.5; color: #E4E4E7">Entregás <strong style="color: #FFFFFF">${a.entregaFmt}</strong> (50%) y el saldo en hasta 36 cuotas fijas.</span>
<span style="font-size: 14px; line-height: 1.5; color: #A1A1AA">También financiamos hasta el 100%. Consultá el valor de la cuota.</span>
</div>` : '';

  // Mensajes de WhatsApp: siempre con el link de la publicación para saber de qué auto se habla.
  const ident = `${a.nombreLargo} (Ref. ${a.ref})`;
  const consulta = JH.waUrl(`Hola JH Motors, me interesa este auto: ${ident}. ¿Sigue disponible?\n\n${a.url}`);
  const visita = JH.waUrl(`Hola JH Motors, quiero coordinar una visita para ver este auto: ${ident}.\n\n${a.url}`);
  const cuotas = JH.waUrl(`Hola JH Motors, quiero saber el valor de las cuotas para este auto: ${ident}.\n\n${a.url}`);

  const fila = (l, val, pad) => `<div style="display: flex; justify-content: space-between; gap: 16px; padding: ${pad}; border-bottom: 1px solid #232327; font-size: 15px">
<dt style="color: #A1A1AA">${l}</dt>
<dd style="margin: 0; font-weight: 600; text-align: right">${esc(val)}</dd>
</div>`;
  const hay = ([, val]) => val !== '' && val !== null && val !== undefined && val !== false;
  const ficha = [
    ['Marca', a.marca], ['Modelo', a.modelo], ['Versión', a.version], ['Año', a.anio],
    ['Kilometraje', a.kmFmt], ['Combustible', a.combustible],
    ['Transmisión', a.transmision + (a.marchas ? `, ${a.marchas} velocidades` : '')],
    ['Motor', a.motor], ['Potencia', a.potencia], ['Tracción', a.traccion], ['Carrocería', a.carroceria],
    ['Puertas', a.puertas], ['Color', a.color], ['Empadronado en', a.padron],
    ['Acepta permuta', a.permuta ? 'Sí' : ''], ['Referencia', a.ref]
  ].filter(hay).map(([l, val]) => fila(l, val, '14px 16px 14px 0')).join('\n');

  const estadoDoc = [
    ['Dueños anteriores', a.duenos], ['Service', a.service], ['Documentación', a.documentacion],
    ['Llaves', a.llaves], ['Garantía', a.garantia]
  ].filter(hay);

  const titulo2 = (id, texto) => `<h2 id="${id}" style="margin: 0; font-size: 28px; font-weight: 800; font-stretch: 112%">${texto}</h2>`;
  const caja = (id, texto, cuerpo) => `<section aria-labelledby="${id}" style="background: #111113; border: 1px solid #232327; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: ${id === 'estado' ? 14 : 12}px">
<h2 id="${id}" style="margin: 0; font-size: 20px; font-weight: 800; font-stretch: 110%">${texto}</h2>
${cuerpo}
</section>`;

  const parecidos = similares(a, 3);
  const mini = (o) => `<a class="card" href="${esc(autoHref(o, raiz))}" style="display: flex; flex-direction: column; background: #131315; border: 1px solid #232327; border-radius: 16px; overflow: hidden; text-decoration: none; color: #F5F5F4">
<div class="ph" style="position: relative; aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center">
${o.fotos.length
    ? `<img class="cover" src="${esc(raiz + o.fotos[0].chica)}" alt="${esc(o.nombreLargo)}" width="640" height="360" loading="lazy" decoding="async">`
    : icon.car('40%')}
</div>
<div style="padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 18px; font-weight: 700">${esc(o.marca + ' ' + o.modelo)}</span>
<span style="font-size: 14px; color: #A1A1AA">${esc([o.version, o.anio, o.kmFmt].filter(Boolean).join(' · '))}</span>
</div>
<span style="font-size: 22px; font-weight: 800; font-stretch: 112%">${o.precioFmt}</span>
</div>
</a>`;

  const descripcion = `${a.nombreLargo}, ${a.sinKm ? '' : a.kmFmt + ', '}${a.combustible.toLowerCase()}, ${a.transmision.toLowerCase()}. ${a.precioFmt}.` +
    (a.financiable && a.precio ? ' Financiación hasta el 100%.' : '') +
    ` Vení a verlo a JH Motors ${a.sede || 'Toledo y Atlántida'}, Canelones.`;

  pagina('auto.html', a.ruta, {
    titulo: esc(`${[a.nombreLargo, !a.sinKm && a.kmFmt, a.precioFmt].filter(Boolean).join(' · ')} | JH Motors`),
    ogTitulo: esc(`${a.nombreLargo} — ${a.precioFmt}`),
    descripcion: esc(descripcion),
    ogTipo: 'product',
    ogImagen: fotos.length ? metaImagen(fotos[0].grande) : '',
    precarga: fotos.length ? precargar(raiz, fotos[0], SIZES) : '',
    jsonld: jsonld(autoLd(a, descripcion),
      migas([['Catálogo', SITIO], [a.carroceria, SITIO + '?tipo=' + encodeURIComponent(a.carroceria)], [a.titulo, a.url]]),
      dealerLd()),
    nav: { catalogo: ' style="color: #FFFFFF"', vender: '' },
    js: ['galeria'],
    a: {
      ref: a.ref, marca: esc(a.marca), modelo: esc(a.modelo), version: esc(a.version), anio: a.anio,
      titulo: esc(a.titulo), carroceria: esc(a.carroceria),
      tipoHref: esc(raiz + '?tipo=' + encodeURIComponent(a.carroceria) + '#catalogo'),
      sedePill: a.sede ? `<span style="padding: 6px 12px; border-radius: 999px; border: 1px solid #2E2E33; font-size: 13px; color: #D4D4D8; display: inline-flex; align-items: center; gap: 6px">
${icon.pin(14, 'currentColor', 1.9)}
Local ${esc(a.sede)}
</span>` : '',
      precio: a.precioFmt,
      notaPrecio: a.precio ? 'Precio contado' : 'Precio'
    },
    galeria: { principal, miniaturas },
    claves,
    financiacion,
    consulta: esc(consulta),
    visita: esc(visita),
    botonCuotas: a.financiable ? `<a class="btn-ghost" href="${esc(cuotas)}" target="_blank" rel="noopener" style="display: flex; align-items: center; justify-content: center; height: 48px; border-radius: 999px; border: 1px solid #3A3A40; font-size: 15px; font-weight: 600">Pedir cuotas</a>` : '',
    ficha,
    equipamiento: a.equipamiento.length ? `<section aria-labelledby="equip" style="display: flex; flex-direction: column; gap: 20px">
${titulo2('equip', 'Equipamiento')}
<ul style="margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 12px 24px">
${a.equipamiento.map((e) => `<li style="display: flex; align-items: flex-start; gap: 10px; font-size: 15px; line-height: 1.4; color: #E4E4E7">
${icon.check(18)}
${esc(e)}
</li>`).join('\n')}
</ul>
</section>` : '',
    comentarios: a.descripcion ? `<section aria-labelledby="desc" style="display: flex; flex-direction: column; gap: 16px">
${titulo2('desc', 'Comentarios del vendedor')}
<p style="margin: 0; max-width: 720px; font-size: 17px; line-height: 1.65; color: #C9C9CF; white-space: pre-line">${esc(a.descripcion)}</p>
</section>` : '',
    estadoDoc: estadoDoc.length ? caja('estado', 'Estado y documentación',
      `<dl style="margin: 0; display: flex; flex-direction: column">\n${estadoDoc.map(([l, val]) => fila(l, val, '12px 0')).join('\n')}\n</dl>`) : '',
    ubicacion: sede ? caja('ubic', 'Dónde verlo', `<div class="ph" style="height: 140px; border-radius: 12px; border: 1px solid #232327; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #9A9AA3">
<iframe title="Mapa del local ${esc(sede.nombre)}" src="https://www.google.com/maps?q=${esc(encodeURIComponent(sede.mapa))}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="width: 100%; height: 100%; border: 0; filter: grayscale(0.3) invert(0.9) hue-rotate(180deg)"></iframe>
</div>
<span style="font-size: 16px; font-weight: 700">Local ${esc(sede.nombre)}</span>
<span style="font-size: 15px; color: #A1A1AA">${esc([sede.direccion, sede.horario].filter(Boolean).join(' · '))}</span>
<a href="${esc(mapsBuscar(sede))}" target="_blank" rel="noopener" style="font-size: 15px; font-weight: 600">Cómo llegar</a>`) : '',
    similares: parecidos.length ? `<section aria-labelledby="similares" style="display: flex; flex-direction: column; gap: 24px; padding-top: 16px; border-top: 1px solid #1E1E22">
<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; padding-top: 32px">
${titulo2('similares', 'También te pueden interesar')}
<a href="${raiz}#catalogo" style="font-size: 15px; font-weight: 600">Ver todo el catálogo</a>
</div>
<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 24px">
${parecidos.map(mini).join('\n')}
</div>
</section>` : ''
  });
}

// Páginas que solo llevan a otra (GitHub Pages no tiene redirecciones del servidor).
function redirigir(ruta, destino) {
  const prof = ruta.split('/').length - 1;
  const rel = '../'.repeat(prof) + destino;
  escribir(ruta + 'index.html', render(fs.readFileSync(path.join(SRC, 'redirigir.html'), 'utf8'), {
    canonical: esc(SITIO + destino),
    destino: esc(rel),
    destinoJs: JSON.stringify(rel).replace(/</g, '\\u003c')
  }));
}

main().catch((e) => {
  console.error('Error: ' + e.message);
  process.exit(1);
});
