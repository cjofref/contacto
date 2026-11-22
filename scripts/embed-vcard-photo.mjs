// Inserta o reemplaza la propiedad PHOTO de contacto.vcf con assets/vcard-photo.jpg (base64 plegado).
// Va justo después de FN y en JPEG de 128x128 sin metadatos: el importador de Android antiguo
// pegaba el PHOTO multilínea (PNG 300x300) dentro del campo ADR.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = new URL('..', import.meta.url);
const ruta = fileURLToPath(new URL('contacto.vcf', raiz));
const foto = readFileSync(new URL('assets/vcard-photo.jpg', raiz));

const base64 = foto.toString('base64');
// Primera línea: 75 octetos en total; las siguientes llevan un espacio inicial y 74 de datos.
const prefijo = 'PHOTO;ENCODING=b;TYPE=JPEG:';
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
const ancla = sinFoto.match(/^FN[;:][^\r\n]*\r\n/m);
if (!ancla) {
  console.error('contacto.vcf no tiene FN con CRLF');
  process.exit(1);
}
const i = ancla.index + ancla[0].length;
const nuevo = sinFoto.slice(0, i) + propiedad + sinFoto.slice(i);
if (nuevo !== original) writeFileSync(ruta, nuevo);
