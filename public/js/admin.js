// Formulario del admin: ordenar/quitar fotos y achicar las nuevas antes de subirlas.
(function () {
  var form = document.getElementById('car-form');
  if (!form) return;
  var grid = document.getElementById('photos');
  var order = document.getElementById('photo_order');
  var del = document.getElementById('photo_delete');
  var removed = {};

  function sync() {
    var items = Array.prototype.slice.call(grid.querySelectorAll('[data-id]'));
    var kept = items.filter(function (el) { return !removed[el.getAttribute('data-id')]; });
    order.value = kept.map(function (el) { return el.getAttribute('data-id'); }).join(',');
    del.value = Object.keys(removed).join(',');
    items.forEach(function (el) {
      el.querySelector('.tag').hidden = el !== kept[0];
      el.classList.toggle('removed', !!removed[el.getAttribute('data-id')]);
      el.querySelector('[data-act="del"]').textContent = removed[el.getAttribute('data-id')] ? '↺' : '✕';
    });
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var item = btn.closest('[data-id]');
    var act = btn.getAttribute('data-act');
    if (act === 'left' && item.previousElementSibling) grid.insertBefore(item, item.previousElementSibling);
    if (act === 'right' && item.nextElementSibling) grid.insertBefore(item.nextElementSibling, item);
    if (act === 'del') {
      var id = item.getAttribute('data-id');
      if (removed[id]) delete removed[id]; else removed[id] = true;
    }
    sync();
  });
  sync();

  // Fotos nuevas: se achican en el navegador (máx. 2000 px) para que suban rápido desde el celular.
  var input = document.getElementById('fotos');
  var preview = document.getElementById('new-photos');
  var saveBtn = document.getElementById('guardar');
  var saveLabel = saveBtn.textContent;
  var processing = 0;

  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return resolve(file);
      createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
        var scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
        if (scale === 1 && file.size < 1.5e6) return resolve(file);
        var c = document.createElement('canvas');
        c.width = Math.round(bmp.width * scale);
        c.height = Math.round(bmp.height * scale);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.88);
      }).catch(function () { resolve(file); });
    });
  }

  input.addEventListener('change', function () {
    var files = Array.prototype.slice.call(input.files);
    preview.innerHTML = '';
    files.forEach(function (f) {
      var div = document.createElement('div');
      div.className = 'adm-photo new';
      var img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      img.alt = '';
      div.appendChild(img);
      var t = document.createElement('div');
      t.className = 'tools';
      t.style.fontSize = '13px';
      t.style.color = '#A1A1AA';
      t.textContent = 'Nueva';
      div.appendChild(t);
      preview.appendChild(div);
    });
    if (!window.DataTransfer || !files.length) return;
    processing++;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Preparando fotos…';
    Promise.all(files.map(shrink)).then(function (out) {
      try {
        var dt = new DataTransfer();
        out.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
      } catch (err) { /* el navegador no deja reemplazar: se suben las originales */ }
    }).finally(function () {
      if (--processing === 0) { saveBtn.disabled = false; saveBtn.textContent = saveLabel; }
    });
  });

  form.addEventListener('submit', function () {
    sync();
    setTimeout(function () { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }, 0);
  });
})();
