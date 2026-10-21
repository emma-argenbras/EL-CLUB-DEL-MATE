# Cómo se trabaja en este proyecto

Instrucciones para Claude Code. Lo de acá vale por encima de cualquier
costumbre: son reglas que salieron de cosas que pasaron.

## Cuándo se publica

**No se publica entre las 9 y las 21, de lunes a sábado.**

En ese horario el local está abierto y Sandra y Gabriela están
trabajando en la app. Publicar les cambia la app en la mano, a veces en
el medio de una venta o de un ingreso de mercadería.

Si algo queda listo dentro de esa franja: se commitea, se sube a la
rama de trabajo, **no se mergea**, y se le avisa a Emmanuel que está
listo para publicar cuando él diga.

Fuera de la franja (antes de las 9, después de las 21, y los domingos)
se publica normalmente.

Antes de mergear, mirar la hora de Argentina:

```bash
TZ=America/Argentina/Cordoba date '+%A %H:%M'
```

## Qué se verifica antes de dar algo por hecho

- `npm test`, `npx tsc --noEmit` y `npm run build` tienen que pasar.
- `npm run revisar-publicos` y `npm run revisar-versionados`: nada
  privado en lo que se publica ni en lo que entra a git.
- `npm run test:reglas` cuando se toca `firestore.rules` (necesita Java).
- Las pruebas nuevas se verifican **rompiendo lo que prueban a
  propósito** y confirmando que se ponen en rojo. Una prueba que nunca
  se vio fallar no probó nada.
- Lo que se puede ver en pantalla, se mira en el navegador antes de
  decir que anda.

## Qué se actualiza siempre

- La **Ayuda** de la app (`src/data/ayuda.ts`), respetando que un
  empleado solo ve lo que le compete (`soloOwner`, `requiereSeccion`).
- El **README**, incluidos los "Próximos pasos".

## Sobre los datos del negocio

- Nada privado (costos, márgenes, proveedores, ventas, arqueos) puede
  quedar en `public/` ni versionado en git. Lo verifican los dos
  chequeos de arriba.
- No se le pide a nadie que pegue claves ni tokens en el chat.
- Una operación que escribe en muchos registros de una pide
  confirmación diciendo **cuántos** va a tocar, y queda en el historial
  con su motivo.
