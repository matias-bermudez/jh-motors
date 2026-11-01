// Helpers compartidos. Se usan en el navegador (panel, Vendé tu auto) y también en scripts/generar.js,
// que arma las páginas con estas mismas funciones. Todo se expone en window.JH.
(function () {
  var C = window.JH_CONFIG;

  // Opciones de los selectores del panel. Lo que no está en la lista de equipamiento se escribe a mano.
  var OPCIONES = {
    carrocerias: ['SUV', 'Sedán', 'Hatchback', 'Pick-up', 'Utilitario', 'Station wagon', 'Coupé', 'Minivan', 'Convertible'],
    combustibles: ['Nafta', 'Diésel', 'Híbrido', 'Eléctrico', 'GNC'],
    transmisiones: ['Manual', 'Automática'],
    tracciones: ['Delantera', 'Trasera', '4x2', '4x4', 'AWD'],
    departamentos: [
      'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida', 'Lavalleja',
      'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha', 'Salto', 'San José',
      'Soriano', 'Tacuarembó', 'Treinta y Tres'
    ],
    equipamiento: [
      'Aire acondicionado', 'Aire acondicionado digital', 'Climatizador bizona', 'Dirección asistida',
      'Vidrios eléctricos', 'Espejos eléctricos', 'Cierre centralizado', 'Alarma',
      'Pantalla multimedia', 'Apple CarPlay y Android Auto', 'Bluetooth', 'Cámara de retroceso',
      'Sensores de estacionamiento', 'Control de crucero', 'Computadora de a bordo', 'Arranque sin llave',
      '2 airbags', '6 airbags', 'Frenos ABS', 'Control de estabilidad (ESP)',
      'Llantas de aleación', 'Faros LED', 'Faros antiniebla', 'Techo solar',
      'Tapizado de cuero', 'Asientos calefaccionados', 'Barras de techo', 'Enganche'
    ],
    marcas: ['Audi', 'BAIC', 'BMW', 'BYD', 'Changan', 'Chery', 'Chevrolet', 'Citroën', 'DFSK', 'Fiat', 'Ford', 'Geely',
      'Great Wall', 'Haval', 'Honda', 'Hyundai', 'JAC', 'Jeep', 'Jetour', 'Kia', 'Mazda', 'Mercedes-Benz', 'MG', 'Mitsubishi',
      'Nissan', 'Peugeot', 'RAM', 'Renault', 'Subaru', 'Suzuki', 'Toyota', 'Volkswagen', 'Volvo']
  };

  // Datos propios de JH que no son columnas de la base compartida: van en autos.extra.
  var EXTRA = ['version', 'potencia', 'sede', 'financiable', 'padron', 'service', 'documentacion', 'llaves', 'garantia'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function miles(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  // moneda: 'USD' (por defecto) o 'UYU'. Sin precio = "Consultar".
  function precio(precio, moneda) { return precio ? (moneda === 'UYU' ? '$ ' : 'U$S ') + miles(precio) : 'Consultar'; }
  // Para ordenar y comparar autos con precios en distintas monedas.
  function enDolares(precio, moneda) { return precio ? (moneda === 'UYU' ? precio / ((C && C.dolar) || 40) : precio) : null; }
  function waUrl(text) { return 'https://wa.me/' + C.whatsapp + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function slug(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function ref(id) { return 'JH-' + String(id).padStart(4, '0'); }
  // La base guarda en `modelo` el modelo con la versión ("T-Cross Highline 1.4 TSI") y la versión
  // sola en extra.version. El diseño los muestra separados.
  function partirModelo(fila) {
    var version = ((fila.extra && fila.extra.version) || '').trim();
    var modelo = fila.modelo || '';
    if (version && modelo.slice(-version.length - 1) === ' ' + version) modelo = modelo.slice(0, -version.length - 1);
    return { modelo: modelo, version: version };
  }
  // Columna `tipo` de la base a partir de la carrocería.
  function tipoDe(carroceria) {
    return carroceria === 'Pick-up' || carroceria === 'SUV' ? 'camioneta' : carroceria === 'Utilitario' ? 'utilitario' : 'auto';
  }

  // Íconos del diseño.
  function svg(paths, o) {
    o = o || {};
    return '<svg aria-hidden="true" width="' + (o.size || 18) + '" height="' + (o.size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="' +
      (o.stroke || 'currentColor') + '" stroke-width="' + (o.width || 1.9) + '" stroke-linecap="round" stroke-linejoin="round"' +
      (o.style ? ' style="' + o.style + '"' : '') + '>' + paths + '</svg>';
  }
  var AUTO = '<path d="M58 46 L70 24 Q100 18 130 24 L142 46"></path><path d="M26 70 L30 56 Q34 47 50 46 L150 46 Q166 47 170 56 L174 70 L174 78 Q174 82 170 82 L30 82 Q26 82 26 78 Z"></path><path d="M36 60 Q46 63 62 63M164 60 Q154 63 138 63M82 72 L118 72M34 82 L34 90 L52 90 L52 82M148 82 L148 90 L166 90 L166 82"></path>';
  var DATO = { size: 16, stroke: '#8A8A93', width: 1.8 };
  var icon = {
    wa: function (size) { return svg('<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.3A8.5 8.5 0 1 1 21 12z"></path>', { size: size }); },
    arrowRight: function (size) { return svg('<path d="M5 12h14M13 6l6 6-6 6"></path>', { size: size, width: 2 }); },
    arrowLeft: function (size) { return svg('<path d="M19 12H5M11 6l-6 6 6 6"></path>', { size: size || 16, width: 2 }); },
    chevronLeft: function (size) { return svg('<path d="M15 6l-6 6 6 6"></path>', { size: size || 20, width: 2 }); },
    chevronRight: function (size) { return svg('<path d="M9 6l6 6-6 6"></path>', { size: size || 20, width: 2 }); },
    warning: function (size, style) { return svg('<path d="M12 3l10 18H2L12 3z"></path><path d="M12 10v5M12 18v.01"></path>', { size: size, stroke: '#FF3B30', style: style || 'flex-shrink: 0' }); },
    camera: function (size, stroke) { return svg('<path d="M4 8h3l2-3h6l2 3h3v12H4z"></path><circle cx="12" cy="14" r="3.5"></circle>', { size: size || 16, stroke: stroke, width: 1.8 }); },
    search: function () { return svg('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>', { stroke: '#8A8A93', style: 'position: absolute; left: 14px; top: 13px' }); },
    check: function (size, style) { return svg('<path d="M5 12l5 5 9-10"></path>', { size: size, stroke: '#FF3B30', width: 2.2, style: style || 'flex-shrink: 0; margin-top: 1px' }); },
    pin: function (size, stroke, width) { return svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle>', { size: size || 16, stroke: stroke || '#8A8A93', width: width || 1.8 }); },
    calendar: function () { return svg('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>', DATO); },
    gauge: function () { return svg('<path d="M4 17a8 8 0 1 1 16 0"></path><path d="M12 17l4-5"></path>', DATO); },
    fuel: function () { return svg('<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M15 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M8 8h4"></path>', DATO); },
    gearbox: function () { return svg('<circle cx="6" cy="5" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="18" cy="5" r="2"></circle><circle cx="6" cy="19" r="2"></circle><circle cx="12" cy="19" r="2"></circle><path d="M6 7v10M12 7v10M18 7v5H6"></path>', DATO); },
    engine: function () { return svg('<path d="M4 10h3l2-3h5l2 3h4v8h-4l-2 2H9l-2-2H4z"></path>', DATO); },
    // Silueta de auto para cuando todavía no hay fotos.
    car: function (width, stroke, strokeWidth) {
      return '<svg aria-hidden="true" viewBox="0 0 200 100" fill="none" stroke="' + (stroke || '#4A4A52') + '" stroke-width="' + (strokeWidth || 2) +
        '" stroke-linecap="round" stroke-linejoin="round" style="width: ' + (width || '46%') + '; height: auto">' + AUTO + '</svg>';
    },
    carSplit: function () {
      return '<svg aria-hidden="true" viewBox="0 0 200 100" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width: 68%; height: auto"><defs><linearGradient id="split" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3E8EDE"></stop><stop offset="0.5" stop-color="#3E8EDE"></stop><stop offset="0.5" stop-color="#FF3B30"></stop><stop offset="1" stop-color="#FF3B30"></stop></linearGradient></defs><g stroke="url(#split)">' + AUTO + '</g></svg>';
    }
  };

  window.JH = {
    config: C, OPCIONES: OPCIONES, EXTRA: EXTRA,
    esc: esc, miles: miles, precio: precio, enDolares: enDolares, waUrl: waUrl,
    slug: slug, ref: ref, partirModelo: partirModelo, tipoDe: tipoDe, icon: icon
  };
})();
