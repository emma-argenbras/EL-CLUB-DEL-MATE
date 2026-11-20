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
| **Proveedores** | Aumento de costos en bloque (avisa a cuántos productos va a tocar antes de tocarlos), marcar un proveedor como inactivo, y una **cuenta corriente**: registrar compras (que suman stock y actualizan costo solas) y pagos (efectivo, transferencia, etc.), con el saldo que se le debe a cada uno siempre a la vista. |
| **Gastos** | Alquiler, servicios, proveedores, contador. Cada gasto se marca como **fijo** o **variable**, que es lo que después separa el margen del resultado. Un pago registrado desde la cuenta corriente de un proveedor aparece acá solo, sin cargarlo dos veces. |
| **Catálogo público** | Una página aparte, sin login, en `/catalogo/`: nombre, código y precio de venta de 1.280 productos, con buscador. Desde Productos se comparte cualquier producto por WhatsApp con un toque. |
| **Reportes** | El número que importa: margen de contribución, cómo se arma, y si dio a favor o en contra. Se puede ver **por mes o por año** (el anual trae la tabla mes por mes, el mejor y el más flojo, y el promedio de los meses cerrados — el mes en curso queda marcado aparte y no compite). Incluye el **desglose de los gastos**, separados en fijos y variables y abiertos por categoría, con el detalle de cada movimiento. |
| **Consulta de precios** | El modo salón: la app abre directo en el buscador, con el precio en grande y sin avisos ni costo a la vista. Para responder "¿cuánto sale?" con el cliente adelante. |
| **Ajustes** | Vincular la nube, respaldo de todos los datos, exportación de ventas a CSV, recarga del catálogo, el **historial de modificaciones** (quién cambió qué y cuándo, con filtros) y la **revisión de proveedores**. |

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
Hay **tres roles**:

| | Dueño/a | Encargado/a | Empleado/a |
|---|---|---|---|
| Caja, Productos, Proveedores, Gastos | sí | sí | sí |
| Reportes con el margen | sí | sí | no (tiene "Mi día") |
| Cambiar el precio de venta / archivar | sí | sí | no (pide autorización) |
| Autorizar cierres tardíos y firmar diferencias | sí | sí | no |
| Dar de alta y manejar al equipo | sí | sí (menos dueños) | no |
| **Borrar todos los datos** | sí | **no** | no |
| **Importar un respaldo** | sí | **no** | no |
| **Crear, editar o desactivar un dueño** | sí | **no** | no |

El corte entre dueño y encargado no es "cuánto confío": es que esas tres
cosas pueden **destruir el negocio o repartirlo**, y no se delegan. Importar
un respaldo está del lado del dueño porque reemplaza el catálogo, los turnos y
las ventas de ese aparato con lo que diga el archivo. Desde el 19/11 no le
borra ni le pisa nada al servidor (ver «Lo que pasó el 19/11»), pero lo que el
archivo tenga y el servidor no, se sube: con un archivo viejo puede revivir
cosas borradas a propósito.

Un encargado tampoco puede **ascenderse a sí mismo** ni **degradar a un dueño**
para después tocarlo. La regla mira el rol de los dos lados —el que el
documento tiene ahora y el que tendría después—, porque mirar solo uno dejaba
pasar justo esos dos atajos. Hay seis pruebas contra el emulador para eso, y
verifiqué que las seis se ponen en rojo si se afloja el candado.

Cuando un encargado autoriza algo, la constancia guarda **su nombre y su rol**
(`cierreAutorizado.porRol`): dice que lo miró un encargado, no que lo miró un
dueño. Para eso sirve una constancia.

Lo mismo vale para el historial de modificaciones, y ahí faltaba: durante dos semanas
guardó el nombre y dejó el rol en `null`. La prueba de `db.ts` verificaba que el rol se
guardara **cuando venía**, y venía nunca — el motor armaba el autor sin él. Por eso la
función que firma los cambios salió del motor (que no se puede probar sin Firebase) y
vive en [`src/sync/sesion.ts`](./src/sync/sesion.ts), con sus propias pruebas.

Quién puede hacer qué vive en un solo archivo,
[`src/sync/permisos.ts`](./src/sync/permisos.ts), con un nombre por permiso.
Antes era `rol === 'owner'` repetido en diez pantallas, que con dos roles se
aguantaba y con tres no.
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

## El modo consulta de precios (el celular del salón)

Un cliente parado adelante preguntando cuánto sale algo es otra situación que mirar el
catálogo. Ahí no se navega, no se lee una tabla y no se desplaza una lista: se escribe
media palabra y se lee un número en voz alta. Para eso está
[`src/paginas/ConsultaPrecios.tsx`](./src/paginas/ConsultaPrecios.tsx):

- **Arranca con el teclado abierto** en el buscador. Un toque menos.
- **Sin avisos arriba.** Los pendientes del negocio no son asunto de ese momento, y
  correrían el buscador hacia abajo justo cuando tiene que estar arriba de todo. La
  campana 🔔 también se esconde.
- **El precio va grande de verdad** (2,1 rem), porque se lee de parado y a veces con el
  celular medio girado.
- **No se ve el costo ni el margen.** No es solo por los permisos: la pantalla se da
  vuelta sola hacia el cliente, y lo que el negocio paga por algo no es una
  conversación para tener en el mostrador.

Se prende en **Ajustes → Modo consulta de precios**, y se guarda en la tabla `ajustes`,
que a propósito no sincroniza: son marcas del aparato, no del negocio. Es justo lo que
hace falta —el celular del salón lo tiene prendido y el del dueño no—, y si viajara a
la nube, prenderlo en el salón le cambiaría la pantalla de arranque a todo el mundo.

No es un kiosco: desde la pantalla se va al resto de la app y el menú de abajo sigue
estando. Lo único que cambia es por dónde arranca y qué no muestra. El botón de salida
**no apaga el modo** —eso se hace desde Ajustes—, así que el celular del salón vuelve
solo al buscador la próxima vez que se abre.

---

## Códigos con barra: 34 productos que nunca subían

34 códigos del catálogo tienen una barra adentro (`EL11/05`, `EL22/102`, `EL82/471`…).
Para Firestore la barra no es un caracter más: es el separador de la ruta. Así que

```js
doc(firestore, 'negocios', 'el-club-del-mate', 'productos', 'EL11/05')
```

no apuntaba a un producto llamado `EL11/05` sino a la ruta
`negocios/el-club-del-mate/productos/EL11/05`, que tiene **cinco tramos** —impar— y por
lo tanto no es un documento:

```
Invalid document reference. Document references must have an even number
of segments, but .../productos/EL11/05 has 5.
```

Y lo rechazaba **tirando una excepción al armar la referencia**, no devolviendo una
promesa rechazada. Eso tuvo dos consecuencias, las dos silenciosas:

1. Esos 34 productos **nunca subieron**. Como la excepción no pasaba por
   `avisarRechazo()`, tampoco aparecía el aviso de "el servidor rechazó un cambio": se
   guardaban en el celular y ahí quedaban.
2. En la subida inicial (`empujarTodoLocal`), la excepción cortaba el armado del lote
   **y con él todo lo que venía después en la cola**: el resto de los productos, los
   turnos, las ventas, los gastos y —sobre todo— **los proveedores**. De ahí vienen
   buena parte de los `proveedorId` que apuntan a fichas que en el servidor no existen.

El arreglo está en [`src/sync/claves.ts`](./src/sync/claves.ts): se escapa la barra al
nombrar el documento y se desescapa al leerlo. **El código que ve una persona no cambia
en ningún lado** — el código de verdad viaja adentro del documento, en el campo
`codigo`, y esto es solo cómo se llama el archivo.

Se escapan dos caracteres y nada más: la barra, porque rompe, y el porcentaje, porque
es el caracter de escape. Eso es lo importante y es a propósito: **los otros 1.303
productos conservan exactamente el nombre de documento que ya tienen en el servidor.**
Si esto escapara de más (con `encodeURIComponent`, que también toca los espacios), cada
producto con un espacio en el código pasaría a ser un documento nuevo y quedaría el
viejo al lado. Un arreglo que duplica el catálogo es peor que el problema.

Las pruebas corren sobre el catálogo de verdad, no sobre ejemplos inventados: los 1.280
códigos de `public/catalogo.json` tienen que dar un nombre de documento válido, único y
reversible. Verifiqué que cinco de ellas se ponen en rojo si se saca el escape.

Además, ahora cada referencia del lote va en su propio `try`: una clave mala se saltea
sola y el resto sube, en vez de cortar la cola entera.

**Se arregla solo**: la próxima vez que cada dispositivo inicie sesión, `empujarTodoLocal`
sube lo que el servidor no tiene, y ahí entran los 34.

---

## El historial de modificaciones

Cada vez que se crea, edita, archiva o borra algo, queda un renglón con **quién, su
rol, cuándo, qué campo, el valor de antes y el de después**. Cubre las ocho entidades
que son datos del negocio: productos, proveedores, turnos de caja (apertura, cierre,
autorizaciones), ventas, gastos, compras y pagos a proveedores, y usuarios.

No hay que llamar a nada para que se grabe. Está en los ganchos `creating` /
`updating` / `deleting` de Dexie ([`src/db/db.ts`](./src/db/db.ts)), que son los
mismos por los que pasa **toda** escritura de la app: una pantalla nueva queda
registrada sin que nadie se acuerde de registrarla. Qué campos se anotan de cada
tabla está en `CAMPOS_POR_TABLA`, en un solo lugar.

Se consulta en **Ajustes → Historial de modificaciones**
([`src/paginas/Historial.tsx`](./src/paginas/Historial.tsx)): primero un resumen
—cuántos cambios, desde cuándo, cuántos hizo cada persona, el detalle por campo— y
después la lista, con filtros por persona, tipo de dato, campo y fechas. El resumen va
arriba a propósito: con miles de renglones, la pregunta que uno trae casi nunca es
"¿qué pasó a las 8:41?" sino "¿esto lo hizo alguien o lo hizo la máquina?".

### No se puede editar ni borrar, tampoco un dueño

En `firestore.rules`, las dos colecciones de historial llevan
`allow update, delete: if false` para **todos los roles, incluido el dueño**. No es
desconfianza hacia nadie: un historial que el jefe puede editar no sirve como
constancia de nada, ni frente a un empleado ni frente a uno mismo dentro de seis
meses. Si un renglón está equivocado, lo que corresponde es **agregar** el cambio que
corrige. Hay siete pruebas contra el emulador para esto, y verifiqué que se ponen en
rojo si se afloja el candado.

El renglón más viejo de la lista dice **"Acá arranca el historial"** con la fecha del
11/10/2026. Antes de eso la tabla existía pero un error la dejó en cero registros, y
sin ese renglón un historial que empieza de golpe se lee como un historial al que le
sacaron cosas.

### Lo que pasó el 14/10, y por qué no fue nadie

El día del primer ingreso de Sandra aparecieron **1.506 cambios de productos a su
nombre** a las 8:41. No tocó nada: había apretado "Ir a resolverlo" en el Panel para
mirar.

La causa estaba en `comoRemoto()`, el marcador que evita que un cambio bajado del
servidor se vuelva a subir (y que no se anote como edición a mano). Era **un booleano**,
y `comoRemoto` es asincrónico y corre desde varios lados a la vez: los ocho listeners
de Firestore, la lista de precios y la carga de meses históricos. El **primero** que
terminaba lo ponía en `false` mientras los demás seguían escribiendo, y desde ese
instante lo que bajaba del servidor se registraba como ediciones de quien estuviera
logueado. En un celular recién instalado eso es el catálogo entero: 1.337 productos con
sus costos de 2022–2024, sus proveedores y 42 descontinuados, todos "editados" en dos
minutos.

Ahora es un **contador**: el modo remoto dura hasta que termina el último, que es lo
que se quería decir desde el principio. Hay tres pruebas de concurrencia —dos
sincronizaciones a la vez, ocho como en el arranque, y una que falla— y verifiqué que
las tres se ponen en rojo al volver al booleano.

Tres cosas que conviene tener claras de ese episodio:

- **Los datos de los productos nunca estuvieron mal.** Lo único equivocado era el
  historial. Revertir esos valores habría roto datos buenos.
- **No fue un botón del Panel.** El Panel y todo el camino de la auditoría solo leen;
  "Ir a resolverlo" únicamente navega. Eso ahora es una regla verificada en
  [`src/lib/panel-no-escribe.test.ts`](./src/lib/panel-no-escribe.test.ts), que revisa
  el texto de esos cinco archivos y falla si aparece una escritura.
- **Los 1.506 renglones siguen ahí**, porque el historial no se borra ni para
  arreglarlo. Lo que se hizo fue dejar explicado qué son: acá, en la Ayuda, y en el
  comentario de `comoRemoto`.

El arreglo tenía un límite, que quedó anotado así: «el marcador sigue siendo **global**,
así que una edición hecha a mano justo mientras baja una sincronización se toma por remota
y no deja renglón. Es un problema mucho más chico». **No era chico**, y no era solo el
renglón: esa edición tampoco se subía. Se encontró y se arregló el 19/11, pasando el
marcador por cada escritura. Ver «Lo que pasó el 19/11».

### Una acción en bloque avisa cuántos productos toca

El aumento de costos de un proveedor es la única acción que cambia cientos de
productos con un solo toque. Antes lo hacía sin preguntar: un 50 donde iba un 5 no
tenía vuelta atrás más que a mano, producto por producto. Ahora pregunta diciendo
**a cuántos productos va a tocar** y muestra un ejemplo concreto con el más caro
("de $ 20.000 a $ 21.600"), porque un porcentaje es abstracto y un precio no. Los
renglones quedan agrupados en el historial con el motivo «Aumento +8% a Fulano».

---

## Borrar un turno, y que no vuelva

Hasta el 20/10/2026 un turno se creaba y **no se sacaba nunca**. Para la operación de
todos los días eso está bien —un turno trabajado se corrige, no se borra— pero dejaba
sin salida el caso en que un turno no tendría que existir: el mismo día cargado dos
veces desde dos dispositivos. Pasó el 19/10 y no había forma de arreglarlo desde la app.

Peor: cuando pasa, **Caja no alcanza para verlo**. Caja busca el turno con `.first()`,
así que de dos turnos "19/10 Tarde" muestra uno y el otro queda invisible — pero sigue
sumando, porque los reportes cuentan las ventas **por fecha**, no por turno. Y las
ventas de un turno cerrado tampoco se pueden borrar: ese botón solo aparece con el
turno abierto.

**Ajustes → Turnos del día** ([`src/paginas/TurnosDelDia.tsx`](./src/paginas/TurnosDelDia.tsx))
muestra todos los turnos de un día, marca los repetidos, y de cada uno dice la caja
inicial, cuántas ventas tiene, por cuánto y quién atendió — que es lo que hace falta
para saber cuál es el bueno. Borrar pide confirmación con el detalle completo y después
un **motivo obligatorio**, y queda en el historial.

Dos decisiones del borrado ([`src/db/borrarJornada.ts`](./src/db/borrarJornada.ts)):

- **No devuelve el stock.** El stock se descuenta en el dispositivo donde se carga la
  venta; cuando la venta llega a los demás por sincronización, el stock de ellos no se
  toca. Devolverlo al borrar sumaría en un dispositivo lo que nunca se restó ahí.
- **Las constancias se escriben antes que los borrados.** Si algo fallara a mitad de
  camino, es preferible tener de más —un borrado anotado que no pasó, que no revive
  nada— que de menos.

### La tabla `borrados`: que lo borrado no resucite

Esta es la parte que no se ve y es la que importa. La subida inicial de cada dispositivo
manda al servidor **todo lo que el servidor no tenga**. Es lo que permite que un celular
que estuvo sin señal ponga al día lo suyo — y, sin más, también lo que haría que algo
borrado volviera a aparecer: si se borra un turno desde la PC y en otro celular todavía
quedaba la copia local, al abrir la app ese celular lo ve "faltando" en el servidor y lo
vuelve a subir. El borrado se deshace solo, sin que nadie toque nada.

Por eso cada cosa borrada a propósito deja un renglón en `borrados`, y
`empujarTodoLocal` **le pregunta al servidor** —no a la copia local, que es justamente
la que está atrasada— qué se borró, y no lo sube.

Si la lista de borrados no se puede leer, se sube igual: perder un dato por no poder
leer una lista sería peor que revivir uno borrado, que al menos se vuelve a borrar.

---

## La carga a mano: lo que se agregó el 20/10

Con la importación cancelada, todo pasa por las manos de una persona. Estos diez
cambios salieron de ahí, y la mitad son frenos: cosas que antes se podían hacer mal sin
que nada avisara.

### Los dos carteles

Van **arriba de todo y en todas las pantallas**, a propósito.

- **"Este dispositivo no está conectado"**, cuando la app corre sin nube. El aviso ya
  existía —en Ajustes, escrito como un paso de instalación pendiente— y nadie lo leyó
  nunca: un empleado ni siquiera puede entrar a Ajustes. Un celular estuvo tres días
  cargando datos que nadie veía.
- **"Hay N cosas sin subir al servidor"**, comparando **cantidades**: una consulta de
  conteo por tabla contra el servidor, nueve lecturas en total, cada cinco minutos. No
  dice cuáles faltan, y para lo que tiene que hacer alcanza — avisarle a quien está
  cargando que lo que carga no está llegando a ningún lado.

`sinSubir` en el estado de la nube distingue **null** (no se pudo averiguar) de **cero**
(se controló y está todo arriba). No saber no es lo mismo que estar al día.

### Productos con un proveedor que no existe

Un producto puede apuntar a una ficha que **no está**. Quedaban en un limbo: no contaban
como "sin proveedor" —`proveedorId` no es null— ni aparecían dentro de ningún proveedor
—esa ficha no está en la lista—. Invisibles para los dos lados, y nadie los buscaba
porque ningún aviso los nombraba. El caso real: MR001 a MR006.

[`src/lib/proveedorDeProducto.ts`](./src/lib/proveedorDeProducto.ts) distingue los
**tres** estados que hay y no dos. Ahora el producto se lee "proveedor inexistente:
MATES RAFAEL…" en rojo, el filtro por proveedor los agrupa, y el Panel avisa cuántos son
y de quiénes.

### Enganchar los productos a su proveedor

En la base real son **850 productos repartidos en 97 nombres** —MOHICANO 135, SALDOS 65,
PAISA 61, THOR MATES BRIAN AGUIAR 50— contra **49 productos bien enganchados**. O sea
que el estado roto es la regla y no la excepción: arreglarlo de a un producto no es
trabajo de una tarde, es imposible.

En Productos, filtrando por "Proveedor inexistente", cada uno de esos nombres aparece
con un botón **Ver y asociar** ([`src/db/asociarFantasmas.ts`](./src/db/asociarFantasmas.ts)).
Se hace de a un proveedor, mostrando antes la lista completa de productos que se van a
tocar. Toca **dos campos y nada más**: `proveedorId` y el nombre escrito. Ni precios, ni
costos, ni stock.

**La ficha parecida.** `asegurarProveedor()` reusa una ficha cuando el nombre normaliza
igual, pero "THOR MATES" y "THOR MATES BRIAN AGUIAR" **no** normalizan igual: son dos
nombres distintos y dan dos ids distintos. Por eso hay un segundo paso: `fichaParecida()`
busca una ficha cuyas palabras sean **el comienzo exacto** del nombre buscado, y la
ofrece. Si se acepta, se usa esa ficha y el nombre largo queda cargado como **otro
nombre** suyo, así la próxima vez cae solo.

El criterio es conservador a propósito: "MATES RAFAEL" no se ofrece para "MATES DEL
LITORAL", aunque empiecen igual. Y es una **sugerencia**, nunca una decisión: la toma
quien está mirando, que sabe si son el mismo proveedor o dos que empiezan parecido.

El aviso de "listo" vive en el contenedor y no en la tarjeta del proveedor: apenas se
asocian los productos, ese proveedor deja de ser un fantasma y la tarjeta se va de la
lista. Si el mensaje viviera adentro, se iría con ella y el trabajo terminaría sin
confirmación.

### Pasar una venta de turno

Solo entre turnos del **mismo día** y solo si los **dos están abiertos**
([`src/db/moverVenta.ts`](./src/db/moverVenta.ts)).

Lo primero, porque la venta tiene su propia fecha y los reportes suman **por fecha**
mientras la caja cuenta **por turno**: moverla a otro día sin tocar las dos cosas deja
el reporte y el arqueo diciendo cosas distintas. Lo segundo, porque un turno cerrado se
cerró contando una plata, y meterle o sacarle una venta después hace que el arqueo
firmado ya no corresponda. La app dice "reabrí el turno primero", y reabrir existe.

### De dónde sale la plata de un pago

Antes todo pago a proveedor se registraba como salido de la caja grande. Si se pagaba
con efectivo del cajón, el turno cerraba con un faltante por ese monto y nada lo
explicaba. Ahora el formulario pregunta, y el movimiento se escribe **una sola vez**:
contra el turno (`EGRESO_CAJA`, que el cierre descuenta solo) o contra la caja grande
(`GASTO_CAJA_GRANDE`). La opción del cajón no aparece si no hay turno abierto.

### Alta de producto desde una compra

Casi toda compra trae algo que todavía no está en el catálogo, y cortar la carga para
ir a crearlo era perder el formulario entero. Ahora "+ Producto nuevo…" lo crea con el
proveedor ya puesto. El precio de venta queda vacío a propósito: lo decide quien mira el
costo y la rentabilidad, no el apuro de la carga.

De paso, guardar una compra pasó a **leer los productos de la base** en vez de la lista
que tenía la pantalla: un producto recién creado desde ahí todavía podía no estar en esa
lista, y eso reventaba al guardar.

### Reactivar un proveedor

Marcarlo inactivo deja sus productos descontinuados; reactivarlo no lo deshacía y nada
lo decía. Ahora **pregunta** si también saca esa marca, y la confirmación de marcar
inactivo avisa que va a pasar. Se pregunta en vez de deshacerlo solo porque a veces se
marca inactivo *porque* los productos se descontinuaron de verdad.

### Y dos cosas chicas

- El botón de **aplicar el plan de proveedores** quedó solo para dueño. La revisión
  —que es la lista de trabajo— la sigue viendo un encargado completa.
- El **contacto** del proveedor sí estaba, en "Editar", sin restricción por rol. Lo que
  no estaba era el renglón cuando el campo está vacío: un proveedor sin contacto se veía
  igual que si el campo no existiera. Ahora dice "sin contacto cargado".

---

## La cuenta de cada movimiento

`tipo` y `cuenta` son dos preguntas distintas, y las dos hacen falta.

**`tipo` decide la aritmética.** `EGRESO_CAJA` sale del cajón del turno y el cierre lo
descuenta del efectivo esperado; `GASTO_CAJA_GRANDE` no toca ese cajón. La app **no
lleva un saldo de caja grande**: ese tipo significa "es un gasto del negocio que no sale
del cajón", nada más.

**`cuenta` dice de dónde salió de verdad**: cajón, caja grande, banco o Mercado Pago. Un
pago por transferencia desde el banco y uno desde Mercado Pago son los dos "no sale del
cajón", pero no son la misma plata, y a fin de mes hay que poder conciliar cada cuenta
con su resumen.

Por eso **el tipo se deriva de la cuenta** (`tipoSegunCuenta`), y no al revés: el cajón
es lo único que toca el turno.

El campo es opcional a propósito: los movimientos cargados antes del 21/10/2026 no lo
tienen, y los de la planilla vieja tampoco. Para esos, la lista de Gastos trae un
selector en cada renglón — es lo que permite clasificar los tres movimientos de Mercado
Pago que estaban pendientes sin borrarlos y volver a cargarlos.

## La ficha del proveedor

Con la carga a mano, la ficha dejó de ser una agenda y pasó a ser lo que se necesita
para **comprarle**: por dónde se le escribe, a quién, a qué cuenta se le transfiere y
con qué condiciones.

Los campos son `contacto` (teléfono/WhatsApp), `comoSeCompra`, `web`, `ciudad`,
`aliasCbu`, `titular` y `notas` (condiciones), más los `alias` que ya estaban.

Lo que importa del cambio no son los campos sino que **el alta y la edición usan el
mismo formulario** (`CamposProveedor`). Antes eran dos: el alta pedía nombre y contacto,
la edición agregaba los otros nombres. Un proveedor cargado nuevo nacía a medias y había
que entrar a editarlo para completarlo, cosa que nadie hace.

Y se leen **sin entrar a editar**, en la ficha del proveedor: si solo se vieran al
editar, cargarlos no serviría de nada. El teléfono sale como enlace de WhatsApp.

---

## El lío de los proveedores

Al 17/10/2026: 34 proveedores cargados, **33 inactivos**, varios repetidos con el mismo
nombre (A MATEAR ALEJO, ABEL, ALBERTO BALDUGA), y los productos apuntando a unos **80
`proveedorId` distintos** para esas 34 fichas. El síntoma visible es que al editar un
producto la lista de proveedores sale vacía: el formulario muestra solo los activos
([`Productos.tsx`](./src/paginas/Productos.tsx), el filtro `prov.activo !== false`), y
con uno solo activo lo único que queda es "Sin proveedor".

Son dos causas sumadas, ninguna de las dos es que alguien cargó mal los datos.

**1. El id del proveedor se inventa en cada dispositivo.** Tanto la migración de la
base (versión 3) como `derivarProveedoresDesdeProductos()` hacen lo mismo: agrupan los
productos por el **nombre** del proveedor que venía de la planilla y le dan a cada
nombre un id nuevo con `nuevoId()`, que es aleatorio. Eso funciona en un dispositivo.
Con cinco, no: el celular de cada persona le puso a "MOHICANO" un id distinto, y
después los cinco sincronizaron. Resultado: el mismo proveedor varias veces con ids
distintos, y cada producto apuntando al id que le puso **su** celular.

**2. La subida inicial se cortaba.** Es el bug de las claves con barra, acá arriba: la
cola se cortaba en el primer producto con barra, y los proveedores —que van después de
los productos en el orden de subida— nunca llegaban al servidor, aunque sus productos
sí. Por eso hay `proveedorId` que no corresponden a ninguna ficha.

Lo de los 33 inactivos es lo único que el código **no** explica: hay una sola forma de
marcar un proveedor como inactivo y es de a uno, con confirmación
([`Proveedores.tsx`](./src/paginas/Proveedores.tsx), `alternarActivo`). O se hizo a
mano 33 veces, o entró así en un respaldo importado. Desde el 11/10 el historial
registra ese campo, así que de acá en adelante se sabe.

### El id del proveedor sale del nombre

La raíz del problema es que el id se sorteaba. Desde el 17/10 lo decide el nombre
([`src/lib/idProveedor.ts`](./src/lib/idProveedor.ts)): "MOHICANO" es siempre
`prov-mohicano`, en cualquier dispositivo y para siempre. Dos celulares que nunca se
hablaron llegan al mismo id sin tener que ponerse de acuerdo — el nombre ya es el
acuerdo.

El mismo valor sirve para dos cosas: es el id, y es la respuesta a "¿estos dos son el
mismo proveedor?". Que sea **una sola función** es a propósito: si agrupar y nombrar
usaran reglas distintas, se podrían agrupar dos fichas y después darles ids diferentes.
La consecuencia es que dos nombres que dan el mismo id **son** el mismo proveedor para
la app: "HUGO-LA ENTRERRIANA" y "HUGO LA ENTRERRIANA" se juntan, que es lo que se
quiere. Hasta ahí llega: "S.A" y "SA" dan ids distintos, porque juntarlos pediría
colapsar las letras sueltas y esa regla también juntaría nombres que no son el mismo.
Está anotado en las pruebas.

Todos los caminos que crean un proveedor a partir de un nombre pasan por
`asegurarProveedor()` en [`src/db/db.ts`](./src/db/db.ts): el alta de Proveedores y el
"+ Proveedor nuevo…" de Productos. Que sea uno solo es lo que garantiza que los dos
lleguen al mismo id.

Esto se hizo pensando en la importación del Excel, que iba a crear varias decenas de
proveedores de una. **Esa importación se canceló el 20/10 y la carga pasó a ser a
mano**, lo que no lo vuelve menos necesario: al contrario. Una importación se escribe
una vez y se revisa; una persona escribe el nombre cada vez, y escribe "Mohicano" un
martes y "MOHICANO " el jueves. `asegurarProveedor()` reconoce que son el mismo y reusa
la ficha en vez de crear una copia — con mayúsculas distintas, con acentos, con espacios
de más, y con los **otros nombres** que se le hayan cargado.

### Los alias: los casos que el nombre no junta solo

"ARANDU" y "ARANDUPÒ" son el mismo proveedor, pero sus nombres no se normalizan igual,
así que darían dos fichas. Para eso la ficha tiene **otros nombres** (`alias`): se
cargan desde Proveedores → Editar, separados por coma, y desde ahí la app los trata
como la misma ficha — en el plan de limpieza, en el formulario de productos y en la
importación del Excel.

Es a propósito que sea **un dato y no una regla en el código**: cada caso nuevo se
resuelve cargando el alias, sin tocar la app ni esperar una versión nueva. Y al
unificar, el nombre de cada ficha absorbida queda automáticamente como alias de la que
sobrevive, para que nadie la vuelva a crear escribiendo ese nombre.

### La revisión, y el botón de aplicar

[`src/lib/planProveedores.ts`](./src/lib/planProveedores.ts) calcula el plan y
**Ajustes → Revisión de proveedores** lo muestra. Nada se escribe hasta tocar **Aplicar
el plan** y confirmar: el arreglo mueve el proveedor de cientos de productos de una, y
eso se mira antes de que pase.

El plan sale en el orden en que conviene ejecutarlo:

1. **Unificar.** Las copias del mismo nombre se juntan en una: sobrevive la que más
   productos tiene (a igualdad, la más vieja) y las demás le ceden los suyos. Además
   cada ficha pasa a tener el id de su nombre, así que **también entran las que no
   están repetidas pero tienen un id al azar** — si se les dejara el id viejo, el día
   que alguien vuelva a escribir ese nombre aparecería una segunda ficha y el lío
   volvería a empezar.
2. **Reenganchar.** Productos que apuntan a una ficha inexistente pero cuyo nombre —que
   los productos traen escrito en el campo `proveedor`, de la planilla vieja— coincide
   con una ficha que sí existe. No hay que crear nada: se reapunta.
3. **Crear.** De estos no quedó ninguna ficha en ningún lado. Se agrupan **por nombre
   normalizado**, no por id perdido: tres ids distintos que dicen "MOHICANO" dan **una**
   ficha, no tres. Nacen activas.
4. **Reactivar.** Se calcula **sobre el resultado simulado de los pasos 1 a 3**, no
   sobre la foto de hoy, y ahí está lo importante: antes de mover los productos la foto
   miente. Una ficha inactiva que hoy figura sin productos vigentes puede recibir 18 al
   reenganchar, y entonces sí hay que reactivarla. Solo se reactivan las que terminan
   con productos vigentes: si una quedó inactiva y todos sus productos quedaron
   descontinuados, esa decisión fue deliberada y no se deshace sola.

Los ids perdidos cuyos productos **no dicen de quién son** no se pueden resolver solos y
salen aparte, para asignarlos a mano.

El aplicar vive en [`src/db/limpiarProveedores.ts`](./src/db/limpiarProveedores.ts), y
hay tres decisiones que vale la pena saber:

- **Vuelve a calcular el plan adentro de la transacción.** La pantalla muestra un plan
  de hace unos segundos; lo que se aplica es el de los datos de este instante. Por eso
  devuelve lo que realmente hizo, y la pantalla informa **eso** y no lo que había
  prometido.
- **El orden no es casual:** primero queda lista la ficha final, después se mueven los
  productos, y recién al final se borran las absorbidas. Al revés habría un momento con
  productos apuntando a una ficha que ya no existe.
- **Es idempotente.** Correrlo dos veces no cambia nada la segunda: una ficha que ya
  está como tiene que estar no se reescribe, así que un doble toque del botón no sube
  cincuenta fichas a la nube para nada. Hay una prueba de eso.

Además, con la nube configurada el botón **no aparece si no hay sesión iniciada**: sin
alguien a quien atribuirle el cambio el historial no anota nada, y una limpieza que
toca cientos de productos sin dejar constancia es justo lo que el historial existe para
evitar.

La lógica tiene 28 pruebas y el aplicar 12, incluidas las que verifican que después de
aplicar no queda ningún producto apuntando a una ficha inexistente y que el plan ya no
propone nada más.

---

## Lo que pasó el 20/10: el catálogo público pisó los costos

A las 16:40 del 20/10/2026 quedaron cientos de productos sin costo y sin proveedor.
MR001 a MR006, que tenían los dos, aparecieron vacíos; los productos con ficha de
proveedor bajaron de 899 a 619; 820 de 1.352 quedaron sin costo. El precio de venta
quedó intacto en todos.

### La causa

`sembrarCatalogo()` escribe los 1.280 productos de `public/catalogo.json` en la base
del dispositivo. Ese archivo es el catálogo público: lleva código, descripción y
precio de venta, y **no lleva** costo, proveedor, rentabilidad ni fecha de compra —
todos vienen en `null`, que es justamente lo que lo hace publicable.

Ese `bulkPut` no estaba envuelto en `comoRemoto()`, así que cada producto pasaba por
los ganchos de escritura y el motor de sincronización lo subía al servidor.

Falta una pieza más para que eso rompa algo. En `App.tsx`, `iniciarMotor()` —que es
quien engancha `pushCambio`— corre **antes** que `sembrarCatalogo()`, y `pushCambio`
solo se abstiene mientras no haya `auth.currentUser`. En un celular al que le borraron
los datos, la sesión de Firebase se restaura sola a los pocos cientos de milisegundos:
a mitad del `bulkPut` deja de haber freno, y los productos que faltaban suben con
`setDoc` encima de los buenos.

Eso explica las cinco cosas que se vieron, y conviene leerlas juntas porque cada una
sola lleva a otra conclusión:

- los nulos caen **exactamente** en los campos que el catálogo público no trae;
- el precio de venta quedó igual, porque el catálogo sí lo trae;
- **no quedó un solo renglón en el historial**: el perfil todavía no había cargado,
  `obtenerAutor()` devolvía `null`, y el historial no anota lo que no le puede
  atribuir a nadie (ver "El historial de modificaciones");
- fueron ~280 productos y no 1.280: los que alcanzaron a pasar antes de que se
  restaurara la sesión no subieron;
- 16:40, que es la hora en que se rearmó el celular.

Quedan descartados los dos sospechosos de siempre: los meses históricos no hacen nada
porque sus archivos ya no están publicados y `bajarJSONSiEsta()` devuelve `null`, y
`aplicarPreciosNuevos()` sí estaba envuelto en `comoRemoto()`.

### Los dos frenos

Son dos capas distintas a propósito, porque protegen de cosas distintas.

**1. En la app** (publicado el 20/10 a las 21). El `bulkPut` del sembrado va dentro de
`comoRemoto()`. Sembrar es traer una copia de algo que ya es de todos, igual que
aplicar un cambio que baja del servidor: se guarda en el dispositivo y no se sube
nunca. Lo cubren tres pruebas en `src/db/sembrarNoSube.test.ts`.

**2. En el servidor** (`firestore.rules`). Un dato cargado no se puede reemplazar por
uno vacío:

```
function noPisaConVacio(campo) {
  return !(
    resource.data.get(campo, null) != null &&
    request.resource.data.get(campo, null) == null
  );
}
```

Vale para `precioCompra`, `proveedorId`, `proveedor` y `rentabilidad`. Esta capa es la
que importa de verdad, porque protege **aunque el dispositivo tenga una versión vieja
de la app** — que es justo el caso que no se puede controlar desde acá. Ocho pruebas
en `pruebas/reglas.test.ts`, incluida la del caso exacto del 20/10.

La contra, dicha de frente: **vaciar un costo a propósito tampoco se va a poder.** Un
costo que quedó mal se corrige poniendo el que corresponde, no dejándolo en blanco. Es
un precio barato y está decidido así.

### La pantalla de recuperación

**Ajustes → Recuperar costos y proveedores**, solo para el dueño. Busca lo que falta y
lo rellena, con vista previa antes de escribir nada.

La regla de oro, y no se negocia: **solo rellena lo que está vacío.** Nunca pisa un
valor cargado. Si no, recuperar lo viejo borraría lo que se cargó esta semana, que es
el mismo error del 20/10 al revés. `aplicarPlanRecuperacion()` vuelve a leer cada
producto justo antes de escribirlo, así que algo cargado entre la vista previa y el
botón tampoco se pisa.

Las fuentes se consultan **en orden** y gana la primera que tenga el dato:

1. **El historial de la app.** La más nueva y la más precisa: guarda, producto por
   producto y campo por campo, el último valor que tuvo. Incluye los 1.506 renglones
   del 14/10, que son los costos reales del servidor de ese día.
2. **Los archivos que se carguen** (`.csv` o `.json`): el Excel viejo, o una copia
   anterior de los productos. Se leen en el dispositivo, no se suben a ningún lado y
   no quedan guardados.

**Un código repetido en una fuente queda afuera.** Si el mismo código aparece dos veces
en el archivo son dos productos distintos con la misma clave, y no hay forma de saber
cuál de los dos es el que está en la app. La pantalla los lista por su nombre para
cargarlos a mano.

> Esto se agregó el 21/10, después de que pasara. El lector se quedaba con la **primera**
> fila, y en el bloque `LST` la primera no es la que quedó en la app: `LST009` es "TABLAS
> GUAYUBIRA SURTIDAS CHICAS" ($ 1.800) en una fila y "MATERA BOLSO" ($ 40.000) en otra, y
> la app tiene la segunda. Entró con un costo 95 % más barato. Lo destapó el aviso de
> "costo que no cierra", que marcó cinco. Los otros dos afectados —`221-264` y
> `151-327`— no lo dispararon porque el costo equivocado era plausible.
>
> Quedarse con el primero, con el último o con el más caro son todas formas de elegir a
> ciegas. La única respuesta honesta es no elegir.

**El costo viaja con su fecha y con su rentabilidad, y los tres salen de la misma
fuente.** Mezclar el costo de una con la fecha de otra deja un dato que no existió
nunca. Y la fecha es la de verdad, no la de hoy: un costo de agosto que entrara con la
fecha de hoy pasaría por actual y nadie lo volvería a mirar; con su fecha, la app lo
marca como **costo vencido** y queda en la lista de lo que hay que actualizar, que es
donde corresponde. La vista previa dice cuántos van a quedar así.

El proveedor vuelve con su nombre y con el id derivado de ese nombre. Si la ficha
existe queda enganchado solo; si no, queda como "proveedor inexistente", que es lo que
el botón de **"Ver y asociar"** sabe resolver. Por eso la recuperación va primero y el
botón después: recuperando vuelven los nombres, y recién ahí hay algo que agrupar.

Todo queda en el historial con el motivo «Recuperación de costos y proveedores», y la
confirmación dice cuántos productos toca antes de hacerlo.

---

## Dos cosas sobre los costos

### El aviso de "costo que no cierra"

Caso real: **TM051**, costo $ 3.100 y precio $ 71.900. Al costo le faltaba un cero.

Es el problema opuesto a vender bajo costo, y hasta ahora no lo miraba nadie. Lo
peligroso no es el reporte: es que **el precio que la app sugiere sale diez veces más
barato**. Alcanza con que alguien acepte esa sugerencia para vender a un décimo.

Lo detecta `costoSospechoso()`, y el criterio es el desvío contra **la rentabilidad del
propio producto**, no contra el precio pelado. La diferencia importa: por precio pelado
los más desviados de la base real son costos viejos de artículos baratos —inflación, no
error— y el aviso sería puro ruido. Contra la propia rentabilidad, un cero de menos da
exactamente 10×.

El umbral es **6**. Con la base real: los markups van de 1,0 a 2,2 y el desvío casi
nunca pasa de 3, así que en 6 no entra ninguna oferta normal de las 1.152 que tienen los
tres datos cargados, y sí entran las dos que están mal. Sin rentabilidad cargada no hay
contra qué comparar, así que ahí se mira el precio pelado con una vara más alta (15).

Cuando el cero de más deja el precio donde corresponde, el aviso lo dice: *"¿no será
$ 31.000?"*. Cuando no cierra, avisa igual pero sin sugerir un número inventado.

Aparece en el Panel como hallazgo crítico, en Productos como filtro, y en cada renglón
de la lista.

### Revisión de costos

**Ajustes → "Revisión de costos"**. Los productos sin costo o con el costo vencido,
filtrables por proveedor y corregibles en la misma lista.

Desde el 19/11 la misma pantalla tiene una segunda vista con todos los productos de un
proveedor: ver «La planilla del proveedor».

Sandra actualiza costos con la factura del proveedor delante. Entrando y saliendo de la
ficha de cada producto, de a cien, eso no se termina nunca.

Se escriben **dos campos y nada más** —el costo y su fecha— y solo en los renglones que
ella toca. El precio de venta, la rentabilidad, el stock y el proveedor quedan como
están: esta pantalla corrige costos, no es un editor de productos.

Tres cosas que hace sola:

- Mientras se escribe, muestra en cuánto quedaría el margen y qué precio pediría el
  markup. Es la forma de ver el cero de menos **antes** de guardar.
- Si el número no cierra —el mismo criterio del aviso de arriba, o un costo que dejaría
  el producto vendiéndose bajo costo— **pregunta antes de guardar**.
- Si alguien cambió ese costo desde otro dispositivo mientras la lista estaba abierta,
  **no lo pisa**: avisa y deja los dos valores a la vista. La pantalla no puede saber
  cuál de los dos es el bueno.

Los descontinuados quedan afuera: nadie los va a reponer y solo llenarían la lista.

### Y un bug viejo que esto destapó

`leerNumero()` leía **"31.000" como 31**. No era de esta pantalla: era de todas —Caja,
Productos, Proveedores— porque `Number("31.000")` da 31, y el punto de los miles es lo
más natural del mundo escribiendo acá.

Ahora un punto seguido de grupos de exactamente tres dígitos es separador de miles
(`31.000` → 31000, `1.500.000` → 1500000) y cualquier otro punto sigue siendo decimal
(`3.5` → 3.5). Se encontró probando la pantalla en el navegador, no en las pruebas: el
primer costo que cargué quedó en $ 31.

---

## Unir proveedores

Sandra terminó de asociar los productos —cero con "proveedor inexistente"— y quedaron
fichas repetidas que el id derivado del nombre no junta solo, porque los nombres no
normalizan igual: `SALDO`/`SALDOS`, `VICTOR ESTEBANEZ`/`VICTOR ESTEVANEZ`,
`ARIEL GARCIA`/`ARIEL GARCIA MISIONES`, `DISTRIBUIDORA DE MATES`/`DISTRIBUIDORA MATES`,
y tres proveedores con dos fichas idénticas cada uno.

**Ajustes → "Unir proveedores"**, para dueño y encargada.

### Lo que se mueve

A la ficha que queda le pasan los productos **y toda la cuenta corriente de la otra**:
compras y pagos. Esto último es la parte que no se puede olvidar — si la plata quedara
colgada de un id borrado, no la encontraría nadie, y tener dos fichas es mejor que eso.
Todo va dentro de una transacción: o se mueve todo, o no se mueve nada.

El nombre de la ficha borrada queda como **"otro nombre"** de la que queda. No es
cosmético: `asegurarProveedor()` mira los alias, así que si mañana alguien escribe el
nombre viejo cae en la ficha buena en vez de volver a crear la copia.

Si la ficha que queda tiene campos vacíos —teléfono, ciudad, alias para transferir— se
completan con los de la absorbida. Los que ya tenía no se tocan.

### Las sugerencias

`src/lib/fichasParecidas.ts` arma la lista de sospechosos con tres criterios, y ninguno
une nada solo:

- **mismo nombre** una vez sacados acentos, puntuación, plurales y palabras de relleno
  (`de`, `la`, `y`). Junta `SALDO`/`SALDOS` y `DISTRIBUIDORA DE MATES`/`DISTRIBUIDORA
  MATES`;
- **casi igual**: una sola letra de diferencia en una sola palabra, y solo en palabras de
  cinco letras o más. Junta `ESTEBANEZ`/`ESTEVANEZ` y deja afuera `MATE`/`MATA`;
- **empieza igual**: las palabras de una son el comienzo exacto de la otra. Junta
  `ARIEL GARCIA`/`ARIEL GARCIA MISIONES` y deja afuera `MATES RAFAEL`/`MATES DEL LITORAL`,
  que comparten la primera palabra y no son el mismo.

Con las once fichas de prueba encuentra exactamente los cinco pares reales y ninguno más.
Si dos fichas son el mismo proveedor lo sabe una persona, no una regla: la sugerencia
ahorra el trabajo de buscarlos, la decisión es de quien está mirando.

### Y un agujero del historial que esto destapó

`movimientosProveedor` registraba `tipo`, `monto`, `fecha` y `concepto`, pero **no
`proveedorId`**. O sea: mover una compra de un proveedor a otro —mover plata de una
cuenta corriente a otra— no dejaba rastro. Ahora sí.

---

### Las fichas repetidas vacías, de una (10/11)

El 10/11 se encontraron en el servidor 94 fichas con el mismo nombre exacto que otra, sin
productos ni compras ni pagos, todas de la importación del 18/08. Unirlas de a una eran 94
vueltas. Arriba de la pantalla aparece ahora **«Fichas repetidas vacías»**
(`src/lib/fichasRepetidas.ts`):

- **La lista entera, antes de tocar nada:** el nombre, cuándo se creó la vacía, cuántos
  productos y compras tiene la gemela, y qué pasa a la gemela.
- **Un botón une todas.** Pregunta antes cuántas son, con un ejemplo. De cada vacía pasan a
  la gemela el teléfono, la ciudad o el alias si la gemela no los tenía, y sus otros nombres.
  Ningún producto, compra ni pago cambia de lugar.
- **Cada una se vuelve a mirar al unir** (`unirFichasVacias`). Si ya no está, si cambió de
  nombre o si le cargaron algo desde que se mostró la lista, se saltea y se dice por qué. Todo
  va en una transacción, con el motivo «Unión de fichas repetidas vacías» en el historial.
- **Lo que no es vacío no entra.** Si dos fichas del mismo nombre tienen datos, aparecen
  aparte («Mismo nombre, con datos en más de una»), con «Elegir», que las pone en la unión de a
  una. Si todas las de un nombre están vacías, no hay cuál es la buena y no se tocan. Los
  parecidos (SALDO y SALDOS) siguen en las sugerencias de siempre.
- **Los menús muestran cuántos productos tiene cada ficha:** dos con el mismo nombre se veían
  iguales.

**Las de un nombre con todas sus fichas vacías también entran (20/11).** Antes se dejaban
porque «no hay cuál es la buena», pero tampoco hay nada que perder: ninguna tiene productos,
compras ni pagos. Queda una (`quedaEntreVacias`): la que ya tiene el id de su nombre (a la que
llegan la importación del Excel y cualquier aparato) o, si no, la que tiene más datos de
contacto y pago, la activa, la más vieja. Las demás se le unen en la misma pasada, con sus
datos. En la lista dicen «vacía también», y la pregunta dice de cuántos nombres. Así la
limpieza se hace de una vez y no quedan nombres repetidos sueltos; solo los que tienen datos en
más de una ficha, que van a mano.

**Y la unión ahora deja constancia en `borrados`, también la de a una.** Antes la ficha
absorbida se borraba sin constancia. Un aparato que estuvo apagado puede volver a subir lo que
el servidor no tiene, salvo lo que figura en `borrados` (es lo que pasaba con los turnos). Si
alguien vuelve a crear un proveedor con ese mismo id, la constancia se olvida
(`olvidarBorradoDeProveedor`); si no, la revisión de lo que no sube lo sacaría de los
aparatos.

Probado:
- 6 pruebas de la lista y 7 de la unión, rotas a propósito de 14 maneras y las 14 en rojo:
  - la unión de a una sin constancia;
  - la constancia que no se olvida;
  - sin mirar el nombre, o si tiene datos;
  - la de las vacías sin constancia;
  - pisando los datos de la gemela, o sin sus otros nombres;
  - sin borrar la vacía, o con otro motivo;
  - sin recortar espacios;
  - dos fichas con datos tomadas como una;
  - las únicas tomadas como repetidas;
  - sin contar compras y pagos;
  - sin ordenar.
- En el navegador, a 1440 y a 390, la lista y el botón.
- Contra los emuladores, con la Mac de Emmanuel y un celular de Sandra que estaba sin
  conexión:
  - en el servidor quedan las gemelas, con el teléfono y la ciudad rescatados;
  - los productos no se mueven, y hay una constancia por ficha con quién y el motivo;
  - el celular vuelve y no devuelve nada;
  - cero rechazos y nada «sin subir».
- La misma prueba sin la constancia: el celular tampoco las devolvió. La copia local de
  Firestore le avisó el borrado antes de subir. La constancia es la segunda barrera, para un
  aparato que no tenga esa copia, como con los turnos.
- El 20/11, con la versión que sube lo que se carga mientras la app recibe
  (`pruebas/e2e/proveedores.cjs`): 110 fichas como las del servidor, 64 vacías repetidas (4 de
  nombres con todas vacías) y un par con datos. La lista muestra las 64 antes del botón, un
  toque las une, a los 12 s la pantalla confirma «Las 64 constancias ya están en el servidor»,
  quedan 46 fichas (el único nombre repetido es el par con datos), ningún producto cambia de
  ficha, y el aparato de Sandra, abierto todo el tiempo, baja a 46 sin nada «sin subir» ni
  ningún rechazo. Las pruebas de la lista, rotas a propósito de 14 maneras más: las 14 en rojo.

## Que un producto no se cargue dos veces

Dos formas de duplicar un producto, con dos arreglos distintos.

### Mismo código, otro dispositivo

`guardar()` validaba "ya existe" **solo contra la base local**. Un dispositivo que estuvo
un rato sin internet no tiene los productos que se crearon mientras tanto: para él ese
código está libre. Al subirlo, `setDoc` **pisa** el del servidor y el producto que estaba
desaparece debajo del nuevo — el mismo final del 20/10 por otro camino.

Ahora, al crear, se pregunta también al servidor (`existeEnLaNube()`). Las tres
respuestas son distintas y las tres importan:

| Respuesta | Qué hace |
|---|---|
| ya existe | frena, y dice que está en el servidor aunque no se vea acá |
| está libre | sigue normal |
| **no se pudo saber** | **frena**: «Sin conexión no se pueden crear productos nuevos. Conectate y probá de nuevo.» |

Lo tercero es lo que no se puede barrer bajo la alfombra: **no saber no es lo mismo que
estar libre**.

La primera versión avisaba y dejaba seguir, por no trabar el mostrador. Emmanuel lo
corrigió el 21/10 y tiene razón, por dos motivos que yo no había puesto en la balanza:
los productos **los da de alta solo Sandra desde la Mac** (decisión del 20/10), así que
frenar no traba ninguna venta; y mientras no exista el respaldo nocturno, **un producto
pisado no se puede recuperar de ningún lado**. Cuando el respaldo esté andando se
revisa.

La regla vive en `src/lib/codigoNuevo.ts`, separada del formulario justamente para que
los cuatro casos se puedan probar.

### Mismo producto, otro código

El 21/10 se cargó `LST016` con la descripción de `MATERA RECTANGULAR`, que ya existía
como `LST010`. Cuando eso pasa, el stock y las ventas quedan repartidos entre los dos y
ninguno de los dos números sirve.

Al escribir la descripción, la app avisa si ya hay un producto con esa misma descripción
—o con una a una letra— y muestra su código y su costo. **Avisa y no frena**, a
propósito: "LIMPIA BOMBILLA" lo venden cuatro proveedores y son cuatro productos con su
propio costo. Quien está cargando es el único que puede saberlo.

Y hay un filtro **"Repetidos por nombre"** que los agrupa para revisarlos de a tandas.

### Lo que hay hoy

Medido sobre la base real el 21/10 a las 16:03: **25 grupos, 55 productos** comparten
descripción.

Y el número que de verdad importa: **solo 4 de esos grupos comparten también proveedor y
costo**, y los cuatro son variantes legítimas —SUR X MAYOR con sufijos A/B/C, y SALDOS
con precios distintos—. El único producto cargado dos veces de verdad era
`MATERA RECTANGULAR` (`LST010` y `LST016`), y ya está resuelto.

O sea: el catálogo está limpio. El filtro queda como control, no como lista de trabajo.

La comparación ignora mayúsculas, acentos, plurales y palabras de relleno, así que
`TABLA GUAYUBIRA GRUESA 2 HERRADURAS` y `TABLA GUAYUBIRA GRUESA CON 2 HERRADURAS` caen
en el mismo grupo. `con` cuenta como relleno y `sin` **no**: "TABLA CON HERRADURA" y
"TABLA SIN HERRADURA" son dos productos distintos.

---

## Cambiar el código de un producto

Sandra es la que ordena los productos, y hasta ahora la app no dejaba cambiarle el
código a uno que ya existía. Cuando necesitaba renumerar algo se iba al Excel viejo, lo
ordenaba ahí y lo pasaba a mano — y el 21/10 el Excel y la app terminaron diciendo cosas
distintas sobre diez códigos del bloque `LST`.

Al editar un producto hay un botón **«Cambiar el código»**.

### Por qué no es editar un campo

El código **es la clave** del producto (`db.productos` lo usa como id). Habilitar el
campo y escribir encima crearía un producto nuevo y dejaría las ventas apuntando a un
código que ya no existe.

Así que el cambio muda el producto con todo lo que cuelga de él, en una sola
transacción:

- el registro en `productos`, con `busqueda` rehecho (lleva el código adentro);
- `ventas.codigo`;
- las líneas de compra, `movimientosProveedor.items[].codigo`.

El código nuevo pasa por la misma puerta que al crear un producto (`codigoNuevo.ts`): no
puede estar ocupado acá ni en el servidor, y sin conexión no se puede.

### El viejo se archiva antes de borrarse, y las reglas tienen que permitir el borrado

Esto se encontró **la misma noche en que se publicó**, auditando el cableado: la regla de
`productos` en Firestore decía `allow delete: if false`. El servidor aceptaba el producto
nuevo y **rechazaba el borrado del viejo** — la app mostraba el cartel rojo, pero el
código viejo quedaba vivo en el servidor y en los otros celulares, con el producto
repartido en dos.

Dos arreglos, en capas:

1. **En la app**: antes de borrar el viejo, lo deja archivado, inactivo y sin stock. El
   archivado el servidor lo acepta siempre. Si el borrado llegara a rechazarse, lo que
   queda allá es invisible —no sale en listas, catálogo ni selectores— y no duplica
   nada. Lo único que no pasa es que el código quede libre.
2. **En las reglas**: `allow delete: if estoyAlMando()` para productos. Lo puede hacer
   quien puede cambiar códigos: dueño y encargada. Cuatro pruebas nuevas contra el
   emulador, y verificado volviendo la regla a `if false`: las dos de "puede" se caen.

**Hasta que las reglas nuevas estén pegadas en la consola** (247 líneas, desde el link
Raw de la rama), cambiar un código funciona pero el código viejo queda archivado en vez
de libre. Después, queda libre.

### Lo que NO se mueve, y por qué

Los renglones de `historial` del código viejo **se quedan donde están**. No es un olvido:
el historial es de solo agregar, y las reglas de Firestore lo dicen explícitamente
(`allow update, delete: if false`). Intentar reescribirlos haría que el servidor rechace
la escritura.

La vista previa lo dice antes de confirmar: cuántos renglones quedan bajo el código
anterior. El cambio en sí queda anotado, así que el rastro se puede seguir.

### Y el otro pedido de Sandra

También había pedido **poder borrar productos para liberar códigos**. No se implementó el
borrado, y no hace falta: con esto le cambia el código al producto y el viejo queda
libre. Los productos se siguen archivando y no se borran, para que las ventas viejas
sigan teniendo sentido.

---

## Lo que pasó el 22/10: las ediciones que no llegaban

A la mañana, una auditoría con los datos reales encontró que **las ediciones de
productos de Sandra no llegaban al servidor**, aunque sus renglones de historial sí:
DLB001 (costo y precio), LST005, LST006 y LST010 (desarchivar) y el cambio de código
LST016 → LST014, que dejó la MATERA RECTANGULAR dos veces. La última edición suya que
había llegado era la de LST007, el 21/10 a las 17:42.

### Lo que se encontró

1. **El aviso del rechazo no se veía nunca.** El motor lo anotaba en el estado de la
   nube, pero el siguiente snapshot lo borraba, y en un rechazo el siguiente snapshot
   es la reversión misma, milisegundos después. Tampoco iba a la campanita. La edición
   se deshacía sola en pantalla y nadie se enteraba. Ahora hay un **cartel rojo que
   queda hasta que la persona toca "Entendido"**, con el motivo en palabras.
2. **Firestore no dice qué condición falló.** Contesta "Missing or insufficient
   permissions" y nada más. `src/sync/motivoRechazo.ts` repite las preguntas de la
   regla de productos con lo que el servidor tiene de verdad: lee el producto y el
   perfil propio **del servidor**, no de la copia local. Dice si fue el rol con el que
   figura el usuario, o qué dato el cambio dejaba vacío. Cada rechazo queda además en
   la colección **`rechazos`** del servidor, con el texto, los motivos y el mensaje
   original de Firebase, para verlo desde la consola sin pedirle a nadie una foto.
3. **Si lo único que fallaba era un dato vacío, el cambio se reintenta solo** sin ese
   campo (`setDoc` con `merge`). El servidor conserva lo que tenía, por ejemplo el
   proveedor, y el resto de la edición entra: el precio, el costo, el desarchivado. Es
   lo que pide la regla ("un dato cargado no se pisa con vacío") sin tirar abajo lo
   que alguien acaba de cargar. Después se trae a este dispositivo lo que quedó allá.
4. **El formulario de productos le hacía rechazar las ediciones a Gabriela.** Mandaba
   `archivado: false` siempre, y los productos que nacieron de la semilla no tienen ese
   campo en el servidor. Para la regla, un campo que aparece es un campo que cambia, y
   archivar es de dueño o encargado. Ahora el formulario lo manda solo si el producto
   ya lo tenía. El reintento también cubre este caso, para los dispositivos que todavía
   tengan la versión anterior.
5. **La tabla `borrados` no viajaba al servidor.** No estaba entre las tablas con
   gancho de sincronización: la constancia recién subía la próxima vez que ese
   dispositivo iniciaba sesión. Ahora sube en el momento, sin renglón propio en el
   historial (ya lo dice el "borró" de lo que se borró).
6. **Cambiar el código anota el código viejo en `borrados`**, antes de borrarlo. Sin
   eso, cualquier dispositivo que todavía tenga el código viejo lo vuelve a subir al
   iniciar sesión. Si un código anotado se vuelve a usar, la constancia se saca.
7. **Unir dos productos que son el mismo.** "Cambiar el código" a un código que ya
   existe ya no se frena sin más: muestra cuál es y ofrece **unirlos**. Las ventas, las
   compras y el stock del que se va pasan al que queda, que conserva su descripción,
   su costo y su precio. El que se va queda archivado, no borrado. Pide confirmación
   con los números y queda en el historial como "Unión de productos repetidos".

El punto 2 de la auditoría tenía una hipótesis: que el archivado y el borrado iban en
la misma transacción y solo subía el borrado. No era eso. Los dos salen; **el
archivado se rechazaba por la misma causa que las demás ediciones**, y el borrado
porque las reglas publicadas no lo permiten.

### Cómo se probó

- Las pruebas de siempre, y en el emulador de reglas un caso por cada situación: lo
  que `motivoRechazo.ts` dice que pasa tiene que pasar, y lo que dice que se puede
  reintentar tiene que entrar al reintentarlo.
- **La app entera contra los emuladores de Firebase**, con las reglas que están
  publicadas hoy (241 líneas), en el navegador. Un build con `VITE_FIREBASE_EMULADOR=1`
  conecta la app a los emuladores. El build que se publica no lleva esa variable. Esa
  prueba encontró un error que las pruebas sueltas no veían: al traer lo que quedó en
  el servidor después del reintento, la escritura local caía dentro de una transacción
  de Dexie ya terminada (`TransactionInactiveError`). El servidor quedaba bien y el
  dispositivo seguía mostrando lo viejo.

### Por qué la copia de Sandra tenía huecos

Emmanuel descartó el rol: en los datos figura `encargado` exacto. Fue un dato que se
mandaba vacío, y #55 lo resolvió: al actualizar, las ediciones pendientes de Sandra
subieron. Quedaba la pregunta de fondo: cómo pudo su copia local tener vacíos datos que
el servidor sí tenía.

La causa más probable, encontrada esa misma tarde: **los cambios que llegan del
servidor se guardaban en un solo recorrido, y el primero que fallaba cortaba todo lo
que venía después.** Al abrir la app, el primer snapshot trae la colección entera —miles
de productos, en orden de código—, así que un solo documento malo dejaba atrasados a
todos los que venían detrás, en cada arranque, sin más señal que un `console.warn`.

Una prueba lo reproduce. Con el recorrido viejo, el producto que viene después de un
documento sin código se queda con el proveedor vacío, y la prueba se pone en rojo. Desde
`src/sync/aplicarRemotos.ts` cada cambio va por su cuenta: el que falla se anota en
`rechazos` (acción `recibir`, una vez por sesión y documento) y el resto se guarda. La
prueba contra los emuladores lo confirma con un documento roto puesto primero en el
orden: todo lo que viene detrás llega bien.

Si esta era la causa, la copia de cada dispositivo se arregla sola al abrir la app con
esta versión, y en `rechazos` aparece cuál es el documento malo.

### Lo que todavía no se sabía (a la mañana)

Cuál de las dos causas tuvo Sandra. **El rol** (en el servidor no figura como
`encargado` exacto) explica todos los casos: cada edición que no llegó toca el precio
o el archivado, y lo que sí llegó no. **Un dato vacío** también explica algunos, si su
copia local tenía huecos que el servidor no. La app dice cuál apenas Sandra actualice y
vuelva a intentar: queda en el cartel y en `rechazos`. Si es el rol, el reintento no lo
arregla y hay que corregir su perfil.

---

## Dos cosas chicas del 22/10 a la siesta

### "Actualizar" no se lleva lo que está a medio cargar

Actualizar recarga la app, y una recarga se lleva lo que está escrito y sin guardar: las
líneas de una compra, el conteo de un cierre, un producto nuevo. Cada formulario se
anota mientras tiene algo sin guardar (`src/lib/sinGuardar.ts`), y con algo anotado el
cartel naranja pide guardar primero y el botón pasa a "Actualizar igual". Si se toca
igual, pregunta antes de recargar diciendo qué se perdería.

Cubre el pago a proveedores, la ficha del proveedor, el gasto, el producto, el usuario
nuevo, la apertura y el cierre de caja, la venta a medio cargar, el egreso de caja y los
costos escritos en la Revisión de costos. La compra no hace falta: tiene su propio
borrador, que sobrevive a la recarga (ver abajo).

### "Sigue igual" en la Revisión de costos

Un costo vencido no siempre cambió. Hasta ahora la única forma de sacarlo de la lista
era volver a tipear el mismo número. Con el casillero vacío, el botón de un costo
vencido dice **"Sigue igual"**: renueva solo la fecha, sin escribir el costo. Si alguien
cambió el costo mientras tanto, no confirma nada, porque se estaría confirmando un número
que nadie vio. En el historial queda con su propio motivo, "Costo confirmado: sigue
valiendo lo mismo".

---

## El borrador de la compra

Una compra se carga con la factura delante, línea por línea, y hasta "Guardar compra"
vivía solo en la pantalla: si se cerraba la app, se apagaba el celular o alguien tocaba
"Actualizar", había que empezar de nuevo con veinte productos.

Ahora, mientras se carga, se guarda una copia en el dispositivo (`src/lib/borradorCompra.ts`,
en `ajustes`, que no se sincroniza: es trabajo a medias de quien la carga, no un dato
del negocio). Al volver a abrir "+ Registrar compra" de ese proveedor aparece como
estaba, con un aviso y un botón para empezar de nuevo. Se borra al guardar la compra o
al cancelarla, y cancelar con algo escrito pregunta antes.

---

## Deshacer una venta, y que lo borrado no vuelva

Después de tocar "Agregar" en Caja aparece **"Cargada: … · Deshacer (30)"**. Un
producto equivocado o un cero de más se ven justo ahí, y deshacer de un toque es más
rápido que buscar el renglón y confirmar. A los 30 segundos el aviso se va y la venta
queda.

De paso se arregló el "Borrar" del renglón: no dejaba constancia en `borrados`, así que
un celular que tenía la venta y estaba sin internet la volvía a subir al reconectarse.
Las dos cosas usan ahora `src/db/borrarVenta.ts`, que deja la constancia antes de
borrar, devuelve el stock si el producto lo lleva y queda en el historial con su motivo:
"Venta deshecha al momento de cargarla" o "Venta borrada desde Caja".

---

## El turno que corresponde a la hora

El 23/10 a las 9:13 se abrió el turno TARDE. Caja ya elegía mañana o tarde según la hora,
pero solo al abrirse la pantalla, y la PC del local deja la app abierta de un día para el
otro: a la mañana seguía mostrando la tarde anterior, y la fecha de ayer.

Tres cosas (`src/lib/turnoSegunHora.ts`, `src/db/cambiarTurno.ts`):

- **Caja sigue al día.** Mientras nadie elija otra fecha u otro turno a mano, cuando
  cambia el día la pantalla pasa sola al día de hoy y al turno que corresponde a esa hora.
  No cambia a las 14: a esa hora alguien puede estar cerrando la mañana.
- **Avisa y pregunta.** Si el turno elegido no es el de la hora (antes de las 14, la
  mañana), hay un cartel rojo con un botón para ir al que corresponde, y al tocar "Abrir
  turno" pregunta: "Son las 9:13 y estás abriendo el turno TARDE. ¿Seguro?". Un turno de
  otro día también pregunta.
- **Se corrige sin borrarlo.** Un turno abierto **sin ventas** se pasa de la mañana a la
  tarde o al revés, con su caja inicial y sus egresos, y queda en el historial. Con ventas,
  no: eso ya es mover plata de caja (para una venta suelta está "Pasar a…"). Tampoco si en
  el otro horario ya hay un turno ese día. La regla de jornadas ya lo permitía para
  cualquiera activo; dos pruebas nuevas contra el emulador lo fijan.

Probado en el navegador con el reloj simulado: la app abierta desde las 17:00 del 22 pasó
sola al 23, mañana; a las 9:13 el TARDE avisó y preguntó; y el TARDE abierto pasó a la
mañana con su caja.

---

## Cambio de producto

La app no tenía cómo registrar un cambio (el cliente devuelve uno, se lleva otro y paga o
recibe la diferencia), y Sandra lo resolvía con productos comodín sin proveedor, costo ni
precio: «DIF – Diferencia por cambio» y «SALDOS – DE TODO». Al 26/10 eran $100.700
vendidos sin saber qué salió, sin margen y sin mover stock. Esas ventas no se tocaron:
cambiar datos ya cargados necesita el OK de Emmanuel.

En Caja, **"↔ Cambio"** (`src/db/cambioProducto.ts`, `src/componentes/FormularioCambio.tsx`).
Se elige lo que trae el cliente y lo que se lleva, y la app calcula la diferencia.

### Cómo se guarda

Como **dos renglones de venta del turno unidos por `cambioId`**: el que vuelve en negativo
(cantidad y total con signo menos) y el que se lleva en positivo. Así, todo lo que ya
sumaba ventas da bien sin tocarlo:

- en la caja del turno se mueve solo la diferencia, porque los dos renglones llevan el
  medio de pago de la diferencia. Si se le devuelve plata en efectivo, el efectivo esperado
  baja solo. No se carga un egreso aparte, que la contaría dos veces;
- el costo de mercadería resta el que vuelve (al costo de hoy: el original no se conoce) y
  suma el que sale. El margen queda con la diferencia real;
- el stock del que vuelve sube y el del que se lleva baja (si el producto lleva stock);
- el ranking de productos le descuenta las unidades al devuelto.

Lo que sí se tocó: en el resumen del mes un cambio cuenta como **una** operación, no dos,
y Reportes muestra aparte "Cambios de producto (N), diferencia neta $…". En la lista del
turno los renglones van marcados "CAMBIO · VUELVE / SE LLEVA". Un cambio se borra o se
deshace entero, nunca la mitad, y no se puede pasar al otro turno de a un renglón.
## El mismo egreso del cajón, dos veces

El 23/10 el pago a Dosanto por $37.500 se registró desde Proveedores con la plata del
cajón —eso ya lo descuenta del turno— y después se cargó a mano como egreso en Caja. El
cierre lo descontó dos veces.

Ahora, al cargar un egreso del cajón en Caja, si ese día ya hay uno del mismo monto la
app pregunta antes, diciendo cuál es. Si el que ya está salió de un pago a proveedor,
explica que el cierre ya lo descuenta. Al revés también: registrar un pago a proveedor
con plata del cajón pregunta si ese día ya hay un egreso igual cargado a mano
(`src/lib/egresoRepetido.ts`). No se frena, porque dos egresos iguales el mismo día pueden
ser de verdad.

---

## Ventas sin código

La app ya dejaba «Vender igual, sin código», y está bien que sea así: frenar la venta con
el cliente esperando para dar de alta un producto termina en productos hechos a las
apuradas. Pero se aceptaba cualquier texto, y se usaban productos comodín para lo mismo.
Al 26/10, «SALDOS – DE TODO» y «DIF – Diferencia por cambio» sumaban $100.700 que no
dicen qué salió.

Lo que aprobó Emmanuel (`src/lib/ventaSinCodigo.ts`):

- **La descripción tiene que decir qué es.** Si no, el buscador no ofrece vender sin
  código: necesita al menos una palabra de tres letras o más que no sea genérica ni de
  relleno («saldos», «varios», «de todo», «dif» no alcanzan). Los productos comodín
  aparecen en el buscador marcados en rojo, sin bloquearlos: sacarlos de circulación lo
  decide Emmanuel.
- **Una lista para resolverlas después** (Productos → «Ver y resolver», o Ajustes →
  «Ventas sin código»). Cada venta sin código cargada en la app desde el 1/9 (lo de antes
  es la planilla importada) se asigna **de a una** a su producto. Pasa a tener su código,
  su nombre y el costo de hoy, y descuenta el stock si el producto lo lleva. Lo cobrado no
  cambia y el historial guarda lo que decía antes (`src/db/asignarVentaSinCodigo.ts`).
- **Aviso en el Panel.** «N ventas del mes se cargaron sin código» y, como importante, las
  ventas de productos comodín (sin proveedor, costo ni precio), nombrando cada uno.

Las ventas ya cargadas con DIF y SALDOS **no se tocan**: la lista las muestra y nada más.

---

## Lo que pasó el 31/10: la venta de Gabriela y la copia atrasada

Gabriela cargaba ventas y le salía el cartel rojo «El servidor no aceptó un cambio en
productos». La venta entraba; lo que se perdía era el descuento de stock.

### La causa

Hasta hoy, cada edición mandaba al servidor **el documento entero** del registro, armado
con la copia local (`final = { ...obj, ...combinados }` en el gancho de `db.ts`). Una venta
descuenta stock con `db.productos.update(codigo, { stock })`, así que viajaba el producto
completo, con el precio de venta que tuviera el celular en ese momento.

Si Sandra había subido el precio en su Mac y el celular de Gabriela todavía no lo había
recibido —sin señal, o con la app cerrada en el bolsillo—, el documento que viajaba llevaba
el precio viejo. Para la regla de Firestore eso es cambiar `precioVenta`, y un empleado no
puede: rechazaba el cambio entero, incluido el stock. La reversión del rechazo le volvía a
poner al celular lo del servidor, y el stock quedaba sin descontar. Reproducido contra los
emuladores con el código publicado: venta en el servidor, stock 3 en vez de 2, cartel rojo.

El mismo mecanismo estaba detrás de los problemas de Sandra del 22/10: una copia atrasada
que intenta pisar campos que no tocó.

### El arreglo

Cada edición manda **solo los campos que cambiaron** (`AccionCambio` nuevo: `'actualizar'`),
con `setDoc(..., { mergeFields })`. El servidor los mezcla con lo que ya tiene, y la regla
ve como cambiados solo esos. Con `mergeFields` y no con `merge: true` a propósito: `merge`
mezcla los objetos anidados (los billetes de un arqueo se sumarían a los viejos en vez de
reemplazarlos); `mergeFields` reemplaza cada campo nombrado entero. Las altas y la subida
inicial siguen mandando el documento completo.

Y un segundo ajuste que la prueba de punta a punta destapó: el motor salteaba todo eco
"pendiente" de una escritura propia. Con ediciones parciales, lo que Firestore muestra
mientras espera la confirmación es lo del servidor con lo nuestro encima, y puede traer
campos que otro dispositivo cambió mientras este estaba sin señal. Si se saltea, y la
confirmación no cambia el contenido, no llega ningún otro aviso: el celular de Gabriela se
quedaba con el precio viejo (150 segundos sin converger; recién al recargar). Ahora los
ecos de una modificación se aplican; los de un alta se siguen salteando, que es lo que
saturaba el primer login.

De paso: guardar el formulario de un producto borraba `creadoEn` y `creadoPor`, porque el
formulario arma el objeto de cero y Dexie informaba esos campos como quitados. Ahora se
conservan.

Para poder preguntar «¿qué versión tenés?» sin adivinar, la app muestra la fecha y la hora
del build (y el commit) en Ajustes y en la pantalla de entrada.

### Cómo se probó

- 7 pruebas del gancho: qué viaja en una venta (solo stock, `actualizadoEn` y
  `actualizadoPor`), en un formulario entero, en un alta, al vaciar un campo, y que
  `creadoPor` se conserva. Mutadas: volviendo al documento entero caen 3; sin conservar
  `creadoPor`, cae 1. Y una del motor: el eco pendiente de una edición trae el precio
  nuevo; el de un alta no se reescribe.
- 3 pruebas de reglas: el documento entero con el precio viejo se rechaza; solo el stock
  con `mergeFields` entra y el precio nuevo queda; `mergeFields` reemplaza el arqueo entero.
- La app entera contra los emuladores, como Gabriela: entra, abre el turno, se queda sin
  señal; Sandra sube el precio; Gabriela vende sin señal; vuelve la señal. Con el código
  publicado: stock 3, rechazo, cartel. Con el arreglo: stock 2 en el servidor, precio nuevo
  intacto y ya en el celular, sin rechazos, sin cartel. Los cinco escenarios del 22/10
  siguen pasando.

## Lo que no se sube: un turno que el servidor ya tiene

Cuando una persona inicia sesión, la app sube lo que ese aparato tiene y el servidor
no (`empujarTodoLocal`). Compara por id: si el id no está allá, se sube. Eso duplica un
turno entero en un caso que el 31/10 estuvo a punto de pasar: el celular de Gabriela
tenía turnos con ventas que no habían llegado, Sandra los volvió a cargar desde su Mac
—otro id de turno, otros ids de ventas— y al reconectarse el celular habría subido los
suyos al lado de los de Sandra. Caja muestra uno solo de los dos turnos; los reportes
suman los dos.

### El freno

Un turno se identifica, para una persona, por su fecha y su horario (mañana o tarde).
Antes de subir, la app lee los turnos del servidor; si para esa fecha y horario ya hay
uno con otro id, el de este aparato **se retiene**, con sus ventas y sus egresos. No se
sube ni se borra (`src/sync/retener.ts`). Queda anotado en el aparato
(`ajustes['subidaRetenida']`), sale un cartel arriba de todo —«Hay cargas de este
aparato que no se subieron, a propósito»— y en Ajustes aparece la tarjeta «Cargas
retenidas», con cada turno, sus ventas y su total, y dos botones para quien está al
mando: **«Ya está cargado: descartar»** borra el turno de este aparato nada más (en
`comoRemoto`, sin viajar y sin anotarse como borrado), y **«Falta de verdad: subirlo»**
lo sube igual, a sabiendas de que quedan dos turnos para esa fecha, que después se ven
en Turnos del día.

Lo que el freno no cubre, y por qué:

- Las escrituras hechas con la sesión abierta y sin señal no pasan por la subida
  inicial: las encola Firestore y las manda solo al volver la señal. Eso no se puede
  interceptar desde la app.
- Un aparato con la versión anterior sube lo suyo antes de actualizarse, porque la
  subida inicial corre con el código que ya tiene instalado. Para el celular de
  Gabriela el freno llegaba tarde; la salida fue borrar los datos del sitio en Chrome
  sin abrir la app (está en la Ayuda: «Voy a borrar la app del celular»).

Y para lo que ya quedó duplicado hay un aviso nuevo en el Panel y en la revisión
completa, **«N turnos están cargados más de una vez»** (`caja-turnos-repetidos`), de
cualquier mes, que lleva a Turnos del día. Lo ve quien está al mando.

### Cómo se probó

- 6 pruebas de `retener.ts` (qué se retiene, qué no, qué cuelga de un turno retenido,
  el texto del cartel) y 3 del aviso del Panel. Mutadas: `decidirRetenidos` devolviendo
  vacío caen 2; `cuelgaDeRetenido` siempre falso cae 1; sin el aviso caen 2.
- La app entera contra los emuladores: el celular tiene el turno 29/10 mañana con 2
  ventas y 1 egreso que nunca subieron, y el servidor tiene ese turno cargado por Sandra
  con otro id. Al iniciar sesión el servidor queda igual (su turno, sus 2 ventas), sale
  el cartel, sobrevive a recargar la app, y «descartar» borra las copias de este aparato
  sin tocar el servidor.

## Lo que pasó el 04/11: el aviso «sin subir» que no bajaba

La Mac de Sandra quedó diciendo «Hay 1 cosa sin subir al servidor» y la PC de Gabriela
«3», fijos, mientras las ventas del día subían bien. El aviso compara **cantidades** por
tabla —cuántas filas tiene el aparato contra cuántas tiene el servidor— y no dice qué es
lo que falta. Contra los emuladores, con las reglas que están en la consola y la versión
publicada, salieron exactamente esos dos números.

### Las causas

- **Lo retenido se contaba como «sin subir».** Un turno frenado para no duplicarlo (ver
  "Lo que no se sube") no se sube a propósito, pero el aviso amarillo lo sumaba igual: un
  turno con dos ventas daba 3, al lado de un cartel rojo que decía «no se duplicó nada».
- **Lo borrado desde otro aparato quedaba para siempre.** Si este aparato no se enteraba
  del borrado, la subida inicial lo salteaba —bien, no lo revive— pero tampoco lo sacaba
  de acá. Contaba 1 para siempre.
- **Un lote rechazado se caía entero, y borraba.** La subida inicial manda en lotes de
  hasta 400, y un lote es todo o nada: una sola fila que las reglas no aceptan (un renglón
  del historial firmado por otra persona, un turno que ya trae el cierre autorizado) tiraba
  abajo las demás, en cada arranque, con un `console.warn` como única señal. Y peor: al
  deshacer el lote, Firestore avisa un `removed` por cada fila, y la app las **borraba de
  este aparato**. En la prueba, una venta que estaba solo en la Mac desapareció sin haber
  llegado nunca al servidor.
- **La marca de arranque del historial** (`historial-arranca-2026-10-11`) la pone cada
  aparato para sí, firmada por `sistema`: las reglas no la dejan subir, y viajaba en el lote.

### El arreglo

- Antes de mandar un lote, sus claves se anotan como rechazo; si entra, se desanotan. Así
  la reversión de un lote rechazado ya no borra nada del aparato (`mandarLoteSinPerder`).
  Lo mismo para «Falta de verdad: subirlo» de las cargas retenidas.
- Si un lote falla, o si el aviso sigue arriba de cero después de un minuto, la app
  **revisa de a una** (`revisarPendientes`, `src/sync/sinSubir.ts`): lo borrado a propósito
  se saca de este aparato; un usuario que el servidor ya no tiene también (subirlo podría
  revivir a alguien dado de baja); lo retenido y los renglones del historial firmados por
  otra persona se dejan y no cuentan; lo demás se sube en una transacción que no pisa nada
  que ya esté allá. Un turno con el cierre autorizado lo sube alguien al mando en dos pasos.
  Lo que no entra queda con el motivo.
- El cartel tiene «Ver qué es», que lleva a una pantalla con cada cosa y qué se hizo
  (también desde Ajustes → «Lo que no subió»). Quien está al mando puede sacar de un
  aparato algo que el servidor no acepta; la fila entera queda copiada en `rechazos`.
- Cada revisión deja una constancia en `rechazos` con acción `revisar` y la lista de lo
  que encontró, para verlo desde la consola sin pedir fotos.

### Cómo se probó

- 12 pruebas de `sinSubir.ts`. Rotas a propósito: sin mirar los borrados cae 1; sin
  descontar lo retenido caen 2; tomando el historial de otro como propio cae 1; dejando
  revivir usuarios cae 1.
- La app entera contra los emuladores, en dos aparatos. La Mac de Sandra, con una venta
  borrada desde otro aparato, una venta y un turno autorizado que nunca subieron, y un
  renglón del historial de Gabriela. La PC de Gabriela, con un turno retenido de dos
  ventas y un turno autorizado que como empleada no puede crear.
  - Con la versión publicada: «1» y «3» fijos, y la venta y el turno de la Mac borrados
    del aparato sin llegar al servidor.
  - Con el arreglo sin la protección de lotes: los avisos en cero, pero la venta igual se
    perdía. Por eso la protección.
  - Con el arreglo entero: la Mac sube la venta y el turno con su autorización, saca la
    venta borrada, y queda en cero sin perder nada. La PC no cuenta lo retenido, y el turno
    que no puede crear queda en el aparato con el motivo, contando 1.

## Lo que pasó el 06/11: 406 turnos retenidos y la ruedita del mouse

Emmanuel abrió la app en su Mac después de varios días y aparecieron un cartel rojo con
406 turnos y 1.819 ventas retenidos (del 01/02 al 31/08), un aviso de «406 turnos cargados
más de una vez», y todo muy chiquito. Lo chiquito era el zoom de Chrome en esa ventana,
entre 25 y 33 % (se vuelve con ⌘ 0). Lo demás:

### De dónde salían los 406 turnos

Hasta el 15/10, cada aparato que abría la app importaba por su cuenta los meses viejos de
la planilla (`sincronizarMesImportado`, desde los `historico-*.seed.json` que entonces se
publicaban), y a cada turno le ponía un número nuevo. La Mac tenía su copia de febrero a
agosto y el servidor tiene la de otro aparato: mismo día y horario, otro número. Sin el
freno del 31/10 ("Lo que no se sube"), febrero a agosto habrían quedado duplicados en el
servidor. Desde el 15/10 esos archivos ya no se publican, así que ningún aparato nuevo
vuelve a importar.

### Lo que cambia

- **El cartel resume.** Hasta tres turnos se nombran; más, se dice el tramo («del 01/02
  mañana al 31/08 tarde»). Antes listaba los 406 y tapaba la pantalla.
- **El Panel no cuenta lo retenido** (`idsRetenidos` en la auditoría): una copia retenida
  está solo en ese aparato y tiene su propio cartel, no es un turno repetido del negocio.
  Tampoco reclama los domingos como días sin caja.
- **Copias exactas, de una vez.** «Cargas retenidas» compara cada turno retenido con el que
  tiene el servidor para esa fecha y horario: mismas ventas (producto, cantidad, total y
  medio de pago) y mismos movimientos (tipo, concepto y monto), sin importar el orden
  (`compararConServidor`). Las que coinciden en todo se sacan del aparato con un botón que
  antes dice cuántos turnos, ventas y movimientos son. El servidor no cambia, queda un
  renglón en el historial con el motivo, y la lista entera en `rechazos` (acción
  `descartar`). Las que no coinciden quedan para mirarlas de a una: una versión vieja del
  importador pudo dejar datos distintos.
- **La ruedita del mouse ya no cambia los números** (`src/lib/ruedita.ts`). En la compu, un
  campo de número con el foco cambiaba su valor al girar la ruedita encima: se cargaba el
  conteo, se bajaba en la pantalla, y la cantidad de billetes quedaba en cero. Ahora, si la
  ruedita gira sobre el número que tiene el foco, se le saca el foco: el número queda y la
  pantalla baja. Vale para todos los campos de número de la app.

### Cómo se probó

- 5 pruebas de la ruedita, 3 del cartel y de la comparación, y 3 del Panel. Rotas a
  propósito: sin filtrar lo retenido caen 2; contando los domingos caen 2; con la lista
  entera en el cartel cae 1; comparando solo cantidades cae 1.
- La ruedita en el navegador, sobre el conteo de apertura, con un Chrome que maneja la
  ruedita como uno de escritorio: con la versión publicada, cinco giros dejaron el conteo
  en cero y la pantalla quieta; con el arreglo, el número quedó en 3 y la pantalla bajó.
- La app entera contra los emuladores, como la Mac de Emmanuel: diez turnos de febrero
  propios con otros números, uno con un monto distinto. El cartel dice «del 02/02 al
  11/02», el Panel no los cuenta, la tarjeta separa 9 copias exactas y 1 distinta, y el
  botón saca las 9 del aparato (18 ventas) sin tocar el servidor, con el renglón del
  historial y la constancia.

## Lo que pasó el 07/11: tres turnos de Gabriela que no llegaron

El soporte de Emmanuel encontró que en el servidor faltan tres turnos: 03/11 mañana, 03/11
tarde y 04/11 tarde. Sus 19 ventas sí están, y el historial muestra que Gabriela los cerró con
arqueo. No hay ninguna constancia de borrado.

### Lo que se sabe y lo que no

- **No se borraron del servidor.** Ningún camino de la app borra un turno allá sin dejar
  constancia en `borrados`. La excepción es «Importar un respaldo», en Ajustes (desde el
  19/11 ya no: importar no le borra nada al servidor). «Copias
  retenidas» (usado el 06/11 a las 12:18) solo saca copias del aparato donde se toca.
- **El 04/11 el aviso estaba mal diagnosticado.** Ese día la PC de Gabriela marcaba «3 sin
  subir» fijo, y faltan justo tres turnos. Aquel arreglo se probó con un turno retenido de
  dos ventas, no con sus datos reales. Lo más probable es que fueran estos tres.
- **El aviso «sin subir» tiene un punto ciego.** Compara cuántos registros tiene el aparato
  contra cuántos tiene el servidor, no cuáles. La revisión de a uno saltea una tabla si el
  aparato no tiene más filas que el servidor. Si a un aparato le faltan otros turnos del
  servidor, uno pendiente queda tapado y nunca se intenta subir.
- **Dónde están todavía no se sabe.** Lo más probable es la PC de Gabriela; si se borraron
  los datos del sitio, en ningún aparato. Las ventas cuentan en los reportes. Del turno
  faltan la caja inicial, el conteo del cierre y la diferencia. El conteo y la hora están en
  el historial; la caja inicial no.

### Lo que se agregó (10/11)

- **En el Panel, para quien está al mando:** «N turnos no llegaron al servidor: sus ventas
  sí» (`caja-turnos-sin-subir`, urgente). Sale de las ventas del mes cuyo turno no está, así
  que se ve desde cualquier aparato. Dice la fecha, quién lo cargó, cuántas ventas y cuánta
  plata. El 03/11 lo habría mostrado ese mismo día.
- **En cada aparato, un cartel rojo:** «El turno del 03/11 mañana (8 ventas) no llegó al
  servidor», con qué no hacer. Los turnos de las últimas tres semanas se controlan uno por
  uno (`controlarTurnosRecientes`):
  - primero se cuenta cuántos están, una lectura por cada tanda de 30;
  - recién si falta alguno se pregunta cuáles;
  - no cuentan los retenidos, los borrados a propósito ni los abiertos hace menos de dos
    minutos.

  Corre después del intento de subida inicial, y cada cinco minutos.
- **La subida automática no cambia.** Qué hacer con un turno que no llegó lo decide Emmanuel.

Probado:
- 3 pruebas del cartel y 2 del aviso del Panel, rotas a propósito de 10 maneras y las 10 en
  rojo (una sobrevivía al principio: el vendedor tomado de la primera venta; se cambió el
  caso).
- Contra los emuladores, con el caso armado como el real:
  - el aparato de Gabriela tiene un turno que no puede subir, y sus dos ventas están en el
    servidor;
  - el cartel rojo aparece a los 47 segundos de abrir. Antes, ese aparato reintentó subir lo
    pendiente, de a uno;
  - el turno sigue sin subir;
  - el Panel de Emmanuel muestra el aviso con el detalle;
  - en la compu de Emmanuel no aparece ningún cartel de aparato.

El 20/11 Emmanuel pidió completarlos: se rearman desde Turnos del día con las ventas, los
egresos, el conteo del historial y la cadena de caja. Ver «Rearmar los turnos que no
llegaron».

## Lo que pasó el 13/11: el aparato que dejaba de recibir

El soporte de Emmanuel trajo dos cosas el mismo día:
- A Sandra no le aparecen seis productos que el servidor tiene desde el 29/10 (116-244,
  116-297, 116-331, 116-335, 221-731 y 221-740).
- Volvieron las fichas de proveedor repetidas: 252 en el servidor, con 93 nombres repetidos,
  y ninguna constancia de proveedores en `borrados`.

### Lo que se encontró

- **Una escucha que se caía no volvía.** Cada tabla tiene su escucha del servidor. Cuando una
  termina en error, Firestore la da por terminada y no avisa nada más. La app no la volvía a
  abrir hasta recargar, y la pisaba la primera tabla que recibía algo: el estado volvía a
  decir «Sincronizado». Probado con la versión publicada contra el emulador:
  - se niega una vez leer productos;
  - un producto creado después no llega nunca;
  - apenas cambia un proveedor, Ajustes dice «Sincronizado».
- **Qué puede tirar una escucha:** la cuota diaria de lecturas, un permiso, o la base del
  navegador que falla. La cuota del plan Spark es de 50.000 lecturas, y cada apertura lee la
  base entera (ver «Próximos pasos»). Cuál fue en el caso de Sandra todavía no se sabe: lo
  dice la foto de Ajustes o la consola de Firebase.
- **Un aparato que no recibe sigue subiendo.** La revisión de «sin subir» sube lo que el
  servidor no tiene, salvo lo que figura en `borrados`. Si ese aparato no se enteró de un
  borrado y no hay constancia, lo revive. Es un camino por el que pueden volver las fichas.
- **Las constancias:** la unión publicada el 10/11 las escribe, la masiva y la de a una. Que
  no haya ninguna quiere decir que la limpieza no se corrió o que el servidor las rechazó. Lo
  dicen `historial` (renglones `borro` de proveedores) y `rechazos` (tabla `borrados`). Está
  pedido al soporte.

### Lo que cambia

- **La escucha caída se vuelve a abrir sola**, a los 15 segundos, 30, 1 minuto, 2 y después
  cada 5 minutos para siempre: la cuota vuelve sola a la madrugada. La que se reabre pide
  también los cambios de estado (`includeMetadataChanges`): así se entera de que volvió
  aunque nadie haya cambiado nada. Las que nunca se cayeron quedan como estaban.
- **Mientras haya una caída:**
  - un cartel rojo para todos dice qué no recibe, desde cuándo y qué hacer. Si es la cuota,
    dice que recargar no sirve;
  - el estado queda en error (el Panel lo marca urgente) en vez de «Sincronizado».
- **Constancia en `rechazos`, con acción `escuchar`:** una cuando se cae y otra cuando
  vuelve, con cuánto duró y cuántos intentos llevó.
- **La revisión de «sin subir» no sube nada de una tabla que el aparato no está recibiendo**
  (`sin-recibir`). En «Ver qué es» aparece como «De algo que este aparato no está
  recibiendo», y se revisa cuando vuelve.

La lógica está en `src/sync/escuchas.ts`, aparte del motor, con sus pruebas.

### Cómo se probó

- 6 pruebas de `escuchas.ts` y una de la clasificación. Se rompieron a propósito de 11
  maneras y las 11 quedaron en rojo.
- Contra los emuladores, con las reglas publicadas:
  - se niega leer productos y el aparato arranca: aparece el cartel y queda la constancia;
  - mientras sigue caída cambia un proveedor: el estado sigue en error;
  - se vuelve a permitir: el cartel se va solo a los 10 a 14 segundos, sin ningún cambio en
    productos;
  - un producto creado después llega, y queda la constancia de la vuelta.
- La misma prueba con tres roturas del motor (sin reabrir, sin los cambios de estado,
  «Sincronizado» siempre): las tres fallan.

### Las constancias, confirmadas contra el servidor (publicación aparte)

Hasta el 13/11, la unión escribía la constancia en el aparato y suponía que llegaba. Ahora:
- **Después de unir**, la masiva y la de a una, la app espera a que salga lo que tiene en
  cola y le pregunta al servidor por cada constancia. Lo dice en verde si están todas. Si
  falta alguna lo dice en rojo, con cuántas y con que no se repita la limpieza.
- **Arriba de la pantalla**, «Constancias en el servidor» dice cuántas hay en total. Avisa
  si falta alguna de las que se unieron desde ese aparato, y «Revisar de nuevo» vuelve a
  preguntar. Es lo primero que hay que mirar antes de repetir la limpieza.

La pregunta va de a 30 constancias, por su nombre en el servidor, y lee solo las que
encuentra. Los textos están en `src/sync/constancias.ts`, con sus pruebas.

Probado:
- 5 pruebas de los textos y las tandas, y una de los ids unidos. Se rompieron a propósito
  de 7 maneras y las 7 quedaron en rojo.
- Contra los emuladores, con dos fichas vacías y un par con datos:
  - con las reglas publicadas: «Las 2 constancias ya están en el servidor», después «La
    constancia ya está», y la tarjeta pasa de 0 a 2 y a 3;
  - con reglas que no dejan escribir `borrados`, el caso que explicaría lo del 13/11: las
    fichas se borran igual, y la pantalla dice en rojo «Ninguna de las 2 constancias llegó
    al servidor» y «La constancia no llegó». En `rechazos` quedan las tres.
- La misma prueba con tres roturas fallan las tres:
  - que diga siempre que están;
  - que no pregunte después de la unión de a una;
  - que pregunte con el nombre sin escapar.

De paso: cuando el servidor rechaza las constancias, rechaza también los renglones del
historial de esa unión, que viajan en el mismo momento. La revisión de «sin subir» los
sube después.

Sigue: que la revisión tampoco vuelva a subir una ficha de proveedor vacía cuando el
servidor ya tiene otra con el mismo nombre, aunque falte la constancia. Es la tercera
barrera. Las dos de hoy (la escucha que vuelve y la constancia confirmada) alcanzan para
repetir la limpieza, pero esta cubre las fichas borradas por fuera de la app, por ejemplo
desde la consola de Firebase.

## Lo que pasó el 19/11: lo que se cargaba mientras la app recibía, no subía

Es el hallazgo más importante de la auditoría general del 19/11, y lo más probable es que
sea la causa común de varios problemas que se habían tratado por separado: turnos y ventas
«sin subir», cierres de caja que al día siguiente aparecían abiertos, cosas borradas que
volvían, y la limpieza de proveedores del 13/11.

### Cómo se encontró

Probando otra cosa: un gasto cargado a los pocos segundos de recargar la página no llegaba
al servidor. Sin recargar llegaba en un segundo. Se midió, y se siguió el hilo.

### La causa

Lo que baja del servidor se guarda en el aparato marcado como «remoto», para que no vuelva
a subir ni quede en el historial a nombre de quien tiene la app abierta. Esa marca era un
**contador global** (`remotoEnCurso`, en `src/db/db.ts`): mientras hubiera alguna bajada en
curso, **todo** lo que se escribía en la base se tomaba por remoto. También lo que cargaba
la persona. No se subía y no dejaba historial.

El contador quedaba prendido en dos situaciones, y las dos son de todos los días:

1. **Al abrir la app.** La primera respuesta de cada tabla trae la tabla entera, y se
   guarda documento por documento. En la prueba, con una base chica, eran 7 segundos; con
   la base real y en un celular es bastante más. Abrir la app y abrir el turno enseguida
   dejaba el turno sin subir.
2. **En el medio de cualquier operación de varios pasos.** Cada escritura propia vuelve
   enseguida como eco por la escucha. Guardar ese eco prendía el contador, y como el eco
   tiene que esperar a que la operación suelte la tabla, el contador quedaba prendido
   **hasta que la operación terminaba**: lo que faltaba de la operación no se subía. Un
   ticket de varios productos, un ingreso de mercadería, un remarcado, un cierre.

Lo que pasaba después dependía de qué era lo que no había subido:

- **Un alta** (una venta, un turno, un gasto) quedaba en el aparato y la subía más tarde la
  revisión de pendientes o el arranque siguiente. Es el «hay N cosas sin subir» que
  aparecía y se iba.
- **Una edición** (cerrar un turno, cambiar un precio, descontar stock) no la subía nadie:
  la subida del arranque solo manda lo que el servidor no tiene. Y al abrir la app de nuevo,
  lo del servidor pisaba lo del aparato: el cierre desaparecía.
- **Un borrado** tampoco: al abrir la app de nuevo, lo borrado volvía.

### La prueba, con la versión que estaba publicada

En el navegador, contra los emuladores, la limpieza de «Fichas repetidas vacías» sobre 60
pares:

| | En el aparato | En el servidor, 30 s después |
|---|---|---|
| **Versión publicada hasta el 19/11** | 0 copias, 60 constancias, 2 renglones de historial | **59 de 60 copias siguen**, **1 de 60 constancias** |
| **Con el arreglo** | 0 copias, 60 constancias, 120 renglones de historial | 0 copias, 60 de 60 constancias, 60 de 60 datos rescatados (a los 12 s) |

Es lo que pasó el 13/11: la limpieza se veía hecha en el aparato de Sandra y al servidor
había llegado una parte mínima. Las fichas no «volvieron»: nunca se habían ido. La
confirmación de constancias del 13/11 lo avisa bien («Faltan 59 de las 60 constancias»),
pero no podía decir por qué.

### El arreglo

La marca dejó de ser global: va en la **transacción** que escribe (`comoRemoto(tablas, fn)`
abre una transacción sobre las tablas que va a tocar y la anota; los ganchos de escritura
reciben la transacción de cada escritura y miran si es una de esas). Lo que la persona hace
mientras tanto va en otra transacción: es suyo, se sube y queda en el historial, pase lo que
pase alrededor. No hay nada que prender ni apagar.

- `src/db/db.ts`: `comoRemoto` y los tres ganchos. Es la tercera versión de esa marca; las
  tres están contadas en el comentario, porque las dos anteriores fallaron de formas
  opuestas (ver «Lo que pasó el 14/10»).
- `src/sync/aplicarRemotos.ts`: lo que baja se guarda en transacciones remotas propias, de
  a tandas (más abajo). Antes todo el recorrido iba adentro de una sola marca.
- `src/sync/enOrden.ts`: lo que baja de cada tabla se guarda de a un aviso, en orden (más
  abajo).
- `src/sync/motor.ts` y `src/db/sembrar.ts`: los otros lugares que guardan algo «de todos»
  (el catálogo sembrado, la lista de precios, lo que se saca de un aparato porque ya estaba
  borrado, los turnos retenidos que se descartan).

**Lo que eso le pide a quien toque el código:** adentro de `comoRemoto` solo se escribe en
la base local. No se puede esperar otra cosa ahí adentro (un `fetch`, un `setTimeout`, una
lectura de Firestore): la transacción se cerraría sola. Lo que venga de afuera se busca
antes y se pasa ya resuelto.

De paso se arregló otro error del mismo lugar, que no había llegado a pasar: una edición
hecha adentro de una transacción anidada perdía su renglón de historial (`anotarEnHistorial`
esperaba a la transacción de adentro y no a la de más afuera).

### Lo que baja de cada tabla se guarda en orden

Con el arreglo de arriba, lo que se carga al abrir la app ya sube. Quedaba un problema en el
mismo rato, del lado del aparato: cada aviso de la escucha se guardaba por su cuenta, todos a
la vez. El primero trae la tabla entera y tarda; si mientras tanto la persona cambiaba un
precio o borraba algo, el eco de ese cambio llegaba como un segundo aviso, corto, y se
guardaba **antes** de que el primero llegara a esa fila. Después el primero la pisaba con lo
viejo: en ese aparato el precio volvía al anterior y lo borrado reaparecía. Y lo que
reaparece sin estar en el servidor, la revisión de pendientes lo vuelve a subir.

Ahora cada aviso espera a que termine de guardarse el anterior de su tabla
(`colaPorClave`, en `src/sync/enOrden.ts`). Las tablas no se esperan entre sí, y un aviso que
falla no frena a los que vienen atrás.

### Lo que baja se guarda en tandas (publicación aparte, la misma madrugada)

La marca por transacción tenía un costo que se midió antes de darla por terminada: cada
documento que bajaba abría su propia transacción. Al abrir la app baja cada tabla entera, así
que eran miles, una atrás de la otra, y con cada una las pantallas abiertas volvían a leer.
En el navegador contra los emuladores, con 3.000 ventas en el servidor:

| | La primera vez (baja todo) | Al recargar: termina de guardar lo que baja | Un gasto cargado a los 3 s de recargar llega al servidor |
|---|---|---|---|
| Versión publicada hasta el 19/11 | 130 s | 70 s y 66 s | a los 39 s y 35 s |
| Marca por transacción, de a un documento | 180 s | no terminó en 180 s | a los 84 s |
| **En tandas de 200** | **10 s** | **6 s** | **a los 4 s y 2 s** |

La fila del medio es la primera publicación del arreglo: dejaba de perder lo cargado, pero
abría más lento que antes. Por eso esta salió enseguida, la misma madrugada y antes de que
abriera el local: con las dos, la primera sincronización de la prueba quedó en 10 s contra
los 130 s de la versión anterior.

`aplicarCambiosRemotos` ahora guarda de a `TANDA` (200) documentos por transacción:

- **Cada documento sigue por su cuenta.** El que falla se anota y los demás de su tanda se
  guardan igual (lo del 22/10 no cambia).
- **Si la tanda entera no cierra** —el navegador cortó la transacción, o uno malo la tiró
  abajo—, esa tanda se guarda de a uno, cada cual en su transacción, como se hacía antes.
- **Se respeta el orden**, adentro de la tanda y entre tandas: lo último que llegó de una
  fila es lo que queda.
- **Son 200 y no la tabla entera a propósito:** mientras dura una tanda, lo que la persona
  quiera escribir en esa tabla espera a que termine. Con 200 es un instante.

Lo que se carga en ese rato sigue siendo de quien lo carga: la marca va en la transacción de
la tanda, no en el aire.

### Un aparato atrasado ya no vuelve a subir lo que otro borró (publicación aparte, la misma madrugada)

Buscando qué más podía hacer que algo borrado volviera apareció otro camino, distinto del de
arriba. No es «el borrado no subió»: el borrado llegó bien al servidor, y lo deshace **otro
aparato** al abrirse.

Cada vez que se abre la app pasan dos cosas a la vez: baja lo del servidor, y la subida del
arranque (`empujarTodoLocal`) compara lo que hay en el aparato contra lo que hay en el
servidor para subir lo que falte. Si un aparato estuvo cerrado mientras desde otro se borraba
un gasto, al abrirse todavía lo tiene. El borrado baja enseguida, pero se guarda **después**
de lo que Firestore ya tenía guardado en ese aparato, que es la tabla entera. Si la
comparación se hacía en ese rato, el gasto todavía estaba: «lo tengo yo y el servidor no».
Lo subía de nuevo, y reaparecía para todos.

En el navegador contra los emuladores, un aparato cerrado, otro que borra un gasto y una
ficha de proveedor, y el primero que vuelve a abrir:

| Gastos en la tabla | Versión publicada hasta ese momento | Con el arreglo |
|---|---|---|
| 300 | Queda borrado | Queda borrado |
| 1.500 | Queda borrado | Queda borrado |
| 6.000 | **El gasto vuelve al servidor a los 20 s** | Queda borrado |

Depende de cuánto tarda en guardarse lo que baja: del tamaño de la tabla y de la velocidad
del aparato. Con la base de hoy y en una compu no pasaba; en un celular lento, o con más
gastos cargados, iba a empezar a pasar. No se pudo mostrar que haya pasado antes: con la
versión anterior a las tandas y 1.500 gastos tampoco volvía (ahí tardaba todo más, la
bajada y la subida). Queda cerrado antes de que la base crezca.

Solo afecta a lo que se borra **sin constancia**: gastos, compras y pagos a proveedores,
fichas de proveedor borradas a mano. Las ventas, los turnos y las fichas unidas dejan
constancia en `borrados` y la subida ya no las tocaba.

El arreglo, en `src/sync/enOrden.ts` y `src/sync/motor.ts`:

- **La subida espera.** Antes de leer lo que hay en el aparato de una tabla, espera a que
  termine de guardarse lo que bajó de esa tabla (`esperarLoBajado`). Lo mismo hace la revisión
  de pendientes.
- **Con un límite de tres minutos.** Si se cumple, de esa tabla no se sube nada en esa pasada
  y el control periódico vuelve a mirar: entre subir tarde y revivir lo borrado, se sube
  tarde.
- **Lo que ya no está en el aparato no se sube.** Justo antes de mandar cada fila se vuelve a
  mirar si sigue ahí, y se manda como está en ese momento, no como estaba cuando se armó la
  lista.

En la misma prueba, un gasto que estaba **solo** en ese aparato (nunca había subido) sube
igual: el arreglo no frena lo que tiene que subir.

Lo que no cubre: una fila que está en la base de la app pero que Firestore, en ese aparato,
no conoce —nunca pasó por él— no se puede distinguir de una que nunca subió. Para eso hacen
falta constancias en todas las tablas (ver «Próximos pasos»).

### «Importar un respaldo» ya no le borra nada al servidor

Revisando qué otras operaciones escriben muchas filas de una apareció esta. Importar vacía
cada tabla y la vuelve a llenar, y con la sesión abierta cada fila vaciada era un borrado
que viajaba al servidor y cada fila llenada un alta, de a una. La pregunta decía «reemplaza
los datos de este dispositivo»; lo que hacía era reemplazar los del negocio.

En la prueba contra los emuladores, con la versión que estaba publicada, importar un
respaldo de dos productos fue borrando el catálogo del servidor: de 1.283 productos a 1.210
en un minuto, y seguía. Con la base real son decenas de miles de escrituras; el plan gratis
de Firebase corta antes de terminar y el servidor queda borrado a medias, para todos. No hay
registro de que alguien lo haya usado con la sincronización prendida.

Ahora importar está en `src/db/importarRespaldo.ts` y va marcado como remoto: reemplaza los
datos **de ese aparato** y nada más. No sube un solo cambio ni deja historial. La pregunta de
antes dice de cuándo es el archivo, cuántos productos, turnos y ventas trae, y qué pasa con
el servidor: lo que el servidor ya tiene manda y vuelve a bajar al abrir la app; lo que el
archivo tenga y el servidor no, se sube como lo de cualquier aparato atrasado. Si el archivo
está roto a la mitad, no cambia nada. Sigue siendo solo del dueño.

La misma prueba con esta versión: el servidor queda con sus 1.283 productos, sus ventas y
sus gastos; al volver a abrir la app el aparato vuelve a tener lo del servidor, y lo único
que sube es lo que el archivo tenía de más (un producto y un gasto).

Recuperar el negocio entero desde un respaldo, si algún día hace falta, es otra herramienta
(en lotes, contando y preguntando) y no existe todavía.

### Cómo se probó

- 7 pruebas de «Importar un respaldo» (rotas a propósito de 8 maneras, las 8 en rojo).
- 6 pruebas del guardado en orden (rotas a propósito de 6 maneras, las 6 en rojo). Una de
  ellas muestra el problema sin la cola: el aviso largo del arranque pisa el precio recién
  cambiado y revive lo recién borrado.
- 48 pruebas en los tres archivos de esta parte (`src/db/historial.test.ts`,
  `src/sync/aplicarRemotos.test.ts`, `src/db/sembrarNoSube.test.ts`). Las tres nuevas que
  describen el problema —abrir el turno mientras baja la tabla entera, el ticket de treinta
  productos con el eco, editar el mismo producto que está bajando— **se corrieron contra el
  código que estaba publicado y las tres quedaron en rojo**: del ticket subían 2 de 30.
- El arreglo se rompió a propósito de 14 maneras: 13 en rojo. La que no, es el `?` del modo
  de la transacción (`'rw?'`), una defensa que en las pruebas no cambia nada.
- De punta a punta en el navegador contra los emuladores: la limpieza de 60 pares con las
  dos versiones (la tabla de arriba), el gasto cargado después de recargar, y las pruebas
  que ya había de lo que toca sincronización (ticket, ingreso, rechazo de una escritura,
  turnos retenidos, escuchas, constancias), con las dos versiones para comparar. Ver el PR.
- **Las tandas:** 4 pruebas nuevas (una transacción por tanda y no por documento; uno malo
  en el medio no tira abajo la tanda; si la tanda entera no cierra se guarda de a uno; el
  orden adentro de la tanda), y la de «abrir el turno y editar mientras baja la tabla
  entera» pasó de 400 a 1.000 documentos, cinco tandas. Rotas a propósito de 10 maneras, las
  10 en rojo. De punta a punta, además de la medición del arranque: la batería entera otra
  vez sobre la versión en tandas —cambiar el código de un producto, ticket, ingreso,
  limpieza de 60 fichas, editar y borrar a los 2 s de abrir, escuchas, constancias,
  pendientes sin subir, rechazo de una escritura, Gastos, la planilla, el gasto tras
  recargar, importar un respaldo, «Cómo venimos», copias y turnos retenidos, sueldos—, sin
  diferencias con la versión de a uno salvo los tiempos. Uno de los documentos de prueba
  está roto a propósito y va primero en su tabla: el de atrás llega igual, que es la
  confirmación en un navegador de verdad de que uno malo no tira abajo su tanda.

- **El aparato atrasado:** 8 pruebas nuevas en `src/sync/enOrden.test.ts`. Tres arman el
  caso —el aparato tiene la fila que el otro borró; baja primero la tabla entera y después
  el borrado— y muestran que sin esperar la subida todavía la ve, y esperando no. Rotas a
  propósito de 6 maneras, las 6 en rojo. La espera adentro del motor y el «lo que ya no está
  acá no se sube» no tienen prueba automática propia: los cubre la prueba de punta a punta
  de la tabla de arriba, que con la versión anterior da mal, y la batería entera otra vez
  sobre esta versión.

### Un cartel rojo que es del emulador, no de la app

En las pruebas contra el emulador, después de una escritura que el servidor rechaza **de
verdad**, a veces aparece «El servidor no aceptó 5 cambios» sobre renglones del historial que
sí llegaron. Costó una noche entender de dónde salía, así que queda escrito.

Se reprodujo sin la app, con treinta líneas que usan solo el SDK de Firebase en el navegador:
un borrado que las reglas prohíben y, atrás, en la misma cola, cinco altas en una colección
que no admite cambios y cinco incrementos de un contador. En cuatro de seis corridas el
emulador aplicó lo que venía atrás del rechazo y lo volvió a aplicar cuando el SDK lo reenvió
(el SDK reenvía lo que quedó en cola después de un rechazo, que es lo correcto): las cinco
altas volvieron rechazadas porque ya existían, y el contador de cinco incrementos quedó en
**34**. Un servidor que hiciera eso con los incrementos no serviría para contar nada: es un
defecto del emulador (v1.22.0), no el comportamiento del servidor real, y pasa igual con la
versión que estaba publicada y con esta.

Qué hacer cuando aparezca en una prueba: mirar si el dato está en el servidor. Si está, es
esto. Y para no quedarse con la deducción, está pedido al soporte que busque rechazos de
`historial` en la colección `rechazos` del servidor real (ver «Próximos pasos»).

Dónde se ve seguro: al **cambiar el código de un producto** con las reglas publicadas, que
no dejan borrar productos. El borrado del código viejo ahora sale siempre, el servidor lo
rechaza, y eso es lo previsto: el código nuevo queda creado, las ventas pasan al nuevo, el
viejo queda archivado y la constancia queda en `borrados`; ese rechazo se anota como
«esperable» y no muestra cartel. En el emulador, atrás de ese rechazo aparece el cartel falso
del historial.

### Lo que este arreglo no hace

- **No recupera lo que ya se perdió.** Una edición o un borrado que no subió y después fue
  pisado por lo del servidor no está en ningún lado.
- **No vuelve a hacer la limpieza de proveedores.** Hay que repetirla, con el OK de
  Emmanuel y mirando la lista antes (ver «Próximos pasos»). Esta vez tiene que llegar.
- **No evita que al abrir la app se vuelva a guardar todo.** Cada vez que se abre, lo que
  baja —o lo que Firestore tiene guardado en el aparato— se escribe otra vez en la base
  local, aunque sea igual a lo que ya estaba. En tandas son segundos, pero es trabajo de
  más.

## Los avisos por plazo, y el cambio en una línea (06/11)

Dos pedidos del 06/11 que no tocan cómo se guardan los datos:

- **Avisos por plazo** (punto 4, `src/lib/agruparAvisos.ts`). La campana y el Panel
  separan «Para hoy» (los urgentes), «Esta semana» (los importantes) y «Cuando puedas»
  (el mantenimiento). La campana cuenta solo lo de hoy: en la Mac de Emmanuel decía 13 con
  todo mezclado. De cada aviso se ve el título; el porqué y el qué hacer van plegados. Lo de
  mantenimiento arranca plegado y, cuando el aviso trae un total («532 de 1.337»), se ve
  como un avance: «60 % al día».
- **El cambio en una línea** (punto 9, `agruparCambios` en `cambioProducto.ts`). La lista
  del turno muestra las dos mitades de un cambio juntas: qué volvió, qué se llevó y cuánto
  pagó el cliente o se le devolvió, con el medio de pago. La pestaña «Ventas (N)» y Turnos
  del día cuentan un cambio como una operación, no como dos.

Probado: 6 pruebas de los plazos y 3 del cambio (rotas a propósito: contar todo en la
campana cae 1; no sumar lo que vuelve caen 2; contar renglones en vez de operaciones cae
1), y las dos pantallas en el navegador.

## Saldos y genéricos: la venta dice qué salió (06/11)

Punto 15 del pedido del 06/11: al vender un producto genérico, como «SALDOS – DE TODO»,
Caja pide «¿Qué salió?» y la venta se guarda con eso como descripción, con el código del
genérico (`descripcionParaVender` en `src/lib/ventaSinCodigo.ts`). Sin descripción, o con
una que no dice nada («saldos», «varios»), no deja agregar la venta. Lo que se escribió
otras veces aparece como sugerencia.

Lo piden los comodines (sin proveedor, costo ni precio) y los productos marcados en
Productos con «Producto genérico: pide qué salió al venderlo» (campo `generico`, que viaja
solo si se marca). Las ventas ya cargadas con SALDOS y DIF no se tocan.

Probado: 5 pruebas (rotas a propósito: sin mirar la marca cae 1; aceptando «saldos» cae
1), y una venta de SALDOS en el navegador, guardada como «bombilla de alpaca».

## El cierre de caja: conteo ciego, recuento y pistas (06/11)

Punto 5 del pedido del 06/11. Hay 9 cierres con diferencia esperando visto bueno, por
$ 644.700, y la mayoría se explica después, mirando el día a mano. El cierre ahora hace
esa mirada en el momento:

- **Conteo ciego.** Mientras se cuenta no se ve cuánto debería haber; aparece con «Ya
  conté: ver cómo da». Lo contado en ese momento queda en el turno (`primerConteo`), y si
  después se recuenta y cambia, el dueño ve los dos números en la lista de vistos buenos.
- **Recuento.** Desde $ 2.000 de diferencia, la app pide recontar los billetes grandes.
- **Pistas** (`pistasDeLaDiferencia`, `src/lib/diferenciaCaja.ts`). Busca en el turno
  movimientos por el mismo monto: si falta plata, una venta en efectivo (¿fue por
  transferencia?) o una venta cargada dos veces; si sobra, una venta con tarjeta o
  transferencia (¿fue en efectivo?), un egreso o un pase que quizás no salió del cajón. Y si
  la diferencia es justo uno a cinco billetes grandes, pregunta por esos billetes.
- **Motivo con categoría** (`motivoDiferencia`): error de conteo, vuelto, venta mal cargada,
  egreso sin cargar, pase sin cargar o «No sé», en la misma pantalla y no en un cartel.
  Con eso, más adelante, sale un reporte por motivo y por persona.

Probado: 8 pruebas (rotas a propósito: tomar una venta en efectivo como explicación de un
sobrante cae 1; el umbral corrido cae 1), y un cierre en el navegador: sin «Ya conté» no
se ve lo esperado ni el botón de cerrar; con $ 10.000 contados sobre $ 55.000 esperados
aparecen el recuento y la pista de la venta de $ 45.000 en efectivo; sin motivo no cierra;
queda guardado el primer conteo y el motivo.

## La caja grande, con saldo (06/11)

Punto 13 del pedido del 06/11: «la grande, ¿dónde se ve?». La app anotaba lo que entraba y
salía de la caja grande, pero nunca calculó cuánto había. Ahora tiene su pantalla (Gastos →
«Ver caja grande», para quien está al mando):

- **Saldo** (`saldoDeCuenta`, `src/lib/cajaGrande.ts`): el último conteo, más los pases desde
  el cajón y los ingresos, menos los gastos pagados con ella y los depósitos, cargados
  después de ese conteo. Sin ningún conteo no hay saldo: la primera vez se cuenta.
- **Conteos** en una tabla nueva que sincroniza, `arqueosCuenta` (versión 8 de la base
  local), con lo contado y lo que debería haber. Como el cierre, primero se cuenta y después
  se ve. Los últimos conteos quedan a la vista con su diferencia.
- **Pases entre cuentas**: un tipo de movimiento nuevo, `PASE_ENTRE_CUENTAS`, con `cuenta`
  (de dónde sale) y `cuentaDestino` (a dónde entra). No es gasto ni ingreso: ningún cálculo
  de gastos ni de resultado lo cuenta, porque todos filtran por tipos explícitos.
- **Caja virtual**: lo cobrado hoy y en el mes sin efectivo, por medio de pago.

La tabla nueva está también en el respaldo nocturno (`scripts/respaldar-firestore.ts`, en
la rama). La regla general del servidor ya la cubre.

Probado: 8 pruebas (rotas a propósito: contar un gasto del banco en la caja grande caen 2;
contar movimientos de antes del conteo caen 2), y contra los emuladores en dos aparatos:
la Mac cuenta $ 200.000 y deposita $ 50.000 al banco; el servidor tiene el conteo y el
pase; la otra compu ve $ 150.000; ningún aviso de «sin subir».

---

## El ticket con varios productos, y las tarjetas con recargo (06/11)

Puntos 7 y 8 del pedido del 06/11. Hasta acá cada producto era una venta suelta con su
propio medio de pago: un cliente que se llevaba un mate y una bombilla eran dos ventas, si
pagaba una parte en efectivo y otra con tarjeta no había cómo cargarlo, y el recargo de
Consumax o Club del Este se hacía a mano en el precio.

**Sin tabla nueva** (`src/db/ticket.ts`). Cada producto sigue siendo un renglón de `ventas`,
y los del mismo ticket comparten `ticketId`. Si el ticket se pagó con más de un medio, o con
una tarjeta y un plan, cada renglón guarda en `pagos` cómo se pagó lo suyo
(`repartirPagos`: cada renglón toma de los pagos en orden hasta cubrirse, en centavos, así
cada medio suma exacto). Un renglón pagado entero con un solo medio y sin tarjeta queda
igual que cualquier venta de antes, sin `pagos`.

**Las cuentas de plata leen `cobrosDe(v)`** (en `db.ts`): los `pagos` si los hay, y si no
el medio y el total de siempre. Lo usan el resumen del turno y del mes (`calculos.ts`), la
caja virtual y las pistas del cierre. Las ventas viejas no cambian en nada.

**El recargo es un renglón más del ticket**, con el código `REC-TARJETA` y costo cero: así
lo vendido suma lo cobrado, el banco del turno da con lo que pasó por el posnet, y el margen
lo cuenta. No suma unidades, no aparece en los más vendidos ni en «costos a actualizar»
(`esRecargo`). Los planes están en `src/lib/tarjetas.ts`: débito y crédito bancaria sin
recargo; Consumax y Club del Este, 5 % en un pago y 15 % en tres (lo que pasó Emmanuel).
Con crédito hay que elegir la tarjeta en cada venta; con débito no.

**En Caja:** «🧾 Varios productos» abre el ticket (`FormularioTicket.tsx`): buscador,
renglones con cantidad y precio, los genéricos piden qué salió, «+ Otro medio de pago» con
el segundo monto que se completa con lo que falta, «Paga con» con el vuelto, y los totales.
Desde la venta común, «+ Se lleva otro producto» pasa a ticket con lo ya elegido. La venta
común con un plan con recargo se guarda como ticket (producto + recargo). En la lista, el
ticket es una línea («TICKET») que se deshace, se borra o se pasa de turno entera
(`borrarTicket` y `moverTicket`, en una transacción), y cuenta como una operación.

**El servidor no cambia:** la regla general de `ventas` no limita campos. Ningún valor
queda `undefined` adentro de `pagos` (Firestore no lo acepta y `limpiar` del motor solo
mira el primer nivel): hay una prueba para eso.

**Ojo legal, para Emmanuel:** la ley 25.065 pide no cobrar distinto con tarjeta de crédito
que en efectivo. Cómo se presenta el recargo lo decide él con el contador; la app registra lo
que se cobró.

Probado: 13 pruebas del ticket, 4 de tarjetas, y las de cálculos, caja virtual, pistas y
agrupado (rotas a propósito una por una: el reparto sin tope, sin renglón de recargo, el
stock sin sumar por código, los pagos sin guardar, el agrupado, el orden, mover solo un
renglón, un `undefined` en los pagos, el plan puesto por defecto en crédito, las cuentas
leyendo el medio en vez de los pagos; cada una pone en rojo su prueba). En el navegador:
Consumax 3 pagos ($ 40.000 → «cobrá $ 46.000»), deshacer, un ticket de tres productos mitad
en efectivo y resto con Club del Este (resumen del turno: $ 30.000 efectivo, $ 32.550
banco), pasarlo de turno, y borrar con el stock que vuelve. Contra los emuladores en dos
aparatos: la Mac carga el ticket mixto, el servidor tiene los renglones con sus pagos, la
otra compu ve lo mismo y los mismos totales, la borra desde ahí y desaparece en la Mac;
ningún aviso de «sin subir».

---

## El ingreso de mercadería, con el flete en el costo (06/11)

Puntos 10 y 11 del pedido del 06/11, y el historial de compra por código del 17. Hasta acá
la compra se cargaba adentro del proveedor eligiendo cada producto de un desplegable con
los 1.300 del catálogo, y el flete no tenía dónde ir.

**La pantalla** (`/ingreso`, `IngresoMercaderia.tsx`): Proveedores → «📦 Ingreso de
mercadería», o desde la ficha del proveedor, que ya la abre con él elegido (`?proveedor=`,
así recargar no lo pierde). Se busca cada producto con el mismo buscador de Caja, se carga
cuántos llegaron y el costo de la factura, y cada renglón dice la última compra (cuándo, a
quién, a cuánto). El formulario viejo de compra se sacó: había dos formas de hacer lo mismo.

**Sin tabla nueva** (`src/db/ingresoMercaderia.ts`): sigue siendo un movimiento de proveedor
de tipo «compra», con tres campos opcionales nuevos: `flete` (`{monto, criterio,
transportista}`), `comprobante` (remito o factura) y, en cada renglón, `costoConFlete`.

**Qué es cada monto.** Al proveedor se le debe la mercadería sin flete (`monto`); el flete lo
cobra el transporte. El costo que queda en cada producto es el de la factura más su parte del
flete: es el que usan el margen y el precio sugerido.

**El reparto** (`repartirFlete`): por costo (cada producto carga según lo que vale, el que
va por defecto) o por unidades (cada unidad carga lo mismo). Es lo que los sistemas grandes
llaman «costos de importación»; Odoo ofrece cinco criterios y para el local alcanzan dos. La
parte de cada renglón suma exacto el flete, al centavo (método del mayor resto). Si todo vino
bonificado (costo cero), por costo reparte por unidades.

**Remarcar.** Al confirmar, la app lista lo que subió de costo y si el precio quedó por
debajo de su rentabilidad, con la misma vara que el aviso del Panel (`precioAtrasado`: 5 % de
tolerancia, un descontinuado no se remarca). Quien está al mando remarca ahí, con pregunta
que dice cuántos y motivo en el historial; una empleada ve que hay para remarcar y que el
dueño lo ve en el Panel. Las reglas ya lo cubrían: cualquiera activo carga stock y costo;
el precio de venta, solo al mando.

**El borrador** (`borradorCompra.ts`) guarda también el remito y el flete, y la pantalla lista
lo que quedó a medio cargar en el aparato.

**Las compras de cada producto** (`comprasDeProducto`): en la ficha del producto, en
Productos, la lista de sus compras con proveedor, fecha, cantidad, costo, costo con flete y
remito. Es el historial por código del punto 17.

Probado: 15 pruebas del ingreso y 3 más del borrador. Cada una se rompió a propósito y se
puso en rojo:
- el resto al centavo;
- el bonificado;
- el costo con flete y la deuda sin flete;
- el motivo y un `undefined` en el flete;
- remarcar lo igual y remarcar sin tolerancia;
- el orden de las compras;
- el costo vacío;
- el borrador sin renglones y la lista de borradores.

En el navegador: un ingreso de 3 mates y 10 bombillas con $ 10.000 de flete por costo
($ 6.000 y $ 4.000; $ 22.000 y $ 4.400 por unidad), el borrador al recargar, el remarcado, y
la cuenta del proveedor. Contra los emuladores, una empleada carga el ingreso, y en el
servidor quedan:
- la compra con su flete, el stock y los costos;
- el historial con el motivo y su nombre;
- cero rechazos.

Del lado del dueño: ve el aviso en el Panel, carga otro ingreso y remarca. El precio llega a
la otra compu.

De paso: el aviso del Panel decía «1 producto está más baratos»; ahora concuerda.

---

## La agenda de vencimientos (06/11)

Punto 18 del pedido del 06/11: alquiler, luz, internet, contador, monotributo, el resumen de la
tarjeta. Hasta acá la app avisaba recién después, cuando un gasto del mes pasado faltaba en
este («gastos habituales faltantes»).

**Una tabla nueva que sincroniza**, `vencimientos` (versión 9 de la base local):
- qué se paga, el día del mes, un monto aproximado, la categoría y de dónde sale la plata;
- si es fijo o variable y cuántos días antes avisar;
- `desde`: la fecha desde la que se controla. Un mes que venció antes no se reclama.

Está en la sincronización, en el historial y en el respaldo nocturno (en la rama). La regla
general del servidor ya la cubre.

**Pagado es un gasto, no un dato aparte.** «Marcar pagado» carga el gasto con su categoría y
su cuenta, con `vencimiento: {id, periodo}`, y un vencimiento está pagado en un mes si hay
un gasto que lo dice. Así no hay dos verdades: si el gasto se borra, vuelve a figurar sin
pagar. Si ya estaba cargado a mano en Gastos, la pantalla lo ofrece y se engancha ese
(`engancharGasto`), sin cargarlo dos veces. Si sale del cajón, va contra el turno abierto,
como el pago a un proveedor.

**Qué se reclama** (`situacionDe`, `src/lib/vencimientos.ts`):
- el mes pasado, si venció y no se pagó;
- si no, el mes en curso;
- el día 31 en un mes más corto vence el último día.

**Los avisos del Panel**, solo para quien está al mando:
- «Hoy» para lo vencido o lo que vence hoy;
- «Esta semana» para lo que vence en los próximos días.

Lo que está en la agenda sale del aviso de gastos habituales faltantes: no se avisa dos veces.

**La pantalla** (`/vencimientos`, desde Gastos):
- lo pagado y lo que falta del mes;
- la lista con lo vencido primero;
- «Marcar pagado» y «Editar»;
- botones para cargar los de siempre.

Probado: 18 pruebas de la agenda y 4 de los avisos. Cada una se rompió a propósito y se puso
en rojo:
- el fin de mes;
- no reclamar lo que la agenda no conocía;
- el pago por mes;
- los días de aviso;
- los archivados;
- no ofrecer un gasto ya enganchado;
- el turno solo si sale del cajón;
- el cajón sin turno;
- enganchar dos veces;
- el motivo y el monto;
- no avisar dos veces;
- lo de hoy y lo de la semana;
- solo al mando.

En el navegador:
- la agenda con el contador vencido, la luz por vencer y el alquiler;
- los dos avisos del Panel;
- «Es este» con el gasto del contador cargado a mano;
- la luz pagada con Mercado Pago, y los avisos que se van.

Contra los emuladores en tres aparatos:
- Emmanuel carga la luz y el servidor la tiene.
- Sandra la ve en su Panel y la marca pagada: el gasto queda con su vencimiento, y el
  historial dice quién y por qué.
- La Mac la ve pagada y sin aviso.
- Gabriela no entra a la agenda.
- Cero rechazos y nada «sin subir».

De paso: la entrada de la Ayuda sobre la caja grande se le mostraba a una empleada con Gastos,
y la pantalla es solo para quien está al mando; ahora no.

---

## Los pedidos de insumos (06/11)

Punto 14 del pedido del 06/11, la primera mitad: lo que falta en el local (bolsas, papel,
rollos de ticket, limpieza).

**Una lista compartida**, tabla nueva `pedidos` (versión 10, sincroniza, con historial y en el
respaldo nocturno de la rama):
- Cualquiera anota qué falta, con cantidad y nota opcionales. Lo que ya está anotado y
  abierto no se anota dos veces: se compara sin mayúsculas ni acentos.
- Quien está al mando lo pasa a «Pedido», «Recibido» o «Descartado», y queda quién y cuándo.
- Quien lo anotó puede decir «Ya no hace falta» mientras nadie lo pidió.

**Dónde está.** La pantalla `/pedidos` es para todos. Se entra desde Caja (abajo de todo,
con cuántas cosas hay anotadas), desde Mi día y desde Gastos. El Panel avisa a quien está al
mando en «Esta semana»: «Faltan 2 cosas en el local», con quién lo anotó y hace cuánto, lo
más viejo primero.

Probado: 5 pruebas de los pedidos y 2 del aviso. Cada una se rompió a propósito y se puso en
rojo:
- el repetido sin acentos;
- lo recibido que se vuelve a anotar;
- quién lo pasó;
- el orden;
- lo pedido que no avisa;
- el aviso ordenado;
- solo a quien compra.

Contra los emuladores:
- Gabriela, con solo Caja, anota desde la caja; el repetido no pasa y ella solo puede decir
  «Ya no hace falta».
- Emmanuel lo ve en el Panel y lo pasa a pedido y a recibido, con historial.
- Gabriela ve en qué anda cada cosa.
- Cero rechazos y nada «sin subir».

La segunda mitad del punto 14, la reposición sugerida por proveedor, necesita que el stock
esté controlado: hoy la mayoría de los productos no lo lleva.

## Los sueldos y los retiros (19/11)

Hasta el 19/11 la app sabía cuánto se pagaba de sueldos en el mes (la categoría de gasto
SUELDOS), pero no a quién, ni cuánto se había acordado con cada persona. Ese día salió la
primera versión, y a la tarde Emmanuel decidió quién ve qué y que en el local se cobra por
semana. Lo de abajo es como quedó.

### Dos datos, en dos lugares distintos

- **Lo pagado** es lo de siempre: un gasto de categoría SUELDOS, cargado desde Caja (un
  retiro del cajón) o desde Gastos. Lo nuevo es que dice de quién es (`persona`, el id de su
  usuario) y, si hace falta, a qué mes corresponde (`periodoSueldo`). Viaja con la
  sincronización de todos y se ve en Gastos, como cualquier gasto.
- **Lo acordado** es reservado. Es la única colección (`sueldos`, una ficha por persona, con
  el id de su usuario) que **no pasa por el motor de sincronización**: el motor baja cada
  tabla a todos los aparatos. No tiene tabla en la base local ni ganchos. Las pantallas
  Sueldos y «Mi sueldo» la leen directo del servidor (`src/sync/sueldosNube.ts`).

Tampoco pasa por el historial compartido, por el mismo motivo: un renglón «cambió el sueldo
de tanto a tanto» lo leería todo el que ve el historial. La historia queda adentro de la
ficha: un cambio de sueldo no pisa el anterior, se agrega con el día o el mes desde el que
rige (`acuerdos`). Así los meses viejos siguen mostrando lo que se había acordado entonces.

**Los montos no van nunca al código, a las pruebas ni a este repositorio**, que es público.
Los carga un dueño en la pantalla.

### Quién ve qué (decisión de Emmanuel, 19/11)

| | Dueño/a | Encargado/a | Empleado/a |
|---|---|---|---|
| Ver lo acordado con cada persona | Sí | Sí | Solo lo suyo |
| Definir o cambiar lo acordado | Sí | No, tampoco el suyo | No |
| Decir de quién es un pago y a qué mes corresponde | Sí | Sí | No |
| «Mi sueldo» | No tiene: retira | Sí | Sí |

Que definir quede solo para un dueño es para que nadie se cambie el propio sueldo. Cada
permiso tiene su nombre en `src/sync/permisos.ts` (`puedeVerSueldos`, `puedeDefinirSueldos`,
`tieneMiSueldo`) y la regla del servidor dice lo mismo: se cambian juntas.

### Por semana, cada sábado, o por mes

La primera versión acordaba solo por mes. El 19/11 Emmanuel decidió que en el local se cobra
**por semana**: un monto fijo cada sábado. «Por mes» quedó como opción.

**Por semana.** El acuerdo dice el monto de la semana y desde qué día rige. A cada mes le
corresponde ese monto por los sábados que tiene, contando desde ese día: noviembre de 2026
tiene cuatro, octubre tuvo cinco. Así el mes cierra solo: quien cobró sus cinco sábados de
octubre está al día, no «cobró de más». La pantalla muestra la cuenta («… por semana × 4
sábados · van 2»): mientras el mes no termina, lo que falta es lo de los sábados que todavía
no llegaron.

- El día de inicio no tiene que ser sábado. Si alguien empezó un miércoles, su primer sábado
  es el de esa semana. Antes de guardar, la confirmación dice cuánto le queda correspondiendo
  ese mes, con los sábados contados: ahí se ve si el día elegido es el que se quería.
- Un aumento a mitad de mes se carga con el día desde el que vale: cada sábado cuenta lo que
  regía ese día.
- Si dos acuerdos empiezan el mismo día vale el último que se cargó: así se corrige un monto
  mal puesto. Si lo que quedó mal es el día, se carga 0 desde el día equivocado y el monto
  desde el correcto.

**Por mes.** Un monto por mes desde un mes, se pague como se pague: cada pago cuenta para su
mes y lo que falta es lo acordado menos lo cobrado. Si alguien empezó a mitad de mes, se
carga primero ese mes con lo que le corresponde y después el siguiente con el sueldo entero
(son dos acuerdos).

**Cuando se pasa de uno a otro** vale el acuerdo que empezó último, mirado sábado por sábado
(`acordadoEnElMes()` en `src/lib/sueldos.ts`). El mes en que se pasa de «por mes» a «por
semana» cuenta solo los sábados desde el cambio: la parte por mes no se prorratea. Para
volver a «por mes» hay que elegir desde el mes siguiente: en un mes en que ya rige uno por
semana, ese seguiría mandando, y la app avisa en vez de guardar algo que no se vería.

En los dos casos un pago cuenta para el mes de su fecha, salvo que se le diga otro
(«Corresponde a»). Un sábado que se terminó pagando el lunes del mes siguiente se acomoda
así.

### La pantalla Sueldos

Gastos → «Ver sueldos» (`/sueldos`). Por mes:

- **El total:** lo acordado, lo pagado y lo que falta. Lo que uno cobró de más no tapa lo
  que le falta a otro.
- **Por persona:** lo que le corresponde en el mes (por semana, con la cuenta de sábados),
  lo que cobró (con cada pago) y lo que falta o cobró de más. «Definir sueldo», que le
  aparece solo a un dueño, pide cómo cobra (por semana o por mes), el monto y desde cuándo;
  pregunta antes de guardar, diciendo qué había y quiénes lo van a ver. Antes de guardar
  vuelve a leer la ficha, por si otro dueño la cambió mientras tanto. Los dueños no figuran
  acá salvo que se les haya definido un sueldo o cargado un pago.
- **«Pagos de sueldo sin asignar»:** están como SUELDOS y no dicen de quién. Se elige la
  persona.
- **«¿Esto es un sueldo?»:** gastos del mes con otra categoría que nombran a alguien del
  equipo o dicen «sueldo», «adelanto» o «semana». Es una sugerencia: si la app sabe de quién
  es, alcanza con un toque («Sí, es de …»); si no, se elige. Pasa a SUELDOS como gasto fijo.
- **«Corresponde a»:** el saldo de noviembre pagado el 3 de diciembre es sueldo de
  noviembre. Se cambia en ese pago. Para el resultado del mes sigue contando la fecha.

Cada cambio toca un solo gasto y queda en el historial con el motivo «Ordenado desde
Sueldos». El historial muestra el nombre de la persona y el mes, no el id.

### Los pagos por semana que no se encontraban, y los apodos

El primer día, «¿Esto es un sueldo?» no encontró los pagos de quien cobra por semana: de
siete, cinco estaban en OTROS. Tres motivos, los tres de cómo se anota de verdad:

1. El concepto dice el apodo («SEMANA GABI») y la app buscaba el nombre de la cuenta.
2. Dice «semana», que no estaba entre las palabras que hacen pensar en un sueldo.
3. La categoría viene puesta en OTROS, y quien carga no la cambiaba.

Lo que se hizo:

- **Apodos** (`apodos`, en el usuario): con qué otros nombres figura alguien en los gastos.
  Se cargan de dos formas. Sola: cuando alguien dice a mano de quién es un gasto y el
  concepto tiene una única palabra que puede ser un apodo, la app pregunta «¿A … le dicen
  …?» y lo recuerda. O a mano, en Ajustes → «Usuarios del equipo» → «Apodos». Los ve todo el
  equipo, como el nombre; los cambia quien está al mando.
- **«Semana» y «semanal»** son palabras de sueldo.
- **Al cargar, la app pregunta.** En Caja y en Gastos, si el concepto nombra a alguien o
  dice una de esas palabras, aparece «¿Es el sueldo de …?». Con «Sí, cargarlo así» quedan
  puestas la categoría y la persona. No cambia nada sola. Es lo que evita que el próximo
  pago vuelva a caer en OTROS.

`queParece()` en `src/lib/sueldos.ts` es la que decide: manda a quién nombra (un dueño es un
retiro, alguien del equipo es un sueldo) y, sin nombre, las palabras.

### «Mi sueldo»

`/mi-sueldo`, desde «Mi día» (o desde Sueldos, «Ver solo lo mío», para quien está de
encargado). Cada persona ve lo suyo del mes: lo que le corresponde (por semana, su monto por
los sábados del mes), cada pago que cobró y lo que le falta. Lo acordado sale de su ficha,
que es la única que el servidor le deja leer; lo cobrado, de los pagos de sueldo a su
nombre, que ya están en el aparato.

### Los retiros de los dueños

Lo que un dueño saca para él no es un sueldo, pero se lleva igual: por persona. Un retiro es
un gasto de categoría RETIRO SOCIOS que dice de quién es (el mismo campo `persona`). Al
elegir esa categoría, en Caja y en Gastos, aparece «¿De quién es el retiro?» con los dueños;
si el concepto nombra a un dueño, la app ofrece cargarlo así.

En Sueldos, abajo, «Retiros de los dueños» muestra lo que retiró cada uno en el mes, con
cada retiro. Aparecen todos los dueños activos, hayan retirado o no. «Retiros sin asignar» y
«¿Esto es un retiro de un dueño?» sirven para ordenar lo que ya estaba cargado.

Aparecen los dueños de la lista de Ajustes → «Usuarios del equipo». **Un dueño que no usa la
app está ahí sin cuenta** (lo que sigue): no hace falta crearle una.

### Los dueños que no usan la app (19/11, a la noche)

Los dueños son tres y dos no usan la app. La primera versión pedía crearles una cuenta para
anotarles los retiros. Se descartó: una cuenta de dueño que nadie usa es un acceso total de
más.

Ahora un dueño puede agregar, en Ajustes → «Usuarios del equipo» → «+ Dueño que no usa la
app», a un dueño **sin cuenta**: solo el nombre, y pregunta antes de guardar. Queda en la
misma colección `usuarios`, con `sinCuenta: true`, rol dueño, sin mail y con un id que empieza
con `sin-cuenta-` (los de las cuentas son el uid de Firebase Auth, que no lleva guiones). No
tiene cuenta en Firebase Auth: nadie puede entrar con eso.

- **Se elige para un retiro, no para un sueldo** (`duenosParaRetiro`, `personasParaSueldo`).
- **La pregunta al cargar lo conoce** por el nombre o los apodos (`personasConocidas`): un
  egreso que dice «RETIRO MAMA» ofrece cargarlo como retiro de Elena.
- **En Sueldos** figura en «Retiros de los dueños» aunque no haya retirado.
- **«Desactivar»** lo saca de la lista; lo que ya retiró queda a su nombre.

Por qué en `usuarios` y no en una colección nueva: así no se toca la sincronización (la
colección ya viaja a todos los aparatos), los apodos y las listas de dueños andan igual, y la
regla de `usuarios` deja crear o tocar a un dueño solo a otro dueño: una encargada no puede
agregar un dueño ni cambiarle el nombre. Una colección nueva caería en la regla general, que
deja escribir a cualquiera activo.

### Que lo acordado no quede guardado en ningún aparato

La primera versión leía las fichas con el Firestore de siempre, que guarda en el disco del
aparato todo lo que lee. Mientras Sueldos la veía solo el dueño, en su aparato, daba igual.
Con la encargada viendo Sueldos y cada persona viendo lo suyo, alguna de esas pantallas se
va a abrir en la compu del local, que es de todos.

Ahora `sueldosNube.ts` usa la versión liviana (`firebase/firestore/lite`), que pide y
contesta y nada más: no tiene cache ni cola. La prueba de punta a punta busca los montos
acordados en todo lo que guarda cada aparato (las cuatro bases de IndexedDB, localStorage,
sessionStorage y lo que guarda el service worker) después de usar las pantallas: no están en
el del dueño, ni en la compu donde entró la encargada, ni en el celular de la empleada, ni
el suyo propio. La misma búsqueda sí encuentra un pago y un texto de la app, que es lo que
tiene que estar.

El costo: sin conexión no se ve ni se cambia lo acordado. Los pagos y los retiros sí, porque
están en el aparato.

### La regla del servidor

`firestore.rules`, colección `sueldos`: **leen los dueños y quien está de encargado, y cada
persona su ficha; escribe solo un dueño.** Está afuera de la regla general, que deja leer a
cualquiera con sesión.

Para guardar, además, la ficha tiene que traer la versión de su formato (`forma: 2`), que la
app manda sola. Es por las versiones viejas de la app: la de la madrugada del 19/11 no
conoce los acuerdos por semana, los saltea al leer y, si guardara la ficha, los borraría.
Sin la versión, el servidor no la deja guardar. Un aparato sin actualizar ve «Sin definir» y
no puede cambiar nada hasta que toca «Actualizar».

**No está pegada en la consola, y por ahora no se pega** (decisión del 19/11 a la noche:
Emmanuel no hace tareas a mano). Desde el entorno de Claude no se puede publicar: la red no
llega a la API de Firebase, y para entrar Firebase pide pegar un código de Google, que es una
clave. La app anda con las reglas que haya en la consola, y qué pasa depende de cuáles sean:

- Si tiene la de sueldos de la madrugada del 19/11 (solo el dueño): a la encargada Sueldos le
  dice que el servidor no le deja ver lo acordado, y «Mi sueldo» lo mismo; los pagos se ven
  igual. Probado. El dueño lee y guarda como siempre; lo que no hay es la protección contra
  una versión vieja de la app.
- Si no tiene regla de sueldos (las de antes del 19/11): la colección cae en la regla general,
  que deja leer a cualquiera con sesión y escribir a cualquiera activo. La app no se lo
  muestra a quien no debe, pero el servidor no lo protege. **Antes de cargar los sueldos hay
  que mirar en la consola cuál de las dos es.**

Si aparece una forma de publicar las reglas sin pasos a mano (por ejemplo, el workflow de
reglas con una cuenta de servicio), antes se prueban en el emulador, con dueño, encargada y
empleada, las tareas de todos los días: el archivo trae cambios que nunca se pegaron.

### Cómo se probó

- 82 pruebas de la cuenta (`src/lib/sueldos.ts`) y 3 de los permisos. La cuenta y los
  permisos se rompieron a propósito de 78 maneras (31 son del sueldo por semana: cobrar los
  viernes, no contar el día en que empieza, no multiplicar por los sábados, aceptar el 30 de
  febrero…; 13 de los dueños sin cuenta): las 78 en rojo.
- 12 pruebas de la regla contra el emulador (`pruebas/reglas-sueldos.test.ts`): la encargada
  lee y no escribe; una empleada lee su ficha y ninguna otra, ni la lista; nadie que no sea
  dueño escribe, ni la propia; con la cuenta desactivada o sin perfil no se lee nada; sin la
  versión del formato no guarda ni el dueño; y un dueño sin cuenta lo agrega y lo toca solo
  un dueño. La regla se rompió a propósito de 11 maneras, las 11 en rojo.
- De punta a punta en el navegador contra los emuladores, con tres aparatos (el dueño, la
  encargada y una empleada): definir, ordenar los pagos por semana, recordar el apodo, los
  retiros, cargar desde Caja y desde Gastos con la pregunta, «Mi sueldo», lo que queda
  guardado en cada aparato, y pedirle las fichas al servidor directo con la sesión de cada
  una. El guion quedó en `pruebas/e2e/`.

### Lo que falta

- **Las comisiones por venta.** Emmanuel va a definir sobre qué se calculan y con qué
  porcentaje. Cada venta ya guarda quién la hizo (`vendedor`).
- **Alguien del equipo que no usa la app.** Un dueño ya puede estar sin cuenta; alguien del
  equipo, no. Por ahora no hace falta.
- **Los retiros de socios y el resultado del mes.** Hoy un retiro cuenta como un gasto más
  (variable). Si es un gasto del negocio o un reparto de lo ganado es para mirar con el
  contador, junto con lo de los pagos a proveedores.
- **Quitar un acuerdo mal cargado.** Hoy no se borra: se corrige cargando otro (el mismo día
  con el monto bueno, o 0 desde el día equivocado). Si pasa seguido, conviene un «Quitar»
  para el dueño.
- **Otro día de cobro.** Por semana se cuenta el sábado para todos (`DIA_DE_COBRO`). Si
  alguien pasa a cobrar otro día, hay que guardarlo en el acuerdo.
- **El primer mes de alguien que cobra por mes y empezó a mitad de mes** se carga a mano. Si
  se quiere que la app lo calcule sola, hay que decidir cómo se prorratea. Por semana no
  hace falta: se cuenta desde el día en que empezó.

## La planilla del proveedor (19/11)

**Proveedores → un proveedor → «Actualizar costos (planilla)»**, o Ajustes → «Revisión de
costos» → elegir el proveedor → «Todos sus productos». Solo para quien está al mando.

### Por qué

El 19/11 se miró si el Excel viejo se había dejado de usar. No: un mes después de pasar a la
app, cada entrega de mercadería se seguía anotando ahí. En el Excel los productos de un
proveedor están todos juntos, y actualizar una lista de precios es bajar por una columna:
fecha, costo, y el precio sale solo del markup.

La app tenía dos caminos y ninguno era ese. La «Revisión de costos» mostraba solo los
productos sin costo o con el costo vencido: los de una entrega, que casi siempre tienen el
costo al día, no aparecían. Y el «Ingreso de mercadería» pide buscar cada producto y contar
cuántos llegaron, que es más trabajo que el que hacían en el Excel (ahí no llevaban stock).

### Qué es

La misma pantalla de la revisión, con una segunda vista (`planillaDelProveedor`, en
`src/db/revisarCostos.ts`): **todos** los productos del proveedor, en el orden de sus
códigos —`MN2` antes que `MN10`, como los lee una persona—, cada uno con su costo, la
fecha, el precio y el markup, y un cartel `VENCIDO` o `SIN COSTO` donde corresponde.

- **Enter guarda y pasa al de abajo.** Veinte productos son veinte números y veinte Enter.
- **La fecha de la compra** se elige arriba y vale para todo lo que se guarde: la de la
  factura, si no es la de hoy. No puede ser futura.
- **«Sigue igual»** está en todos los renglones con costo, no solo en los vencidos: renueva
  la fecha sin escribir el número.
- **El precio de venta no cambia solo.** En el Excel se movía con el costo; acá, cambiar un
  precio es también cambiar una etiqueta en el local. Cuando el costo —ya al día— deja el
  precio por debajo de lo que pide su markup, el renglón lo dice y ofrece ponerlo. Al final
  de la lista, **«Precios por debajo de su markup»** los junta: un botón los cambia todos,
  después de preguntar diciendo **cuántos** son y con un ejemplo. Queda en el historial como
  «Remarcado desde la planilla del proveedor».
- Sobre un costo vencido o vacío no se sugiere ningún precio: sería remarcar con un número
  que nadie confirmó.
- La diferencia tiene que pasar del 5 % (`precioAtrasado`): menos que eso es redondeo o una
  decisión de precio.
- Los descontinuados no están; la planilla dice cuántos hay.

El proveedor y la vista van en la dirección (`?proveedor=…&todos=1`): se llega directo desde
la ficha del proveedor y recargar no los pierde.

### Lo que no hace

No suma stock ni anota la compra en la cuenta del proveedor: eso es el «Ingreso de
mercadería». La planilla es el puente para dejar el Excel; el ingreso es donde conviene
terminar, porque además deja el stock y la deuda al día.

### Cómo se probó

- 21 pruebas en `src/db/revisarCostos.test.ts` (7 nuevas) y 1 de la Ayuda. La cuenta se
  rompió a propósito de 14 maneras y las 14 quedaron en rojo.
- De punta a punta contra los emuladores, como la encargada: el orden y el estado de cada
  renglón, tres Enter seguidos con el foco bajando, los dos precios puestos de una (con su
  pregunta), uno puesto desde su renglón, «Sigue igual» con otra fecha, una fecha futura que
  no deja guardar, y lo que quedó en el servidor y en el historial. Una empleada con
  Proveedores no ve el enlace ni puede entrar. Se rompió a propósito de 4 maneras (el foco
  no baja, el botón no pregunta, «Sigue igual» ignora la fecha, el enlace a la vista de una
  empleada) y las 4 se vieron.

### Lo que falta

- **Dar de alta un producto desde la planilla**, con el proveedor ya puesto. Hoy es
  Productos → «+ Producto nuevo».
- **Cambiar el markup desde la planilla.** Hoy se cambia en la ficha del producto.
- **La lista para las etiquetas:** después de cambiar precios, lo que hay que volver a
  etiquetar.
- **Una fecha para dejar el Excel.** Lo decide Emmanuel; hasta entonces hay dos listas de
  precios que pueden no decir lo mismo.

## Gastos: dos arreglos de la auditoría (19/11)

Los dos salieron de leer la pantalla en la auditoría general, no de un pedido. La regla de
cada uno está en `src/lib/borrarGasto.ts`, suelta de la pantalla para poder probarla.

**Borrar un gasto de un turno cerrado.** Un gasto que salió de la caja de un turno es parte
de la cuenta de ese turno: cuánto efectivo tenía que haber al cerrar. En la Caja, un turno
cerrado no deja borrar nada. Desde la lista de Gastos se podía igual, cualquiera con la
sección, y el arqueo de un turno ya cerrado y revisado dejaba de coincidir sin que nadie se
enterara. Ahora (`permisoParaBorrarGasto`):

- sin turno (caja grande) o con el turno abierto, se borra como siempre;
- con el turno cerrado, solo quien está al mando, y la pregunta dice qué turno se mueve;
- una empleada ve, en lugar del botón, «Es de un turno cerrado: lo borra quien está al
  mando»;
- un gasto que apunta a un turno que no está en ese aparato se trata como de turno
  cerrado: no se puede afirmar que esté abierto.

**Fijo o variable, según la categoría que viene puesta.** El formulario abría en PROVEEDORES
con «Fijo» marcado: la sugerencia solo se aplicaba al *cambiar* de categoría, y la que venía
puesta nunca se cambiaba. Un pago a proveedor cargado desde Gastos quedaba fijo, y el mismo
pago cargado desde Proveedores, variable: el margen de contribución del mes dependía de por
dónde se había cargado. Ahora arranca como lo pide su categoría (`esVariablePorDefecto`).
Los gastos ya cargados no se tocan: revisar los de PROVEEDORES que figuran como fijos es una
decisión de Emmanuel (ver «Próximos pasos»).

Probado con 7 pruebas (rotas a propósito de 6 maneras, las 6 en rojo) y de punta a punta
contra los emuladores, como una empleada con Gastos y como la encargada; la pantalla también
se rompió a propósito (el botón a la vista de la empleada, el formulario abriendo en «Fijo»)
y las dos se vieron.

## «Cómo venimos»: el uso de la app, semana por semana (19/11)

**Ajustes → «Cómo venimos»**. Solo para quien está al mando. No escribe nada.

Sale de una pregunta de Emmanuel: si había mejorado el uso de la app y si se había dejado el
Excel. Desde afuera no se podía contestar: hubo que ir a mirar la fecha de modificación del
Excel (ver «La planilla del proveedor»). Estos números salen de lo que ya está en cada
aparato, sin leer nada nuevo del servidor, y contestan lo mismo cada lunes.

Una tarjeta por semana, las últimas seis (`usoPorSemana`, en `src/lib/usoDeLaApp.ts`):

- **Caja cargada:** de lunes a sábado, cuántos días tienen al menos un turno, y cuáles no.
  En la semana en curso solo cuentan los días que ya pasaron. El domingo y los feriados no
  se reclaman (ver «Los feriados»); los feriados de la semana se nombran en la tarjeta.
- **Turnos de días anteriores sin cerrar.**
- **Ventas, y qué parte se cargó el mismo día.** Se compara el día de la venta con el día en
  que se cargó (`creadoEn`, en la hora del aparato). Las «después» se pasaron más tarde,
  casi siempre desde el cuaderno. Las que no tienen ese dato (las importadas de la planilla
  vieja) no cuentan para ningún lado. El recargo de tarjeta no es una venta.
- **Ventas sin código.**
- **Costos actualizados e ingresos de mercadería:** los productos cuyo costo tiene fecha de
  esa semana y las compras cargadas. Es la cuenta que se compara con lo que llegó de los
  proveedores: si llegó mercadería y los dos están en cero, se anotó en otro lado.

Cada semana lleva un cartel (`senalDeLaSemana`): **FALTA CARGAR** si faltó la caja de algún
día o quedó un turno sin cerrar, **PARA MIRAR** si más de una de cada diez ventas se cargó
después, **BIEN** lo demás. Los cortes son a ojo y están en un solo lugar.

**«Copiar el resumen»** deja las seis semanas en texto para pegar en WhatsApp. Si el aparato
no deja copiar solo, muestra el texto para copiarlo a mano.

**No hay números por persona, a propósito.** La pantalla es para ver qué parte de la app
todavía cuesta más que el cuaderno y arreglar esa parte, no para marcarle nada a nadie.

Probado con 14 pruebas de la cuenta (rotas a propósito de 14 maneras, las 14 en rojo; una
fija la hora del local para que el «día de carga» no dependa de dónde corre la prueba), 1 de
la Ayuda, y de punta a punta contra los emuladores.

## Los feriados (20/11)

El lunes 23/11/2026 es feriado (Día de la Soberanía Nacional, trasladado del viernes 20). Hasta
el 20/11 la app no sabía de feriados: el martes, el Panel iba a avisar que faltaba la caja de
un día en que el local estuvo cerrado, y «Cómo venimos» lo iba a marcar como día sin caja.

Ahora `src/lib/feriados.ts` tiene los feriados nacionales, y `seEsperaCaja(fecha)` dice si
ese día se espera caja: de lunes a sábado, menos los feriados. La usan el aviso del Panel de
días sin caja (`auditoria.ts`) y «Cómo venimos» (`usoDeLaApp.ts`), que además nombra los
feriados de la semana. En el Panel, la tarjeta de turnos dice «Hoy es feriado».

- **Qué entra:** los feriados nacionales, inamovibles y trasladables, el día en que se
  observan (Ley 27.399), y los que agrega un decreto (el lunes 9/11/2026, por la visita del
  papa: Decreto 1103/2026). 2026 sale del calendario oficial. 2027 tiene los inamovibles y
  los trasladables movidos como dice la ley.
- **Qué no:** los días no laborables con fines turísticos (en 2026: 23/3, 10/7 y 7/12),
  porque ahí cada comercio decide si abre; y los feriados de una sola provincia o ciudad.
- **Si el local abre un feriado,** el turno se carga como siempre y cuenta. Lo único que
  cambia es que, si no hay caja, no se reclama.

De paso: el aviso de días sin caja daba por hecho que el navegador rechaza el 30 de febrero,
y no lo rechaza (lo convierte en el 2 de marzo). Mirando un mes ya pasado podía reclamar el
29, el 30 y el 31 de febrero. `seEsperaCaja` mira que el día exista.

Probado con 6 pruebas de los feriados, 2 del aviso del Panel y 1 de «Cómo venimos» (tres
pruebas viejas cambiaron: usaban la semana del 9/11, que tuvo un feriado). Roto a propósito
de 11 maneras: las 11 en rojo.

## Equipamiento y deudas en cuotas (20/11)

La compu del local se compró con la tarjeta de un dueño, en 6 cuotas, y el local le devuelve
de la 2 a la 6. Se venía cargando como OTROS, y no había forma de llevar cuánto se le debía.

**La categoría EQUIPAMIENTO** es para lo que se compra para el local y queda (una compu, una
heladera). Arranca como gasto fijo (`FIJOS_POR_DEFECTO`, que ahora es una sola lista para toda
la app: la usaban copiada Caja y Vencimientos). Entra en el resultado del mes en que se paga;
en cuotas, cada cuota en su mes, así la compra se reparte sola. Si conviene que no entre en
el resultado y se amortice, es para mirar con el contador, junto con los retiros.

**Corregir la categoría desde Gastos:** al lado de cada gasto hay un selector de categoría,
solo para quien está al mando. Toma el fijo o variable de la categoría nueva y queda en el
historial («Categoría corregida desde Gastos»). Es para pasar a EQUIPAMIENTO lo que ya estaba
como OTROS.

**Una deuda en cuotas es un vencimiento de la agenda con cuotas** (`Vencimiento.cuotas`:
cuántas en total, la primera que paga el local y el mes de esa cuota) y, si es con alguien de
la lista, a quién (`Vencimiento.aQuien`). Se usó la agenda porque ya avisa cada mes, carga el
gasto al marcarlo pagado y viaja a todos los aparatos; no hizo falta una tabla nueva.

- Antes de la primera cuota no se reclama nada, y después de la última queda **terminada**
  (`tocaEn`, `cuotaDelPeriodo` en `src/lib/vencimientos.ts`). Se controla desde la primera
  cuota aunque se cargue después.
- El gasto de cada pago dice qué cuota es («cuota 3 de 6, diciembre») y queda a nombre de la
  persona (`Movimiento.persona`). En Gastos se lee «a Elena».
- «Deudas en cuotas», arriba de la agenda, dice cuántas van pagadas, cuántas quedan, cuál
  sigue y cuánto es, aproximado (`estadoDeLaDeuda`).
- Una cuota que ya estaba cargada, aunque sea como OTROS, se engancha con «¿Ya lo cargaste en
  Gastos?» y pasa a la categoría de la deuda, con su persona. El historial lo dice. Los gastos
  que ofrece salen primero por el monto más parecido al de la agenda: OTROS junta de todo y se
  muestran cuatro, así que el más nuevo no siempre era el que se buscaba (en la prueba en el
  navegador, el primero era una heladera).

Los montos de la compu no están en el código ni en las pruebas: los carga el asistente desde
la pantalla.

Probado:
- 12 pruebas de la cuenta y 5 de las escrituras. Rotas a propósito de 29 maneras, las 29 en
  rojo (una necesitó una prueba más: el salto a la primera cuota no se veía si la agenda la
  conocía desde antes).
- En el navegador, contra los emuladores (`pruebas/e2e/gastos.cjs`): se carga «Una deuda en
  cuotas» con un dueño sin cuenta, se engancha una cuota que estaba como OTROS y pasa a
  EQUIPAMIENTO «a Elena», la tarjeta baja de 5 a 4 cuotas, y el selector de Gastos cambia otra
  categoría. Todo queda en el historial con su motivo y el servidor no rechaza nada.

## Rearmar los turnos que no llegaron (20/11)

Los tres turnos de Gabriela del 03/11 y el 04/11 (ver «Lo que pasó el 07/11») nunca llegaron
al servidor: sus ventas y sus egresos sí. Todo lo que hacía falta para completarlos ya estaba
allá, así que se rearman desde la app, sin buscar el aparato.

**De dónde sale cada dato** (`src/lib/rearmarTurnos.ts`):
- La fecha, el horario y la hora de apertura: el renglón «creó» del historial («Turno del
  2026-11-03 a la mañana»). Si después se corrigió el horario, vale el corregido. Si el
  historial no lo tiene, el horario sale de la hora de las ventas, y la pantalla lo dice.
- El conteo del cierre, billete por billete, y la hora: el historial de cuando se cerró. Si el
  historial no lo tiene, lo que se contó al abrir el turno siguiente.
- Con cuánto abrió: lo que contó el turno anterior al cerrar. La cadena de caja cierra (lo
  revisó el soporte): lo que queda en el cajón es con lo que abre el que sigue. Dos turnos
  seguidos que faltan se apoyan uno en el otro, en orden.
- Las ventas y los egresos: tienen el id del turno y no se tocan.

**Lo que no se sabe no se inventa:** el motivo de la diferencia y el primer conteo quedan
vacíos, el turno se crea sin visto bueno (el servidor no deja crearlo con uno), y si la caja no
dio justa espera el visto bueno del dueño como cualquier cierre. Si falta el turno anterior o
el conteo del cierre, o ya hay otro turno con esa fecha y ese horario, ese turno dice por qué
y no se rearma.

**Se rearma con el mismo id.** Si el aparato que lo tenía aparece y lo sube, es el mismo turno
y no queda repetido. Al tocar el botón se vuelve a mirar si llegó mientras tanto.

**Dónde:** arriba de todo en Turnos del día (adonde lleva el aviso «N turnos no llegaron al
servidor» del Panel), solo para quien está al mando. Primero la lista: de cada turno, con
cuánto abrió y de dónde sale, cuánto contó al cerrar, cuánto tendría que haber dado, la
diferencia y si engancha con el turno que sigue. Abajo, «Rearmar los N turnos», que pregunta
cuántos va a crear y cuáles. Quedan en el historial con el motivo «Turno rearmado: no había
llegado al servidor», y en la nota del turno dice de dónde salió cada número.

Probado:
- 13 pruebas de la cuenta y 3 de las escrituras, con el caso armado como el real (montos
  inventados). Rotas a propósito de 33 maneras, las 33 en rojo (cinco necesitaron un caso
  más: la fecha del historial distinta de la de las ventas, un turno reabierto y vuelto a
  cerrar, un conteo raro en el historial, y uno que llega con su id pero otro horario).
- En el navegador, contra los emuladores (`pruebas/e2e/turnos.cjs`): el Panel dice «3 turnos
  no llegaron al servidor», Turnos del día muestra la lista, la pregunta dice «Se van a crear
  3 turnos», el servidor los recibe con sus ids, cerrados, con la caja inicial de la cadena y
  el conteo del historial, el historial tiene los 3 «creó» con el motivo, las ventas siguen
  siendo las mismas, el aviso del Panel desaparece y no hay ningún rechazo.

## Dueños que entran solo a mirar (20/11)

Sebastián y Elena van a entrar a ver el Panel y los Reportes, sin cargar, editar ni borrar
nada, ni en la app ni pidiéndoselo al servidor. Lo pidió Emmanuel el 20/11.

**Un rol nuevo, «Dueño/a, solo mira»** (`'socio'` en `Rol`, `soloMira` y `veLosNumeros` en
`src/sync/permisos.ts`):
- **Ve** el Panel y los Reportes, como un dueño: cómo viene el mes, el margen, el resultado y
  todos los avisos con su «Por qué y qué hacer». El menú tiene solo Panel y Reportes (y la
  Ayuda); cualquier otra dirección lo devuelve al Panel. No tiene «Mi día», Ajustes ni la
  campana.
- **No hace** nada: los avisos no tienen «Ir a resolverlo» ni «Recordar», la caja grande del
  Panel no lleva a contarla y los Reportes no llevan a corregir productos.
- **No sube nada.** El motor le pregunta al servidor qué rol tiene antes de la subida inicial
  y, si solo mira, no sube ni controla lo que no subió; cualquier cambio local tampoco viaja
  (`modoSoloMira` en `src/sync/motor.ts`).
- **El servidor no lo deja aunque lo pida.** Las escrituras van por lista
  (`puedoCargar()` en `firestore.rules`: dueño, encargada y empleada). Un rol que no está en
  la lista, este o uno nuevo, no escribe nada. Lee lo mismo que cualquiera con sesión, menos
  los sueldos acordados.
- **Sigue siendo dueño para los retiros:** aparece en «¿De quién es el retiro?», en «Retiros
  de los dueños» y en las deudas en cuotas; en el mes de sueldos, no. La encargada no lo
  crea, no lo toca ni pasa a nadie a este rol (en la app y en las reglas).

**Darle acceso a un dueño sin cuenta sin que pierda sus retiros:** Ajustes → «Usuarios del
equipo» → «Darle acceso para mirar», en la fila del dueño sin cuenta. Solo un dueño.
- Se escribe su mail; antes de crear nada dice qué va a poder y cuántos retiros y deudas pasan
  a su cuenta.
- La cuenta se crea con una contraseña al azar que nadie ve (`crearCuentaParaMirar`), y le
  llega un mail para elegir la suya. **Nadie escribe ni pasa una contraseña.**
- Una cuenta de Firebase trae su propio id, así que se crea su usuario con ese id y todo lo
  que apuntaba al «sin cuenta» pasa al nuevo, de una y con su motivo en el historial
  (`pasarALaCuenta` en `src/db/accesoParaMirar.ts`): los retiros (`Movimiento.persona`) y las
  deudas del local con él (`Vencimiento.aQuien`). El «sin cuenta» se saca.
- Si el mail ya tiene una cuenta, no toca nada y lo dice.

**El fundador ahora es solo Emmanuel.** Hasta hoy, el mail de Sebastián se hacía dueño
completo solo, en su primer login (`esFundador()` en las reglas y `EMAILS_FUNDADORES` en el
motor). Si va a entrar solo a mirar, eso era un acceso total de más: se sacó de los dos
lados, y una prueba controla que digan lo mismo.

Probado:
- Permisos, retiros y Ayuda: pruebas nuevas; el paso a la cuenta, con 5 pruebas de la cuenta
  y 4 de las escrituras. Todo roto a propósito de 26 maneras, las 26 en rojo (una necesitó un
  caso más: un mail guardado con mayúsculas).
- Las reglas, contra el emulador (`pruebas/reglas-socio.test.ts`): lee todo lo del Panel y
  los Reportes y no los sueldos; no escribe en ninguna colección, ni su perfil; un rol que no
  está en la lista tampoco; la encargada no lo crea ni lo toca; el mail de Sebastián ya no se
  hace dueño. Rotas a propósito de 11 maneras, las 11 en rojo.
- **Un día en el local, contra las reglas nuevas** (`pruebas/reglas-dia.test.ts`), con
  dueño, encargada y empleada: abrir la caja, vender, egreso, retiro, cambio de producto,
  corregir y deshacer una venta, cerrar, cargar un gasto, un ingreso de mercadería, unir
  proveedores y cambiar un código, cada paso con lo que escribe la app y su historial. Todo
  pasa (la empleada no archiva ni borra productos, como hasta ahora). Rotas a propósito de
  6 maneras: las 5 que cambian algo, en rojo.
- En el navegador, contra los emuladores (`pruebas/e2e/solo-mira.cjs`): Emmanuel le da acceso
  a Elena; la pregunta dice «2 retiros anotados y 1 deuda»; en el servidor queda su usuario
  «solo mira», con los 2 retiros y la deuda, y el «sin cuenta» ya no está; le llega el mail
  y elige su contraseña; entra y ve Panel y Reportes, con los números y 4 avisos sin un solo
  botón para resolver; nueve direcciones de otras pantallas la devuelven al Panel; mientras
  mira, el servidor no cambia en nada y no hay renglones a su nombre; pidiéndoselo directo al
  servidor, una venta, un retiro, borrar un turno y hacerse dueña dan 403, y leer da 200. El
  mail de Sebastián no entra ni crea cuenta. Cero rechazos.

## La compu: opción B (06/11)

Punto 20 del pedido del 06/11 («hay que mejorar la visual»). Emmanuel eligió la opción B de
los diseños: en una pantalla ancha, el menú pasa arriba y el Panel se vuelve un tablero.
**El celular no cambia nada.** Sale en tres partes: el menú y el Panel, la Caja, y la ficha
del producto.

**Desde 1024 píxeles de ancho** (`@media (min-width: 1024px)`, al final de `estilos.css`):
- El menú de abajo se esconde. Arriba aparecen el círculo «ECDM», el nombre y las mismas
  secciones del menú de siempre, con iconos de trazo (`src/componentes/Icono.tsx`) en lugar
  de emojis, que se ven distinto en cada aparato. La sección abierta va en verde, subrayada.
- Fondo gris verdoso, tarjetas blancas con borde y sin sombra, el contenido hasta 1080
  píxeles de ancho. El Panel usa hasta 1320 (`PANTALLAS_ANCHAS` en `App.tsx`): las otras
  pantallas todavía no están acomodadas para tanto ancho, y estiradas se leen peor.
- Las otras pantallas toman los colores nuevos y nada más. Su acomodo para la compu viene
  después, de a una.

**El Panel en la compu:**
- Arriba, la fecha, el saludo con el nombre y «Ir a la caja» (solo a quien tiene la Caja).
- Cuatro recuadros con lo de hoy (`src/lib/tablero.ts`):
  - lo vendido y cuántas operaciones (un ticket o un cambio cuenta como una);
  - el efectivo que debería haber en el cajón del turno abierto;
  - lo cobrado con tarjeta, transferencia o QR;
  - para quien está al mando, el saldo de la caja grande, que lleva a contarla; para el
    resto, cuántos avisos hay para hoy.
- Los avisos en tres columnas, una por plazo.
- Las ventas de la semana en barras, de lunes a sábado, con hoy resaltado, y los turnos de
  hoy: quién, desde qué hora y si ya cerró.
- El puntaje de la revisión queda abajo; en el celular sigue arriba, como siempre.

**Y un hueco del conteo ciego, arreglado.** La Caja muestra arriba «Efectivo esperado en
caja», y eso quedaba a la vista mientras se contaba en «Cierre». Ahora, en esa pestaña y con
el turno abierto, dice «se ve después de contar». Lo esperado aparece recién con «Ya conté»,
como estaba pensado.

Probado:
- 5 pruebas del tablero, rotas a propósito de 12 maneras y las 12 en rojo:
  - el saludo de las 12 y de las 20;
  - la semana que arranca el domingo, o un día corrida;
  - el filtro del día y el domingo en las barras;
  - el cajón con los turnos cerrados, con ventas de otro turno o sin los egresos;
  - los renglones contados como operaciones;
  - un cero en vez de «no hay turno»;
  - el banco igual a todo lo vendido.
- En el navegador, a 1440 y a 390 de ancho, con datos de un día:
  - en la compu, el menú arriba y el de abajo escondido, sin corrimiento horizontal;
  - en el celular, todo como antes.
- El conteo ciego, en el navegador: con el turno abierto y $ 55.000 esperados, en «Cierre»
  el número no aparece en ninguna parte de la pantalla hasta «Ya conté». Con el arreglo
  sacado, el mismo control da que se ve.

### La Caja en tres columnas (segunda parte)

En la compu (`useEsCompu`, la misma medida que el `@media`), la pestaña «Ventas» de la Caja
cobra todo desde el ticket:
- **Buscar producto**, con «Lo más vendido de la semana»: los seis que más salieron en los
  últimos siete días, contados por cuántas ventas y no por unidades
  (`src/lib/masVendidos.ts`).
- **Ticket**, con − y + para la cantidad y el precio a mano.
- **Cobro**: los mismos medios, tarjetas, recargo y vuelto que el ticket del celular. Al
  registrar, el formulario queda vacío para el próximo cliente.
- Abajo, **las ventas del turno en una tabla** (hora, qué, cómo pagó, total), con «Pasar a» y
  «Borrar».

El formulario es el mismo del celular (`FormularioTicket` con `enColumnas`). En el celular no
cambia nada.

**Una venta de un solo producto no es un ticket.** Si al registrar queda un solo renglón,
pagado con un solo medio y sin recargo, se guarda sin `ticketId` ni `pagos`, con los mismos
campos que una venta de siempre (`comoVentaSola` y `registrarCobro`, en `src/db/ticket.ts`).
Si no, en la compu todo lo vendido diría «TICKET». Vale también para el ticket del celular:
si se registra con un solo producto, queda como venta común.

Probado:
- 3 pruebas nuevas del ticket, rotas a propósito de 8 maneras y las 8 en rojo:
  - sin mirar cuántos renglones, o sin mirar los medios;
  - el débito como ticket;
  - que queden el `ticketId` o los `pagos`;
  - que se toque lo armado;
  - que se guarde lo armado;
  - que vuelva siempre como ticket.
- 2 pruebas de lo más vendido, rotas de 7 maneras y las 7 en rojo.
- En el navegador, a 1440: el ticket de dos productos queda como ticket, y la venta de uno,
  como venta común. A 390, la caja de siempre: la venta común, el ticket de un producto que
  queda como venta, y el de dos que queda como ticket.
- Contra los emuladores, con la Mac a 1440 y un celular:
  - una venta en efectivo, un ticket con Consumax 3 pagos y efectivo, y una de débito que se
    deshace;
  - en el servidor, la venta sola tiene los campos de siempre y el ticket su recargo;
  - el stock da lo esperado y el borrado deja su constancia;
  - el celular ve lo mismo que el servidor;
  - cero rechazos y nada «sin subir».

### La ficha del producto (tercera parte)

En la compu, tocar un producto de la lista abre su ficha (`src/componentes/FichaProducto.tsx`):
- **Arriba**, el nombre, el código, el proveedor, el precio y las marcas «EN STOCK», «SIN
  STOCK», «CONVIENE REMARCAR», «DESCONTINUADO» o «GENÉRICO». Al lado, «Compartir por
  WhatsApp» y «Editar», que abre el formulario de siempre; al salir, se vuelve a la ficha.
- **Precio y margen**: el costo, la rentabilidad buscada y el margen de hoy. Si el precio
  quedó atrás (`precioAtrasado`), dice cuánto pide la rentabilidad y cuánto se deja de
  cobrar por unidad. Quien está al mando tiene el botón «Poner $ X». Usa `remarcar`, el
  mismo del ingreso de mercadería: pregunta antes y queda en el historial con el motivo
  «Remarcado desde la ficha del producto». Un empleado lo ve sin el botón, igual que en el
  formulario, donde tampoco puede cambiar el precio.
- **Stock y ventas**: cuántos hay, los vendidos en 30 días (menos lo que volvió en un
  cambio), para cuánto alcanzan a ese ritmo y la última venta (`src/lib/fichaProducto.ts`).
- **Historial**: los últimos cambios, con quién y cuándo, sin las fechas que se mueven solas.
- **Compras**: la tabla con el costo, el flete y el remito de cada una, y cuánto subió el
  costo desde la primera.

En el celular, tocar un producto sigue abriendo el formulario directo.

**Y dos números que se habían quedado.** La tarjeta «Historial de ediciones» del formulario
del producto y el «productos actualizados este mes» de Mi día leían `historialProductos`.
Esa tabla no se escribe desde la versión 6, cuando el historial pasó a `historial`, y su
contenido se copió ahí. El formulario mostraba solo lo de antes, y Mi día daba siempre
cero. Ahora los dos leen `historial` (`src/lib/historialLegible.ts`, con los nombres de los
campos que ya usaba la pantalla del Historial). De paso, Mi día buscaba hasta el día 31 de
cada mes, una fecha que en noviembre no existe y que algunos navegadores toman como
inválida: ahora va del 1 del mes al 1 del siguiente.

Probado:
- 4 pruebas de la ficha, rotas a propósito de 12 maneras y las 12 en rojo (dos sobrevivían
  al principio: el piso en cero y el ritmo de 30 días; se sumaron los casos):
  - 31 días en vez de 30;
  - sin restar lo que volvió;
  - la última venta sin la hora, o con una devolución;
  - el cero como «no queda»;
  - los límites de la semana y de los dos meses;
  - el costo sin flete, o sin ordenar;
  - la variación con una sola compra.
- 3 del historial, rotas de 5 maneras y las 5 en rojo:
  - otras tablas, otras personas u otras acciones;
  - otros meses;
  - el mismo producto contado dos veces.
- En el navegador, a 1440: la ficha, «Poner $ 19.600», «Editar» y la vuelta a la ficha y a
  la lista. A 390, tocar el producto abre el formulario, como siempre.
- Contra los emuladores, con Emmanuel y con Gabriela (empleada con Productos), los dos a
  1440:
  - Gabriela ve la ficha sin el botón;
  - Emmanuel remarca, y el servidor queda con el precio nuevo, la fecha de hoy y el
    historial con el motivo;
  - Gabriela ve el precio nuevo al instante;
  - Gabriela cambia el stock desde «Editar», vuelve a la ficha con el cambio en el
    historial, y Mi día dice «Productos que actualizaste: 1» (antes daba 0);
  - cero rechazos y nada «sin subir».

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

### `productos.seed.json`: resuelto

Durante meses `public/productos.seed.json` se sirvió público en
`app.elclubdelmate.com/productos.seed.json` **con el precio de compra, la rentabilidad y
el proveedor de cada producto**. Salió de `public/` en el #28 y hoy no está ni en
`public/` ni en `dist/`: la carga inicial usa `catalogo.json`, que solo lleva código,
descripción y precio de venta.

Lo que queda de eso es el historial de git, que sigue siendo público hasta que el
repositorio pase a privado (ver "Próximos pasos").

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
| `datos/productos.seed.json` | **fuera de git** (`.gitignore`) | catálogo completo con costo, markup y proveedor |
| `datos/historico-<mes>.seed.json` | **fuera de git** (`.gitignore`) | ventas, gastos y turnos de cada mes de 2026 |
| `datos/arqueos-<mes>.seed.json` | **fuera de git** (`.gitignore`) | conteo de billetes de cada turno |
| `public/catalogo.json` | publicado | código, descripción y precio de venta, nada más |
| `public/precios-<mes>.seed.json` | publicado | solo cambios de precio de venta |

Los de `datos/` **estuvieron versionados hasta el 15/10/2026**, y eso fue un error
mío: el README decía "fuera de `public/`, no se publica" y era cierto a medias —no se
publicaban en el sitio, pero sí en GitHub, donde cualquiera podía leerlos sin login.
Eran los costos de los 1.337 productos con sus proveedores, las ventas de ocho meses y
el conteo de billetes de cada turno. Ya no están en el árbol y ahora hay un chequeo que
lo verifica; lo que queda pendiente es el historial de git, que solo cierra poniendo el
repositorio en privado (ver el aviso al final de esta sección).

Si hacen falta de nuevo para correr un script, se recuperan del historial
(`git show eaeb991:datos/productos.seed.json > datos/productos.seed.json`) o se
exportan desde la app con **Ajustes → Respaldo**, que es la fuente al día.

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
npm run revisar-publicos      # los JSON de public/
npm run revisar-versionados   # todos los JSON que estén dentro de git
```

`scripts/revisar-publicos.py` falla si encuentra precio de compra, markup, proveedor,
stock, ventas, gastos, turnos o arqueos. Los **dos** chequeos corren en cada pull
request, y **el deploy corre el primero otra vez sobre `dist/`** —lo que realmente se
sube, no lo que hay en `public/`— justo antes de publicar. Si algo se coló, no se
publica nada.

El segundo chequeo (`--versionados`) es el que faltaba, y es el que importa más mientras
el repositorio sea público: mira lo que está **dentro de git**, no una carpeta. Pregunta
`git ls-files` en vez de recorrer el disco, así da igual en qué carpeta se esconda el
archivo. Saltea los JSON de herramientas (`package.json`, `tsconfig.json`, etc.), que no
son datos del negocio.

Para agregar un campo a la lista, está en `PROHIBIDAS` arriba del script, cada uno con
el motivo escrito al lado.

> ⚠️ **El repositorio es público, y el historial de git también.** Sacar los archivos
> de `datos/` del árbol (15/10/2026) corta el acceso fácil —ya no se ven navegando el
> repositorio— pero **no los borra de los commits viejos**: siguen siendo legibles para
> quien sepa buscarlos, igual que las versiones anteriores de los archivos de `public/`.
> El chequeo nuevo impide que vuelva a pasar de acá en adelante; no puede arreglar el
> pasado.
>
> Lo único que cierra el pasado es **poner el repositorio en privado** (Settings →
> General → Danger Zone → Change repository visibility). Dos cosas antes de tocarlo:
>
> 1. **El plan de la cuenta.** GitHub Pages desde un repositorio privado requiere plan
>    pago (Pro). Con una cuenta gratuita, al poner el repositorio en privado **Pages se
>    apaga y `app.elclubdelmate.com` deja de responder**. La app instalada en los
>    celulares sigue funcionando (es una PWA, ya está descargada y guarda los datos en
>    el dispositivo), pero un celular nuevo no la puede instalar y nadie puede recibir
>    una actualización.
> 2. **El horario.** No en pleno turno. Si el sitio se cae, se vuelve a poner público y
>    queda como estaba — no se pierde ningún dato, pero no es algo para descubrir con el
>    local abierto.
>
> Qué cambia y qué no, al poner el repositorio en privado: el sitio publicado por Pages
> **sigue siendo público** (una página web es pública por definición, y así tiene que
> ser para que entre un cliente al catálogo). Lo que deja de ser público es el **código
> y el historial**, que es justo lo que acá importa.

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

**La app ya no los carga sola (06/11).** Hasta el 15/10 había que agregar el mes a
`MESES_HISTORICOS` en `src/App.tsx` y la app lo traía al abrirse
(`sincronizarMesImportado`). Se sacó: los archivos dejaron de publicarse porque son
ventas (datos privados), y si volvían, cada aparato creaba su propia copia de esos
meses con otros ids. Así aparecieron los 406 turnos retenidos en la Mac. Lo histórico
ya está en el servidor; un mes nuevo de la planilla se sube desde un solo aparato,
con un script, nunca publicándolo en `public/`.

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

Lo que baja se guarda marcado como «remoto» para que no vuelva a subir ni quede en el
historial. La marca va en la transacción que lo escribe (`comoRemoto`, en `db.ts`), no en
un estado global: lo que la persona carga mientras tanto se sube como siempre (ver «Lo que
pasó el 19/11»).

Cada tabla se escucha por separado. Si la escucha de una termina en error, el motor
la vuelve a abrir solo, cada vez con más espera, y mientras tanto el estado queda en
error y la revisión no sube nada de esa tabla (ver «Lo que pasó el 13/11» y
`sync/escuchas.ts`).

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

Lo que está pendiente de verdad, al 20/11/2026. Lo de arriba de la lista es lo que
sigue.

- [ ] **Los feriados de 2027 y 2028** (`src/lib/feriados.ts`): revisar 2027 cuando salga el
      calendario oficial (puede haber un decreto que agregue o mueva alguno) y sumar 2028
      antes de que termine 2027.
- [ ] **Cargar la deuda de la compu y corregir sus cuotas cargadas como OTROS** (lo hace el
      asistente desde la pantalla, con los montos de verdad): Vencimientos → «Una deuda en
      cuotas», y en Gastos, el selector de categoría. Ver «Equipamiento y deudas en cuotas».
- [ ] **EQUIPAMIENTO y los retiros en el resultado del mes:** mirar con el contador si entran
      como gasto o se separan (y si el equipamiento se amortiza).
- [ ] **Rearmar los tres turnos del 03/11 y el 04/11** (lo hace el asistente, con esta versión
      publicada): Turnos del día → mirar la lista (que cada uno diga «Engancha» y de dónde
      sale cada número) → «Rearmar los 3 turnos». Después, el visto bueno de los que no
      cierren justo, como cualquier cierre.

**Hecho el 31/10** — cada edición manda solo los campos que cambió (la venta de Gabriela
ya no choca con un precio que su celular no había recibido), los ecos de una edición se
aplican, `creadoPor` se conserva al editar, y la app muestra su versión en Ajustes y en
el login. Ver "Lo que pasó el 31/10".

**Hecho el 06/11** — la ruedita del mouse ya no cambia los números (el conteo que quedaba
en cero), el cartel de cargas retenidas resume, el Panel no cuenta lo retenido ni los
domingos, y las copias exactas retenidas se sacan de una vez. Ver "Lo que pasó el 06/11".
Después, en el día: los avisos por plazo y el cambio en una línea, los saldos que piden qué
salió, el cierre con conteo ciego, la caja grande con saldo, y el ticket con varios
productos y las tarjetas con recargo. Más tarde: el ingreso de mercadería, la agenda de
vencimientos, los pedidos de insumos y la primera parte de la visual nueva en la compu. El
análisis de los 22 pedidos del 06/11 y el plan están en el documento «ECDM · Análisis y
plan de mejoras (noviembre)».

**Para que decida Emmanuel (encontrado el 06/11):** un pago a proveedor genera un gasto
variable de categoría PROVEEDORES, y el resultado del mes ya resta el costo de la mercadería
vendida. La mercadería se resta dos veces. Con el flete adentro del costo pasa lo mismo si el
flete se carga como gasto. Lo que proponen los sistemas de gestión: el pago a un proveedor de
mercadería (y el flete) mueve plata pero no es gasto del mes, porque ya está en el costo de
lo vendido; los insumos (bolsas, limpieza) sí son gasto. Antes de tocar la cuenta, mirar con
el contador y con los datos reales cuánto cambia.

**Hecho el 13/11** — la escucha del servidor que se cae se vuelve a abrir sola, con un
cartel mientras tanto, y la revisión no sube nada de lo que el aparato no está recibiendo.
Ver «Lo que pasó el 13/11».

**Hecho el 19/11** — los sueldos: lo acordado con cada persona, de quién es cada pago y
cuánto falta. A la noche, con lo que decidió Emmanuel: los ven los dueños y quien está de
encargado, los define solo un dueño, cada persona ve lo suyo en «Mi sueldo», el sueldo se
acuerda por semana (un monto fijo cada sábado, con «por mes» como opción) y los retiros de
los dueños se llevan por persona. Ver «Los sueldos y los retiros».

- [ ] **Pegar las reglas en la consola** (desde el 20/11 las pega Emmanuel). Probadas en el
      emulador con las tareas de todos los días de dueño, encargada y empleada (ver «Dueños
      que entran solo a mirar»). Van **antes** de darle acceso a nadie para mirar: con las
      reglas viejas, un rol que solo mira podría escribir pidiéndoselo al servidor, y el mail
      de Sebastián todavía se haría dueño solo.
- [ ] **Cargar los sueldos acordados:** los carga el asistente desde la pantalla (por semana,
      con el día desde el que rige), cuando haya reglas que los protejan.
- [ ] **Darles acceso para mirar a Sebastián y a Elena** (con las reglas ya pegadas):
      Ajustes → «Usuarios del equipo» → en cada uno, «Darle acceso para mirar», con el mail que
      pase Emmanuel. Si alguno todavía no está como dueño sin cuenta, primero «+ Dueño que no
      usa la app». Les llega un mail para elegir la contraseña.
- [ ] **Ordenar lo que ya estaba cargado:** en Sueldos, mes por mes, «¿Esto es un sueldo?» y
      «¿Esto es un retiro de un dueño?» muestran lo que quedó en OTROS.
- [ ] **Las comisiones por venta:** falta que Emmanuel defina la base y el porcentaje.

**Hecho el 19/11, publicación aparte** — la planilla del proveedor: todos sus productos en
una lista para cargar los costos de una entrega con Enter, la fecha de la factura y los
precios que pide el markup, de a uno o todos juntos. Es lo que se seguía haciendo en el
Excel. Ver «La planilla del proveedor».

- [ ] **Ponerle fecha al Excel** (decisión de Emmanuel). Mientras se anote en los dos lados,
      la lista de precios del Excel y la de la app pueden no decir lo mismo.

**Hecho el 19/11, publicación aparte** — en Gastos, un gasto de un turno cerrado solo lo
borra quien está al mando (avisado de qué turno mueve), y el formulario arranca fijo o
variable según su categoría. Ver «Gastos: dos arreglos de la auditoría».

- [ ] **Los pagos a proveedores cargados desde Gastos que quedaron como fijos** (decisión de
      Emmanuel): contarlos y, si corresponde, pasarlos a variable de una, con su pregunta y
      su motivo. Cambia el margen de contribución de los meses que toque.

**Hecho el 19/11, publicación aparte (sincronización)** — lo que se carga mientras la app
recibe datos del servidor ahora se sube y queda en el historial. Era la causa de la limpieza
de proveedores que no llegaba, y muy probablemente de los «sin subir», de los cierres que
aparecían abiertos y de lo borrado que volvía. Ver «Lo que pasó el 19/11».

- [ ] **Repetir la limpieza de fichas de proveedor** (pedida por Emmanuel el 20/11; la hace el
      asistente después de las 21, con la versión del 20/11 publicada): Ajustes → «Unir
      proveedores» → mirar la lista de «Fichas repetidas vacías» entera → «Unir las N fichas
      vacías a su gemela». Tiene que terminar en verde («Las N constancias ya están en el
      servidor»); si sale en rojo, no repetirla y mandar la foto. Los pares con datos de los dos
      lados los une Sandra a mano desde la misma pantalla.
- [ ] **Pedirle al soporte que mire si quedó algo sin subir de antes**: turnos que en el
      servidor figuran abiertos y en el aparato cerrados, y el número de «sin subir» de
      cada aparato después de actualizar.
- [ ] **Una herramienta para recuperar el negocio desde un respaldo** (decisión de
      Emmanuel): «Importar un respaldo» ahora cambia solo ese aparato. Subir un respaldo
      entero al servidor tiene que ir en lotes, diciendo cuánto toca y preguntando.

**Hecho el 19/11, publicación aparte (sincronización)** — lo que baja del servidor se guarda
en tandas de 200. En la prueba, la primera sincronización pasó de 130 s a 10 s, y lo que se
carga apenas se abre la app llega al servidor en 2 a 4 s. Ver «Lo que baja se guarda en
tandas».

- [ ] **Leer menos al abrir la app.** Medido el 19/11 mirando lo que la app le pide al
      servidor: al abrirse pide cada colección **una sola vez**, que es la escucha. La
      subida del arranque no agrega lecturas: se cuelga de la escucha que ya está abierta.
      Lo anotado el 27/10 —que `empujarTodoLocal` leía todo otra vez— estaba mal, y sacarle
      ese `getDocs` no ahorraría nada. Lo que sí cuesta, según la documentación de
      facturación de Firestore: una escucha que estuvo más de 30 minutos desconectada se
      cobra como una consulta nueva, o sea la colección entera, esté o no guardada en el
      aparato. Cada aparato que se abre a la mañana lee todo, y el historial es lo que más
      crece. Si la consola de Firebase muestra que se está cerca de las 50.000 lecturas por
      día, lo que sigue es escuchar solo lo reciente del historial y de las ventas.
- [ ] **Que lo borrado deje constancia en todas las tablas.** Hoy la dejan las ventas, los
      turnos (con lo suyo), el código viejo de un producto y las fichas de proveedor unidas.
      Un gasto, una compra, un pago o una ficha borrados desde un aparato todavía pueden
      volver desde otro si en ese otro la fila no pasó nunca por Firestore (ver «Un aparato
      atrasado ya no vuelve a subir lo que otro borró»).
- [ ] **No volver a guardar lo que no cambió** al abrir la app (ver «Lo que este arreglo no
      hace»).
**Hecho el 19/11, publicación aparte (sincronización)** — un aparato que estaba cerrado
mientras otro borraba algo ya no lo vuelve a subir al abrirse: la subida del arranque espera a
que termine de guardarse lo que bajó antes de comparar. Ver «Un aparato atrasado ya no vuelve
a subir lo que otro borró».

- [ ] **Pedirle al soporte que busque rechazos de `historial` en la colección `rechazos`**
      del servidor real. No debería haber: es para confirmar que el cartel falso que se ve
      en las pruebas es solo del emulador (ver «Cómo se probó»).

**Hecho el 19/11, publicación aparte** — «Cómo venimos»: el uso de la app semana por semana
(días con caja, ventas cargadas en el día o después, costos e ingresos de mercadería), con un
resumen para copiar. Ver «Cómo venimos».

- [ ] **Mirar «Cómo venimos» cada lunes con Sandra**, y comparar los costos actualizados
      con lo que se siga anotando en el Excel hasta que tenga fecha de corte.
- [ ] **Feriados:** que la pantalla (y el aviso del Panel) no reclamen la caja de un feriado.

**Hecho el 13/11, publicación aparte** — «Unir proveedores» confirma contra el servidor que
las constancias llegaron y dice cuántas hay. Ver «Las constancias, confirmadas contra el
servidor».

**Lo que sigue (13/11):**
- [ ] **Una tercera barrera para las fichas de proveedor.** La revisión no tiene que volver
      a subir una ficha vacía si el servidor ya tiene otra con el mismo nombre exacto,
      aunque no haya constancia (por ejemplo, si se borró desde la consola).
- [ ] **Mirar en la consola de Firebase las lecturas por día.** Con la cuota de 50.000
      lecturas diarias del plan Spark, quedarse sin lecturas puede ser lo que tira las
      escuchas (ver «Leer menos al abrir la app», más arriba).

**La limpieza de fichas de proveedor repetidas (10/11) se repite con la versión del 20/11**
(ver el pendiente de arriba). El 13/11 había 252 fichas con 93 nombres repetidos y ninguna
constancia de proveedores en `borrados`. Lo que faltaba antes de repetirla ya está: la escucha
que vuelve y la confirmación de las constancias (13/11), y la causa de que no llegaran, lo que
se cargaba mientras la app recibía (19/11). Desde el 20/11 entran también los nombres con todas
sus fichas vacías (ver «Las fichas repetidas vacías, de una»). Los pares con datos de los dos
lados, como HUGO-LA ENTRERRIANA, los une Sandra a mano desde la misma pantalla.

**Lo que sigue del plan del 06/11**, en orden:

- [ ] **Tarjetas a cobrar**: lo vendido con cada tarjeta, cuándo se acredita y cuánto se
      queda la procesadora, para controlar contra la liquidación. Falta que Sandra junte,
      de cada tarjeta, los días de acreditación y el porcentaje que descuentan.
- [ ] **Precio de oferta o liquidación por producto.** Toca `productos` en el servidor:
      necesita cambio de reglas y el OK de Emmanuel (y quién puede ponerlo).
- [x] **Ingreso de mercadería** con remito, **prorrateo del flete** en el costo, y las
      compras de cada producto en su ficha (ver «El ingreso de mercadería»).
- [x] **Pedidos de insumos** (ver «Los pedidos de insumos»).
- [ ] **Pago a proveedor en un solo paso** contra sus facturas, condición de IVA del
      proveedor (falta saber cómo factura cada uno y qué es «medio IVA»), y la reposición
      sugerida por proveedor (necesita stock controlado).
- [x] **Vencimientos**: la agenda con avisos y «marcar pagado» (ver «La agenda de
      vencimientos»). Falta que Emmanuel cargue los suyos: qué, qué día y cuánto, más o menos.
- [ ] **Flujo de fondos**: lo que hay, más lo que se va a cobrar, menos lo que vence, semana
      por semana. Necesita las tarjetas a cobrar.
- [ ] **Cierre de mes** con la carpeta para el contador y el tope del monotributo (falta la
      categoría y en qué formato quiere los datos el contador).
- [ ] **ARCA**: factura C desde la app, con el certificado guardado en el servidor (no en
      el celular).
- [ ] La **visual en la compu** (opción B). Hecho el 06/11: el menú arriba, el Panel como
      tablero, la Caja en tres columnas y la ficha del producto (ver «La compu: opción B»).
      Sigue el resto de las pantallas, de a una: Proveedores, Gastos, Reportes y Ajustes.
- [ ] El **logo original** (cuando Emmanuel lo pase en SVG o en PNG de 1024).

**Hecho el 04/11** — el aviso «sin subir» ya no cuenta lo retenido ni lo firmado por otra
persona, revisa solo qué es cada cosa y la resuelve, tiene «Ver qué es», y un lote
rechazado en la subida inicial ya no borra lo que había en el aparato. Ver "Lo que pasó el
04/11".

**Hecho el 31/10, a la mañana** — el freno a la subida inicial cuando el servidor ya
tiene ese turno desde otro aparato (la tarjeta «Cargas retenidas» en Ajustes), el aviso
del Panel «turnos cargados más de una vez», y en la Ayuda cómo borrar la app de un
celular sin dejar datos. Ver "Lo que no se sube".

**Encontrado en la auditoría del 27/10** (sin cambios de código todavía)

- [ ] **Cada apertura de la app lee la base entera del servidor.** Corregido el 19/11, con
      la medición: no es `empujarTodoLocal`. Su `getDocs` de cada colección se cuelga de la
      escucha que ya está abierta y no agrega lecturas. Las que leen todo son las escuchas
      mismas, cuando el aparato estuvo más de 30 minutos desconectado (ver «Leer menos al
      abrir la app», más arriba). Lo que sigue en pie de esta nota: `controlarSinSubir` hace
      un conteo por tabla cada cinco minutos, unas 5.000 lecturas por día en la PC que queda
      prendida; se puede controlar cada 15 minutos. Antes, mirar el uso real en la consola
      de Firebase.
- [ ] **El historial crece sin límite** y cada dispositivo lo escucha y lo carga entero
      (`Historial.tsx` trae todos los renglones a memoria). Escuchar solo los últimos
      90 días y traer lo viejo a pedido; en la pantalla, de a 300 con "ver más".
- [ ] **Las pruebas de reglas no corren en el CI.** GitHub Actions tiene Java: agregar
      `npm run test:reglas` a `verificar.yml`. Y pasar tres o cuatro guiones de
      Playwright al repositorio para correrlos contra los emuladores.
- [ ] Detalles: el aviso "ventas sin costo" cuenta dos veces un cambio cuyo producto no
      tiene costo; `rechazos` no se limpia nunca. (Que un cambio contaba como dos en
      "Ventas (N)" y en Turnos del día se arregló el 06/11.)

**En curso**

- [ ] **En la Mac de Emmanuel:** Ajustes → «Cargas retenidas» → «Sacar de este aparato las
      copias exactas». Las que queden «distintas» se miran de a una antes de decidir.
- [x] **Sacar el importador de meses viejos** (`sincronizarMesImportado` y
      `MESES_HISTORICOS`): hecho el 06/11.
- [ ] **El martes 03/11 no tiene turno en el servidor.** Preguntar si se trabajó con la app.
- [ ] **Mirar en `rechazos` las constancias con acción `revisar`** que dejen la Mac de
      Sandra y la PC de Gabriela al actualizar: dicen qué era cada cosa que el aviso
      contaba. Y antes, las de acción `guardar` de los últimos días, por si algún lote se
      cayó y borró algo de un aparato sin haber subido (ver "Lo que pasó el 04/11").
- [ ] **Revisar el 29 y el 30/10 en Turnos del día** (o el aviso nuevo del Panel): si
      alguna venta del celular de Gabriela llegó igual al servidor y después se volvió a
      cargar desde la Mac, hay dos turnos para ese horario. El que sobra se borra con su
      motivo; si cada uno tiene ventas distintas, primero se pasan a uno.
- [ ] **Mirar en `rechazos` los renglones con acción `recibir`** (desde la versión con
      `aplicarRemotos.ts`). Cada uno es un documento del servidor que algún dispositivo
      no pudo guardar: es el que dejaba atrasados a los demás. Corregirlo en la consola
      (casi seguro le falta la clave: `codigo` en productos, `id` en el resto).
- [ ] **Unir LST016 con LST014** (la MATERA RECTANGULAR repetida). Desde la versión del
      22/10: editar LST016 → "Cambiar el código" → LST014 → "Unir". Si Sandra todavía
      no puede archivar, lo hace Emmanuel.
- [ ] **Unir las fichas de proveedor repetidas** (tarea 33 del tablero). Sandra ya
      asoció todos los productos —cero con "proveedor inexistente"— y quedaron seis
      pares de fichas que son el mismo proveedor. La herramienta está publicada
      (Ajustes → "Unir proveedores"); lo hace ella, de a un par.
- [ ] **Prender el respaldo nocturno.** El código está hecho y probado contra el
      emulador; falta que Emmanuel cree la cuenta de servicio (rol "Visualizador de
      Cloud Datastore", **nada más**), el repositorio privado de respaldos y los dos
      secrets. Hasta entonces queda en la rama de trabajo y no en `main`, porque sin
      los secrets fallaría todas las noches.
- [ ] **Mudar la publicación a Firebase Hosting** y después pasar el repositorio a
      privado. El paso 1 (deploy a la URL `*.web.app`) está listo y espera una cuenta
      de servicio con rol "Firebase Hosting Admin".
- [ ] La **publicación automática de reglas** queda escrita y sin activar: por ahora
      las pega Emmanuel a mano. Para prenderla hace falta su propia cuenta de servicio,
      separada de la del respaldo.

> **Cancelado el 20/10/2026: la importación del Excel.** Estaba planificada como una
> carga única desde `BASE DE DATOS ECDM 2026` (108 precios de venta, 724 costos, 53
> productos nuevos, 40 descripciones). **No se hace.** Desde el 20/10 los productos,
> los precios, los costos y los proveedores se cargan **a mano en la app**, que pasa a
> ser la única fuente.
>
> Queda anotado y no borrado porque explica por qué existen varias cosas del código: el
> id del proveedor derivado del nombre, los alias y `asegurarProveedor()` se hicieron
> pensando en esa importación. Siguen siendo necesarios —más todavía con carga a mano,
> ver abajo—, pero el motivo original ya no es el que figura.

**Seguridad**

- [ ] **Pasar el repositorio a privado.** Es lo único que cierra el historial de git,
      donde siguen los costos, las ventas de ocho meses y los arqueos que estuvieron
      versionados en `datos/` hasta el 15/10. Antes hay que mirar el plan de la cuenta:
      con una cuenta gratuita, Pages desde un repositorio privado se apaga y el sitio
      se cae. Está explicado en "Qué se publica y qué no".
- [ ] Activar la protección de rama en `main` (pull request + check `verificar`
      obligatorios).
- [ ] **Pegar en la consola de Firebase las reglas de la rama (247 líneas).** Traen
      `allow delete: if estoyAlMando()` en productos, sin la cual "Cambiar el código"
      deja el código viejo archivado en vez de libre. **Recién después de que Sandra
      actualice la app a la versión del 22/10**, que es la que anota el código viejo en
      `borrados`: con la anterior, un dispositivo atrasado lo podría volver a subir.
      Cuando esté el workflow de reglas, esto deja de hacerse a mano.

**Hecho el 15/10** — `datos/` salió del repositorio y hay un chequeo
(`npm run revisar-versionados`) que falla si vuelve a entrar algo privado al árbol.

**Hecho el 17/10** — los 34 códigos con barra ya suben al servidor, el modo consulta de
precios para el salón, la revisión de proveedores, y el id del proveedor derivado del
nombre.

**Hecho el 20/10** — borrar un turno (y que lo borrado no vuelva), y los diez puntos de
"La carga a mano": los dos carteles, los productos con proveedor inexistente, el filtro
por proveedor, pasar una venta de turno, el origen de la plata de un pago, el alta de
producto desde una compra, y el detector de turnos repetidos por mes.

**Hecho el 20/10 a la noche** — el freno del sembrado: el catálogo público ya no se
sube encima de los costos del servidor. Ver "Lo que pasó el 20/10". Las reglas con
`noPisaConVacio()` se pegan a mano en la consola de Firebase; están en la rama, no en
`main`.

**Hecho el 20/10, tarde** — el aviso de costos que no cierran, la revisión de costos de
a muchos, y el arreglo de `leerNumero()` con el punto de los miles.

**Hecho el 21/10** — el aviso de costos que no cierran, la revisión de costos de a
muchos, el arreglo de `leerNumero()` con el punto de los miles, que la recuperación
saltee los códigos repetidos, y unir proveedores.

**Hecho el 21/10, a la tarde** — que un código repetido no se pueda crear desde un
dispositivo atrasado (y que sin conexión directamente no se puedan crear productos), el
aviso de producto con la misma descripción, y el filtro de repetidos por nombre.

**Hecho el 21/10, a la noche** — cambiar el código de un producto, que es lo que hacía
que Sandra tuviera que pasar por el Excel; y que sin conexión no se puedan crear
productos. Publicados juntos a las 21:12.

> **Ojo con el Excel `BASE DE DATOS ECDM 2026`.** El 21/10 a la tarde se renumeró ahí el
> bloque `LST` (Luis Suárez Tablas) para que ningún código quedara repetido. El Excel ya
> no es fuente de nada —desde el 20/10 todo se carga en la app— pero si alguien lo abre
> para consultar, **diez códigos `LST` significan productos distintos que en la app**
> (`LST009` es MATERA BOLSO en la app y una tabla pizzera en el Excel). La forma de
> renumerar en la app es "Cambiar el código", desde editar el producto.

**Datos a ordenar**

- [ ] **Ordenar los proveedores a mano** (decisión del 20/10). La pantalla de
      **Ajustes → Revisión de proveedores** sigue siendo la lista de trabajo: dice
      cuáles están repetidos, cuáles inactivos con productos vigentes y cuáles usan los
      productos sin tener ficha. Lo que cambia es que las correcciones las hace una
      persona desde Proveedores, no el botón de aplicar.
- [ ] Los **772 productos sin proveedor**: se les asigna proveedor a mano desde
      Productos, de a uno o filtrando por los que no tienen.
- [ ] Los ~10 códigos duplicados que la planilla colapsó en uno.
- [ ] **Las dos devoluciones de Mercado Pago** del 13 de mayo ($ 1.210.000) y el 21 de
      marzo ($ 193.000), $ 1.403.000 en total. Están anotadas como **ventas** en la
      planilla vieja, sin código de producto, así que inflan la venta del año en un 3 %
      (ver "Todo 2026 ya está cargado"). No son gastos: el selector de cuenta de Gastos
      no las alcanza. Hay que decidir qué se hace con ellas.

      > Una versión anterior de esta lista decía "3 movimientos de Mercado Pago sin
      > clasificar ($ 1.623.000)". Ese dato lo escribí mal el 15/10 al rehacer la lista:
      > no coincide ni en cantidad ni en monto con lo único que está documentado, que es
      > lo de arriba. No hay un tercer movimiento que yo pueda verificar.

**Mejoras conocidas**


- [ ] Pasar el marcador de "esto viene del servidor" **por cada escritura** en vez de
      tenerlo global (hoy una edición hecha justo durante una sincronización no deja
      renglón en el historial).
- [ ] Cargar el número de WhatsApp del local para el catálogo público.
- [ ] WhatsApp etapa 2: contestar los pedidos desde la app.
- [ ] Comisiones de tarjeta y días de acreditación.
- [ ] Control de stock con reposición automática.

**Hecho** — multi-usuario con roles distintos (dueño, encargado, empleado), cierres
tardíos con autorización, visto bueno de diferencias, historial de modificaciones,
cuenta corriente de proveedores, catálogo público y dominio propio.
