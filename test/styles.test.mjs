import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const css = readFileSync(new URL('css/styles.css', raiz), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(new URL('index.html', raiz), 'utf8');

// Paleta permitida tras el delta (CA-3).
const NAVY = [1, 37, 63];
const NAVY_DEEP = [1, 26, 45];
const TEAL = [16, 193, 197];
const MINT = [135, 199, 141];
const WHITE = [255, 255, 255];
const HEX_PERMITIDOS = new Set(['#01253f', '#011a2d', '#10c1c5', '#87c78d', '#fff', '#ffffff']);
const RGBA_PERMITIDOS = ['255,255,255', '16,193,197', '1,37,63'];

// Reglas planas `selector { declaraciones }` (también las anidadas en @media/@supports).
const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2] }));
const vars = Object.fromEntries([...css.matchAll(/(--mo-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

function luminancia([r, g, b]) {
  const c = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
// Compone un color con alfa sobre un fondo opaco.
const sobre = (rgb, alfa, fondo) => rgb.map((v, i) => Math.round(v * alfa + fondo[i] * (1 - alfa)));
const resuelveVar = (valor) => valor.replace(/var\((--mo-[\w-]+)\)/g, (_, v) => vars[v] ?? _);

test('todo color pertenece a la lista permitida; rgba(0,0,0,α) solo en sombras', () => {
  const hex = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  assert.ok(hex.length > 0);
  for (const c of hex) assert.ok(HEX_PERMITIDOS.has(c), `color no permitido: ${c}`);

  let revisadas = 0;
  for (const { decl } of reglas) {
    for (const d of decl.split(';')) {
      const [prop, ...resto] = d.split(':');
      for (const m of resto.join(':').matchAll(/rgba?\(([^)]*)\)/g)) {
        revisadas++;
        const rgb = m[1].replace(/\s+/g, '').split(',').slice(0, 3).join(',');
        if (rgb === '0,0,0') {
          assert.equal(prop.trim(), 'box-shadow', `rgba(0,0,0,α) fuera de una sombra: ${d.trim()}`);
        } else {
          assert.ok(RGBA_PERMITIDOS.includes(rgb), `color no permitido: rgba(${m[1]})`);
        }
      }
    }
  }
  assert.equal(revisadas, (css.match(/rgba?\(/g) || []).length, 'hay rgba() fuera de una declaración');

  const sinVars = css.replace(/var\([^)]*\)/g, '');
  const nombrados = sinVars.match(/(?:color|background|border[\w-]*|outline|fill|stroke|mask-image)\s*:\s*[^;{}]*\b(red|blue|green|black|white|gray|grey|orange|yellow|purple|pink)\b/gi);
  assert.equal(nombrados, null, `color con nombre no permitido: ${nombrados}`);
});

test('contraste >= 4,5:1 en los pares de texto', () => {
  const pares = [
    ['blanco sobre navy', WHITE, NAVY],
    ['teal sobre navy', TEAL, NAVY],
    ['mint sobre navy', MINT, NAVY],
    ['navy sobre teal (inicio del degradé)', NAVY, TEAL],
    ['navy sobre mint (fin del degradé)', NAVY, MINT],
    ['blanco sobre navy profundo (menú)', WHITE, NAVY_DEEP],
    ['teal sobre la opción activa del menú', TEAL, sobre(TEAL, 0.16, NAVY_DEEP)],
    ['navy sobre blanco (botón de la demo)', NAVY, WHITE],
  ];
  for (const [nombre, a, b] of pares) {
    const r = contraste(a, b);
    assert.ok(r >= 4.5, `${nombre}: ${r.toFixed(2)}:1`);
  }
});

test('cada color: rgba(255,255,255,α) cumple 4,5:1 sobre navy y sobre navy con 6 % de blanco', () => {
  const usados = reglas.flatMap((r) => [...r.decl.matchAll(/(?:^|[;\s])color:\s*([^;]+)/g)].map((m) => resuelveVar(m[1].trim())));
  const translucidos = usados.filter((c) => /^rgba\(255,\s*255,\s*255/.test(c));
  assert.ok(translucidos.length > 0, 'se esperaba al menos un texto blanco translúcido');
  const glass = sobre(WHITE, 0.06, NAVY);
  for (const c of translucidos) {
    const alfa = parseFloat(c.match(/,\s*([\d.]+)\)$/)[1]);
    for (const [nombre, fondo] of [['navy', NAVY], ['navy + 6 % blanco', glass]]) {
      const r = contraste(sobre(WHITE, alfa, fondo), fondo);
      assert.ok(r >= 4.5, `${c} sobre ${nombre}: ${r.toFixed(2)}:1`);
    }
  }
});

test('botón primario: degradé teal→mint con texto navy', () => {
  const regla = reglas.find((r) => r.sel === '.btn-primary');
  assert.ok(regla, 'falta .btn-primary');
  assert.match(regla.decl, /background:\s*var\(--mo-grad\)/);
  assert.match(regla.decl, /(?:^|[;\s])color:\s*var\(--mo-navy\)/);
  assert.match(vars['--mo-grad'], /var\(--mo-teal\),\s*var\(--mo-mint\)/);
});

test('degradé de texto: color teal antes y background-clip solo dentro de @supports', () => {
  const inicio = css.indexOf('@supports');
  assert.ok(inicio >= 0, 'falta @supports');
  const fuera = css.slice(0, inicio);
  assert.doesNotMatch(fuera, /background-clip:\s*text/);
  const hl = reglas.find((r) => r.sel === '.hl');
  assert.match(hl.decl, /(?:^|[;\s])color:\s*var\(--mo-teal\)/);
});

test('convención --mo-*: toda variable es --mo-* y toda variable definida se usa', () => {
  const definidas = [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
  for (const v of definidas) {
    assert.ok(v.startsWith('--mo-'), `${v} no sigue la convención --mo-*`);
    assert.ok(css.includes(`var(${v})`), `${v} está definida y no se usa`);
  }
});

test('pesos de h1–h3 están entre los cargados de Montserrat', () => {
  const cargados = html.match(/Montserrat:wght@([\d;]+)/)[1].split(';');
  const titulares = reglas.filter((r) => /(^|[\s,])(h[123]|\.hl)\b/.test(r.sel) || /\bh[123]\b/.test(r.sel));
  const pesos = titulares.flatMap((r) => [...r.decl.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1]));
  assert.ok(pesos.length > 0, 'los titulares deben fijar font-weight');
  for (const w of pesos) assert.ok(cargados.includes(w), `peso ${w} no cargado (${cargados})`);
});

test('los :hover solo existen dentro de @media (hover: hover)', () => {
  const inicio = css.indexOf('@media (hover: hover)');
  assert.ok(inicio >= 0, 'falta @media (hover: hover)');
  const fin = css.indexOf('\n}', inicio);
  const fuera = css.slice(0, inicio) + css.slice(fin);
  assert.doesNotMatch(fuera, /:hover/);
  assert.match(css.slice(inicio, fin), /\.btn-primary:hover/);
});

test('fondo con nodos.webp y pila de fuentes CJK para :lang(zh)', () => {
  assert.match(css, /url\(\.\.\/assets\/nodos\.webp\)/);
  assert.match(css, /:lang\(zh\)\s*\{[^}]*PingFang SC[^}]*Noto Sans SC/);
});
