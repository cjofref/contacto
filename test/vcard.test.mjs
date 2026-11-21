import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const desplegar = (t) => t.replace(/\r\n[ \t]/g, '');
const tieneWechat = (t) => t.includes('weixin://');

test('contacto.vcf trae el ID de WeChat y LinkedIn solo como perfil social, sin zona horaria', () => {
  const t = leer('contacto.vcf');
  const logico = desplegar(t);
  assert.ok(logico.includes('\r\nitem1.URL:weixin://dl/chat?cjofre13\r\n'));
  assert.ok(logico.includes('\r\nitem1.X-ABLabel:WeChat\r\n'));
  assert.ok(
    logico.includes(
      '\r\nX-SOCIALPROFILE;TYPE=linkedin;X-USER=cristobaljofre:https://www.linkedin.com/in/cristobaljofre\r\n',
    ),
  );
  assert.ok(!/^TZ[;:]/m.test(t));
  assert.ok(!logico.includes('\r\nURL:https://www.linkedin.com'));
  assert.ok(logico.includes('\r\nURL:https://www.monitorone.com\r\n'));
});

test('contacto.vcf mantiene CRLF y líneas físicas de 75 octetos o menos', () => {
  const t = leer('contacto.vcf');
  assert.ok(!/(^|[^\r])\n/.test(t));
  for (const l of t.split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, l);
});

test('un vCard sin la línea de WeChat no cumple la prueba', () => {
  assert.ok(tieneWechat(leer('contacto.vcf')));
  assert.ok(!tieneWechat(leer('test/fixtures/sin-wechat.vcf')));
});

test('contacto.vcf trae la foto: bytes idénticos a assets/vcard-photo.png, CRLF y menos de 30 KB', () => {
  const t = leer('contacto.vcf');
  const logico = desplegar(t);
  const m = logico.match(/\r\nPHOTO;ENCODING=b;TYPE=PNG:([A-Za-z0-9+/=]+)\r\nEND:VCARD\r\n/);
  assert.ok(m, 'falta PHOTO justo antes de END:VCARD');
  const bytes = Buffer.from(m[1], 'base64');
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  assert.ok(bytes.equals(readFileSync(new URL('../assets/vcard-photo.png', import.meta.url))));
  assert.ok(!/^LOGO[;:]/m.test(t));
  assert.ok(Buffer.byteLength(t, 'utf8') < 30 * 1024);
});

test('embed-vcard-photo es idempotente: una segunda corrida no cambia el archivo', () => {
  const antes = leer('contacto.vcf');
  const r = spawnSync(process.execPath, ['scripts/embed-vcard-photo.mjs'], { cwd: raiz, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(leer('contacto.vcf'), antes);
});
