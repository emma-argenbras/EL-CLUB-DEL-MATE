# 🧉 El Club del Mate

App PWA para la gestión y administración del local. Reemplaza la planilla mensual
de Google Sheets (`JULIO 2026 nueva ECDM - CON BASE DE DATOS`) por una app que se
instala en el celular, **funciona sin internet**, **sincroniza entre dispositivos**
cuando hay conexión, y calcula sola el **margen de contribución** del mes.

---

## Qué hace hoy

| Sección | Para qué sirve |
|---|---|
| **Caja** | Abrir el turno (mañana / tarde) contando la caja, cargar ventas buscando por código o por nombre, registrar egresos, y cerrar el turno viendo la diferencia de caja. |
| **Productos** | Los 1336 productos que estaban en la planilla. Buscador, edición de precios, costos, proveedor y stock, con filtros rápidos por costo vencido o sin stock. El precio de venta sugerido siempre redondea para arriba, a un múltiplo de 100 — nunca queda un número con sueltos. |
| **Proveedores** | Aumento de costos en bloque, marcar un proveedor como inactivo, y una **cuenta corriente**: registrar compras (que suman stock y actualizan costo solas) y pagos (efectivo, transferencia, etc.), con el saldo que se le debe a cada uno siempre a la vista. |
| **Gastos** | Alquiler, servicios, proveedores, contador. Cada gasto se marca como **fijo** o **variable**, que es lo que después separa el margen del resultado. Un pago registrado desde la cuenta corriente de un proveedor aparece acá solo, sin cargarlo dos veces. |
| **Reportes** | El número que importa: margen de contribución del mes, cómo se arma, y si el mes dio a favor o en contra. |
| **Ajustes** | Vincular la nube, respaldo de todos los datos, exportación de ventas a CSV y recarga del catálogo. |

La campana 🔔 de arriba de todo avisa sola cuando hay algo para revisar: productos
que se venden **al costo o por debajo** (el aviso más urgente: cada venta pierde
plata), productos sin stock, productos con costo vencido, ventas del mes sin costo
cargado, diferencias de caja o problemas de sincronización. Cada aviso lleva a la
pantalla que lo resuelve, ya filtrada.

La **Ayuda** (❓) se adapta a quién la mira: un empleado ve solo las preguntas de
lo que efectivamente puede hacer — sin las de dueño (usuarios, respaldos) ni las
de secciones que tenga apagadas.

Cuando se publica una versión nueva de la app, aparece un botón **"Actualizar"**
arriba de todo — no se actualiza sola de golpe para no cortar una venta a la mitad.
Al lado del botón de ayuda (?) también hay un botón manual **🔄** para buscar una
versión nueva en cualquier momento, sin esperar a que avise sola.

---

## Julio y agosto 2026 ya están cargados

Lo que estaba anotado en las planillas de julio (62 jornadas, 375 ventas, 35
gastos) y de agosto (62 jornadas, 167 ventas, 24 gastos) se carga solo.

La carga es **turno por turno y no pisa nada**: un turno que abrió y cerró una
persona desde la app queda intacto aunque la planilla tenga ese mismo día. Solo
se tocan los turnos marcados como importados. Eso permite volver a traer un mes
cuando se corrige el importador, sin riesgo para lo que se cargó a mano.

**Agosto 2026 (hasta el día 18, que es hasta donde llega la planilla):**

| | |
|---|--:|
| Ventas totales | $3.869.780 |
| Costo de mercadería vendida | −$1.437.865 |
| Gastos variables | −$911.550 |
| **Margen de contribución** | **$1.520.365 (39,3 %)** |
| Gastos fijos | −$1.150.000 |
| **Resultado del mes** | **$370.365 a favor** |

**Julio 2026 dio así:**

| | |
|---|--:|
| Ventas totales | $7.427.650 |
| Costo de mercadería vendida (con los costos actuales del catálogo) | −$2.775.453 |
| Gastos variables | −$1.532.650 |
| **Margen de contribución** | **$3.119.547 (42,0 %)** |
| Gastos fijos (alquiler, luz, contador) | −$1.334.000 |
| **Resultado del mes** | **$1.785.547 a favor** |

⚠️ Ese margen usa el costo *actual* de cada producto (el que ya venías cargando en
la planilla), y **el 88 % de lo vendido en julio corresponde a productos con el
costo vencido o sin cargar** — ver la sección de abajo. El número real de julio es
más bajo que $3.119.547. A medida que actualices los costos de lo que más se
vende, el reporte de julio se va a ir corrigiendo solo.

Para cargar otro mes histórico, ver "Importar un mes ya cargado en la planilla
vieja" más abajo.

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

En el catálogo, **1243 de los 1336 productos tienen el precio de compra vencido o
sin cargar**: los precios de venta se fueron actualizando durante 2026, pero los de
compra quedaron en 2024 y 2025.

Eso hace que el margen **parezca más alto de lo que realmente es**. En el catálogo,
la relación real entre precio de venta y precio de compra da 2,37 veces, cuando la
rentabilidad objetivo cargada es de 1,3.

La app **no oculta ese problema**: te avisa en la campana 🔔 y en Productos cuántos
artículos tienen el costo vencido, y en Reportes te dice cuánta plata vendida no
tiene costo cargado. Para que el margen del mes sea confiable, hay que ir
actualizando los precios de compra de lo que más se vende.

---

## Sincronizar entre dispositivos (respaldo automático + usuarios)

Por defecto cada celular guarda sus datos por separado (funciona perfecto así,
pero no comparten información entre sí, y no hay usuarios ni roles). Para que
el celular del mostrador, el de Emma y una computadora vean **los mismos datos
en tiempo real** —y para que cada persona tenga su propio login con su rol—
hay que crear una cuenta gratuita de Firebase — es un trámite de 5 minutos que
**solo lo puede hacer alguien con acceso al mail del negocio**:

1. Entrar a **[console.firebase.google.com](https://console.firebase.google.com)**
   con la cuenta de Google del negocio → **"Crear un proyecto"** → ponerle un
   nombre (ej. "el-club-del-mate") → seguir los pasos (no hace falta activar
   Google Analytics).
2. Dentro del proyecto: **Compilación → Firestore Database → Crear base de
   datos** → modo producción → elegir una región cercana (ej.
   `southamerica-east1`).
3. Pegar el contenido de [`firestore.rules`](./firestore.rules) en
   **Firestore Database → Reglas** → Publicar.
4. **Compilación → Authentication → Comenzar** → pestaña "Sign-in method" →
   habilitar **"Correo electrónico/contraseña"**.
5. **Configuración del proyecto** (ícono de engranaje) → bajar hasta "Tus apps" →
   ícono `</>` (app web) → registrar una app (cualquier nombre) → copiar el
   objeto `firebaseConfig` que aparece.
6. Cargar esos 6 valores como **Settings → Secrets and variables → Actions** en
   este repositorio de GitHub, con estos nombres exactos:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
7. Volver a correr el deploy (un push a `main`, o "Run workflow" manual en
   Actions). A partir de ahí, la app va a pedir iniciar sesión.

### Usuarios y roles

Con esto activado, **cada persona inicia sesión con su propio mail y
contraseña** — ya no hay un login compartido entre dispositivos.

- **Fundadores** (los dueños que arrancan la cuenta): sus mails están
  escritos a mano en [`firestore.rules`](./firestore.rules) y en
  [`src/sync/motor.ts`](./src/sync/motor.ts) (constante `EMAILS_FUNDADORES`)
  — hoy son `emmanuel@elclubdelmate.com` y `sebastian@elclubdelmate.com`. La
  primera vez que uno de esos mails inicia sesión, la cuenta se crea sola con
  rol de **dueño**. Para sumar un fundador nuevo hay que agregar su mail en
  los **dos** archivos y volver a publicar la app.
- **Todos los demás** (empleados, u otros dueños que no sean fundadores) se
  dan de alta **desde la app**, no desde Firebase: un dueño ya logueado va a
  **Ajustes → Usuarios del equipo → + Usuario nuevo**, carga su nombre, mail,
  una contraseña inicial y el rol, y con eso esa persona ya puede iniciar
  sesión en cualquier dispositivo. No hace falta volver a tocar Firebase ni
  este repositorio para eso.
- Un **dueño** ve y maneja todo. Un **empleado** opera Caja, Productos,
  Proveedores y Gastos igual, mantiene los costos de compra al día, pero no
  ve el margen de ganancia del negocio (tiene "Mi día" en vez de Reportes),
  no puede cambiar el precio de venta, y para archivar un producto necesita
  que un dueño lo autorice.
- Un dueño puede **desactivar** a cualquiera (incluso a otro dueño) desde
  **Ajustes → Usuarios del equipo → Desactivar**, sin borrar nada de lo que
  esa persona cargó. Si estaba usando la app en ese momento se le cierra la
  sesión sola; Firestore también le rechaza cualquier escritura mientras
  esté desactivado, así que no alcanza con seguir con la app abierta para
  esquivarlo. Un dueño no se puede desactivar a sí mismo desde la app (para
  eso está el otro fundador, o Firebase Console como último recurso).

Una vez logueado, todo lo que se carga en cualquier dispositivo (ventas,
cierres de caja, gastos, cambios de precio) se sube solo y aparece en los
demás en segundos. Si se corta internet, sigue funcionando exactamente igual
y sincroniza apenas vuelve la señal.

---

## Cómo instalarla en el celular

1. Abrir **https://app.elclubdelmate.com/** en Chrome (Android) o Safari (iPhone).
2. Menú del navegador → **"Agregar a pantalla de inicio"** / **"Instalar app"**.
3. Listo: queda como una app más y anda sin internet.

---

## Dominio propio (app.elclubdelmate.com)

La app se publica en GitHub Pages pero se sirve bajo el dominio propio del
negocio, no bajo `github.io`. Esto se arma con dos partes:

1. **DNS**: un registro `CNAME` en el proveedor de DNS de `elclubdelmate.com`
   — nombre `app`, valor `emma-argenbras.github.io` — así el subdominio
   apunta a GitHub Pages sin tocar el resto del sitio (`www.elclubdelmate.com`
   sigue funcionando exactamente igual, en su propio hosting).
2. **GitHub**: el archivo [`public/CNAME`](./public/CNAME) le dice a GitHub
   Pages qué dominio propio tiene que servir (se copia solo a `dist/` en
   cada build), y en **Settings → Pages → Custom domain** del repositorio
   hay que cargar el mismo dominio una vez para que GitHub emita el
   certificado HTTPS.

Si el dominio cambia alguna vez, hay que actualizar **ambas** partes (el DNS
y `public/CNAME`) — no alcanza con una sola.

---

## Los datos viven primero en el celular

- **Anda perfecto sin internet.** Cada acción se guarda al toque en el dispositivo.
- **Sin sincronización configurada, cada celular tiene sus propios datos** (ver
  arriba cómo activarla).
- Con sincronización activada, si se pierde o rompe un celular, los datos siguen
  disponibles en la nube y en los demás dispositivos vinculados.
- Igual conviene entrar de vez en cuando a **Ajustes → Copia manual → Descargar
  copia** y guardar ese archivo en Google Drive, como respaldo extra.

---

## Para desarrollar

```bash
npm install
npm run dev          # servidor local de desarrollo
npm run build        # compila a dist/
npm run preview      # prueba la versión compilada
npm run typecheck    # revisa los tipos
```

Para probar la sincronización en local, copiar `.env.example` a `.env` y cargar
las claves de Firebase (ver arriba), después `npm run dev`.

### Volver a importar el catálogo desde una planilla

```bash
pip install openpyxl
python3 scripts/importar-catalogo.py "mi-planilla.xlsx"
```

Lee la hoja `PRODUCTOS` y regenera `public/productos.seed.json`.

### Importar un mes ya cargado en la planilla vieja

```bash
python3 scripts/importar-historico.py "mi-planilla.xlsx" 2026 8
```

Lee las hojas `1M`/`1T`…`31M`/`31T` y la hoja `TOTALES` de ese mes, y genera
`public/historico-2026-08.seed.json`. El script también imprime en pantalla qué
productos vendidos ese mes no tienen costo de compra cargado.

Después hay que agregar el mes a la lista `MESES_HISTORICOS` en `src/App.tsx` para
que la app lo cargue solo la primera vez que se abre (no pisa datos si ya se
estaba usando la app para cargar caja real).

### Regenerar los íconos

```bash
node scripts/generar-iconos.mjs
```

---

## Cómo está armado

- **Vite + React + TypeScript** — app liviana, sin servidor propio.
- **vite-plugin-pwa** — service worker, funciona sin conexión, instalable, con
  botón de actualización cuando hay una versión nueva.
- **Dexie (IndexedDB)** — base de datos en el propio dispositivo. Es la que lee y
  escribe toda la app; funciona sola, sin necesitar la nube.
- **Firebase (Firestore + Authentication)**, opcional — sincroniza esa misma base
  entre dispositivos. Si no está configurado, no se descarga ni se usa: la app
  pesa lo mismo y funciona 100 % local.

```
src/
  db/db.ts          Estructura de datos + ganchos que avisan a sync de cada cambio
  db/sembrar.ts     Carga inicial del catalogo y de los meses historicos
  lib/calculos.ts   Arqueo, margen de contribución, resúmenes
  lib/formato.ts    Pesos argentinos, fechas, lectura de números
  sync/             Motor de sincronización con Firebase (opt-in)
  paginas/          Caja, Productos, Proveedores, Gastos, Reportes, Ajustes
  componentes/      Buscador de productos, arqueo de caja, notificaciones, update
```

### Cómo sincroniza (para quien toque el código)

Cada escritura a Dexie (crear, editar, borrar un producto/turno/venta/gasto) pasa
por un gancho central en `db.ts`, así ninguna pantalla tiene que acordarse de nada
especial. Ese gancho avisa al motor de sync (`sync/motor.ts`), que sube el cambio a
Firestore. Firestore tiene su propio cache offline: si no hay internet, el cambio
queda en cola en el dispositivo y se sube solo cuando vuelve la señal. Al revés,
`sync/motor.ts` escucha Firestore en tiempo real y aplica los cambios que llegan de
otros dispositivos a la base local. Cada turno, venta y gasto tiene un id propio
generado en el dispositivo (no un número correlativo), así dos celulares pueden
crear datos al mismo tiempo sin internet sin pisarse entre sí.

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
| Un solo archivo, sin avisos | Campana de notificaciones: costos vencidos, diferencias de caja, etc. |
| Se comparte por Google Drive, sin tiempo real | Sincroniza entre dispositivos en segundos (una vez configurada) |
| Necesita internet y cuenta de Google | Anda sin internet, instalada en el celular |

---

## Próximos pasos

- [ ] Actualizar precios de compra de los productos que más se venden (ver la
      campana 🔔 y Productos → "Ver esos productos").
- [ ] Compras a proveedores y control de stock con reposición.
- [ ] Comisiones de tarjeta y días de acreditación.
- [ ] Multi-usuario con permisos distintos (hoy todos comparten un mismo acceso).
