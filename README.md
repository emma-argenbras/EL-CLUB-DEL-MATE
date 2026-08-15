# 🧉 El Club del Mate

App PWA para la gestión y administración del local. Reemplaza la planilla mensual
de Google Sheets (`JULIO 2026 nueva ECDM - CON BASE DE DATOS`) por una app que se
instala en el celular, **funciona sin internet** y calcula sola el **margen de
contribución** del mes.

---

## Qué hace hoy

| Sección | Para qué sirve |
|---|---|
| **Caja** | Abrir el turno (mañana / tarde) contando la caja, cargar ventas buscando por código o por nombre, registrar egresos, y cerrar el turno viendo la diferencia de caja. |
| **Productos** | Los 1336 productos que estaban en la planilla. Buscador, edición de precios, costos, proveedor y stock. |
| **Gastos** | Alquiler, servicios, proveedores, contador. Cada gasto se marca como **fijo** o **variable**, que es lo que después separa el margen del resultado. |
| **Reportes** | El número que importa: margen de contribución del mes, cómo se arma, y si el mes dio a favor o en contra. |
| **Ajustes** | Respaldo de todos los datos, exportación de ventas a CSV y recarga del catálogo. |

---

## Cómo se calcula el margen de contribución

```
  Ventas totales            (efectivo + tarjetas + transferencias)
− Costo de la mercadería    (precio de compra × unidades vendidas)
− Gastos variables          (los que suben cuando vendés más)
─────────────────────────
= MARGEN DE CONTRIBUCIÓN

− Gastos fijos              (alquiler, sueldos, contador: se pagan igual)
─────────────────────────
= RESULTADO DEL MES         (a favor o en contra)
```

### ⚠️ Un dato importante sobre los costos

En la planilla original, **1243 de los 1336 productos tienen el precio de compra
vencido o sin cargar**: los precios de venta se fueron actualizando durante 2026,
pero los de compra quedaron en 2024 y 2025.

Eso hace que el margen **parezca más alto de lo que realmente es**. En la planilla,
la relación real entre precio de venta y precio de compra da 2,37 veces, cuando la
rentabilidad objetivo cargada es de 1,3.

La app **no oculta ese problema**: te avisa en Productos cuántos artículos tienen el
costo vencido, y en Reportes te dice cuánta plata vendida no tiene costo cargado.
Para que el margen del mes sea confiable, hay que ir actualizando los precios de
compra de lo que más se vende.

---

## Cómo instalarla en el celular

1. Abrir la dirección de la app en Chrome (Android) o Safari (iPhone).
2. Menú del navegador → **"Agregar a pantalla de inicio"** / **"Instalar app"**.
3. Listo: queda como una app más y anda sin internet.

---

## ⚠️ Los datos viven en el celular

Toda la información se guarda **en el dispositivo**, no en la nube. Eso significa:

- **Anda perfecto sin internet.**
- **Si se pierde o se formatea el celular, se pierden los datos.**
- Cada dispositivo tiene sus propios datos: **no se sincronizan entre sí todavía.**

👉 Por eso: entrar seguido a **Ajustes → Descargar respaldo** y guardar ese archivo
en Google Drive.

La sincronización entre varios dispositivos es el próximo paso (ver más abajo).

---

## Para desarrollar

```bash
npm install
npm run dev          # servidor local de desarrollo
npm run build        # compila a dist/
npm run preview      # prueba la versión compilada
npm run typecheck    # revisa los tipos
```

### Volver a importar el catálogo desde una planilla

```bash
pip install openpyxl
python3 scripts/importar-catalogo.py "mi-planilla.xlsx"
```

Lee la hoja `PRODUCTOS` y regenera `public/productos.seed.json`.

### Regenerar los íconos

```bash
node scripts/generar-iconos.mjs
```

---

## Cómo está armado

- **Vite + React + TypeScript** — app liviana, sin servidor.
- **vite-plugin-pwa** — service worker, funciona sin conexión, instalable.
- **Dexie (IndexedDB)** — base de datos en el propio dispositivo.
- Sin backend: no hay cuentas, ni claves, ni costo mensual.

```
src/
  db/db.ts          Estructura de datos (productos, turnos, ventas, movimientos)
  db/sembrar.ts     Carga inicial del catálogo
  lib/calculos.ts   Arqueo, margen de contribución, resúmenes
  lib/formato.ts    Pesos argentinos, fechas, lectura de números
  paginas/          Caja, Productos, Gastos, Reportes, Ajustes
  componentes/      Buscador de productos, arqueo de caja
```

---

## Diferencias con la planilla

| Antes (planilla) | Ahora (app) |
|---|---|
| 62 hojas por mes, una por turno | Un turno por fecha, sin crear hojas |
| El medio de pago se escribía encima de la fórmula | Campo propio: efectivo, débito, crédito, transferencia, QR |
| El arqueo se cargaba por monto y se sumaba a mano | Se carga **cuántos billetes** hay y la app multiplica |
| El costo se leía del catálogo actual | El costo queda **congelado en cada venta**: el margen histórico no se mueve |
| Sin control de stock | Stock opcional por producto, se descuenta solo |
| Margen de contribución calculado aparte | Calculado solo, con aviso cuando los datos no alcanzan |
| Necesita internet y cuenta de Google | Anda sin internet, instalada en el celular |

---

## Próximos pasos

- [ ] **Sincronización entre dispositivos** (hoy cada celular tiene sus datos).
- [ ] Cargar julio 2026 completo para comparar el margen real contra la planilla.
- [ ] Actualizar precios de compra de los productos que más se venden.
- [ ] Compras a proveedores y control de stock con reposición.
- [ ] Comisiones de tarjeta y días de acreditación.
