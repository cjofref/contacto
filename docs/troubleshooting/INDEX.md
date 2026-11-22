# Troubleshooting — índice de bugs registrados

Formato: `BUG-NNNN — <síntoma greppeable> → <causa raíz en pocas palabras>`

<!-- turbo:debug agrega una línea por bug registrado -->
BUG-0001 — Android muestra "Santiago Chile" seguido de un bloque enorme de base64 en el campo de dirección al importar `contacto.vcf` → el `PHOTO` PNG 300x300 (13 KB, con Exif/XMP/ICC) multilínea iba al final, después de `ADR`, y el importador de Android lo pegaba dentro de la dirección. Arreglo (`f02e296`): `PHOTO` justo después de `FN`, en JPEG 128x128 sin metadatos (3 KB, `TYPE=JPEG`). Verificado en Android desde la tarjeta NFC (2026-11-21). Si reaparece: quitar `PHOTO` del vcf para Android. Fotos del fallo borradas.
