// Genera las 5 páginas por idioma desde templates/page.html e i18n/strings.json.
// Uso: node scripts/build-pages.mjs  (escribe index.html, es/, pt/, fr/ y zh/; la salida se versiona)
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Google Fonts solo donde aporta: el chino usa la pila del sistema (Montserrat y Lato no tienen
// glifos CJK) y así su primer pintado no depende de fonts.googleapis.com, poco fiable desde China.
const FUENTES = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Montserrat:wght@600;700;800&display=swap">
`;
const SIN_FUENTES = new Set(['zh-Hans']);

// Redirección por idioma, solo en la raíz (inglés). Orden: ?lang=xx, idioma guardado,
// navigator.languages (gana el primer prefijo soportado); sin coincidencia se queda en inglés.
function scriptRaiz(destinos) {
  return `  <script>
  (function () {
    var D = ${JSON.stringify(destinos)};
    var ok = function (c) { return Object.prototype.hasOwnProperty.call(D, c); };
    var l = (new URLSearchParams(location.search).get('lang') || '').toLowerCase().slice(0, 2);
    if (ok(l)) { try { localStorage.setItem('contacto.lang', l); } catch (e) { /* sin almacenamiento */ } }
    else { l = ''; try { l = localStorage.getItem('contacto.lang') || ''; } catch (e) { /* sin almacenamiento */ } }
    if (!ok(l)) {
      l = 'en';
      var L = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < L.length; i++) { var c = String(L[i]).toLowerCase().slice(0, 2); if (ok(c)) { l = c; break; } }
    }
    if (D[l]) location.replace(D[l]);
  })();
  </script>
`;
}

export function buildPages({
  strings = JSON.parse(readFileSync(join(RAIZ, 'i18n/strings.json'), 'utf8')),
  template = readFileSync(join(RAIZ, 'templates/page.html'), 'utf8'),
} = {}) {
  const { site, locales } = strings;
  const lista = Object.entries(locales).map(([hreflang, l]) => ({ hreflang, ...l }));
  const destinos = Object.fromEntries(lista.map((l) => [l.code, l.dir]));
  const paginas = new Map();

  for (const actual of lista) {
    const base = actual.dir ? '../' : '';
    // Enlace al inglés con ?lang=en para que la raíz no vuelva a redirigir.
    const hrefDe = (l) => (l.dir ? `${base}${l.dir}` : `${base || './'}?lang=en`);
    const otras = lista.filter((l) => l !== actual);
    const hreflang = [
      ...otras.map((l) => `  <link rel="alternate" hreflang="${esc(l.hreflang)}" href="${site}${l.dir}">\n`),
      `  <link rel="alternate" hreflang="x-default" href="${site}">\n`,
    ].join('');
    const langMenu = lista.map((l) => {
      const actualAttr = l === actual ? ' aria-current="true"' : '';
      return `          <li><a href="${esc(hrefDe(l))}" hreflang="${esc(l.hreflang)}" lang="${esc(l.htmlLang)}" data-lang="${esc(l.code)}"${actualAttr}><span class="fl" aria-hidden="true">${esc(l.flag)}</span><span>${esc(l.name)}</span></a></li>\n`;
    }).join('');

    const vars = {
      ...Object.fromEntries(Object.entries(actual).map(([k, v]) => [k, esc(v)])),
      base,
      site,
      pageUrl: `${site}${actual.dir}`,
      waText: esc(encodeURIComponent(actual.wa)),
      hreflang,
      langMenu,
      rootScript: actual.dir ? '' : scriptRaiz(destinos),
      fonts: SIN_FUENTES.has(actual.hreflang) ? '' : FUENTES,
    };
    const html = template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (!(k in vars)) throw new Error(`plantilla: falta el valor {{${k}}} para ${actual.hreflang}`);
      return vars[k];
    });
    paginas.set(`${actual.dir}index.html`, html);
  }
  return paginas;
}

// realpathSync: con una ruta por symlink argv[1] no coincide y el script saldría 0 sin escribir.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  for (const [ruta, html] of buildPages()) {
    const destino = join(RAIZ, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, html);
    console.log(`escrito ${ruta}`);
  }
}
