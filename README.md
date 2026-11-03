# JH Motors — web

Web de JH Motors (Toledo y Atlántida, Canelones): catálogo con filtros, ficha de cada auto con "Me interesa este auto" por WhatsApp y "Vendé tu auto" (arma el mensaje y lo abre en WhatsApp). El dueño carga los autos desde un panel (`/admin/`).

Es parte de la **Plataforma Automotoras** (`~/Proyectos/plataforma-automotoras`): misma arquitectura y misma base que DN Automóviles.

**Web:** https://jh-motors.pages.dev/

## Cómo funciona

- La web es estática. `scripts/generar.js` (Node, sin dependencias) arma todas las páginas en `_site/`, una por auto, con SEO.
- Los autos y las fotos viven en Supabase (base compartida, `concesionaria = 'jh-motors'`). La web no la consulta en vivo: el generador baja autos y fotos y escribe el HTML final.
- GitHub Actions (`.github/workflows/publicar.yml`) regenera y publica en GitHub Pages en cada push a `main`, cada vez que se guarda un auto en el panel (aviso desde Supabase) y, de respaldo, cada 15 minutos si cambiaron los autos.
- Contacto 100 % por WhatsApp: los botones son links `https://wa.me/<número>?text=<mensaje armado>`.

## Configuración (`js/config.js`)

| Qué | Campo |
| --- | --- |
| Número de WhatsApp de todos los botones | `whatsapp` / `whatsappLabel` — hoy el de prueba `59891969322` / `091 969 322`; el de JH Motors es `59899571202` / `099 571 202` |
| Direcciones, horarios y mapa de los locales | `sedes` (hoy con `[DIRECCIÓN …]` y `[HORARIO]` del diseño; vacío = no se muestra) |
| Textos de números ("+130 autos", "85 mil seguidores") | `stockTexto` y `numeros` |
| Instagram, aviso de "único WhatsApp oficial" | `instagram`, `avisoOficial` |
| Conexión a la base | `supabaseUrl`, `supabaseKey` (clave pública), `concesionaria` |
| URL pública | `sitio` (con `/` al final) |
| Que Google indexe la web | `indexar` (false hasta lanzar = `noindex`) |

Después de cambiar algo, push a `main` y se publica solo.

**Datos del negocio desde el panel:** lo que el dueño guarda en *Datos del negocio* (tabla `negocios` de la base) pisa a `config.js` al publicar, en todo el HTML y en el `config.js` que usa el navegador: `whatsapp`/`whatsappLabel` (columnas `whatsapp` y `telefono`), `instagram` y la dirección y el horario de cada local (`extra.sedes`, ej. `{"Toledo": {"direccion": "...", "horario": "..."}}`; las columnas `direccion` y `horario` llevan un resumen). Si la tabla o la fila no existen, se usa `config.js`. Ningún número está escrito en las plantillas ni en el JS: todo sale de la config.

## Panel (`/admin/`)

- Se entra con email y contraseña de Supabase. El usuario tiene que estar en la tabla `admins` con `jh-motors` (o `*`).
- Carga y edición de autos con todos los datos: marca, modelo, versión, año, km, carrocería, combustible, transmisión, marchas, motor, potencia, tracción, puertas, color, departamento donde está empadronado, precio (U$S o $; vacío = "Consultar"), local, financiable, permuta, estado y documentación, equipamiento y comentarios.
- Fotos: se achican en el navegador (1600 px + miniatura de 640 px) y se suben a `fotos/jh-motors/`. Se ordenan con flechas; la primera es la portada.
- Estados: **disponible**, **reservado** (sigue en el catálogo con el cartel) y **vendido** (sale de la web; su link cae en el 404). "Se ve en la web" sin tildar = borrador.
- **Destacado**: la foto de ese auto aparece grande en el inicio.
- **Sacar foto**: en el celular (pantallas táctiles) hay un botón que abre la cámara trasera y sube la foto al sacarla, además de "Agregar fotos" (galería).
- **Datos del negocio**: WhatsApp (se escribe como en Uruguay, "099 571 202", y se guarda `59899571202` / `099 571 202`), Instagram y dirección y horario de cada local. Guardar republica la web.
- Los links a la web ("Ver web", "Ver") agregan `?v=<hora>` para no ver la copia en caché del navegador.

Lo propio de JH que no es una columna de la base va en `autos.extra`: `version`, `potencia`, `sede`, `financiable`, `padron`, `service`, `documentacion`, `llaves`, `garantia`. La columna `modelo` guarda modelo + versión ("T-Cross Highline 1.4 TSI").

## Autos de ejemplo

`supabase/ejemplos.sql`: los 12 autos del diseño (sin fotos). Se pegan en Supabase → SQL Editor → Run. El mismo archivo trae comentado el `delete` que borra solo esos 12.

## Probar en local

```sh
node scripts/generar.js --local
python3 -m http.server 8793 -d _site   # → http://localhost:8793
```

Para probar sin la base: `AUTOS_JSON=filas.json node scripts/generar.js --local` (filas con el mismo formato que devuelve la API de Supabase). `NEGOCIO_JSON=fila.json` hace lo mismo con la fila de `negocios`.

## SEO

- Una página por auto en `/autos/<slug>/` con title, description, canonical y og:image propios (la foto se ve al compartir el link).
- JSON-LD: `AutoDealer` con los dos locales, `WebSite` e `ItemList` en el inicio; `Car` + `Offer` (moneda real) + `BreadcrumbList` en cada auto.
- `sitemap.xml` (con las fotos) y `robots.txt`. `noindex` en todas las páginas mientras `indexar` sea false.
- Fuentes del diseño alojadas en la propia web, `?v=<hash>` en css y js.

**Al lanzar:** número de JH en `whatsapp`, `indexar: true`, dar de alta la web en Google Search Console con el sitemap y vincular el perfil de Google Business de cada local.
