import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, symlinkSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildPages } from '../scripts/build-pages.mjs';

const raiz = new URL('../', import.meta.url).pathname;

test('el generador produce exactamente las 5 páginas por idioma', () => {
  const rutas = [...buildPages().keys()].sort();
  assert.deepEqual(rutas, ['es/index.html', 'fr/index.html', 'index.html', 'pt/index.html', 'zh/index.html']);
});

test('las páginas versionadas son idénticas a lo que genera build-pages.mjs', () => {
  for (const [ruta, html] of buildPages()) {
    const archivo = join(raiz, ruta);
    assert.ok(existsSync(archivo), `falta ${ruta}: corré node scripts/build-pages.mjs`);
    assert.equal(readFileSync(archivo, 'utf8'), html, `${ruta} está desincronizada: corré node scripts/build-pages.mjs`);
  }
});

test('una clave que falta en strings.json hace fallar el generador', () => {
  const strings = JSON.parse(readFileSync(join(raiz, 'i18n/strings.json'), 'utf8'));
  delete strings.locales.fr.save;
  assert.throws(() => buildPages({ strings }), /\{\{save\}\}/);
});

test('los textos y campos de strings.json se escapan al entrar al HTML', () => {
  const strings = JSON.parse(readFileSync(join(raiz, 'i18n/strings.json'), 'utf8'));
  const fr = strings.locales.fr;
  fr.save = 'Guardar "ya" & <b>';
  fr.flag = '"&';
  fr.code = 'f"r';
  fr.htmlLang = 'fr&"';
  const paginas = buildPages({ strings });
  const html = paginas.get('fr/index.html');
  assert.match(html, /Guardar &quot;ya&quot; &amp; &lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
  for (const [ruta, h] of paginas) {
    assert.match(h, /<span class="fl" aria-hidden="true">&quot;&amp;<\/span>/, `flag sin escapar en ${ruta}`);
    assert.match(h, /data-lang="f&quot;r"/, `code sin escapar en ${ruta}`);
    assert.match(h, /lang="fr&amp;&quot;" data-lang/, `htmlLang sin escapar en ${ruta}`);
  }
});

test('el hreflang de strings.json se escapa en los alternos y el selector', () => {
  const strings = JSON.parse(readFileSync(join(raiz, 'i18n/strings.json'), 'utf8'));
  const { fr } = strings.locales;
  delete strings.locales.fr;
  strings.locales['fr"&'] = fr;
  const html = buildPages({ strings }).get('index.html');
  assert.match(html, /<link rel="alternate" hreflang="fr&quot;&amp;"/);
  assert.match(html, /hreflang="fr&quot;&amp;" lang=/);
});

test('el script se ejecuta igual si se invoca por una ruta con symlink', () => {
  // Copia aislada del generador: así la prueba no reescribe las páginas del repo mientras
  // otros archivos de test las leen en paralelo.
  const dir = mkdtempSync(join(tmpdir(), 'build-pages-'));
  try {
    for (const f of ['scripts/build-pages.mjs', 'templates/page.html', 'i18n/strings.json']) {
      cpSync(join(raiz, f), join(dir, 'repo', f));
    }
    const enlace = join(dir, 'build-pages.mjs');
    symlinkSync(join(dir, 'repo/scripts/build-pages.mjs'), enlace);
    const salida = execFileSync(process.execPath, [enlace], { encoding: 'utf8' });
    assert.match(salida, /escrito index\.html/);
    assert.ok(existsSync(join(dir, 'repo/zh/index.html')), 'no escribió zh/index.html');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
