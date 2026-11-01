// Carga los autos de ejemplo del diseño para probar la web. Solo corre si no hay autos cargados.
// Uso: npm run seed
const db = require('./db');
const { fromForm } = require('./cars');

if (db.listAll().length) {
  console.log('Ya hay autos cargados; no se agregan ejemplos.');
  process.exit(0);
}

const EJEMPLOS = [
  { marca: 'Ford', modelo: 'Ranger', version: 'XLT 3.2 4x4', anio: 2020, km: 92000, combustible: 'Diésel', transmision: 'Manual', tipo: 'Pick-up', motor: '3.2 TDCi', precio: 39900, sede: 'Toledo' },
  { marca: 'Fiat', modelo: 'Cronos', version: 'Drive 1.3', anio: 2022, km: 38000, combustible: 'Nafta', transmision: 'Manual', tipo: 'Sedán', motor: '1.3', precio: 17900, sede: 'Toledo' },
  { marca: 'Peugeot', modelo: '208', version: 'Allure 1.6', anio: 2022, km: 40000, combustible: 'Nafta', transmision: 'Manual', tipo: 'Hatchback', motor: '1.6', precio: 19900, sede: 'Toledo' },
  { marca: 'Nissan', modelo: 'Versa', version: 'Advance 1.6 CVT', anio: 2022, km: 44000, combustible: 'Nafta', transmision: 'Automática', tipo: 'Sedán', motor: '1.6', precio: 20500, sede: 'Atlántida' },
  { marca: 'Chevrolet', modelo: 'Onix Plus', version: 'Premier 1.0 Turbo', anio: 2023, km: 21000, combustible: 'Nafta', transmision: 'Automática', tipo: 'Sedán', motor: '1.0 Turbo', precio: 22500, sede: 'Atlántida' },
  { marca: 'Renault', modelo: 'Kwid', version: 'Intens 1.0', anio: 2023, km: 15000, combustible: 'Nafta', transmision: 'Manual', tipo: 'Hatchback', motor: '1.0', precio: 13900, sede: 'Atlántida' },
  { marca: 'Suzuki', modelo: 'Swift', version: 'GLX 1.2', anio: 2021, km: 47000, combustible: 'Nafta', transmision: 'Manual', tipo: 'Hatchback', motor: '1.2', precio: 15500, sede: 'Toledo' },
  { marca: 'Toyota', modelo: 'Hilux', version: 'SRV 2.8 4x4', anio: 2021, km: 68000, combustible: 'Diésel', transmision: 'Automática', tipo: 'Pick-up', motor: '2.8 TDI', precio: 46900, sede: 'Toledo' },
  {
    marca: 'Volkswagen', modelo: 'T-Cross', version: 'Highline 1.4 TSI', anio: 2022, km: 32000, combustible: 'Nafta',
    transmision: 'Automática', marchas: '6', tipo: 'SUV', motor: '1.4 TSI turbo', potencia: '150 CV', traccion: 'Delantera',
    puertas: '5', color: 'Blanco', padron: 'Canelones', precio: 29900, sede: 'Toledo', destacado: 1,
    duenos: '1', service: 'Al día', documentacion: 'Al día, libre de deudas', llaves: '2 juegos',
    equipamiento: ['Aire acondicionado digital', 'Apple CarPlay y Android Auto', 'Cámara de retroceso',
      'Sensores de estacionamiento', 'Control de crucero', '6 airbags', 'Control de estabilidad (ESP)',
      'Faros LED', 'Arranque sin llave'],
    equipamiento_extra: 'Llantas de aleación 17 pulgadas',
    descripcion: 'Unidad en muy buen estado, con service al día y un solo dueño. Caja automática, bajo consumo y buen espacio para la familia. Se puede ver en nuestro local de Toledo coordinando por WhatsApp.'
  },
  { marca: 'Hyundai', modelo: 'Creta', version: 'Limited 1.6', anio: 2021, km: 55000, combustible: 'Nafta', transmision: 'Automática', tipo: 'SUV', motor: '1.6', precio: 24900, sede: 'Atlántida' },
  { marca: 'BYD', modelo: 'Yuan Pro', version: 'GL', anio: 2024, km: 5000, combustible: 'Eléctrico', transmision: 'Automática', tipo: 'SUV', motor: 'Eléctrico', precio: 32990, sede: 'Toledo' },
  { marca: 'BYD', modelo: 'Dolphin', version: 'GS 100% eléctrico', anio: 2024, km: 8000, combustible: 'Eléctrico', transmision: 'Automática', tipo: 'Hatchback', motor: 'Eléctrico', precio: 27490, sede: 'Toledo' }
];

// Se insertan de más viejo a más nuevo, con fechas escalonadas, para que "Más recientes" respete el orden del diseño.
const stamp = db.db.prepare(`UPDATE cars SET created_at = datetime('now', ?) WHERE id = ?`);
EJEMPLOS.forEach((e, i) => {
  const { data, errors } = fromForm(Object.assign({ financiable: 1 }, e));
  if (errors.length) throw new Error(errors.join(' '));
  const id = db.insert(data);
  stamp.run(`-${EJEMPLOS.length - i} minutes`, id);
});
console.log(`Listo: ${EJEMPLOS.length} autos de ejemplo cargados (sin fotos).`);
