const config = require('./config');
const { photoUrls } = require('./images');

const OPTIONS = {
  tipos: ['SUV', 'Sedán', 'Hatchback', 'Pick-up', 'Utilitario', 'Station wagon', 'Coupé', 'Minivan', 'Convertible'],
  combustibles: ['Nafta', 'Diésel', 'Híbrido', 'Eléctrico', 'GNC'],
  transmisiones: ['Manual', 'Automática'],
  tracciones: ['Delantera', 'Trasera', '4x2', '4x4', 'AWD'],
  monedas: ['USD', 'UYU'],
  estados: ['disponible', 'reservado', 'vendido'],
  departamentos: [
    'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida', 'Lavalleja',
    'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha', 'Salto', 'San José',
    'Soriano', 'Tacuarembó', 'Treinta y Tres'
  ],
  // Lista rápida para tildar en el admin; lo que no esté se escribe a mano.
  equipamiento: [
    'Aire acondicionado', 'Aire acondicionado digital', 'Climatizador bizona', 'Dirección asistida',
    'Vidrios eléctricos', 'Espejos eléctricos', 'Cierre centralizado', 'Alarma',
    'Pantalla multimedia', 'Apple CarPlay y Android Auto', 'Bluetooth', 'Cámara de retroceso',
    'Sensores de estacionamiento', 'Control de crucero', 'Computadora de a bordo', 'Arranque sin llave',
    '2 airbags', '6 airbags', 'Frenos ABS', 'Control de estabilidad (ESP)',
    'Llantas de aleación', 'Faros LED', 'Faros antiniebla', 'Techo solar',
    'Tapizado de cuero', 'Asientos calefaccionados', 'Barras de techo', 'Enganche'
  ]
};

// Tipos que se muestran como chips en el catálogo (en este orden, si hay stock).
const TIPOS_CHIPS = ['SUV', 'Sedán', 'Hatchback', 'Pick-up', 'Utilitario', 'Station wagon', 'Coupé', 'Minivan', 'Convertible'];

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function precioFmt(precio, moneda) {
  return (moneda === 'UYU' ? '$U ' : 'USD ') + fmt(precio);
}

function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const refOf = (id) => 'JH-' + String(id).padStart(4, '0');

function present({ car, photos }) {
  const ref = refOf(car.id);
  const titulo = `${car.marca} ${car.modelo} ${car.anio}`;
  const nombreLargo = [car.marca, car.modelo, car.version, car.anio].filter(Boolean).join(' ');
  const slug = slugify(nombreLargo) + '-' + car.id;
  const url = `/autos/${slug}`;
  const absUrl = config.siteUrl + url;
  const fotos = photos.map((p) => Object.assign({ id: p.id, file: p.file }, photoUrls(p.file)));
  let equipamiento = [];
  try { equipamiento = JSON.parse(car.equipamiento || '[]'); } catch { /* dato viejo o roto */ }

  const kmFmt = fmt(car.km) + ' km';
  const transmisionLarga = car.transmision + (car.marchas ? `, ${car.marchas} velocidades` : '');
  const ficha = [
    ['Marca', car.marca], ['Modelo', car.modelo], ['Versión', car.version], ['Año', car.anio],
    ['Kilometraje', kmFmt], ['Combustible', car.combustible], ['Transmisión', transmisionLarga],
    ['Motor', car.motor], ['Potencia', car.potencia], ['Tracción', car.traccion], ['Carrocería', car.tipo],
    ['Puertas', car.puertas], ['Color', car.color], ['Empadronado en', car.padron],
    ['Acepta permuta', car.permuta ? 'Sí' : ''], ['Referencia', ref]
  ].filter(([, v]) => v !== '' && v != null).map(([label, value]) => ({ label, value: String(value) }));

  const estadoDoc = [
    ['Dueños anteriores', car.duenos], ['Service', car.service], ['Documentación', car.documentacion],
    ['Llaves', car.llaves], ['Garantía', car.garantia]
  ].filter(([, v]) => v).map(([label, value]) => ({ label, value }));

  // Mensajes de WhatsApp: siempre con el link de la publicación para saber de qué auto se habla.
  const ident = `${nombreLargo} (Ref. ${ref})`;
  const wa = {
    consulta: config.whatsapp.link(`Hola JH Motors, me interesa este auto: ${ident}. ¿Sigue disponible?\n\n${absUrl}`),
    visita: config.whatsapp.link(`Hola JH Motors, quiero coordinar una visita para ver este auto: ${ident}.\n\n${absUrl}`),
    financiar: config.whatsapp.link(`Hola JH Motors, quiero saber el valor de las cuotas para este auto: ${ident}.\n\n${absUrl}`)
  };

  return Object.assign({}, car, {
    ref, titulo, nombreLargo, slug, url, absUrl, kmFmt,
    precioFmt: precioFmt(car.precio, car.moneda),
    entregaFmt: precioFmt(Math.round(car.precio / 2), car.moneda),
    electrico: car.combustible === 'Eléctrico',
    reservado: car.estado === 'reservado',
    vendido: car.estado === 'vendido',
    fotos,
    cover: fotos[0] || null,
    equipamiento,
    ficha,
    estadoDoc,
    sedeInfo: config.sedes[car.sede] || null,
    wa
  });
}

// Autos parecidos: mismo tipo primero, después el precio más cercano.
function similares(car, all, n = 3) {
  return all
    .filter((c) => c.id !== car.id && !c.vendido)
    .sort((a, b) =>
      (b.tipo === car.tipo) - (a.tipo === car.tipo) ||
      Math.abs(a.precio - car.precio) - Math.abs(b.precio - car.precio))
    .slice(0, n);
}

// Convierte el formulario del admin en una fila para la base. Devuelve { data, errors }.
function fromForm(body) {
  const t = (k) => String(body[k] ?? '').trim();
  const int = (k) => {
    const v = t(k).replace(/\D/g, '');
    return v === '' ? null : Number(v);
  };
  const oneOf = (k, list, def) => (list.includes(t(k)) ? t(k) : def);
  const checks = [].concat(body.equipamiento || []).map(String);
  const extras = t('equipamiento_extra').split('\n').map((s) => s.trim()).filter(Boolean);

  const data = {
    marca: t('marca'), modelo: t('modelo'), version: t('version'),
    anio: int('anio'), km: int('km') ?? 0,
    combustible: oneOf('combustible', OPTIONS.combustibles, 'Nafta'),
    transmision: oneOf('transmision', OPTIONS.transmisiones, 'Manual'),
    marchas: t('marchas').replace(/\D/g, ''),
    tipo: oneOf('tipo', OPTIONS.tipos, 'Sedán'),
    motor: t('motor'), potencia: t('potencia'), traccion: t('traccion'),
    puertas: t('puertas').replace(/\D/g, ''), color: t('color'), padron: t('padron'),
    sede: Object.keys(config.sedes).includes(t('sede')) ? t('sede') : Object.keys(config.sedes)[0],
    precio: int('precio'),
    moneda: oneOf('moneda', OPTIONS.monedas, 'USD'),
    financiable: body.financiable ? 1 : 0,
    permuta: body.permuta ? 1 : 0,
    duenos: t('duenos'), service: t('service'), documentacion: t('documentacion'),
    llaves: t('llaves'), garantia: t('garantia'),
    equipamiento: JSON.stringify([...new Set([...checks, ...extras])]),
    descripcion: t('descripcion'),
    estado: oneOf('estado', OPTIONS.estados, 'disponible'),
    destacado: body.destacado ? 1 : 0
  };

  const errors = [];
  if (!data.marca) errors.push('Falta la marca.');
  if (!data.modelo) errors.push('Falta el modelo.');
  const year = new Date().getFullYear();
  if (!data.anio || data.anio < 1950 || data.anio > year + 1) errors.push(`El año tiene que estar entre 1950 y ${year + 1}.`);
  if (!data.precio) errors.push('Falta el precio.');
  return { data, errors };
}

module.exports = { OPTIONS, TIPOS_CHIPS, fmt, slugify, refOf, present, similares, fromForm };
