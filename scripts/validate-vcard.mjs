#!/usr/bin/env node
// Valida un vCard 3.0: campos requeridos, CRLF y largo de línea (75 octetos o plegada).
import { readFileSync } from 'node:fs';

const REQUERIDOS = ['N', 'FN', 'TEL', 'EMAIL', 'ORG', 'TITLE', 'URL'];

export function validar(buffer) {
  const errores = [];
  const texto = buffer.toString('utf8');

  if (/(^|[^\r])\n/.test(texto)) {
    errores.push('CRLF: los saltos de línea deben ser CRLF (\\r\\n), se encontró LF suelto');
  }

  const fisicas = texto.split(/\r?\n/).filter((l) => l !== '');
  for (const [i, linea] of fisicas.entries()) {
    const octetos = Buffer.byteLength(linea, 'utf8');
    if (octetos > 75) {
      errores.push(`LARGO: línea ${i + 1} tiene ${octetos} octetos (máx. 75, o plegarla)`);
    }
  }

  // Desplegar líneas plegadas (continuación con espacio o tab).
  const logicas = texto.replace(/\r?\n[ \t]/g, '').split(/\r?\n/).filter((l) => l !== '');

  if (logicas[0] !== 'BEGIN:VCARD') errores.push('BEGIN: falta BEGIN:VCARD en la primera línea');
  if (logicas[logicas.length - 1] !== 'END:VCARD') errores.push('END: falta END:VCARD en la última línea');
  if (!logicas.includes('VERSION:3.0')) errores.push('VERSION: falta VERSION:3.0');

  const nombres = new Set(logicas.map((l) => l.split(/[;:]/, 1)[0].toUpperCase()));
  for (const campo of REQUERIDOS) {
    if (!nombres.has(campo)) errores.push(`${campo}: falta el campo ${campo}`);
  }
  return errores;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error('uso: node scripts/validate-vcard.mjs <archivo.vcf>');
    process.exit(2);
  }
  const errores = validar(readFileSync(ruta));
  if (errores.length) {
    for (const e of errores) console.error(`ERROR ${e}`);
    process.exit(1);
  }
  console.log(`OK ${ruta}`);
}
