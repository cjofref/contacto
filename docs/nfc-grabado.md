# Grabado del tag NFC

Guía para grabar (o regrabar) el tag NFC de la tarjeta de Cristóbal Jofré. El tag guarda solo una URL: al tocarlo con un teléfono se abre la landing, y desde ahí se descarga el contacto.

## Qué grabar

- **URL exacta**: `https://cjofref.github.io/contacto/`
- **Con la barra final** y sin parámetros. La raíz elige sola el idioma del teléfono (inglés, español, portugués, francés o chino); no hace falta grabar una URL por idioma.
- Un solo registro en el tag: tipo **URL/URI**. No agregues registros de texto, de contacto ni de WiFi.

## Tag recomendado

- **NTAG213 o superior** (NTAG215, NTAG216). Los tres los leen todos los iPhone con NFC (iPhone 7 o posterior) y los Android con NFC.
- NTAG213 (144 bytes) alcanza de sobra: la URL ocupa menos de 40 bytes.
- Prefiere un tag adhesivo o tarjeta PVC; si va pegado sobre metal, usa uno con capa de ferrita.

## Paso a paso con NFC Tools

La app gratuita **NFC Tools** (wakdev) graba en iPhone y Android con el mismo flujo.

1. Instala NFC Tools desde App Store o Google Play.
2. Abre la pestaña **Escribir** (*Write*).
3. Toca **Añadir un registro** (*Add a record*) y elige **URL / URI**.
4. En el campo pega `https://cjofref.github.io/contacto/`. Si la app ofrece un prefijo, deja el campo en `https://` y pega el resto, o elige «Otro» y pega la URL entera. No debe quedar `http://` ni un prefijo duplicado.
5. Confirma con **OK** y toca **Escribir / 1 registro** (*Write / 1 record*).
6. Acerca el teléfono a la parte trasera del tag, sin moverlo, hasta que la app diga que el tag se escribió.

Diferencias por teléfono:

- **iPhone**: la app abre una hoja de lectura NFC al pedir escribir; acerca el borde superior del iPhone al tag y espera la confirmación.
- **Android**: activa NFC en Ajustes y acerca la parte trasera, a la altura de la antena (normalmente el centro o la parte superior).

## Prueba obligatoria en ambos teléfonos

Antes de dar el tag por bueno, pruébalo en **un iPhone y un Android**:

1. Con la pantalla encendida y desbloqueada, acerca el teléfono al tag. En iPhone aparece una notificación «Abrir en Safari»; en Android se abre el navegador solo o aparece un aviso para abrir.
2. Comprueba que carga la landing de Monitor One en el idioma del teléfono.
3. Toca **Guardar contacto** y confirma en la ficha: debe quedar «Cristóbal Jofré» con teléfono, correo, sitio web y el ID de WeChat.
4. Repite el toque dos o tres veces para descartar lecturas intermitentes.

Si algo falla, sigue en «Qué hacer si falla».

## NO bloquees (lock) el tag hasta pasar ambas pruebas

El bloqueo de lectura/escritura es **irreversible**: un tag bloqueado con una URL equivocada o que luego cambie queda inservible.

- No actives «Bloquear tag» (*Lock tag*) en NFC Tools mientras no hayan pasado la prueba en iPhone **y** en Android.
- Mientras el tag no esté bloqueado, puedes regrabarlo las veces que quieras con los mismos pasos.
- Si decides bloquearlo, hazlo al final y solo con la URL definitiva. Mantener el tag sin bloquear es seguro para el uso diario: nadie lo regraba sin una app y acceso físico, y la URL es pública de todos modos.

## Qué hacer si falla

| Síntoma | Qué revisar |
|---|---|
| El teléfono no reacciona | NFC activado; quita la funda gruesa; mueve el teléfono despacio por la parte trasera; en iPhone, pantalla desbloqueada |
| Abre otra página o una URL rara | Regraba el registro como **URL/URI** (no «Texto») y revisa que la URL sea exactamente la de esta guía |
| La landing da 404 | Revisa que GitHub Pages siga activo en el repo `cjofref/contacto` (rama `main`, raíz) y que la URL no cambió |
| El contacto no se importa | Abre `https://cjofref.github.io/contacto/contacto.vcf` en el navegador del teléfono; si descarga, el problema es del teléfono, no del tag |

## Estado del tag actual

El tag de Cristóbal ya está grabado con la URL de esta guía y funciona (confirmado por él mismo en la tarea 6.4 del plan).
