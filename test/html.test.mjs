import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const raiz = new URL('../', import.meta.url).pathname;
const { site, locales } = JSON.parse(readFileSync(join(raiz, 'i18n/strings.json'), 'utf8'));
const PAGINAS = Object.entries(locales).map(([hreflang, l]) => ({
  hreflang,
  ...l,
  ruta: `${l.dir}index.html`,
  html: readFileSync(join(raiz, l.dir, 'index.html'), 'utf8'),
}));

const PIPEDRIVE = 'https://webforms.pipedrive.com/f/6UOYm0kTDVL0YsV8SFnOzsSKA5bwGdbyJkvX5kAbAUHXz0dJSshwb9aM14NiE6BILF';

// Resuelve una referencia local relativa a la carpeta de su página (como el navegador).
function resuelve(rutaPagina, ref) {
  return join(raiz, dirname(rutaPagina), ref.replace(/[?#].*$/, ''));
}

const refsLocales = (html) => [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)]
  .map((m) => m[1].replace(/&amp;/g, '&'))
  .filter((r) => !/^(https?:|tel:|mailto:|#|data:)/.test(r));

const anclas = (html) => [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);

test('el resolvedor de rutas distingue la carpeta de cada página', () => {
  assert.ok(existsSync(resuelve('es/index.html', '../css/styles.css')));
  assert.ok(!existsSync(resuelve('es/index.html', 'css/styles.css')), 'una subpágina sin ../ debe fallar');
});

for (const p of PAGINAS) {
  test(`[${p.ruta}] todos los href/src locales existen relativos a su carpeta`, () => {
    const refs = refsLocales(p.html);
    assert.ok(refs.length >= 5, 'no se encontraron referencias locales');
    for (const ref of refs) {
      assert.ok(existsSync(resuelve(p.ruta, ref)), `no existe ${ref} desde ${p.ruta}`);
      if (p.dir) assert.ok(ref.startsWith('../'), `en ${p.ruta} la ruta ${ref} debe subir con ../`);
    }
  });

  test(`[${p.ruta}] lang, viewport, hreflang de las otras cuatro y x-default`, () => {
    assert.match(p.html, new RegExp(`<html lang="${p.htmlLang}">`));
    assert.match(p.html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    const alternos = [...p.html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
      .map((m) => `${m[1]} ${m[2]}`).sort();
    const esperados = [
      ...PAGINAS.filter((o) => o !== p).map((o) => `${o.hreflang} ${site}${o.dir}`),
      `x-default ${site}`,
    ].sort();
    assert.deepEqual(alternos, esperados);
    assert.match(p.html, new RegExp(`<meta property="og:url" content="${site}${p.dir}">`));
  });

  test(`[${p.ruta}] botones de contacto, WhatsApp del idioma y demo`, () => {
    const a = anclas(p.html);
    const base = p.dir ? '../' : '';
    assert.ok(a.some((t) => t.includes(`href="${base}contacto.vcf"`) && /\bdownload\b/.test(t)), 'falta Guardar contacto con download');
    assert.ok(a.some((t) => t.includes('href="tel:+56931929011"')), 'falta tel:');
    assert.ok(a.some((t) => t.includes('href="mailto:cjofre@monitorone.com"')), 'falta mailto:');
    assert.ok(a.some((t) => t.includes('href="https://www.linkedin.com/in/cristobaljofre"')), 'falta LinkedIn');
    const wa = `https://wa.me/56931929011?text=${encodeURIComponent(p.wa)}`;
    assert.ok(a.some((t) => t.includes(`href="${wa}"`)), `WhatsApp sin el mensaje de ${p.hreflang}`);
    assert.ok(a.some((t) => t.includes(`href="${PIPEDRIVE}"`) && t.includes('target="_blank"') && t.includes('rel="noopener"')), 'falta la demo con target y rel');
  });

  test(`[${p.ruta}] sin teléfono ni correo como texto visible`, () => {
    const visible = p.html
      .replace(/<head>[\s\S]*<\/head>/, '')
      .replace(/<script>[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(visible, /56931929011|9\s?3192\s?9011|cjofre@/);
  });

  test(`[${p.ruta}] selector con las 5 páginas y la actual marcada`, () => {
    const links = anclas(p.html).filter((t) => t.includes('data-lang='));
    assert.equal(links.length, 5);
    const actual = links.filter((t) => t.includes('aria-current="true"'));
    assert.equal(actual.length, 1);
    assert.match(actual[0], new RegExp(`data-lang="${p.code}"`));
    const ingles = links.find((t) => t.includes('data-lang="en"'));
    assert.match(ingles, /href="(\.\.\/|\.\/)\?lang=en"/, 'el enlace al inglés lleva ?lang=en');
    for (const t of links) {
      const href = t.match(/href="([^"]+)"/)[1];
      assert.ok(existsSync(join(resuelve(p.ruta, href), 'index.html')), `el enlace ${href} no lleva a una página`);
    }
  });

  test(`[${p.ruta}] solo la raíz redirige; todas recuerdan el idioma`, () => {
    assert.equal(/location\.replace/.test(p.html), p.dir === '', 'location.replace solo en la raíz');
    assert.match(p.html, /localStorage\.setItem\('lang'/);
    assert.match(p.html, /try\s*\{\s*localStorage/);
  });
}

function pesoDir(dir) {
  let total = 0;
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    total += statSync(ruta).isDirectory() ? pesoDir(ruta) : statSync(ruta).size;
  }
  return total;
}

test('cada página con CSS e imágenes pesa < 300 KB', () => {
  const comun = pesoDir(join(raiz, 'css')) + pesoDir(join(raiz, 'assets'));
  for (const p of PAGINAS) {
    const total = Buffer.byteLength(p.html) + comun;
    assert.ok(total < 300 * 1024, `${p.ruta} pesa ${total} bytes`);
  }
});
