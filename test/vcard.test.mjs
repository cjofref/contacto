import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const correr = (ruta) =>
  spawnSync(process.execPath, ['scripts/validate-vcard.mjs', ruta], { cwd: raiz, encoding: 'utf8' });

test('contacto.vcf es válido', () => {
  const r = correr('contacto.vcf');
  assert.equal(r.status, 0, r.stderr);
});

for (const [archivo, campo] of [
  ['sin-tel.vcf', 'TEL'],
  ['sin-fn.vcf', 'FN'],
  ['lf.vcf', 'CRLF'],
]) {
  test(`fixture ${archivo} falla y nombra ${campo}`, () => {
    const r = correr(`test/fixtures/${archivo}`);
    assert.equal(r.status, 1);
    assert.match(r.stderr, new RegExp(campo));
  });
}
