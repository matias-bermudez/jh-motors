// Datos del negocio. Después de cambiar algo hay que publicar (push a main): el sitio se regenera solo.
//
// Lo que el dueño carga en el panel (Datos del negocio → tabla `negocios` de Supabase) pisa a estos valores
// al publicar: whatsapp, whatsappLabel, instagram y la dirección y el horario de cada local.
//
// whatsapp: número de PRUEBA de Matías (091 969 322). El de JH Motors es 59899571202 / 099 571 202:
// cambiarlo recién cuando se lance la web.
window.JH_CONFIG = {
  whatsapp: '59891969322',      // código de país + número, sin 0 ni espacios
  whatsappLabel: '091 969 322',
  instagram: 'jhmotors_oficial',
  // Franja de arriba del inicio: "Nuestro único WhatsApp oficial es el ...".
  avisoOficial: true,
  dolar: 40,                    // pesos por dólar, aproximado: solo para ordenar por precio autos en distintas monedas

  // Locales. `direccion` y `horario` vacíos = no se muestran. `mapa` es lo que se busca en Google Maps.
  // horarioSchema: el mismo horario para Google, ej: 'Mo-Fr 09:00-18:00, Sa 09:00-13:00'.
  sedes: [
    { nombre: 'Toledo', direccion: '[DIRECCIÓN TOLEDO]', horario: '[HORARIO]', horarioSchema: '', mapa: 'JH Motors Toledo Canelones Uruguay' },
    { nombre: 'Atlántida', direccion: '[DIRECCIÓN ATLÁNTIDA]', horario: '[HORARIO]', horarioSchema: '', mapa: 'JH Motors Atlántida Canelones Uruguay' }
  ],

  // Título del inicio y franja de números debajo.
  stockTexto: 'Más de 130 autos en stock, listos para salir.',
  numeros: [
    ['+130', 'autos en stock'],
    ['100%', 'del valor financiado'],
    ['36 cuotas', 'fijas con financiación propia'],
    ['85 mil', 'seguidores en Instagram']
  ],

  // Supabase: base compartida de la Plataforma Automotoras (~/Proyectos/plataforma-automotoras).
  // `concesionaria` = id de esta automotora en la base. La clave es la pública (publishable):
  // puede ir en el código, los permisos los pone el esquema.
  supabaseUrl: 'https://dfunhdfvtmsmjdzpnhas.supabase.co',
  supabaseKey: 'sb_publishable_4Q-GxNAtPB894PRurMLwkQ_2NRVIjWg',
  concesionaria: 'jh-motors',

  // URL pública del sitio, con / al final. Si se compra dominio, cambiarla acá.
  sitio: 'https://matias-bermudez.github.io/jh-motors/',

  // false = Google no indexa la web (meta noindex). Pasar a true recién al lanzar,
  // con el número de WhatsApp de JH Motors.
  indexar: false
};
