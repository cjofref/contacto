# Arquitectura v0.1.0 — NFC Contact

Documento en markdown con diagramas mermaid; la versión LaTeX queda pendiente. Decisiones en [ADR-0001](../adr/ADR-0001-sitio-estatico-github-pages.md).

## 1. HLD

**Qué es**: un sitio estático que un tag NFC abre y que entrega el contacto de Cristóbal Jofré. **Actores**: quien toca la tarjeta (iPhone o Android), Cristóbal (edita datos y publica) y GitHub Pages (hosting).

```mermaid
flowchart LR
  Persona([Persona con teléfono]) -->|toca| Tag[Tag NFC con la URL]
  Tag --> Pages[GitHub Pages<br/>cjofref.github.io/contacto]
  Persona --> Pages
  Pages -->|fuentes| GF[Google Fonts]
  Pages -->|contacto.vcf| Agenda[Agenda del teléfono]
  Pages -->|weixin://, wa.me, tel:, mailto:| Apps[WeChat, WhatsApp, teléfono, correo]
  Pages -->|Solicita tu demo| PD[Formulario Pipedrive]
```

Decisiones macro: sitio estático sin framework ni analytics, generador versionado, vCard 3.0 único (ADR-0001).

## 2. LLD

| Módulo | Ruta | Función |
|---|---|---|
| Datos de textos | `i18n/strings.json` | Fuente única de las 5 páginas (`en`, `es`, `pt-BR`, `fr`, `zh-Hans`) y de `wechatId` |
| Plantilla | `templates/page.html` | HTML con claves `{{…}}` y los scripts mínimos |
| Generador | `scripts/build-pages.mjs` | `buildPages({strings, template})` devuelve ruta→HTML; falla si falta una clave; escribe las páginas |
| Contacto | `contacto.vcf` | vCard 3.0: N, FN, ORG, TITLE, TEL, EMAIL, URL, WeChat, X-SOCIALPROFILE, ADR, PHOTO |
| Validador | `scripts/validate-vcard.mjs` | Exige CRLF, FN, TEL y líneas de 75 octetos como máximo; `test/vcard.test.mjs` fija además WeChat, LinkedIn y la ausencia de `TZ` |
| Foto | `scripts/embed-vcard-photo.mjs` | Embebe `assets/vcard-photo.png` en `PHOTO` (idempotente) |
| Estilos | `css/styles.css` | Tema oscuro con variables `--mo-*` |
| Pruebas | `test/*.test.mjs`, `test/e2e.mjs` | `node:test` y Playwright móvil (390×844 y 360×640) |

Páginas generadas: `index.html`, `es/index.html`, `pt/index.html`, `fr/index.html`, `zh/index.html`.

## 3. Flujos

Ver [docs/diagrams/landing-nfc.md](../diagrams/landing-nfc.md). Regla de idioma en la raíz: `?lang=xx` válido, si no el idioma guardado en `contacto.lang`, si no el primer idioma soportado de `navigator.languages` (`zh-TW` y `zh-HK` van a `/zh/`), si no inglés.

```mermaid
flowchart TD
  A[Abre la raíz] --> B{¿?lang válido?}
  B -- sí --> C[Guardar y usar]
  B -- no --> D{¿Idioma guardado?}
  D -- sí --> C
  D -- no --> E{¿navigator.languages tiene es, pt, fr o zh?}
  E -- sí --> F[Ir a esa página con location.replace]
  E -- no --> G[Quedarse en inglés]
  C --> H{¿Es inglés?}
  H -- no --> F
  H -- sí --> G
```

## 4. Interacción entre componentes

Edición: `i18n/strings.json` + `templates/page.html` → `scripts/build-pages.mjs` → 5 páginas versionadas → `git push origin main` → GitHub Pages. Botón de WeChat: el clic copia `cjofre13` al portapapeles, muestra un aviso en el idioma de la página y navega a `weixin://dl/chat?cjofre13`; si el portapapeles falla, el aviso queda con «Abrir WeChat».

## 5. Tecnología (capas Technology y Application)

- Hosting: GitHub Pages desde `main`, raíz, con HTTPS; `contacto.vcf` se sirve como `text/x-vcard`.
- Dependencias de entrega: Google Fonts (no en chino). Sin base de datos, sin servidor propio, sin API.
- Peso: cada página con CSS y assets, menos de 300 KB (prueba HTML).

## 6. Schema de BD

No aplica: el sitio no tiene base de datos.

## 7. Seguridad

- Superficie: solo archivos estáticos públicos; sin formularios propios ni secretos.
- Los datos del vCard (celular, correo corporativo, web, WeChat, LinkedIn) son profesionales y públicos; no se publican dirección ni cumpleaños.
- Los enlaces externos del botón de demo llevan `target="_blank" rel="noopener"`.
- `localStorage` guarda solo el código de idioma bajo la clave `contacto.lang`, con `try/catch`.
- El tag NFC no se bloquea hasta probarlo en iPhone y Android ([docs/nfc-grabado.md](../nfc-grabado.md)).
