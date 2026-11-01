// Filtros del catálogo: todo pasa en el navegador sobre las tarjetas que ya vienen del servidor.
(function () {
  var grid = document.getElementById('grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-car]'));
  var $ = function (id) { return document.getElementById(id); };
  var buscar = $('buscar'), marca = $('marca'), comb = $('comb'), caja = $('caja'), orden = $('orden');
  var chips = Array.prototype.slice.call(document.querySelectorAll('#tipos [data-tipo]'));
  var DEF = { q: '', tipo: 'Todos', marca: 'Todas', comb: 'Todos', caja: 'Todas', orden: 'recientes' };
  var tipo = DEF.tipo;

  var num = function (el, k) { return Number(el.getAttribute('data-' + k)); };
  var SORTS = {
    recientes: function (a, b) { return num(a, 'orden') - num(b, 'orden'); },
    precioAsc: function (a, b) { return num(a, 'precio') - num(b, 'precio'); },
    precioDesc: function (a, b) { return num(b, 'precio') - num(a, 'precio'); },
    km: function (a, b) { return num(a, 'km') - num(b, 'km'); },
    anio: function (a, b) { return num(b, 'anio') - num(a, 'anio'); }
  };

  function hasOption(sel, v) {
    return Array.prototype.some.call(sel.options, function (o) { return o.value === v; });
  }

  // Lee los filtros de la URL (?marca=Toyota&tipo=SUV) para que los links se puedan compartir.
  function fromUrl() {
    var p = new URLSearchParams(location.search);
    buscar.value = p.get('q') || '';
    [['marca', marca], ['comb', comb], ['caja', caja], ['orden', orden]].forEach(function (pair) {
      var v = p.get(pair[0]);
      pair[1].value = v && hasOption(pair[1], v) ? v : DEF[pair[0]];
    });
    var t = p.get('tipo');
    tipo = t && chips.some(function (c) { return c.getAttribute('data-tipo') === t; }) ? t : DEF.tipo;
  }

  function toUrl() {
    var p = new URLSearchParams();
    var vals = { q: buscar.value.trim(), tipo: tipo, marca: marca.value, comb: comb.value, caja: caja.value, orden: orden.value };
    Object.keys(vals).forEach(function (k) { if (vals[k] && vals[k] !== DEF[k]) p.set(k, vals[k]); });
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  function apply() {
    var q = buscar.value.trim().toLowerCase();
    var n = 0;
    cards.forEach(function (c) {
      var ok = (tipo === 'Todos' || c.getAttribute('data-tipo') === tipo) &&
        (marca.value === 'Todas' || c.getAttribute('data-marca') === marca.value) &&
        (comb.value === 'Todos' || c.getAttribute('data-comb') === comb.value) &&
        (caja.value === 'Todas' || c.getAttribute('data-caja') === caja.value) &&
        (!q || c.getAttribute('data-q').indexOf(q) !== -1);
      c.hidden = !ok;
      if (ok) n++;
    });
    cards.slice().sort(SORTS[orden.value] || SORTS.recientes).forEach(function (c) { grid.appendChild(c); });
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-tipo') === tipo)); });
    $('count').textContent = n === 1 ? '1 auto disponible' : n + ' autos disponibles';
    grid.hidden = n === 0;
    $('empty').hidden = n !== 0;
    toUrl();
  }

  [buscar, marca, comb, caja, orden].forEach(function (el) {
    el.addEventListener(el === buscar ? 'input' : 'change', apply);
  });
  chips.forEach(function (c) {
    c.addEventListener('click', function () { tipo = c.getAttribute('data-tipo'); apply(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-limpiar]'), function (b) {
    b.addEventListener('click', function () {
      buscar.value = DEF.q; marca.value = DEF.marca; comb.value = DEF.comb; caja.value = DEF.caja; orden.value = DEF.orden;
      tipo = DEF.tipo;
      apply();
    });
  });

  fromUrl();
  apply();
})();
