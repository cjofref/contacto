import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
