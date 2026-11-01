# JH Motors — Web

Web de la automotora: catálogo con filtros, detalle de cada auto, "Vendé tu auto" (arma el mensaje y lo abre en WhatsApp) y un panel `/admin` para cargar autos.

- **Diseño:** el original de Claude Design está en `design/` (el HTML empaquetado y las tres pantallas desarmadas). Las vistas en `views/` lo copian tal cual.
- **Stack:** Node.js (≥ 22.13) + Express + EJS. Base de datos SQLite incluida en Node (archivo `data/jhmotors.db`). Las fotos se guardan en `data/uploads/` y se optimizan con `sharp` (WebP en 3 tamaños + JPG para la vista previa en WhatsApp).
- **Sin cuentas de usuarios:** el público no se registra. El admin entra con el usuario y la contraseña del `.env`.

## Arrancar en tu compu

```bash
npm install
cp .env.example .env      # y completá ADMIN_PASSWORD y SESSION_SECRET
npm run seed              # opcional: carga los 12 autos de ejemplo del diseño (sin fotos)
npm run dev               # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

## Configuración

| Qué | Dónde |
| --- | --- |
| Número de WhatsApp (pruebas / real) | `WHATSAPP_NUMBER` en `.env` — `59891969322` (pruebas) → `59899571202` (JH Motors) |
| Dirección pública de la web | `SITE_URL` en `.env` (va en los links que se mandan por WhatsApp, el sitemap y Google) |
| Usuario y contraseña del admin | `ADMIN_USER` / `ADMIN_PASSWORD` en `.env` |
| Direcciones, horarios y mapa de los locales | `src/config.js` → `sedes` (hoy tienen `[DIRECCIÓN …]` y `[HORARIO]`) |
| Textos de números ("+130 autos", "85 mil seguidores") | `src/config.js` → `stockText` y `stats` |

Al cambiar el `.env` o `src/config.js` hay que reiniciar el servidor.

## Cómo se contacta la gente

- **Detalle del auto → "Me interesa este auto"**: abre WhatsApp con  
  `Hola JH Motors, me interesa este auto: Volkswagen T-Cross Highline 1.4 TSI 2022 (Ref. JH-0009). ¿Sigue disponible?` + el link de la publicación.  
  "Agendar visita" y "Pedir cuotas" hacen lo mismo con otro texto.
- **Vendé tu auto**: el formulario arma el mensaje completo (vista previa en vivo) y el botón lo abre en WhatsApp. La página le pide a la persona que mande las fotos en ese mismo chat.

## Panel de administración (`/admin`)

- Cargar un auto: marca, modelo, versión, año, km, carrocería, combustible, transmisión, motor, potencia, tracción, puertas, color, departamento donde está empadronado, precio (USD o $U), local, financiable, permuta, estado y documentación, equipamiento (tildando o escribiendo) y comentarios.
- Fotos: se suben varias juntas desde el celular o la compu; se achican solas. Se ordenan con flechas y la primera es la portada.
- Estados: **disponible**, **reservado** (sigue en el catálogo con un cartel) y **vendido** (sale del catálogo y de Google, pero el link sigue abriendo con el aviso "ya se vendió").
- **Destacado**: la foto de ese auto aparece grande en el inicio.

## SEO incluido

- Páginas generadas en el servidor (Google lee todo sin ejecutar JavaScript).
- URLs legibles: `/autos/volkswagen-t-cross-highline-1-4-tsi-2022-9`. Si se edita marca o modelo, el link viejo redirige al nuevo.
- `<title>` y descripción propios en cada auto, con precio, km y ubicación (Toledo / Atlántida, Canelones).
- Datos estructurados schema.org: `AutoDealer` con los dos locales, `Car` + `Offer` en cada auto (precio, moneda, disponibilidad), `BreadcrumbList` e `ItemList` del catálogo.
- Open Graph con la foto del auto: el link compartido por WhatsApp/Facebook muestra la foto y el precio.
- `/sitemap.xml` (con las fotos) y `/robots.txt` automáticos. El admin no se indexa.
- Fuentes del diseño alojadas en la propia web, imágenes WebP con `srcset` y carga diferida.

**Cuando la web esté online:** dar de alta el dominio en [Google Search Console](https://search.google.com/search-console) y enviar `https://TU-DOMINIO/sitemap.xml`; y crear/vincular el perfil de Google Business de cada local con el link de la web (es lo que más pesa en búsquedas como "automotora Atlántida").

## Pasar a producción

1. Un servidor con disco persistente (VPS, Railway, Render con disco, Fly.io, etc.) — la base y las fotos viven en `data/` (o en `DATA_DIR`). **Respaldá esa carpeta.**
2. `.env` con `SITE_URL=https://tu-dominio`, `WHATSAPP_NUMBER=59899571202`, contraseña fuerte y `SESSION_SECRET`.
3. `npm install --omit=dev && NODE_ENV=production npm start` detrás de HTTPS.
4. Para arrancar sin los autos de ejemplo: no corras `npm run seed` (o borrá la carpeta `data/` antes de cargar los reales).
