# NFC Contact

Landing de Monitor One para la tarjeta NFC de Cristóbal Jofré. Al tocar el tag con un teléfono se abre `https://cjofref.github.io/contacto/`, que presenta a Monitor One en cinco idiomas (inglés en la raíz, `/es/`, `/pt/`, `/fr/`, `/zh/`) y permite guardar el contacto (`contacto.vcf`, vCard 3.0) en iPhone y Android. Es un sitio estático en GitHub Pages.

## Requisitos

Node 22 o superior. Las dependencias solo sirven para el e2e (`npm install` instala Playwright).

## Editar los datos

- **Datos del contacto**: edita `contacto.vcf` (finales de línea CRLF, líneas de 75 octetos como máximo) y valídalo:

  ```sh
  node scripts/validate-vcard.mjs contacto.vcf
  ```

- **Textos de las páginas** (cargo, botones, pitch, módulos, mensaje de WhatsApp, ID de WeChat): edita `i18n/strings.json` y regenera las cinco páginas:

  ```sh
  node scripts/build-pages.mjs
  ```

  Las páginas generadas se versionan: haz commit de ellas junto con el cambio.

- **Foto del contacto**: la foto es `assets/vcard-photo.png`. Para reembeberla en `contacto.vcf` (es idempotente):

  ```sh
  node scripts/embed-vcard-photo.mjs
  ```

Publicar es hacer `git push origin main`: GitHub Pages sirve la raíz de `main`.

## Pruebas

```sh
node --test
```

Cubre el vCard, el generador, el HTML (enlaces, colores, contraste, peso menor a 300 KB) y los estilos. El e2e móvil necesita un servidor local y Chromium:

```sh
npx playwright install chromium
python3 -m http.server 8000 &
BASE_URL=http://localhost:8000/ node test/e2e.mjs
```

Contra el sitio publicado: `BASE_URL=https://cjofref.github.io/contacto/ node test/e2e.mjs`.

## Grabar el tag NFC

Sigue [docs/nfc-grabado.md](docs/nfc-grabado.md): URL exacta, tipo de tag, pasos con NFC Tools y la regla de no bloquear el tag antes de probarlo en iPhone y Android.

## Más documentación

- [docs/adr/](docs/adr/): decisiones de diseño.
- [docs/arq/](docs/arq/): arquitectura.
- [CHANGELOG.md](CHANGELOG.md): cambios por versión.
