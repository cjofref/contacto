# ADR-0001: Sitio estático en GitHub Pages con vCard 3.0 y generador versionado

- **Fecha**: 2026-11-21
- **Estado**: accepted
- **Plan**: nfc-landing-m1

## Contexto
La tarjeta NFC de Cristóbal Jofré debe abrir, al tocarla con un teléfono, una página rápida que presente a Monitor One y deje guardar el contacto en dos toques en iPhone y Android. La URL queda grabada en el tag, así que tiene que ser estable y gratuita de mantener. Las personas que reciben la tarjeta hablan inglés, español, portugués, francés o chino.

## Opciones consideradas
1. **Sitio estático en GitHub Pages (`cjofref.github.io/contacto/`)** — gratis, sin servidor, publica con `git push`; la URL depende del repo.
2. **Framework (Next, Astro) con build en CI** — más cómodo para plantillas, pero agrega dependencias, pipeline y superficie de fallo para un sitio de 5 páginas.
3. **Servicio de tarjetas digitales de terceros** — rápido, pero sin control del contacto ni de la marca, y con costo recurrente.

## Decisión
HTML y CSS estáticos publicados con GitHub Pages desde `main` (raíz), con un `contacto.vcf` vCard 3.0 servido como archivo. Sin framework ni analytics. Las pruebas usan `node:test` sin dependencias; Playwright solo para el e2e móvil (`test/e2e.mjs`).

Detalles que fija esta decisión:

- **Generador**: `scripts/build-pages.mjs` (Node, sin dependencias) produce las páginas desde `templates/page.html` y `i18n/strings.json`. La salida generada se **versiona**, de modo que Pages sirve archivos tal cual y `test/build.test.mjs` falla si lo versionado difiere de lo generado.
- **5 páginas por idioma**: inglés en la raíz (`/`) y `/es/`, `/pt/`, `/fr/`, `/zh/`, con `hreflang` cruzados y `x-default` hacia la raíz. El selector de idioma es un `<details>` con enlaces reales: funciona sin JavaScript.
- **Excepciones al «sin JavaScript»**, todas mínimas:
  1. En todas las páginas, recordar el idioma elegido en `localStorage` (clave `contacto.lang`, dentro de `try/catch`).
  2. Solo en la raíz, una redirección por idioma (`?lang=xx`, luego el idioma guardado, luego `navigator.languages`; `location.replace`; inglés por defecto).
  3. Copiado del ID de WeChat (`cjofre13`) al portapapeles con un aviso en el idioma de la página, antes de abrir la app; sin JavaScript el enlace `weixin://` abre WeChat igual.
- **Google Fonts** (Montserrat y Lato) se carga en inglés, español, portugués y francés; en chino se usa la pila de fuentes del sistema. Limitación aceptada: en los otros cuatro idiomas una petición colgada a `fonts.googleapis.com` puede retrasar el primer pintado, porque la hoja bloquea el renderizado; `display=swap` solo cubre los archivos de fuente.
- **vCard 3.0 único** para todos los idiomas, con el cargo («General Manager») en inglés. WeChat va como URL `weixin://dl/chat?cjofre13` con etiqueta «WeChat»; LinkedIn va solo como perfil social (`X-SOCIALPROFILE`): el iPhone lo muestra, Android lo ignora y se aceptó que ahí no aparezca.
- **Foto embebida**: el contacto lleva el logo de Monitor One como `PHOTO` PNG de 300×300 (menos de 30 KB), generada por `scripts/embed-vcard-photo.mjs`, que es idempotente.
- **Zona horaria descartada** por decisión de la persona: ningún teléfono la muestra y un desfase fijo quedaría mal la mitad del año en Santiago.

## Justificación
Un tag NFC necesita una URL que no caduque y un destino que cargue en 4G (la página pesa menos de 300 KB, fijado por pruebas). GitHub Pages cumple ambas con costo cero y revertir es un `git revert`. Versionar la salida del generador evita un paso de CI y deja el sitio verificable con archivos locales. Un solo vCard evita que los idiomas se desincronicen.

## Consecuencias
- Cambiar un dato exige editar `contacto.vcf` o `i18n/strings.json`, regenerar y hacer push; no hay panel.
- La URL del tag depende del repo `cjofref/contacto`: renombrarlo rompe los tags ya grabados.
- El origen `cjofref.github.io` se comparte con otros sitios de la cuenta; por eso la clave de `localStorage` lleva el prefijo `contacto.`.
- Los datos del vCard son públicos: solo se publican datos profesionales.
- LinkedIn no se ve en Android y WeChat no permite agregar por ID desde un enlace web: el botón abre la app con el ID copiado.
