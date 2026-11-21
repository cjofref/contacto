// E2E móvil con Playwright. Uso: BASE_URL=http://localhost:8000/ node test/e2e.mjs
// Corre en serie (un navegador, un viewport a la vez) para cuidar la RAM.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// `node --test` descubre todo test/*.mjs; el e2e necesita un servidor y se corre aparte.
if (process.env.NODE_TEST_CONTEXT) {
  console.log('e2e omitido bajo node --test: corré `node test/e2e.mjs` con un servidor local');
  process.exit(0);
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000/';
const ARTIFACTS = new URL('./artifacts/', import.meta.url).pathname;
const VCF_LOCAL = readFileSync(new URL('../contacto.vcf', import.meta.url));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const VIEWPORTS = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '360x640', width: 360, height: 640 },
];
const ACCIONES = ['Llamar', 'WhatsApp', 'Email', 'LinkedIn'];

mkdirSync(ARTIFACTS, { recursive: true });

const fallos = [];
const check = (ok, mensaje) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${mensaje}`);
  if (!ok) fallos.push(mensaje);
};

async function corrida(browser, vp, { sinFuentes }) {
  const etiqueta = `${vp.nombre}${sinFuentes ? ' sin-fuentes' : ''}`;
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  if (sinFuentes) {
    await page.route(/https?:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => route.abort());
  }
  await page.goto(BASE_URL, { waitUntil: 'load' });
  // Deja que el layout se estabilice (swap de fuentes) antes de medir.
  await page.evaluate(() => document.fonts.ready);

  // S-1 / S-4: sin scroll horizontal.
  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  check(scroll.sw <= scroll.cw, `[${etiqueta}] sin scroll horizontal (${scroll.sw} <= ${scroll.cw})`);

  // S-1: «Guardar contacto» visible sin scroll.
  const guardar = page.getByRole('link', { name: 'Guardar contacto' });
  const caja = await guardar.boundingBox();
  check(
    !!caja && caja.y >= 0 && caja.y + caja.height <= vp.height,
    `[${etiqueta}] «Guardar contacto» visible sin scroll (y=${caja && Math.round(caja.y)}, alto=${caja && Math.round(caja.height)}, viewport=${vp.height})`,
  );

  // S-4: acciones tocables y sin texto cortado.
  for (const nombre of ACCIONES) {
    const a = page.getByRole('link', { name: nombre, exact: true });
    const b = await a.boundingBox();
    check(!!b && b.width >= 48 && b.height >= 48, `[${etiqueta}] «${nombre}» >= 48x48 (${b && Math.round(b.width)}x${b && Math.round(b.height)})`);
    const corte = await a.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    check(corte.sw <= corte.cw, `[${etiqueta}] «${nombre}» sin texto cortado (${corte.sw} <= ${corte.cw})`);
  }

  if (sinFuentes) {
    // S-7: texto legible con la fuente de respaldo.
    const legible = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const estilo = getComputedStyle(h1);
      return {
        texto: h1.textContent.trim(),
        tamano: parseFloat(estilo.fontSize),
        visible: h1.getBoundingClientRect().width > 0,
        cargada: document.fonts.check('600 16px Poppins') && [...document.fonts].some((f) => f.status === 'loaded'),
      };
    });
    check(legible.texto.length > 0 && legible.visible && legible.tamano >= 16, `[${etiqueta}] título legible con fuente de respaldo (${legible.tamano}px)`);
    check(!legible.cargada, `[${etiqueta}] Google Fonts efectivamente bloqueado`);
  } else {
    // S-2: la descarga entrega contacto.vcf idéntico al del repo.
    const [descarga] = await Promise.all([page.waitForEvent('download'), guardar.click()]);
    check(descarga.suggestedFilename() === 'contacto.vcf', `[${etiqueta}] descarga se llama contacto.vcf (${descarga.suggestedFilename()})`);
    const ruta = await descarga.path();
    const bytes = await readFile(ruta);
    check(sha256(bytes) === sha256(VCF_LOCAL), `[${etiqueta}] sha256 de la descarga igual al del repo`);
  }

  await page.screenshot({ path: `${ARTIFACTS}landing-${vp.nombre}${sinFuentes ? '-sin-fuentes' : ''}.png`, fullPage: true });
  await context.close();
}

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    await corrida(browser, vp, { sinFuentes: false });
    await corrida(browser, vp, { sinFuentes: true });
  }
} finally {
  await browser.close();
}

if (fallos.length) {
  console.error(`\n${fallos.length} verificación(es) fallaron`);
  process.exit(1);
}
console.log('\ne2e ok');
