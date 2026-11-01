// "Vendé tu auto": arma el mensaje con lo que completa la persona y lo abre en WhatsApp.
(function () {
  var form = document.getElementById('vender');
  if (!form) return;
  var INTRO = {
    'Vender': 'quiero vender mi auto',
    'Consignar': 'quiero dejar mi auto en consignación',
    'Entregarlo como parte de pago': 'quiero entregar mi auto como parte de pago'
  };
  var REQ = [['marca', 'marca'], ['modelo', 'modelo'], ['anio', 'año'], ['nombre', 'nombre'], ['tel', 'celular']];
  var seg = { operacion: 'Vender', estado: 'Muy bueno' };
  var fmt = window.JH.miles;
  var val = function (id) { return String(form.elements[id].value || '').trim(); };

  function render() {
    var lines = ['Hola JH Motors, ' + INTRO[seg.operacion] + '.', '', '*Vehículo*'];
    var add = function (label, v) { if (v) lines.push(label + ': ' + v); };
    add('Marca', val('marca'));
    add('Modelo', val('modelo'));
    add('Versión', val('version'));
    add('Año', val('anio'));
    var km = val('km').replace(/\D/g, '');
    if (km) lines.push('Kilómetros: ' + fmt(km) + ' km');
    add('Combustible', val('comb'));
    add('Transmisión', val('caja'));
    add('Color', val('color'));
    add('Estado general', seg.estado);
    var precio = val('precio').replace(/\D/g, '');
    if (precio) lines.push('Precio pretendido: U$S ' + fmt(precio));
    if (val('comentarios')) lines.push('', 'Comentarios: ' + val('comentarios'));
    lines.push('', '*Mis datos*');
    add('Nombre', val('nombre'));
    add('Celular', val('tel'));
    add('Localidad', val('localidad'));
    lines.push('', 'Les envío las fotos a continuación.');
    var mensaje = lines.join('\n');

    var faltan = REQ.filter(function (r) { return !val(r[0]); }).map(function (r) { return r[1]; });
    document.getElementById('mensaje').textContent = mensaje;
    var enviar = document.getElementById('enviar');
    enviar.href = window.JH.waUrl(mensaje);
    enviar.hidden = faltan.length > 0;
    document.getElementById('no-listo').hidden = faltan.length === 0;
    document.getElementById('faltan').textContent = faltan.join(', ');
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-seg]'), function (group) {
    var key = group.getAttribute('data-seg');
    var btns = Array.prototype.slice.call(group.querySelectorAll('[data-value]'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        seg[key] = b.getAttribute('data-value');
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        render();
      });
    });
  });

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  render();
})();
