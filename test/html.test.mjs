import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const raiz = new URL('../', import.meta.url).pathname;
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const css = readFileSync(join(raiz, 'css/styles.css'), 'utf8');

const NAVY = '#01253f';
const TEAL = '#10c1c5';

// Colores permitidos (CA-3): paleta M1, blanco, fondo y grises BS5 de la guía.
const PERMITIDOS = new Set([
  NAVY, TEAL, '#87c78d', '#383838', '#fff', '#ffffff', '#f8f9fa',
  '#e9ecef', '#dee2e6', '#6c757d',
]);
const PERMITIDO_RGBA = 'rgba(0,0,0,0.075)';

function normalizaHex(h) {
  return h.toLowerCase();
}

function luminancia(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const canal = (i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

test('todos los href/src locales existen', () => {
  const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const locales = refs.filter((r) => !/^(https?:|tel:|mailto:|#|data:)/.test(r));
  assert.ok(locales.length > 0, 'no se encontraron referencias locales');
  for (const ref of locales) {
    assert.ok(existsSync(join(raiz, ref)), `no existe ${ref}`);
  }
});

test('enlaces de contacto: tel, mailto y contacto.vcf con download', () => {
  assert.match(html, /href="tel:\+56931929011"/);
  assert.match(html, /href="mailto:cjofre@monitorone\.com"/);
  assert.match(html, /<a\b[^>]*href="contacto\.vcf"[^>]*\bdownload\b/);
});

test('meta viewport presente', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});

function pesoDir(dir) {
  let total = 0;
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    total += statSync(ruta).isDirectory() ? pesoDir(ruta) : statSync(ruta).size;
  }
  return total;
}

test('peso de index.html + css/ + assets/ < 300 KB', () => {
  const total = statSync(join(raiz, 'index.html')).size + pesoDir(join(raiz, 'css')) + pesoDir(join(raiz, 'assets'));
  assert.ok(total < 300 * 1024, `pesa ${total} bytes`);
});

test('todo color de css/styles.css pertenece a la lista permitida', () => {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = [...sinComentarios.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => normalizaHex(m[0]));
  assert.ok(hex.length > 0);
  for (const c of hex) assert.ok(PERMITIDOS.has(c), `color no permitido: ${c}`);

  const rgba = [...sinComentarios.matchAll(/rgba?\([^)]*\)/g)].map((m) => m[0].replace(/\s+/g, '').replace(/,\.075/, ',0.075'));
  for (const c of rgba) assert.equal(c, PERMITIDO_RGBA, `color no permitido: ${c}`);

  // Colores con nombre fuera de la lista (transparent y currentColor no son colores de marca).
  const sinVars = sinComentarios.replace(/var\([^)]*\)/g, '');
  const nombrados = sinVars.match(/(?:color|background|border[\w-]*|outline|fill|stroke)\s*:\s*[^;{}]*\b(red|blue|green|black|white|gray|grey|orange|yellow|purple|pink)\b/gi);
  assert.equal(nombrados, null, `color con nombre no permitido: ${nombrados}`);
});

test('texto del botón primario es Navy sobre teal con contraste >= 4,5:1', () => {
  const regla = css.match(/\.btn-primary\s*\{([^}]*)\}/);
  assert.ok(regla, 'falta .btn-primary');
  const color = regla[1].match(/(?:^|[;\s])color:\s*var\(--mo-navy\)/);
  const fondo = regla[1].match(/background:\s*var\(--mo-teal\)/);
  assert.ok(color, 'el texto del botón primario debe ser --mo-navy');
  assert.ok(fondo, 'el fondo del botón primario debe ser --mo-teal');
  const ratio = contraste(NAVY, TEAL);
  assert.ok(ratio >= 4.5, `contraste ${ratio.toFixed(2)}:1`);
});
