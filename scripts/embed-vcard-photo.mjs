// Inserta o reemplaza la propiedad PHOTO de contacto.vcf con assets/vcard-photo.png (base64 plegado).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = new URL('..', import.meta.url);
const ruta = fileURLToPath(new URL('contacto.vcf', raiz));
const foto = readFileSync(new URL('assets/vcard-photo.png', raiz));

const base64 = foto.toString('base64');
// Primera línea: 75 octetos en total; las siguientes llevan un espacio inicial y 74 de datos.
const prefijo = 'PHOTO;ENCODING=b;TYPE=PNG:';
const lineas = [];
let resto = prefijo + base64;
lineas.push(resto.slice(0, 75));
resto = resto.slice(75);
while (resto.length) {
  lineas.push(' ' + resto.slice(0, 74));
  resto = resto.slice(74);
}
const propiedad = lineas.join('\r\n') + '\r\n';

const original = readFileSync(ruta, 'utf8');
const sinFoto = original.replace(/PHOTO[;:](?:[^\r\n]*)\r\n(?: [^\r\n]*\r\n)*/g, '');
const fin = 'END:VCARD\r\n';
const i = sinFoto.lastIndexOf(fin);
if (i < 0) {
  console.error('contacto.vcf no tiene END:VCARD con CRLF');
  process.exit(1);
}
const nuevo = sinFoto.slice(0, i) + propiedad + sinFoto.slice(i);
if (nuevo !== original) writeFileSync(ruta, nuevo);
