// Galería de fotos del detalle: flechas, miniaturas, teclado y deslizar en el celular.
(function () {
  var root = document.querySelector('[data-gallery]');
  var main = root && root.querySelector('[data-main]');
  if (!main) return;
  var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-thumb]'));
  var counter = root.querySelector('[data-counter]');
  var total = thumbs.length;
  if (total < 2) return;
  var sel = 0;
  var baseAlt = main.alt.replace(/ — foto \d+$/, '');

  function show(i) {
    sel = (i + total) % total;
    var t = thumbs[sel];
    main.srcset = t.getAttribute('data-chica') + ' 640w, ' + t.getAttribute('data-grande') + ' 1600w';
    main.src = t.getAttribute('data-grande');
    main.alt = baseAlt + ' — foto ' + (sel + 1);
    counter.textContent = (sel + 1) + ' / ' + total;
    thumbs.forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === sel)); });
  }

  thumbs.forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); });
  root.querySelector('[data-prev]').addEventListener('click', function () { show(sel - 1); });
  root.querySelector('[data-next]').addEventListener('click', function () { show(sel + 1); });

  document.addEventListener('keydown', function (e) {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') show(sel - 1);
    if (e.key === 'ArrowRight') show(sel + 1);
  });

  var startX = null;
  main.parentNode.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  main.parentNode.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) show(sel + (dx < 0 ? 1 : -1));
    startX = null;
  }, { passive: true });

  // Precarga solo la foto siguiente y la anterior, para no gastar datos del celular.
  function preloadAround() {
    [sel + 1, sel - 1].forEach(function (i) {
      var img = new Image();
      img.src = thumbs[(i + total) % total].getAttribute('data-grande');
    });
  }
  main.addEventListener('load', preloadAround);
  if (main.complete) preloadAround();
})();
