# Pruebas de punta a punta

La app de verdad, en un navegador, contra los emuladores de Firestore y Auth con las reglas
de `firestore.rules`. Es lo más parecido a usarla que se puede probar sin tocar el servidor
real: varias personas, cada una en su aparato, con su sesión.

```bash
bash pruebas/e2e/correr.sh sueldos
```

Necesita Java y Playwright con su Chromium. No van en el CI de GitHub; se corren a mano antes
de publicar un cambio que toque lo que prueban. Al terminar dicen dónde quedaron las
capturas de pantalla.

## Qué hay

- `ayudas.cjs`: lo común. Hablarle al servidor de prueba por REST, entrar con una cuenta, y
  `rastros()`, que busca un texto en todo lo que el navegador guarda de la app.
- `sueldos.cjs`: el dueño, la encargada y una empleada. Definir lo acordado, ordenar los
  pagos por semana, los apodos, los retiros de los dueños, cargar desde Caja y desde Gastos,
  «Mi sueldo», qué queda guardado en cada aparato, y qué contesta el servidor si se le pide
  una ficha directo con la sesión de cada una.

## Cómo se leen

Cada guion imprime lo que encontró, renglón por renglón; no tiene «pasó» o «falló». Se lee
entero y se compara con lo que tenía que dar. Antes de darlo por bueno hay que verlo dar mal:
romper a propósito lo que prueba y confirmar que el renglón cambia.

## Lo que no puede haber acá

Datos del negocio. Los mails, los nombres y los montos de estos guiones son inventados, y el
repositorio es público.

## Por qué están en el repositorio

Hasta el 19/11 los guiones vivían en una carpeta temporal y se perdieron enteros cuando el
entorno de trabajo se reinició. Los que se vuelvan a armar van acá.
