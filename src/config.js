// Datos del negocio. Lo que cambia entre pruebas y producción va en .env;
// lo demás (direcciones, horarios, textos de números) se edita acá.

const port = Number(process.env.PORT) || 3000;

// Número de WhatsApp en formato internacional, sin "+" ni espacios (598 + celular sin el 0).
const waNumber = String(process.env.WHATSAPP_NUMBER || '59891969322').replace(/\D/g, '');

// 59891969322 -> "091 969 322"
function localPhone(intl) {
  const local = '0' + intl.replace(/^598/, '');
  return local.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
}

module.exports = {
  port,
  siteUrl: (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  siteName: 'JH Motors',

  whatsapp: {
    number: waNumber,
    display: localPhone(waNumber),
    intlDisplay: '+598 ' + localPhone(waNumber).slice(1),
    link: (text) => `https://wa.me/${waNumber}` + (text ? '?text=' + encodeURIComponent(text) : '')
  },

  instagram: {
    user: 'jhmotors_oficial',
    url: 'https://www.instagram.com/jhmotors_oficial/'
  },

  // Mostrar el aviso de "único WhatsApp oficial" arriba de todo en el inicio.
  showAviso: true,

  // Locales. Completá dirección, horario y el link de Google Maps de cada uno.
  sedes: {
    Toledo: {
      nombre: 'Toledo',
      direccion: '[DIRECCIÓN TOLEDO]',
      horario: '[HORARIO]',
      localidad: 'Toledo',
      departamento: 'Canelones',
      // Texto que se busca en Google Maps para el mapa y "Cómo llegar".
      mapsQuery: 'JH Motors Toledo Canelones Uruguay'
    },
    'Atlántida': {
      nombre: 'Atlántida',
      direccion: '[DIRECCIÓN ATLÁNTIDA]',
      horario: '[HORARIO]',
      localidad: 'Atlántida',
      departamento: 'Canelones',
      mapsQuery: 'JH Motors Atlántida Canelones Uruguay'
    }
  },

  // Números de la franja debajo del hero y del título principal.
  stockText: 'Más de 130 autos en stock, listos para salir.',
  stats: [
    { value: '+130', label: 'autos en stock' },
    { value: '100%', label: 'del valor financiado' },
    { value: '36 cuotas', label: 'fijas con financiación propia' },
    { value: '85 mil', label: 'seguidores en Instagram' }
  ],

  admin: {
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
    sessionSecret: process.env.SESSION_SECRET || ''
  },

  dataDir: process.env.DATA_DIR || require('node:path').join(__dirname, '..', 'data')
};
