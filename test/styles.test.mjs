import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');

test('h1, h2, h3 fijan font-weight 600 (el único peso de Poppins que se carga)', () => {
  const regla = css.match(/h1, h2, h3\s*\{([^}]*)\}/);
  assert.ok(regla, 'falta la regla h1, h2, h3');
  assert.match(regla[1], /font-weight:\s*600;/);
});

test('los :hover solo existen dentro de @media (hover: hover)', () => {
  const inicio = css.indexOf('@media (hover: hover)');
  assert.ok(inicio >= 0, 'falta @media (hover: hover)');
  const fin = css.indexOf('\n}', inicio);
  const dentro = css.slice(inicio, fin);
  const fuera = css.slice(0, inicio) + css.slice(fin);
  assert.doesNotMatch(fuera, /:hover/);
  assert.match(dentro, /\.btn-primary:hover/);
  assert.match(dentro, /\.btn-outline:hover/);
});

test('toda variable --mo-* definida se usa', () => {
  const definidas = [...css.matchAll(/(--mo-[\w-]+):/g)].map((m) => m[1]);
  for (const v of definidas) {
    assert.ok(css.includes(`var(${v})`), `${v} está definida y no se usa`);
  }
});
