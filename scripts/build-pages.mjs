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

const WECHAT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 4C5.4 4 2 6.7 2 10.2c0 2 1.1 3.7 2.8 4.8L4 18l3.1-1.6c.8.2 1.6.3 2.4.3"/><path d="M22 14.5c0-2.8-2.7-5-6-5s-6 2.2-6 5 2.7 5 6 5c.7 0 1.4-.1 2-.3l3 .8-.9-2.6c1.1-.9 1.9-2 1.9-2.9z"/></svg>';

export function buildPages({
  strings = JSON.parse(readFileSync(join(RAIZ, 'i18n/strings.json'), 'utf8')),
  template = readFileSync(join(RAIZ, 'templates/page.html'), 'utf8'),
} = {}) {
  const { site, wechatId, locales } = strings;
  if (!wechatId) throw new Error('strings.json: falta wechatId');
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

    // WeChat: botón ancho solo donde wechatWide (zh-Hans); en las demás, cuarto círculo. {id} sale de wechatId.
    const conId = (t) => String(t).replaceAll('{id}', wechatId);
    const ancho = actual.wechatWide === true;
    const wechatWide = ancho
      ? `        <a class="btn btn-wa btn-wechat" href="weixin://" data-wechat aria-label="${esc(conId(actual.wechatAria))}">\n          ${WECHAT_SVG}\n          <span aria-hidden="true">${esc(actual.wechat)} · ${esc(wechatId)}</span>\n        </a>\n`
      : '';
    const wechatCircle = ancho
      ? ''
      : `          <li><a class="circle" href="weixin://" data-wechat aria-label="${esc(conId(actual.wechatAria))}">${WECHAT_SVG}</a></li>\n`;

    const vars = {
      ...Object.fromEntries(Object.entries(actual).map(([k, v]) => [k, esc(v)])),
      base,
      site,
      pageUrl: `${site}${actual.dir}`,
      wechatWide,
      wechatCircle,
      wechatId: esc(wechatId),
      wechatCopied: esc(conId(actual.wechatCopied)),
      wechatManual: esc(conId(actual.wechatManual)),
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
