// E2E móvil con Playwright. Uso: BASE_URL=http://localhost:8000/ node test/e2e.mjs
// Corre en serie (un navegador, un contexto a la vez) para cuidar la RAM.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// `node --test` descubre todo test/*.mjs; el e2e necesita un servidor y se corre aparte.
if (process.env.NODE_TEST_CONTEXT) {
  console.log('e2e omitido bajo node --test: corré `node test/e2e.mjs` con un servidor local');
  process.exit(0);
}

const BASE_URL = new URL(process.env.BASE_URL || 'http://localhost:8000/');
const ARTIFACTS = new URL('./artifacts/', import.meta.url).pathname;
const VCF_LOCAL = readFileSync(new URL('../contacto.vcf', import.meta.url));
const { locales } = JSON.parse(readFileSync(new URL('../i18n/strings.json', import.meta.url), 'utf8'));
const PAGINAS = Object.values(locales);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const urlDe = (dir) => new URL(dir, BASE_URL).href;
const sinQuery = (u) => { const x = new URL(u); return x.origin + x.pathname; };

const VIEWPORTS = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '360x640', width: 360, height: 640 },
];

mkdirSync(ARTIFACTS, { recursive: true });

const fallos = [];
const check = (ok, mensaje) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${mensaje}`);
  if (!ok) fallos.push(mensaje);
};

const nuevoContexto = (browser, { vp = VIEWPORTS[0], locale = 'en-US', idiomas } = {}) => browser.newContext({
  viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  locale,
}).then(async (ctx) => {
  if (idiomas) {
    await ctx.addInitScript((lista) => {
      Object.defineProperty(Navigator.prototype, 'languages', { get: () => lista });
      Object.defineProperty(Navigator.prototype, 'language', { get: () => lista[0] });
    }, idiomas);
  }
  return ctx;
});

// Abre la raíz y espera a que termine la redirección (si la hay).
async function abreRaiz(page, url = BASE_URL.href) {
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForLoadState('load');
  await page.waitForTimeout(400);
  await page.waitForLoadState('load');
  return sinQuery(page.url());
}

// S-10: redirección por idioma desde la raíz.
async function redireccion(browser) {
  const casos = [
    ['es-CL', 'es/'], ['en-US', ''], ['pt-BR', 'pt/'], ['fr-FR', 'fr/'],
    ['zh-CN', 'zh/'], ['zh-TW', 'zh/'], ['de-DE', ''], ['ja-JP', ''], ['it-IT', ''],
  ];
  for (const [locale, dir] of casos) {
    const ctx = await nuevoContexto(browser, { locale });
    const page = await ctx.newPage();
    const final = await abreRaiz(page);
    check(final === urlDe(dir), `[${locale}] raíz → /${dir} (${final})`);
    await ctx.close();
  }

  const ctx = await nuevoContexto(browser, { locale: 'de-DE', idiomas: ['de-DE', 'fr-FR'] });
  const page = await ctx.newPage();
  const final = await abreRaiz(page);
  check(final === urlDe('fr/'), `[de-DE, fr-FR] gana el primero soportado → /fr/ (${final})`);
  await ctx.close();

  // R-12: ?lang= soportado se acepta y se recuerda.
  const ctxFr = await nuevoContexto(browser, { locale: 'en-US' });
  const pageFr = await ctxFr.newPage();
  const conQuery = await abreRaiz(pageFr, urlDe('?lang=fr'));
  check(conQuery === urlDe('fr/'), `[en-US ?lang=fr] raíz → /fr/ (${conQuery})`);
  const vuelta = await abreRaiz(pageFr);
  check(vuelta === urlDe('fr/'), `[en-US ?lang=fr] al volver a / recuerda /fr/ (${vuelta})`);
  await ctxFr.close();

  // R-12: ?lang= no soportado se ignora (ni redirige ni se guarda) y decide el navegador.
  const ctxDe = await nuevoContexto(browser, { locale: 'es-CL' });
  const pageDe = await ctxDe.newPage();
  const ignorado = await abreRaiz(pageDe, urlDe('?lang=de'));
  check(ignorado === urlDe('es/'), `[es-CL ?lang=de] se ignora y sigue al navegador → /es/ (${ignorado})`);
  const guardado = await pageDe.evaluate(() => localStorage.getItem('contacto.lang'));
  check(guardado === null, `[es-CL ?lang=de] no se guarda (${guardado})`);
  await ctxDe.close();

  // R-12: un valor guardado inválido se descarta y decide el navegador.
  const ctxMal = await nuevoContexto(browser, { locale: 'es-CL' });
  await ctxMal.addInitScript(() => { try { localStorage.setItem('contacto.lang', 'xx'); } catch (e) { /* sin almacenamiento */ } });
  const pageMal = await ctxMal.newPage();
  const invalido = await abreRaiz(pageMal);
  check(invalido === urlDe('es/'), `[es-CL guardado=xx] se descarta → /es/ (${invalido})`);
  await ctxMal.close();
}

// S-10: elegir English desde /es/ se recuerda y la raíz no devuelve a /es/.
async function recuerdo(browser) {
  const ctx = await nuevoContexto(browser, { locale: 'es-CL' });
  const page = await ctx.newPage();
  check((await abreRaiz(page)) === urlDe('es/'), '[recuerdo] es-CL entra a /es/');
  await page.locator('.lang summary').click();
  const ingles = page.locator('.lang .menu a[data-lang="en"]');
  check(await ingles.isVisible(), '[recuerdo] el desplegable se abre y muestra English');
  await Promise.all([page.waitForURL((u) => sinQuery(u.href) === BASE_URL.href), ingles.click()]);
  await page.waitForTimeout(400);
  check(sinQuery(page.url()) === BASE_URL.href, `[recuerdo] tras elegir English queda en la raíz (${page.url()})`);
  const recargada = await abreRaiz(page);
  check(recargada === BASE_URL.href, `[recuerdo] al recargar / se queda en inglés (${recargada})`);
  check((await page.locator('html').getAttribute('lang')) === 'en', '[recuerdo] la raíz está en inglés');
  await ctx.close();
}

async function pagina(browser, p, vp, { sinFuentes = false } = {}) {
  const etiqueta = `${p.dir || '/'} ${vp.nombre}${sinFuentes ? ' sin-fuentes' : ''}`;
  const ctx = await nuevoContexto(browser, { vp, locale: 'en-US' });
  const page = await ctx.newPage();
  if (sinFuentes) await page.route(/https?:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => r.abort());
  await page.goto(p.dir ? urlDe(p.dir) : urlDe('?lang=en'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  check((await page.locator('html').getAttribute('lang')) === p.htmlLang, `[${etiqueta}] lang=${p.htmlLang}`);

  const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(scroll.sw <= scroll.cw, `[${etiqueta}] sin scroll horizontal (${scroll.sw} <= ${scroll.cw})`);

  // .card-page recorta con overflow: hidden, así que un desborde no suma a scrollWidth: se mide
  // el texto de cada pieza (Range) contra el borde derecho de .gutter. kicker y hl van sin cortes de línea.
  const bordes = await page.evaluate(() => {
    const borde = document.querySelector('.gutter').getBoundingClientRect().right;
    return ['.kicker', '.hl', '.btn-primary', '.demo .btn'].map((sel) => {
      const el = document.querySelector(sel);
      const rango = document.createRange();
      rango.selectNodeContents(el);
      return { sel, borde, right: Math.max(el.getBoundingClientRect().right, rango.getBoundingClientRect().right) };
    });
  });
  for (const b of bordes) {
    check(b.right <= b.borde + 0.5, `[${etiqueta}] ${b.sel} dentro de .gutter (${Math.round(b.right)} <= ${Math.round(b.borde)})`);
  }

  const guardar = page.getByRole('link', { name: p.save, exact: true });
  const caja = await guardar.boundingBox();
  check(!!caja && caja.y >= 0 && caja.y + caja.height <= vp.height,
    `[${etiqueta}] «${p.save}» visible sin scroll (y=${caja && Math.round(caja.y)}, viewport=${vp.height})`);

  for (const nombre of ['WhatsApp', p.call, p.mail, 'LinkedIn']) {
    const a = page.getByRole('link', { name: nombre, exact: true });
    const b = await a.boundingBox();
    check(!!b && b.width >= 48 && b.height >= 48, `[${etiqueta}] «${nombre}» >= 48x48 (${b && Math.round(b.width)}x${b && Math.round(b.height)})`);
    const corte = await a.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    check(corte.sw <= corte.cw, `[${etiqueta}] «${nombre}» sin texto cortado`);
  }

  const fondo = await page.evaluate(() => getComputedStyle(document.querySelector('.nodes')).backgroundImage);
  check(fondo.includes('nodos.webp'), `[${etiqueta}] fondo con nodos.webp`);

  if (sinFuentes) {
    // S-7: texto legible con la fuente de respaldo y Montserrat realmente sin cargar.
    const r = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return {
        tamano: parseFloat(getComputedStyle(h1).fontSize),
        visible: h1.getBoundingClientRect().width > 0 && h1.textContent.trim().length > 0,
        cargada: [...document.fonts].some((f) => f.family.includes('Montserrat') && f.status === 'loaded'),
      };
    });
    check(r.visible && r.tamano >= 16, `[${etiqueta}] título legible con fuente de respaldo (${r.tamano}px)`);
    check(!r.cargada, `[${etiqueta}] Montserrat efectivamente bloqueada`);
  } else {
    // Desplegable: abre y cada opción es tocable.
    await page.locator('.lang summary').click();
    const opciones = page.locator('.lang .menu a');
    check((await opciones.count()) === 5 && (await opciones.first().isVisible()), `[${etiqueta}] desplegable abierto con 5 idiomas`);
    for (const caja5 of await Promise.all((await opciones.all()).map((o) => o.boundingBox()))) {
      check(!!caja5 && caja5.height >= 48, `[${etiqueta}] opción del menú >= 48 px de alto`);
    }
    const resumen = await page.locator('.lang summary').boundingBox();
    check(resumen.height >= 48 && resumen.width >= 48, `[${etiqueta}] botón del selector >= 48x48`);
    if (vp === VIEWPORTS[0]) {
      await page.screenshot({ path: `${ARTIFACTS}menu-${p.code}-${vp.nombre}.png` });
    }
    await page.locator('.lang summary').click();

    // S-2: la descarga entrega contacto.vcf idéntico al del repo.
    const [descarga] = await Promise.all([page.waitForEvent('download'), guardar.click()]);
    check(descarga.suggestedFilename() === 'contacto.vcf', `[${etiqueta}] descarga contacto.vcf`);
    check(sha256(await readFile(await descarga.path())) === sha256(VCF_LOCAL), `[${etiqueta}] sha256 de la descarga igual al del repo`);
  }

  await page.screenshot({ path: `${ARTIFACTS}landing-${p.code}-${vp.nombre}${sinFuentes ? '-sin-fuentes' : ''}.png`, fullPage: true });
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await redireccion(browser);
  await recuerdo(browser);
  for (const vp of VIEWPORTS) {
    for (const p of PAGINAS) await pagina(browser, p, vp);
    for (const p of PAGINAS.filter((x) => x.code === 'en' || x.code === 'zh')) await pagina(browser, p, vp, { sinFuentes: true });
  }
} finally {
  await browser.close();
}

if (fallos.length) {
  console.error(`\n${fallos.length} verificación(es) fallaron`);
  process.exit(1);
}
console.log('\ne2e ok');
