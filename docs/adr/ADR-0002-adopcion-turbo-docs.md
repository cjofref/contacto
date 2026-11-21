# ADR-0002: Adopción de la estructura `docs/` de turbo

- **Fecha**: 2026-11-21
- **Estado**: accepted
- **Plan**: nfc-landing-m1

## Contexto
El repo nació sin `docs/`. Un sitio chico con un tag físico necesita dejar escritas las decisiones, el procedimiento de grabado y el detalle de cada versión.

## Opciones consideradas
1. **Todo en el README** — simple, pero mezcla decisiones, procedimientos e historial.
2. **Estructura `docs/` estándar de turbo** — carpetas fijas para ADR, arquitectura, changelog y troubleshooting.

## Decisión
Se adopta la estructura `docs/` de turbo: `adr/`, `arq/`, `changelog/`, `diagrams/` y `troubleshooting/`. `docs/api/` no se crea (el sitio no expone API). `docs/runbooks/` no se crea: el único procedimiento operativo es la guía `docs/nfc-grabado.md`.

## Justificación
Es el layout que validan las comprobaciones del plugin y separa lo que lee un usuario (README, CHANGELOG) de lo técnico.

## Consecuencias
Los documentos nuevos siguen esos nombres y la numeración de ADR continúa desde 0003.
