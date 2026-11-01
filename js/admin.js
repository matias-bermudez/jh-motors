// Panel del dueño (/admin/): login, lista de autos, alta/edición/baja, fotos y datos del negocio.
// Los permisos los pone el esquema de la Plataforma Automotoras: solo los emails de la tabla admins
// con permiso sobre 'jh-motors' pueden escribir. La web pública no lee de acá en vivo:
// scripts/generar.js la regenera cuando se guarda un auto.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const C = window.JH_CONFIG;
const JH = window.JH;
const BUCKET = 'fotos';
// Base compartida: esta web solo ve y edita los autos de su automotora.
const CONCESIONARIA = C.concesionaria;
const $ = (s) => document.querySelector(s);
const esc = JH.esc;

const form = $('#f-auto');
let sb;
let autos = [];
let filtro = 'todos';
// Editor: auto que se edita (null = nuevo), fotos actuales (rutas en el bucket),
// las subidas en esta edición (se borran si se cancela) y las quitadas (se borran al guardar).
let actual = null;
let fotos = [];
let nuevas = [];
let quitadas = [];
let subiendo = 0;

llenarOpciones();
if (!C.supabaseUrl || !C.supabaseKey) {
  $('#cargando').hidden = true;
  $('#sin-config').hidden = false;
} else {
  sb = createClient(C.supabaseUrl, C.supabaseKey);
  iniciar();
}

async function iniciar() {
  const { data } = await sb.auth.getSession();
  $('#cargando').hidden = true;
  if (data.session) await entrar();
  else vista('login');
}

// GitHub Pages deja que el navegador guarde cada página 10 minutos: desde el panel,
// los links a la web agregan ?v=<hora> para abrir siempre lo recién publicado.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-fresco]');
  if (!a) return;
  const url = new URL(a.href, location.href);
  url.searchParams.set('v', Date.now());
  a.href = url.toString();
});

function vista(nombre) {
  for (const v of ['login', 'lista', 'editor', 'negocio']) $('#v-' + v).hidden = v !== nombre;
  $('#admin-nav').hidden = nombre === 'login';
  window.scrollTo(0, 0);
}

function aviso(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { t.hidden = true; }, 5000);
}

function error(el, texto) {
  el.textContent = texto || '';
  el.hidden = !texto;
}

// Selectores, marcas y equipamiento salen de JH.OPCIONES (js/common.js).
function llenarOpciones() {
  const listas = Object.assign({ sedes: C.sedes.map((s) => s.nombre) }, JH.OPCIONES);
  for (const sel of document.querySelectorAll('select[data-opciones]')) {
    const vacio = sel.dataset.vacio ? `<option value="">${esc(sel.dataset.vacio)}</option>` : '';
    sel.innerHTML = vacio + listas[sel.dataset.opciones].map((o) => `<option>${esc(o)}</option>`).join('');
  }
  $('#marcas').innerHTML = JH.OPCIONES.marcas.map((m) => `<option value="${esc(m)}">`).join('');
  $('#equipamiento').innerHTML = JH.OPCIONES.equipamiento.map((e) =>
    `<label class="adm-check"><input type="checkbox" name="equip" value="${esc(e)}"> ${esc(e)}</label>`).join('');
  form.elements.carroceria.value = 'Sedán';
  $('#neg-sedes').innerHTML = C.sedes.map((s, i) => `
    <label class="adm-field">Dirección local ${esc(s.nombre)}<input class="in" name="direccion-${i}" placeholder="Ej.: Ruta 6 km 25" autocomplete="off"></label>
    <label class="adm-field">Horario local ${esc(s.nombre)}<input class="in" name="horario-${i}" placeholder="Ej.: Lunes a sábado de 9 a 19 h" autocomplete="off"></label>`).join('');
}

// ---- Login ----

$('#f-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  error($('#login-error'));
  const { error: err } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  if (err) return error($('#login-error'), 'Email o contraseña incorrectos.');
  await entrar();
});

async function entrar() {
  const { data: puede } = await sb.rpc('puede_editar', { c: CONCESIONARIA });
  if (!puede) {
    await sb.auth.signOut();
    vista('login');
    return error($('#login-error'), 'Este usuario no tiene permiso para editar JH Motors. Hay que agregarlo en la tabla admins de Supabase.');
  }
  await cargarLista();
}

$('#salir').addEventListener('click', async () => {
  await sb.auth.signOut();
  vista('login');
});

// ---- Lista ----

async function cargarLista() {
  const [{ data, error: err }] = await Promise.all([
    sb.from('autos').select('*').eq('concesionaria', CONCESIONARIA).order('created_at', { ascending: false }),
    leerPublicacion()
  ]);
  if (err) return aviso('No se pudo cargar la lista: ' + err.message);
  autos = data;
  pintarLista();
  vista('lista');
}

// Cuándo se generó la web publicada (estado.json lo escribe scripts/generar.js).
// Un auto modificado después de eso todavía no se ve en la web.
let publicadoEn = null;
async function leerPublicacion() {
  try {
    const r = await fetch(C.sitio + 'estado.json?t=' + Date.now(), { cache: 'no-store' });
    publicadoEn = r.ok ? new Date((await r.json()).generado) : null;
  } catch {
    publicadoEn = null;
  }
}
const pendiente = (a) => publicadoEn && new Date(a.updated_at) > publicadoEn;

// Mientras haya cambios sin publicar, se vuelve a mirar cada 20 segundos.
let revision;
function revisarPublicacion() {
  clearTimeout(revision);
  if (!autos.some(pendiente)) return;
  revision = setTimeout(async () => {
    await leerPublicacion();
    if (!$('#v-lista').hidden) pintarLista();
    else revisarPublicacion();
  }, 20000);
}

function urlFoto(ruta, chica) {
  return sb.storage.from(BUCKET).getPublicUrl(chica ? ruta.replace(/\.jpg$/, '_m.jpg') : ruta).data.publicUrl;
}

const enWeb = (a) => a.publicado && a.estado !== 'vendido';
const ESTADOS = [['disponible', 'Disponible'], ['reservado', 'Reservar'], ['vendido', 'Vendido']];

function pintarLista() {
  const cuenta = (f) => autos.filter(f).length;
  $('#conteo').textContent = `${cuenta((a) => a.estado === 'disponible')} disponibles · ${cuenta((a) => a.estado === 'reservado')} reservados · ` +
    `${cuenta((a) => a.estado === 'vendido')} vendidos · ${cuenta((a) => !a.publicado)} ocultos`;

  const lista = autos.filter((a) => filtro === 'todos' || (filtro === 'oculto' ? !a.publicado : a.estado === filtro));
  if (!lista.length) {
    $('#lista').innerHTML = `<div class="adm-box" style="align-items: center; text-align: center; padding: 56px 24px">
      <h2>${autos.length ? 'No hay autos acá' : 'Todavía no hay autos'}</h2>
      ${autos.length ? '' : '<p style="margin: 0; color: #A1A1AA">Cargá el primero y en unos minutos aparece en el catálogo.</p>'}
    </div>`;
    return revisarPublicacion();
  }
  $('#lista').innerHTML = `<table class="adm-table">
<thead><tr><th>Foto</th><th>Auto</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
<tbody>${lista.map((a) => {
    const x = a.extra || {};
    const media = a.fotos.length ? `<img src="${esc(urlFoto(a.fotos[0], true))}" alt="" loading="lazy">` : '<div class="ph"></div>';
    const datos = [JH.ref(a.id), x.version, JH.miles(a.km) + ' km', x.sede, a.destacado && '★ Destacado', a.fotos.length + ' fotos'].filter(Boolean).join(' · ');
    const marcas = [
      pendiente(a) && '<span class="adm-badge reservado">Publicándose en la web…</span>',
      !a.publicado && '<span class="adm-badge vendido">Oculto</span>',
      !a.fotos.length && '<span class="adm-badge reservado">Sin fotos</span>'
    ].filter(Boolean).join(' ');
    const acciones = [
      `<button class="adm-btn ghost small" type="button" data-editar="${a.id}">Editar</button>`,
      enWeb(a) && `<a class="adm-btn ghost small" href="${esc(C.sitio + 'autos/' + a.slug + '/')}" target="_blank" rel="noopener" data-fresco>Ver</a>`,
      ...ESTADOS.filter(([e]) => e !== a.estado).map(([e, l]) => `<button class="adm-btn ghost small" type="button" data-estado="${e}" data-id="${a.id}">${l}</button>`)
    ].filter(Boolean).join('');
    return `<tr>
<td>${media}</td>
<td>
<button type="button" data-editar="${a.id}" style="padding: 0; border: 0; background: none; color: #F5F5F4; font: inherit; font-weight: 700; text-align: left; cursor: pointer">${esc(a.marca + ' ' + a.modelo + ' ' + a.anio)}</button>
<div style="font-size: 13px; color: #A1A1AA">${esc(datos)}</div>
${marcas ? `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px">${marcas}</div>` : ''}
</td>
<td style="font-weight: 700; white-space: nowrap">${JH.precio(a.precio, a.moneda)}</td>
<td><span class="adm-badge ${a.estado}">${a.estado}</span></td>
<td><div style="display: flex; flex-wrap: wrap; gap: 6px">${acciones}</div></td>
</tr>`;
  }).join('')}</tbody>
</table>`;
  revisarPublicacion();
}

$('#filtro').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  filtro = b.dataset.f;
  document.querySelectorAll('#filtro [data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  pintarLista();
});

$('#lista').addEventListener('click', async (e) => {
  const ed = e.target.closest('[data-editar]');
  if (ed) return abrir(autos.find((a) => String(a.id) === ed.dataset.editar));
  const est = e.target.closest('[data-estado]');
  if (!est) return;
  est.disabled = true;
  const { error: err } = await sb.from('autos').update({ estado: est.dataset.estado }).eq('id', est.dataset.id);
  if (err) {
    est.disabled = false;
    return aviso('No se pudo cambiar el estado: ' + err.message);
  }
  aviso('Estado actualizado. En un par de minutos se ve en la web.');
  await cargarLista();
});

$('#nuevo').addEventListener('click', () => abrir(null));

// ---- Datos del negocio ----
// Se guardan en la tabla `negocios`; al publicar pisan a config.js en toda la web (scripts/generar.js).
// La dirección y el horario de cada local van en extra.sedes; las columnas direccion y horario
// llevan un resumen de los dos locales para quien mire la tabla.

const fNegocio = $('#f-negocio');
// Textos de relleno del diseño ("[HORARIO]"): no se precargan.
const relleno = (s) => !s || /^\[.*\]$/.test(s);
let negocio = null;

$('#abrir-negocio').addEventListener('click', async () => {
  error($('#neg-error'));
  const { data, error: err } = await sb.from('negocios').select('*').eq('concesionaria', CONCESIONARIA).maybeSingle();
  if (err) return aviso('No se pudieron leer los datos del negocio: ' + err.message);
  negocio = data;
  // Sin fila todavía: se muestra lo que hoy publica la web (config.js).
  const el = fNegocio.elements;
  el.whatsapp.value = (data && data.telefono) || C.whatsappLabel || '';
  el.instagram.value = (data && data.instagram) || C.instagram || '';
  const sedes = (data && data.extra && data.extra.sedes) || {};
  C.sedes.forEach((s, i) => {
    for (const k of ['direccion', 'horario']) {
      const val = sedes[s.nombre] && typeof sedes[s.nombre][k] === 'string' ? sedes[s.nombre][k] : s[k];
      el[`${k}-${i}`].value = relleno(val) ? '' : val;
    }
  });
  vista('negocio');
});

document.querySelectorAll('[data-volver]').forEach((b) => b.addEventListener('click', () => vista('lista')));

// "095 407 252", "+598 95 407 252" o "2303 6119" → { whatsapp: '59895407252', telefono: '095 407 252' }.
function telefonoUY(texto) {
  let d = texto.replace(/\D/g, '');
  if (d.startsWith('598')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^[0-9]{8}$/.test(d)) return null;
  const telefono = d.startsWith('9') ? `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : `${d.slice(0, 4)} ${d.slice(4)}`;
  return { whatsapp: '598' + d, telefono };
}

fNegocio.addEventListener('submit', async (e) => {
  e.preventDefault();
  error($('#neg-error'));
  const el = fNegocio.elements;
  const tel = telefonoUY(el.whatsapp.value);
  if (!tel) return error($('#neg-error'), 'El WhatsApp tiene que ser un número de Uruguay, por ejemplo 099 123 456.');
  const sedes = {};
  C.sedes.forEach((s, i) => {
    sedes[s.nombre] = { direccion: el[`direccion-${i}`].value.trim(), horario: el[`horario-${i}`].value.trim() };
  });
  const resumen = (k) => C.sedes.filter((s) => sedes[s.nombre][k]).map((s) => `${s.nombre}: ${sedes[s.nombre][k]}`).join(' · ').slice(0, 200) || null;
  const fila = {
    concesionaria: CONCESIONARIA,
    ...tel,
    // Usuario de Instagram: sirve también si pegan el link del perfil.
    instagram: el.instagram.value.trim().replace(/^.*instagram\.com\//, '').replace(/[/?#].*$/, '').replace(/^@/, '') || null,
    direccion: resumen('direccion'),
    horario: resumen('horario'),
    // Se conservan los datos de extra que este panel no maneja.
    extra: Object.assign({}, negocio && negocio.extra, { sedes })
  };
  $('#guardar-negocio').disabled = true;
  const { error: err } = await sb.from('negocios').upsert(fila, { onConflict: 'concesionaria' });
  $('#guardar-negocio').disabled = false;
  if (err) return error($('#neg-error'), 'No se pudo guardar: ' + err.message);
  Object.assign(C, { whatsapp: tel.whatsapp, whatsappLabel: tel.telefono, instagram: fila.instagram || C.instagram });
  C.sedes = C.sedes.map((s) => Object.assign({}, s, sedes[s.nombre]));
  aviso('Guardado. En un par de minutos se actualiza en toda la web.');
  vista('lista');
});

// ---- Editor ----

const CHECKS = ['publicado', 'destacado', 'acepta_permuta'];
// Se escriben como en Uruguay ("64.000", "U$S 14.500"): se toman solo los dígitos.
const ENTEROS = ['anio', 'km', 'precio', 'marchas', 'puertas', 'duenos'];
const MONTOS = ['km', 'precio'];
const TEXTOS = ['marca', 'carroceria', 'combustible', 'transmision', 'motor', 'traccion', 'color', 'moneda', 'estado', 'descripcion'];

function abrir(a) {
  actual = a;
  form.reset();
  form.elements.carroceria.value = 'Sedán';
  error($('#ed-error'));
  fotos = a ? a.fotos.slice() : [];
  nuevas = [];
  quitadas = [];
  if (a) {
    const x = a.extra || {};
    const el = form.elements;
    for (const k of TEXTOS) el[k].value = a[k] == null ? '' : String(a[k]);
    for (const k of ENTEROS) el[k].value = a[k] == null ? '' : MONTOS.includes(k) ? (a[k] ? JH.miles(a[k]) : '') : String(a[k]);
    for (const k of CHECKS) el[k].checked = !!a[k];
    el.modelo.value = JH.partirModelo(a).modelo;
    for (const k of JH.EXTRA) {
      if (k === 'financiable') el[k].checked = x[k] === true;
      else el[k].value = x[k] == null ? '' : String(x[k]);
    }
    if (!el.carroceria.value) el.carroceria.value = 'Sedán';
    const lista = JH.OPCIONES.equipamiento;
    for (const c of form.querySelectorAll('[name="equip"]')) c.checked = a.equipamiento.includes(c.value);
    el.equip_extra.value = a.equipamiento.filter((e) => !lista.includes(e)).join('\n');
  }
  $('#ed-titulo').textContent = a ? `${a.marca} ${a.modelo} ${a.anio}` : 'Cargar auto nuevo';
  $('#ed-ref').hidden = !a;
  if (a) {
    $('#ed-ref').innerHTML = `Ref. ${JH.ref(a.id)}` + (enWeb(a)
      ? ` · <a href="${esc(C.sitio + 'autos/' + a.slug + '/')}" target="_blank" rel="noopener" data-fresco>Ver publicación</a>` : '');
  }
  $('#guardar').textContent = a ? 'Guardar cambios' : 'Publicar auto';
  $('#borrar-box').hidden = !a;
  pintarFotos();
  vista('editor');
}

function datosDelForm() {
  const el = form.elements;
  const t = (k) => el[k].value.trim();
  const fila = {};
  for (const k of TEXTOS) fila[k] = t(k) || null;
  for (const k of ENTEROS) fila[k] = t(k).replace(/\D/g, '') ? Number(t(k).replace(/\D/g, '')) : null;
  for (const k of CHECKS) fila[k] = el[k].checked;
  if (fila.km === null) fila.km = 0;
  // `modelo` en la base es modelo + versión; la versión sola queda en extra.version.
  fila.modelo = [t('modelo'), t('version')].filter(Boolean).join(' ');
  fila.tipo = JH.tipoDe(fila.carroceria);
  const marcados = [...form.querySelectorAll('[name="equip"]:checked')].map((c) => c.value);
  const otros = el.equip_extra.value.split('\n').map((s) => s.trim()).filter(Boolean);
  fila.equipamiento = [...new Set([...marcados, ...otros])];
  // Se conservan los datos de extra que este panel no maneja.
  const extra = Object.assign({}, actual && actual.extra);
  for (const k of JH.EXTRA) {
    const val = k === 'financiable' ? el[k].checked : t(k);
    if (val === '') delete extra[k];
    else extra[k] = val;
  }
  fila.extra = extra;
  fila.fotos = fotos;
  return fila;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error($('#ed-error'));
  if (subiendo) return error($('#ed-error'), 'Esperá a que terminen de subir las fotos.');
  const fila = datosDelForm();
  const falta = [['marca', 'marca'], ['modelo', 'modelo'], ['anio', 'año']].filter(([k]) => !fila[k]).map(([, l]) => l);
  if (falta.length) return error($('#ed-error'), 'Completá: ' + falta.join(', ') + '.');
  const max = new Date().getFullYear() + 1;
  if (fila.anio < 1950 || fila.anio > max) return error($('#ed-error'), `El año tiene que estar entre 1950 y ${max}.`);

  $('#guardar').disabled = true;
  // El slug es la URL del auto (/autos/<slug>/): marca-modelo-año. Se mantiene mientras no cambien
  // esos datos; si cambian, se actualiza. Si ya existe otro igual, se le agrega -2, -3...
  const base = JH.slug(`${fila.marca} ${fila.modelo} ${fila.anio}`);
  const mismo = actual && (actual.slug === base || /^-\d+$/.test(actual.slug.slice(base.length)) && actual.slug.startsWith(base));
  let err;
  for (let n = 1; n < 20; n++) {
    const slug = mismo ? actual.slug : n === 1 ? base : `${base}-${n}`;
    ({ error: err } = actual
      ? await sb.from('autos').update({ ...fila, slug }).eq('id', actual.id)
      : await sb.from('autos').insert({ ...fila, slug, concesionaria: CONCESIONARIA }));
    if (!err || err.code !== '23505' || mismo) break;
  }
  $('#guardar').disabled = false;
  if (err) return error($('#ed-error'), 'No se pudo guardar: ' + err.message);

  await borrarArchivos(quitadas);
  nuevas = [];
  aviso('Guardado. En un par de minutos se ve en la web.');
  await cargarLista();
});

$('#cancelar').addEventListener('click', cancelar);
$('#volver').addEventListener('click', cancelar);

async function cancelar() {
  // Las fotos subidas en esta edición no quedaron en ningún auto: se borran.
  await borrarArchivos(nuevas);
  nuevas = [];
  vista('lista');
}

$('#borrar').addEventListener('click', async () => {
  if (!confirm(`¿Eliminar ${actual.marca} ${actual.modelo} ${actual.anio} y sus fotos para siempre?\n\nSi se vendió, mejor cambiá el estado a "Vendido".`)) return;
  const { error: err } = await sb.from('autos').delete().eq('id', actual.id);
  if (err) return error($('#ed-error'), 'No se pudo borrar: ' + err.message);
  await borrarArchivos([...actual.fotos, ...nuevas]);
  aviso('Auto eliminado.');
  await cargarLista();
});

// ---- Fotos ----

function pintarFotos() {
  $('#fotos').innerHTML = fotos.map((ruta, i) => `
    <div class="adm-photo">
      <img src="${esc(urlFoto(ruta, true))}" alt="Foto ${i + 1}">
      ${i === 0 ? '<span class="tag">Portada</span>' : ''}
      <div class="tools">
        <button type="button" data-accion="izq" data-i="${i}" aria-label="Mover antes"${i === 0 ? ' disabled' : ''}>←</button>
        <button type="button" data-accion="der" data-i="${i}" aria-label="Mover después"${i === fotos.length - 1 ? ' disabled' : ''}>→</button>
        <button type="button" data-accion="quitar" data-i="${i}" aria-label="Quitar foto">✕</button>
      </div>
    </div>`).join('');
}

$('#fotos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const i = Number(b.dataset.i);
  if (b.dataset.accion === 'quitar') quitadas.push(...fotos.splice(i, 1));
  else {
    const j = b.dataset.accion === 'izq' ? i - 1 : i + 1;
    [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
  }
  pintarFotos();
});

// Dos entradas: la galería (varias a la vez) y la cámara del celular (una por vez, se sube al sacarla).
for (const id of ['#f-fotos', '#f-camara']) {
  $(id).addEventListener('change', (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    subirFotos(archivos);
  });
}

async function subirFotos(archivos) {
  const estado = $('#subiendo');
  subiendo += archivos.length;
  $('#guardar').disabled = true;
  let hechas = 0;
  for (const archivo of archivos) {
    estado.hidden = false;
    estado.textContent = `Subiendo foto ${++hechas} de ${archivos.length}…`;
    try {
      const ruta = `${CONCESIONARIA}/${crypto.randomUUID()}.jpg`;
      const [grande, chica] = await Promise.all([achicar(archivo, 1600, 0.82), achicar(archivo, 640, 0.78)]);
      for (const [r, blob] of [[ruta, grande], [ruta.replace(/\.jpg$/, '_m.jpg'), chica]]) {
        const { error: err } = await sb.storage.from(BUCKET).upload(r, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (err) throw err;
      }
      fotos.push(ruta);
      nuevas.push(ruta);
      pintarFotos();
    } catch (err) {
      aviso(`No se pudo subir ${archivo.name}: ${err.message || err}`);
    }
    subiendo--;
  }
  estado.hidden = true;
  if (!subiendo) $('#guardar').disabled = false;
}

// Achica la foto del celular (3–10 MB) a JPG de ~200 KB, respetando la orientación.
async function achicar(archivo, max, calidad) {
  const img = await decodificar(archivo);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error('formato de imagen no soportado');
  return blob;
}

// createImageBitmap con orientación no anda en todos los Safari: si falla, se usa un <img>
// (los navegadores ya lo giran según la foto).
async function decodificar(archivo) {
  try {
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function borrarArchivos(rutas) {
  if (!rutas.length) return;
  await sb.storage.from(BUCKET).remove(rutas.flatMap((r) => [r, r.replace(/\.jpg$/, '_m.jpg')]));
}
