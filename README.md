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
un respaldo está del lado del dueño porque pisa el catálogo, los turnos y las
ventas con lo que diga el archivo: quien puede importar puede borrar, solo
que más despacio.

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

El arreglo tiene un límite que no disimulo: el marcador sigue siendo **global**, así
que una edición hecha a mano justo mientras baja una sincronización se toma por remota
y no deja renglón. Es un problema mucho más chico —una edición suelta contra 1.506
renglones falsos— y para resolverlo bien hay que pasar el marcador por cada escritura
en vez de tenerlo global. Queda anotado en el código.

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

### Cómo salió

Corrida el 20/10 a la noche sobre la base real: **740 productos rellenados.** Quedaron
154 sin costo y 3 sin proveedor —los que ninguna fuente tenía— y **1.233 con el nombre
del proveedor pero sin ficha**, que es exactamente el estado que resuelve el botón de
"Ver y asociar". Por eso el orden era ese.

---

## El respaldo nocturno

El plan Spark de Firebase **no tiene recuperación a un momento determinado** ni el
export administrado de Google: los dos piden Blaze. El 20/10 eso se notó — lo único que
hubo para recuperar los costos fue el historial de la app y una foto vieja de git. Si
ese día no hubiera estado el Excel, no se recuperaba.

### Cómo funciona

Todas las noches a las 03:17 de Argentina, una GitHub Action baja **todas las
colecciones** de Firestore y las commitea en un repositorio **privado y aparte**, uno
por archivo: `productos.json`, `ventas.json`, `historial.json` y el resto.

La cuenta de servicio que usa tiene **un solo rol: "Visualizador de Cloud Datastore"**.
Nada más. Esa clave corre sola todas las noches y vive en los secrets de un repositorio
público: si se filtra, lo peor que puede hacer es leer. Por eso tampoco se le agrega el
rol para publicar reglas, aunque sea cómodo tener una sola clave — con ese rol, una
clave filtrada reescribe `firestore.rules` y abre la base entera. **Una clave, un
poder.**

Cada commit es una foto completa. Eso da dos cosas que no teníamos:

- **Volver a cualquier noche.** Es lo que el plan Spark no da.
- **Ver qué cambió en el día.** El diff de la mañana muestra producto por producto lo
  que se movió. Lo del 20/10 habría saltado a la vista.

Los archivos se guardan con las claves ordenadas y un dato por renglón, justamente para
que ese diff se pueda leer.

### La alarma

Un respaldo que nadie mira sirve para recuperar, pero no avisa. Así que la corrida
compara con la de anoche y **termina con error** —y GitHub manda el mail— si:

- una colección perdió más del 5 % de sus documentos, o
- más de 20 productos se quedaron **sin costo o sin proveedor** de un día para el otro.

Lo segundo es lo que importa: el 20/10 no desapareció ningún producto, se vaciaron.
Contar documentos no lo habría visto. La lógica está en `src/lib/respaldoAlarma.ts`, con
sus pruebas, incluida la que reproduce ese día (899 → 619 proveedores).

Cuando la alarma suena, **el respaldo se guarda igual**: el respaldo del día en que algo
sale mal es justamente el que más sirve.

### Lo que cuesta

Una corrida lee cada documento una vez. Con la base de hoy son unos pocos miles de
lecturas sobre las 50.000 diarias que da Spark, y el `resumen.json` de cada noche anota
cuántas fueron, así se ve venir si alguna vez empieza a apretar.

---

## Mudar la publicación a Firebase Hosting

GitHub Pages en un repositorio privado [necesita GitHub Pro][pages]. Firebase Hosting
es gratis en el plan Spark —10 GB de almacenamiento, 360 MB por día de transferencia,
dominio propio y certificado incluidos— así que mudando la publicación el repositorio
puede pasar a privado sin pagar nada, y los costos dejan de estar en un historial de
git público.

[pages]: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

### El orden, que es lo que importa

1. **Publicar en la URL gratis `*.web.app`.** No toca el dominio: `app.elclubdelmate.com`
   sigue servido por Pages, intacto. Es para probar.
2. Probar ahí: la app, el catálogo, instalarla en un celular.
3. En la consola de Firebase, agregar el dominio propio. Da un TXT de verificación que
   se carga en el DNS. **Esto todavía no mueve nada.**
4. Cuando Firebase diga "verificado" y el certificado esté listo, recién ahí se cambian
   los registros A. Es el único paso con riesgo, y se vuelve atrás cambiándolos de nuevo.
5. Confirmado que anda, se apaga Pages y se borra `public/CNAME`.
6. Último: el repositorio a privado.

### Lo que ya está hecho (paso 1)

`firebase.json` tiene la sección `hosting` y hay un workflow (`hosting.yml`) que corre
**solo a mano**, para que no pelee con el de Pages mientras los dos existan.

El ruteo se probó con el emulador de Hosting, que para eso está:

- `/` → la app.
- `/catalogo/` → el catálogo público, **servido directo, sin redirect**. Importa:
  `URL_CATALOGO` termina en barra y ese link ya se mandó por WhatsApp a clientes. Por eso
  `trailingSlash` quedó en `true` y no en `false`, que metía un 301 en el medio.
- Cualquier otra dirección cae en la app en vez de dar 404.

Y de paso se arregla algo que en Pages estaba al azar: el cacheo. `sw.js` y los `.html`
van con `no-cache` —si el service worker se cachea, los celulares se quedan clavados en
una versión vieja— y los `assets/` con hash en el nombre van con cache de un año.

### Lo que falta

El dominio (pasos 3 a 6), y decidir cómo se publica: a mano desde la máquina de
Emmanuel, o con una tercera cuenta de servicio (`FIREBASE_HOSTING_SERVICE_ACCOUNT`, rol
"Firebase Hosting Admin" y nada más) para que lo haga el workflow.

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

Lo que está pendiente de verdad, al 20/10/2026 a la noche. Lo de arriba de la lista es
lo que sigue.

**En curso**

- [ ] **Agrupar los 1.233 productos con "proveedor inexistente".** Tienen el nombre
      del proveedor pero no la ficha: así los dejó la recuperación, y es el estado que
      el botón **"Ver y asociar"** sabe resolver. Se hace de a un proveedor, desde
      Productos → filtro "Proveedor inexistente".
- [ ] **Prender el respaldo nocturno.** El código está hecho y probado contra el
      emulador (`.github/workflows/respaldo.yml`); falta que Emmanuel cree la cuenta de
      servicio (rol "Visualizador de Cloud Datastore", **nada más**), el repositorio
      privado de respaldos y los dos secrets. Hasta entonces queda **en la rama y no en
      `main`**, porque sin los secrets fallaría todas las noches.
- [ ] **Mudar el dominio a Firebase Hosting** (pasos 3 a 6 de "Mudar la publicación"), y
      después pasar el repositorio a privado.
- [ ] La **publicación automática de reglas** (`.github/workflows/reglas.yml`) queda
      escrita y sin activar: por ahora las pega Emmanuel a mano. Para prenderla hace
      falta su propia cuenta de servicio, `FIREBASE_REGLAS_SERVICE_ACCOUNT`, separada de
      la del respaldo.

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
- [ ] Pegar en la consola de Firebase las reglas con `noPisaConVacio()` (241 líneas).
      Es la capa que protege aunque un dispositivo tenga una versión vieja de la app.
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

**Hecho el 20/10 a la noche** — el freno del sembrado (el catálogo público ya no se
sube encima de los costos del servidor), la pantalla de recuperación y el botón "Ver y
asociar". Ver "Lo que pasó el 20/10".

**La recuperación, corrida el 20/10 a la noche: 740 productos rellenados.** Quedaron
154 sin costo y 3 sin proveedor —los que ninguna fuente tenía, y se cargan a mano— y
1.233 con el nombre del proveedor pero sin ficha, que es lo que agrupa el botón.

Las reglas con `noPisaConVacio()` se pegan a mano en la consola de Firebase.

**Hecho el 20/10, tarde** — el aviso de costos que no cierran, la revisión de costos de
a muchos, y el arreglo de `leerNumero()` con el punto de los miles.

**Hecho el 21/10** — el aviso de costos que no cierran, la revisión de costos de a
muchos, el arreglo de `leerNumero()` con el punto de los miles, que la recuperación
saltee los códigos repetidos, y unir proveedores.

**Hecho el 21/10, a la tarde** — que un código repetido no se pueda crear desde un
dispositivo atrasado (y que sin conexión directamente no se puedan crear productos), el
aviso de producto con la misma descripción, y el filtro de repetidos por nombre.

**Datos a ordenar**

- [ ] **Ordenar los proveedores a mano** (decisión del 20/10). La pantalla de
      **Ajustes → Revisión de proveedores** sigue siendo la lista de trabajo: dice
      cuáles están repetidos, cuáles inactivos con productos vigentes y cuáles usan los
      productos sin tener ficha. Lo que cambia es que las correcciones las hace una
      persona desde Proveedores, no el botón de aplicar.
- [ ] Los **154 productos sin costo y 3 sin proveedor** que quedaron después de la
      recuperación: ninguna fuente los tenía, así que se cargan a mano desde Productos,
      filtrando por los que no tienen.
- [ ] Los **costos que volvieron marcados como vencidos**. Entraron con la fecha que
      tenían de verdad, así que la app los pone en la lista de lo que hay que
      actualizar. Es a propósito: el margen del reporte miente hasta que se revisen.
- [ ] Los ~10 códigos duplicados que la planilla colapsó en uno.
- [ ] **Los tres asientos de Mercado Pago cargados como ventas, $ 1.623.000.** No son
      ventas ni devoluciones a clientes: es plata que entró de Emmanuel desde Mercado
      Pago y terminó en la caja grande. Los tres tienen la misma forma — una "venta"
      sin código de producto y, **el mismo día y por el mismo monto, un movimiento
      `A_CAJA_GRANDE`**:

      | Fecha | Monto | Cómo figura |
      |---|---|---|
      | 21/03 | $ 193.000 | DEVOLUCION POR TRANSFERENCIA A EMMA DE MERCADO PAGO |
      | 30/04 | $ 220.000 | INGRESO EN CAJA GRANDE (POR UNA TRANSFERENCIA EMMA ) |
      | 13/05 | $ 1.210.000 | DEVOLUCION EMMA (MERCADO PAGO) |

      La plata **nunca pasó por el cajón**: el 13/05 el arqueo abrió en $ 97.630 y
      cerró en $ 136.630, cuando la mediana del mes es $ 145.130. La "venta" y el
      `A_CAJA_GRANDE` se anulan entre sí dentro del turno; son dos asientos para que
      la planilla cerrara, no dos movimientos de plata.

      Inflan la venta del año en 3,6 % ($ 45.002.867 → $ 43.379.867) y, como van sin
      costo, entran enteros al margen de contribución.

      > Una versión anterior de esta lista decía que "3 movimientos de Mercado Pago
      > ($ 1.623.000)" era un dato que yo había escrito mal, y que lo documentado eran
      > dos devoluciones por $ 1.403.000. **Esa corrección estaba equivocada: el dato
      > original era el correcto.** Son tres asientos y suman exactamente $ 1.623.000.
      > Se verificó contra `datos/historico-2026-03/04/05.seed.json` en el historial de
      > git, que es donde están los registros de la planilla vieja.

- [ ] **Los 10 códigos repetidos de la planilla.** En `BASE DE DATOS ECDM 2026` hay diez
      códigos usados dos veces. Al importar ganó una de las dos filas y la otra se
      perdió, así que hoy faltan hasta diez productos en la app:

      | Código | Quedó en la app | Falta, se perdió al importar |
      |---|---|---|
      | `509-54` | TAPON N2 LUMINOX | TAPA PARA BOTELLA CHICA |
      | `LST006` | TABLA SALIGNA CON AGARRES MADERA | PALA PIZZERA GUAYUBIRA |
      | `LST009` | MATERA BOLSO | TABLAS GUAYUBIRA SURTIDAS CHICAS |
      | `LST010` | MATERA RECTANGULAR | TABLAS GUAYUBIRA SURTIDAS GRANDES |
      | `LST011` | YERBERO CUERO | TABLA PIZZERA REDONDA GUAYUBIRA Y CEDRO |
      | `LST 50 X 30` | TABLA CON DIJE 2 MANIJAS | TABLA GUAYUBIRA 2 MANIJAS |
      | `SF001` | CINTO NIÑO CUERO CRUDO | PERCHERO PARED |
      | `VE001` | PIEDRA NATURAL DE LA CORDILLERA DE LOS ANDES | CUCHILLO ACERO AL CARBONO 14CM |
      | `151-327` | BILLETERA DOS VOLANTES | — (es el mismo producto, descrito dos veces) |
      | `221-264` | PORTA TERMO SIRE | — (el mismo, difiere en espacios al final) |

      O sea: **faltan ocho productos** en la app. Los otros dos (`151-327` y `221-264`)
      son la misma cosa cargada dos veces y ahí no falta nada.

      No se puede arreglar cambiando el código del que quedó: el código **es** la clave
      del producto, y cambiarlo es crear uno nuevo y perder las ventas que ya tiene
      asociadas. Lo que corresponde es dar de alta los ocho que faltan con un código
      nuevo cada uno, desde Productos.

      Aparte hay dos pares que no chocan por poco, porque el código difiere en un
      espacio: `LST 49 X30` (TABLA SALIGNA) contra `LST 49 X 30` (TABLA CON 2 MANIJAS),
      y `LST 43X24` (TABLA PETERIBI) contra `LST43X24` (TABLA GUAYUBIRA). Son productos
      distintos y conviene separarlos antes de que alguien normalice los espacios.

      El bloque `LST` usa las medidas como código (`LST53X36`), y por eso choca: dos
      tablas de la misma medida son el mismo código. Esa es la causa de fondo.

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
