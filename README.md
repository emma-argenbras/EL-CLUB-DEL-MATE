# 🧉 El Club del Mate

App PWA para la gestión y administración del local. Reemplaza la planilla mensual
de Google Sheets (`JULIO 2026 nueva ECDM - CON BASE DE DATOS`) por una app que se
instala en el celular, **funciona sin internet**, **sincroniza entre dispositivos**
cuando hay conexión, y calcula sola el **margen de contribución** del mes.

---

## Qué hace hoy

| Sección | Para qué sirve |
|---|---|
| **Panel** | La **revisión automática** del negocio: cada vez que se abre la app revisa sola la caja, el catálogo, los proveedores, los gastos y la sincronización, y arma la lista de lo que hay para hacer, ordenada por gravedad. Cada hallazgo dice qué pasa, por qué importa y qué hacer, con un botón que lleva a la pantalla que lo resuelve, ya filtrada. |
| **Caja** | Abrir el turno (mañana / tarde) contando la caja, cargar ventas buscando por código o por nombre, registrar egresos, y cerrar el turno viendo la diferencia de caja. |
| **Productos** | Los 1336 productos que estaban en la planilla. Buscador, edición de precios, costos, proveedor y stock, con filtros rápidos por costo vencido o sin stock. El precio de venta sugerido siempre redondea para arriba, a un múltiplo de 100 — nunca queda un número con sueltos. |
| **Proveedores** | Aumento de costos en bloque, marcar un proveedor como inactivo, y una **cuenta corriente**: registrar compras (que suman stock y actualizan costo solas) y pagos (efectivo, transferencia, etc.), con el saldo que se le debe a cada uno siempre a la vista. |
| **Gastos** | Alquiler, servicios, proveedores, contador. Cada gasto se marca como **fijo** o **variable**, que es lo que después separa el margen del resultado. Un pago registrado desde la cuenta corriente de un proveedor aparece acá solo, sin cargarlo dos veces. |
| **Catálogo público** | Una página aparte, sin login, en `/catalogo/`: nombre, código y precio de venta de 1.280 productos, con buscador. Desde Productos se comparte cualquier producto por WhatsApp con un toque. |
| **Reportes** | El número que importa: margen de contribución, cómo se arma, y si dio a favor o en contra. Se puede ver **por mes o por año** (el anual trae la tabla mes por mes, el mejor y el más flojo, y el promedio de los meses cerrados — el mes en curso queda marcado aparte y no compite). Incluye el **desglose de los gastos**, separados en fijos y variables y abiertos por categoría, con el detalle de cada movimiento. |
| **Ajustes** | Vincular la nube, respaldo de todos los datos, exportación de ventas a CSV y recarga del catálogo. |

El Panel termina con **Revisión completa**: los 19 controles que la app corre sola,
con el resultado de cada uno — también los que dieron bien. Sin eso, "no hay avisos" y
"no se revisó nada" se ven igual. Un control que no se pudo correr (los del respaldo
automático cuando la nube no está activada) se marca aparte con `?`, no como aprobado.

La campana 🔔 es la versión corta del Panel: los mismos hallazgos, ordenados de lo
más urgente a lo menos. Panel, campana y "Mi día" salen del **mismo motor**
([`src/lib/auditoria.ts`](./src/lib/auditoria.ts)), así los tres dicen siempre lo
mismo. "Mi día" es la vista de un empleado: sus pendientes, filtrados a lo que
efectivamente puede resolver, sin números de ganancia del negocio.

Un aviso que no se puede resolver ahora se pospone un día o una semana; vuelve solo
cuando llega la fecha, si el problema sigue. Los urgentes no se pueden posponer.
También hay **recordatorios** del navegador para lo urgente (una vez por día como
máximo). Son notificaciones locales: llegan mientras la app está abierta, aunque sea
minimizada. Con la app cerrada no llega nada — eso necesitaría un servidor de push,
que este proyecto a propósito no tiene.

La **Ayuda** (❓) se adapta a quién la mira: un empleado ve solo las preguntas de
lo que efectivamente puede hacer — sin las de dueño (usuarios, respaldos) ni las
de secciones que tenga apagadas.

Cuando se publica una versión nueva de la app, aparece un botón **"Actualizar"**
arriba de todo — no se actualiza sola de golpe para no cortar una venta a la mitad.
Al lado del botón de ayuda (?) también hay un botón manual **🔄** para buscar una
versión nueva en cualquier momento, sin esperar a que avise sola.

---

## Todo 2026 ya está cargado

Los ocho meses que había anotados en las planillas viejas (de enero al 18 de
agosto) se cargan solos la primera vez que abrís la app: **2.141 ventas, 482
jornadas, 245 gastos y 40 pases a caja grande**.

La carga es **turno por turno y no pisa nada**: un turno que abrió y cerró una
persona desde la app queda intacto aunque la planilla tenga ese mismo día. Solo
se tocan los turnos marcados como importados. Eso permite volver a traer un mes
cuando se corrige el importador, sin riesgo para lo que se cargó a mano.

### El año, mes por mes

| Mes | Ventas | Margen de contribución | % | Resultado |
|---|--:|--:|--:|--:|
| enero | $4.722.605 | $2.363.716 | 50 % | $574.676 |
| febrero | $4.656.790 | $2.344.721 | 50 % | $641.921 |
| marzo | $5.622.635 | $1.941.754 | 35 % | $194.754 |
| abril | $4.913.540 | $2.705.735 | 55 % | $656.235 |
| mayo | $7.029.250 | $4.476.266 | 64 % | $2.344.166 |
| junio | $6.760.617 | $3.803.201 | 56 % | $1.194.141 |
| julio | $7.427.650 | $3.826.247 | 52 % | $1.546.497 |
| agosto *(en curso, hasta el 18)* | $3.869.780 | $2.190.615 | 57 % | $370.365 |
| **Año 2026** | **$45.002.867** | **$23.652.255** | **52,6 %** | **$7.522.755** |

Mejor mes: **julio** ($7.427.650). Más flojo: **febrero** ($4.656.790). Promedio
de los meses ya cerrados: **$5.876.155**. Agosto no entra en esa comparación
porque todavía le faltan días — sí suma al total del año.

### Cómo sabemos que no se perdió ninguna venta

El importador se controla contra los subtotales que la propia planilla calculaba
en cada hoja. De **482 turnos, 480 cierran al peso**. Los dos que no cierran son
errores de la planilla, no de la app:

- **7 de marzo, tarde**: la fórmula de la planilla era `=SUM(G8:G27)` y había una
  venta real de $26.250 anotada en la fila 28. La planilla no la sumaba; la app sí.
- **21 de julio, mañana**: la planilla anotó la misma venta de $25.500 en la
  columna de efectivo y en la de tarjetas. La app la cuenta una sola vez.

⚠️ **Dos cosas a revisar en los números del año:**

1. **239 ventas por $4.227.370 no tienen el costo de compra cargado.** Ese monto
   entra entero como ganancia, así que el margen real es más bajo que el que
   muestra el reporte. A medida que actualices costos, se corrige solo.
2. **Hay $1.403.000 anotados como venta que no son ventas**: una devolución de
   Mercado Pago del 13 de mayo ($1.210.000) y otra del 21 de marzo ($193.000).
   Están en el renglón de ventas de la planilla, sin código de producto. Se
   dejaron como estaban para que el arqueo de esos días siga cerrando, pero
   inflan la venta del año en un 3 %.

Para cargar otro mes histórico, ver "Importar un mes ya cargado en la planilla
vieja" más abajo.

---

## Las dos fechas de cada producto

La planilla de precios lleva **dos fechas por producto**, y son dos cosas distintas
que conviene no mezclar:

| Fecha | Qué marca | Si queda vieja… |
|---|---|---|
| Al lado del **costo** | Cuándo se actualizó el precio de compra | El **reporte miente**: el margen sale más alto de lo real, porque el costo cargado es más barato que el de verdad. No cambia lo que se le cobra al cliente. |
| Al lado del **precio de venta** | Cuándo se remarcó, se haya comprado o no | Se está **cobrando de menos**: el precio quedó planchado mientras todo aumentaba. |

Se mueven por separado a propósito: se puede remarcar sin haber comprado, y comprar
sin remarcar.

**Las dos se ponen solas.** Si se cambia el costo y no se toca la fecha, la app le
pone la de hoy; lo mismo con el precio de venta. Si se escribe una fecha a mano
(porque se está cargando una compra de la semana pasada), se respeta la escrita.
Antes la del costo era manual y quedaba vieja aunque el costo hubiera cambiado, que
es lo que hacía que el aviso no fuera confiable.

### Un producto descontinuado deja de reclamar

Tildar "Ya no se fabrica / no se repone" ahora silencia **todos** los avisos de
mantenimiento, no solo el del costo:

| Aviso | ¿Sigue apareciendo? |
|---|---|
| Costo vencido | No — no se vuelve a comprar |
| Precio viejo | No — no se va a remarcar |
| Bajo su markup | No — se está liquidando |
| Sin stock | No — no se repone |
| **Bajo costo** | **Sí** — es plata que sale cada vez que sale uno del mostrador |

Antes solo el del costo respetaba la marca, así que alguien podía hacer el trabajo y
seguir viendo el producto en la lista de pendientes.

### Tres avisos, no uno

Antes había un solo aviso que juntaba todo y salía en rojo sobre el 90 % del
catálogo, así que no servía para decidir por dónde empezar. Ahora son tres, y el
orden es el de importancia real:

1. **Bajo su markup** — con el costo y la rentabilidad que el producto ya tiene
   cargados, el precio debería ser más alto. **No depende de ninguna fecha: es una
   cuenta.** Hoy son 16 productos, y es la lista más accionable de las tres.
2. **Precio viejo** — hace más de un año que no se remarca. Hoy son 518.
3. **Costo vencido** — el costo cargado tiene más de 6 meses. Hoy son 1.247, y es
   el que menos urge: ensucia el reporte, no la caja.

Cada uno tiene su chip en la lista de Productos y su filtro propio, y el Panel
enlaza directo a la lista ya filtrada.

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

## Cerrar un turno tarde: lo autoriza el dueño

Cerrar el turno que se acaba de trabajar es rutina y nunca se frena. Cerrar uno que
**quedó olvidado** es otra cosa: es una corrección sobre algo que ya pasó, y el dueño
quiere enterarse en el momento, no cuando revise el mes.

La app considera tardío un cierre en dos casos, sin mirar el reloj:

- el turno es de un día anterior a hoy;
- es el turno de la mañana de hoy, pero el de la tarde ya se abrió.

No se usa la hora a propósito: una mañana que se estira hasta las tres de la tarde es
normal y adivinar por reloj daría falsas alarmas todos los días. Lo que delata la
corrección es que el tiempo ya siguió de largo.

En ese caso un empleado no ve "Cerrar turno" sino **"Pedir autorización para cerrar"**.
Cuenta la plata como siempre, explica qué pasó, y el conteo queda congelado en el
pedido. El dueño lo ve arriba de todo en Caja —con lo contado, lo que debería haber,
la diferencia que quedaría y el motivo— y tiene dos botones: **Autorizar y cerrar**,
que cierra el turno con ese conteo exacto y lo firma, o **No autorizar**, que pide un
motivo y deja el turno abierto para corregirlo.

El dueño no puede editar el conteo desde ahí. Si pudiera, el pedido dejaría de ser la
constancia de lo que se contó y pasaría a ser una negociación.

**Nada de esto frena la venta.** Mientras el pedido espera, el turno sigue abierto y se
puede seguir trabajando: lo único que espera es la corrección.

Del lado del servidor, `firestore.rules` impide que un empleado marque como cerrado un
turno cuya fecha no sea la de hoy (calculada en hora de Argentina, UTC-3). El caso del
mismo día —la mañana con la tarde ya abierta— lo maneja la app, no la regla.

### Probar las reglas de verdad

`firestore.rules` se publica a mano y no pasa por el CI, así que hay pruebas que lo
corren contra el emulador oficial de Firestore:

```bash
npm run test:reglas
```

Necesita Java. Cubre que Gabriela pueda cerrar hoy, que no pueda cerrar ayer, que no
se saltee el bloqueo borrando su propio pedido, que sí pueda dejarlo, y que Emmanuel
pueda hacer las dos cosas. Si tocás las reglas, corré esto antes de pegarlas en Firebase.

---

## Visto bueno sobre las diferencias de caja

Cuando un turno cierra con diferencia, la app le pregunta a quien cerró si sabe a qué
se debió, y **cierra igual**: el turno nunca se frena esperando una autorización, la
persona tiene que poder terminar e irse.

Lo que queda pendiente es el **visto bueno del dueño**. En Caja, arriba de todo, un
dueño ve los cierres con diferencia sin revisar —fecha, turno, cuánto faltó o sobró,
quién cerró y lo que anotó— y les da el visto bueno con un comentario opcional.

El visto bueno **no corrige la diferencia**: queda registrada como fue. Deja la
constancia de que alguien con responsabilidad la miró, con nombre y fecha.

Un empleado no puede firmarlo — si pudiera, quien tuvo la diferencia se la aprobaría
sola. Está bloqueado en `firestore.rules`, no solo en la pantalla: la regla de
`jornadas` deja que cualquiera activo abra, cargue y cierre su turno, pero solo un
owner puede tocar `cierreAutorizado`.

> ⚠️ **Las reglas no se publican con el deploy.** El workflow de GitHub Actions solo
> sube la app; `firestore.rules` hay que pegarlo a mano en **Firebase → Firestore
> Database → Reglas → Publicar** cada vez que cambia. Hasta que eso se haga, el
> bloqueo existe solo en la pantalla.

Mientras queden cierres sin revisar, el Panel lo reclama. No hay que pedir nada: cualquier
cierre con diferencia entra solo en esa lista, aunque quien cerró no haya escrito ninguna
explicación.

El circuito se ve de los dos lados. En el turno ya cerrado, debajo de la diferencia, quien
cerró lee «Queda esperando el visto bueno del dueño» mientras nadie lo miró, y después el
nombre de quién lo dio, cuándo y el comentario que haya dejado.

---

## WhatsApp y catálogo público

Dos cosas que no necesitan ninguna cuenta nueva ni ningún servidor.

### Compartir un producto por WhatsApp

En Productos, cada producto tiene un botón 💬 al lado del precio (y otro más grande
al abrirlo para editar), y arriba de todo hay un **💬 Catálogo** que manda el enlace
al catálogo entero. Los dos los ve cualquiera que tenga Productos habilitado, no solo
un dueño: quien atiende el mostrador es justamente quien contesta los mensajes.

Abre el WhatsApp que la persona ya tiene instalado, con el mensaje escrito:

```
🧉 *MATE IMPERIAL VIROLA ALPACA LISA*
$ 45.000

Código TM015

Mirá todo el catálogo 👉 https://app.elclubdelmate.com/catalogo/
El Club del Mate · Concordia
```

Es un enlace `wa.me`: no manda nada solo, la persona elige el destinatario y toca
enviar. Funciona con WhatsApp común o Business, con el número de siempre.

### El catálogo público

Vive en **https://app.elclubdelmate.com/catalogo/** y lo puede abrir cualquiera, sin
usuario ni contraseña. Tiene buscador y muestra 1.280 productos.

Es una **página aparte de la app**, a propósito:

- un cliente que abre el enlace desde WhatsApp no se baja la app de administración
  entera (pesa 2,5 MB; el catálogo, 48 KB más los datos);
- no pasa por el login ni registra el service worker;
- no puede llegar a ninguna pantalla de administración aunque quiera.

**Qué se publica y qué no.** El catálogo lee `public/catalogo.json`, que tiene
exactamente tres campos por producto: código, descripción y precio de venta. El
precio de compra, la rentabilidad, el proveedor y el stock **no se publican**. Quedan
afuera también los productos inactivos, archivados, descontinuados o sin precio.

Para regenerarlo después de actualizar la lista de precios:

```bash
npm run catalogo
```

Si se editaron precios desde la app y no desde la planilla, se puede exportar el
archivo con los precios actuales desde **Ajustes → Catálogo público → Exportar
catálogo con los precios de hoy**, y publicarlo.

### Etapa 2: contestar WhatsApp desde la app

Esto **todavía no está hecho, y no es una cuestión de programarlo un rato**: choca con
un límite del que conviene estar al tanto antes de decidir nada.

La app es un sitio estático. No hay ningún servidor propio: GitHub Pages entrega
archivos y listo. Para que un mensaje de WhatsApp *entre* a algún lado hace falta algo
prendido las 24 horas esperando que Meta lo llame. O sea: para la etapa 2 hay que sumar
un servidor, y eso es lo que la vuelve una decisión y no una tarea.

Lo que hace falta, en orden:

1. **Un número dedicado.** El número que se carga en la API de WhatsApp Business deja
   de poder usarse en la app común de WhatsApp en el celular. Si es el número que hoy
   usa el local, hay que decidir si se migra o se saca uno nuevo.
2. **Cuenta de Meta Business + WhatsApp Business Platform**, o un intermediario
   (360dialog, Twilio) que simplifica el alta a cambio de un abono.
3. **Un servidor** que reciba los mensajes y los guarde. Puede ser chico —una función
   en Firebase, que ya está pago y configurado, es la opción natural—, pero es
   infraestructura nueva que hay que mantener.
4. **Recién ahí la IA.** Con los mensajes llegando a Firestore, la app los muestra como
   una bandeja más y un agente puede contestar lo que ya sabe: precio, si hay stock,
   horarios. Todo lo que necesita para responder ya está en la base.

Costo: Meta cobra por conversación (las que inicia el cliente son más baratas y hay una
franja gratis mensual). El servidor, con el volumen de un local, entra cómodo en el
plan gratuito de Firebase.

**Lo que sí está listo desde ya:** el catálogo público es la base de conocimiento que
va a usar el agente. Está en un JSON limpio, con precio actualizado, y se regenera con
un comando. Cuando la etapa 2 arranque, no hay que armar eso de cero.

### ⚠️ Pendiente de seguridad: `productos.seed.json`

El catálogo público no expone nada confidencial, pero el archivo que usa la app para
la carga inicial, `public/productos.seed.json`, **sí lleva el precio de compra, la
rentabilidad y el proveedor de cada producto**, y hoy se sirve público en
`app.elclubdelmate.com/productos.seed.json`.

No es algo que haya introducido el catálogo — viene de antes—, pero conviene
resolverlo. La forma prolija es mover la carga inicial del catálogo detrás del login
(traerla de Firestore en vez de un JSON público). Queda anotado como próximo paso.

---

### Ver si lo que carga otra persona ya llegó

En **Ajustes → Respaldo automático** hay dos renglones: el estado de la conexión y
**"Último cambio recibido"**, que dice hace cuánto llegó algo de otro dispositivo
("recién", "hace 3 minutos"). Contesta de un vistazo la duda concreta de trabajar
entre dos personas.

La sincronización es en vivo (`onSnapshot` sobre cada colección, ver
`src/sync/motor.ts`): no hace falta recargar. Un empleado activo puede editar
cualquier campo de un producto salvo `precioVenta` y `archivado`, que quedan
reservados a un dueño por `firestore.rules`.

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

## Qué se publica y qué no

La app vive en un hosting estático (GitHub Pages). Eso quiere decir algo simple y
fácil de olvidar: **cualquier archivo que se suba a `public/` lo puede bajar
cualquiera que sepa la dirección**, esté logueado o no. No hay login que valga para
un archivo estático.

Por eso el catálogo está partido en dos:

| Archivo | Dónde vive | Qué lleva |
|---|---|---|
| `datos/productos.seed.json` | fuera de `public/`, **no se publica** | catálogo completo con costo, markup y proveedor |
| `datos/historico-<mes>.seed.json` | fuera de `public/`, **no se publica** | ventas, gastos y turnos de cada mes de 2026 |
| `datos/arqueos-<mes>.seed.json` | fuera de `public/`, **no se publica** | conteo de billetes de cada turno |
| `public/catalogo.json` | publicado | código, descripción y precio de venta, nada más |
| `public/precios-<mes>.seed.json` | publicado | solo cambios de precio de venta |

`public/catalogo.json` cumple dos funciones a la vez: es lo que ve un cliente que abre
el catálogo por WhatsApp, y es con lo que arranca un dispositivo recién instalado para
que no abra con la pantalla vacía.

**Los costos llegan al iniciar sesión, desde el servidor**, que es el único lugar donde
están protegidos por las reglas de Firestore. Un dispositivo sin vincular queda con un
catálogo para vender, sin los números internos — que es exactamente lo que corresponde.

Los parches mensuales de precios (`public/precios-<mes>.seed.json`) siguen la misma
regla: `scripts/actualizar-precios.py` les saca costo, markup y proveedor antes de
escribirlos.

Los meses históricos tampoco se publican. Un dispositivo que ya los importó no los
vuelve a pedir (la marca del import lo corta antes), y uno recién instalado los recibe
del servidor al iniciar sesión. Si el archivo no está, la app lo saltea en silencio:
faltar es lo esperado, no un error.

### La regla, verificada sola

Esto ya se escapó dos veces —el catálogo con los costos y el historial de ventas de
todo el año— y las dos veces se encontró de casualidad. Así que dejó de ser una
convención y pasó a ser un chequeo:

```bash
npm run revisar-publicos
```

`scripts/revisar-publicos.py` recorre todos los JSON de `public/` y falla si encuentra
precio de compra, markup, proveedor, stock, ventas, gastos, turnos o arqueos. Corre en
cada pull request, y **el deploy lo corre otra vez sobre `dist/`** —lo que realmente se
sube, no lo que hay en `public/`— justo antes de publicar. Si algo se coló, no se
publica nada.

Para agregar un campo a la lista, está en `PROHIBIDAS` arriba del script, cada uno con
el motivo escrito al lado.

> ⚠️ **El repositorio es público.** Nada de esto se sirve ya desde
> `app.elclubdelmate.com`, pero mientras el repositorio sea público todo lo versionado
> se puede leer desde GitHub, **incluido el historial**: sacar un archivo del árbol no
> lo borra de los commits viejos. Los archivos de `datos/` siguen ahí, y también las
> versiones anteriores de los de `public/`.
>
> Lo único que cierra eso es **poner el repositorio en privado** (Settings → General →
> Danger Zone → Change repository visibility). Antes de hacerlo hay que verificar que
> GitHub Pages siga publicando el sitio con el plan de la cuenta: en las cuentas
> gratuitas, Pages desde un repositorio privado puede requerir plan pago. Si el sitio
> se cae, se vuelve a poner público y se piensa otra salida — no se pierde nada, pero
> conviene no hacerlo en pleno horario de atención.

---

## Los datos viven primero en el celular

- **Anda perfecto sin internet.** Cada acción se guarda al toque en el dispositivo.
- **Sin sincronización configurada, cada celular tiene sus propios datos** (ver
  arriba cómo activarla).
- Con sincronización activada, si se pierde o rompe un celular, los datos siguen
  disponibles en la nube y en los demás dispositivos vinculados.
- Igual conviene entrar de vez en cuando a **Ajustes → Copia manual → Descargar
  copia** y guardar ese archivo en Google Drive, como respaldo extra.

### Un dispositivo que se queda atrás

Cada aparato anota, **en el aparato**, cuándo fue la última vez que recibió datos del
servidor. Esa marca vive en `ajustes`, la única tabla que a propósito no sincroniza:
justamente sirve para detectar que *este* aparato se quedó atrás, y un dato compartido
no podría decirlo.

A los **tres días** sin sincronizar, el Panel lo avisa. Tres y no uno, para no molestar
por un franco o un fin de semana largo.

El aviso lo ve cualquiera, no solo un dueño. El estado de sincronización es del
dispositivo, y el dispositivo de un empleado lo mira un empleado: esconderle el aviso
dejaría sin enterarse justo a la única persona que está ahí para hacer algo. El texto
cambia según quién sea — un dueño puede reentrar desde Ajustes, un empleado avisa.

Es distinto del indicador de conexión, que dice cómo está la nube **ahora**. Un celular
al que se le cerró la sesión hace una semana puede verse "conectando" un rato y no
avisar nunca que sus datos no llegan a ningún lado.

---

## Qué se revisa antes de publicar

Dos workflows, y los dos corren lo mismo (`typecheck`, `test`, `build`,
`revisar-publicos`):

- **Verificar** — en cada pull request y en cada push a `main`.
- **Publicar en GitHub Pages** — al mergear a `main`. Corre los chequeos **antes** de
  publicar: si alguno falla, no sube nada y la app que está en el aire sigue siendo la
  anterior.

Que el deploy repita los chequeos no es al pedo: es lo que hace que un commit que
compila pero rompe un cálculo no llegue a producción, sin depender de que nadie haya
configurado nada en GitHub.

Lo que **sí** conviene activar a mano, una sola vez, es la protección de la rama:
**Settings → Branches → Add branch ruleset**, con `main` como target, y tildando
*Require a pull request before merging* y *Require status checks to pass* →
`verificar`. Eso impide además pushear directo a `main` salteándose el pull request.

`npm run test:reglas` no corre en el CI: necesita el emulador de Firestore y Java. Va a
mano cuando se toca `firestore.rules`, que de todos modos se publica a mano.

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
`public/historico-2026-08.seed.json` más `public/arqueos-2026-08.seed.json`.

Al terminar imprime un **control contra los subtotales que la propia planilla
calculaba** en cada hoja, turno por turno. Si algún turno no cierra, lo dice con
nombre y monto: así se distingue un error del importador de un error de la
planilla. Además informa las filas que hubo que interpretar (pagos partidos,
recargos por financiación, ventas anotadas dos veces) y qué productos vendidos
ese mes no tienen costo de compra cargado.

Cuando la hoja `PRODUCTOS` del mes viene rota o a medio cargar (en enero estaba
entera en `#REF!`), el script cae al catálogo actual
(`public/productos.seed.json`) para el costo y el nombre de cada producto. Si no,
esas ventas quedarían con costo cero — inflando el margen — y figurando por su
código pelado en los reportes.

Después hay que agregar el mes a la lista `MESES_HISTORICOS` en `src/App.tsx` para
que la app lo cargue solo la primera vez que se abre (no pisa datos si ya se
estaba usando la app para cargar caja real). Si se corrigió el importador y hay
que **volver a traer** meses ya importados, subí `VERSION_IMPORTACION` en
`src/db/sembrar.ts`: eso vuelve a cargar los turnos marcados como importados y
deja intactos los que cargó una persona.

Las pruebas del parser se corren aparte:

```bash
python3 scripts/importar-historico.test.py
```

### Regenerar el catálogo público

```bash
npm run catalogo
```

Lee `public/productos.seed.json` y escribe `public/catalogo.json` dejando pasar solo
código, descripción y precio de venta. Hay que correrlo cada vez que se actualiza la
lista de precios, o el catálogo público sigue mostrando los precios viejos.

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
