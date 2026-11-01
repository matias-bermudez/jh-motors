# JH Motors — web

Web para **JH Motors** (automotora, locales en Toledo y Atlántida, Canelones). Diseño de Claude Design en `design/` (no cambiarlo).

- Repo: https://github.com/matias-bermudez/jh-motors (público: GitHub Pages gratis no publica repos privados)
- Web: https://matias-bermudez.github.io/jh-motors/
- Seguimiento: issues del repo. Los commits cierran issues con `Closes #N`.

## Plataforma Automotoras

Sigue las reglas de `~/Proyectos/plataforma-automotoras/README.md` (leerlo). Referencia: `~/Proyectos/DNAutos`.
Base compartida en Supabase, `concesionaria = 'jh-motors'`. **No tocar el esquema desde acá**: lo que falte va en `autos.extra`
o se pide la columna en el repo de la plataforma. No hay acceso de escritura a la base desde Claude: los datos se pasan como `.sql`.

## Stack

Sitio estático generado por `scripts/generar.js` (Node 18+, sin dependencias) → `_site/` (no se commitea).
GitHub Actions (`publicar.yml`, igual al de DN) lo publica en Pages en push, `workflow_dispatch` (trigger de Supabase) y cron de 15 min "solo si cambió".

| Archivo | Qué es |
|---|---|
| `js/config.js` | WhatsApp (hoy el de prueba 091 969 322), locales, textos de números, Supabase, `sitio`, `indexar`. La fila de `negocios` lo pisa al publicar (regla 12) |
| `js/common.js` | Helpers compartidos navegador/generador (`window.JH`): precios, slug, ref, opciones del panel, íconos |
| `src/*.html`, `src/_partials/` | Plantillas: `{{ dato }}` (sin escapar: el generador escapa) y `{{> parcial }}` |
| `scripts/generar.js` | Lee autos (o `AUTOS_JSON`), baja fotos, arma páginas, JSON-LD, sitemap, robots, estado.json |
| `js/catalogo.js`, `galeria.js`, `vender.js` | Filtros del catálogo (sobre las tarjetas del HTML), galería, formulario → WhatsApp |
| `src/admin.html`, `js/admin.js` | Panel (supabase-js 2.45.4): autos, "Sacar foto", "Datos del negocio" |
| `supabase/ejemplos.sql` | Los 12 autos de ejemplo del diseño |

Datos de JH en `autos.extra`: `version`, `potencia`, `sede`, `financiable`, `padron`, `service`, `documentacion`, `llaves`, `garantia`.
`modelo` = modelo + versión; `JH.partirModelo()` los separa para el diseño. `tipo` se deriva de `carroceria` (`JH.tipoDe`).
Referencia del auto: `JH-` + id con 4 dígitos.
Datos del negocio (tabla `negocios`): `whatsapp`, `telefono`, `instagram`; dirección y horario por local en `extra.sedes` (`{"Toledo": {direccion, horario}}`, texto vacío = no se muestra).
El generador reescribe `_site/js/config.js` con la config ya pisada. Probar el override sin la base: `NEGOCIO_JSON=fila.json`.

Probar en local: `node scripts/generar.js --local && python3 -m http.server 8793 -d _site` (8791 lo usa DN, 8792 otro proyecto).
Capturas: Playwright de `/Users/matibermudez/Proyectos/TapStore-listas/node_modules/playwright`, `devices['iPhone 13']` para 390 px.

## Registro

- 2026-10-31: primera versión con Express + EJS + SQLite + sharp.
- 2026-11-01: pasa a la Plataforma Automotoras (issues #1–#5): sitio estático, panel con Supabase, ejemplos en SQL, workflow (desactivado hasta hacer público el repo). Servidor viejo eliminado.
- 2026-11-01: repo público, Pages (fuente GitHub Actions) y workflow activados; primera publicación OK (0 autos en la base).
- 2026-11-01: al nivel de DN (reglas 12 y 13, #6–#9): datos del negocio desde la tabla `negocios` (la tabla todavía no existe en la base: hasta correr el schema se usa config.js), pantalla "Datos del negocio", botón "Sacar foto", links del panel con `?v=`.
- Pendiente (#4): registrar `sitio`/`repo` en `concesionarias`, sumar el repo al token de GitHub, usuario del dueño.
