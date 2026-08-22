import type { SeccionId } from '../db/db'
import { normalizar } from '../lib/formato'

export interface EntradaAyuda {
  id: string
  categoria: string
  pregunta: string
  /** Puede tener varios parrafos separados por '\n\n'. */
  respuesta: string
  /** Palabras extra que la gente podria escribir y no estan en la pregunta. */
  palabrasClave?: string[]
  /**
   * Solo la ve un dueño: son cosas que un empleado no puede hacer (crear
   * usuarios, respaldos, borrar datos). Mostrarselas solo genera ruido y
   * la sensacion de que le falta un boton que en realidad nunca va a tener.
   */
  soloOwner?: boolean
  /**
   * Solo tiene sentido si la persona tiene esa seccion habilitada. Un
   * empleado al que le apagaron Proveedores no necesita leer como se
   * registra una compra.
   */
  requiereSeccion?: SeccionId
}

export const CATEGORIAS_AYUDA = [
  'Primeros pasos',
  'Panel y pendientes',
  'Usuarios y roles',
  'Caja',
  'Productos',
  'Proveedores',
  'Gastos',
  'Reportes',
  'Sincronización y respaldo',
] as const

export const AYUDA: EntradaAyuda[] = [
  // ---------- Primeros pasos ----------
  {
    id: 'que-es',
    categoria: 'Primeros pasos',
    pregunta: '¿Para qué sirve esta app?',
    respuesta:
      'Reemplaza la planilla de Google Sheets del local. Sirve para cargar la caja de cada turno, mantener el catálogo de productos y proveedores, anotar los gastos, y ver mes a mes si el negocio dio a favor o en contra. Funciona sin internet: todo lo que cargás queda guardado en el dispositivo, y si el negocio tiene activado el respaldo automático, se comparte con los demás celulares del equipo, cada persona con su propio usuario.',
  },
  {
    id: 'instalar',
    categoria: 'Primeros pasos',
    pregunta: '¿Cómo instalo la app en el celular?',
    respuesta:
      'Android (Chrome): abrí el link de la app → tocá los tres puntitos (⋮) arriba a la derecha → "Agregar a pantalla de inicio" o "Instalar app".\n\niPhone (Safari): abrí el link → tocá el ícono de compartir (el cuadradito con la flecha hacia arriba) → "Agregar a pantalla de inicio".\n\nDespués de eso queda como una app más, con su ícono, y se abre sin pasar por el navegador.',
    palabrasClave: ['descargar', 'pantalla de inicio', 'icono', 'app'],
  },
  {
    id: 'menu',
    categoria: 'Primeros pasos',
    pregunta: '¿Qué es cada sección del menú de abajo?',
    respuesta:
      '🧭 Panel: la revisión automática. Lo primero que conviene mirar al abrir la app: te dice qué hay para hacer hoy.\n\n🧉 Caja: abrir el turno, cargar ventas y cerrar la caja. Es lo que se usa todos los días.\n\n🏷️ Productos: el catálogo completo, buscar y editar precios y costos.\n\n🚚 Proveedores: quién provee cada producto, para actualizar costos en bloque.\n\n💸 Gastos: alquiler, sueldos, proveedores pagados con la caja grande.\n\n📊 Reportes (dueños): el margen de contribución del mes, si dio a favor o en contra.\n\n⭐ Mi día (empleados): tus pendientes del día, tu resumen del mes y lo más vendido.\n\n⚙️ Ajustes (dueños): respaldo de los datos y usuarios del equipo.',
  },
  {
    id: 'sin-internet',
    categoria: 'Primeros pasos',
    pregunta: '¿Qué pasa si se corta el internet o no hay señal?',
    respuesta:
      'Nada: la app sigue funcionando exactamente igual, porque todo se guarda primero en el celular. Podés seguir cargando ventas, cerrando cajas y editando productos sin conexión. Si tenés la sincronización con la nube activada, esos cambios se suben solos apenas vuelve la señal — no hay que hacer nada especial.',
    palabrasClave: ['offline', 'conexion', 'sin señal', 'wifi'],
  },
  {
    id: 'boton-actualizar',
    categoria: 'Primeros pasos',
    pregunta: 'Apareció un cartel naranja que dice "Actualizar", ¿qué hago?',
    respuesta:
      'Significa que se publicó una versión nueva de la app. Tocá "Actualizar" cuando no estés a mitad de cargar una venta o un cierre de caja — la app se recarga sola y toma los cambios nuevos. No se pierde nada de lo que ya cargaste: eso queda guardado en el dispositivo.',
    palabrasClave: ['version nueva', 'cartel', 'aviso', 'actualizacion'],
  },
  {
    id: 'buscar-actualizacion',
    categoria: 'Primeros pasos',
    pregunta: '¿Cómo busco si hay una versión nueva, sin esperar a que avise sola?',
    respuesta:
      'Arriba de todo, al lado del signo de pregunta, hay un botón 🔄. Tocalo en cualquier momento: si hay una versión nueva esperando, se aplica directo; si no hay ninguna, el botón se pone ✅ un instante y listo, ya estás al día. Es el mismo mecanismo que el cartel naranja automático, solo que lo podés disparar vos cuando quieras en vez de esperarlo.',
    palabrasClave: ['boton actualizar', 'chequear version', 'buscar version', 'refrescar'],
  },
  {
    id: 'notificaciones',
    categoria: 'Primeros pasos',
    pregunta: '¿Para qué sirve la campana 🔔 de arriba?',
    respuesta:
      'Es la versión corta de la revisión automática que hace la app: muestra las mismas cosas que el Panel, ordenadas de lo más urgente a lo menos. Tocando cada aviso te lleva directo a la pantalla donde se soluciona, ya filtrada.\n\nEl número rojo es cuántas cosas hay para revisar. Si querés ver el detalle completo, con el "qué hacer" de cada una, entrá al Panel desde el botón de abajo de todo.',
    palabrasClave: ['campana', 'avisos', 'alertas', 'numero rojo'],
  },

  // ---------- Panel y pendientes ----------
  {
    id: 'que-es-el-panel',
    categoria: 'Panel y pendientes',
    pregunta: '¿Qué es el Panel?',
    respuesta:
      'Es la revisión automática del negocio. Cada vez que abrís la app, revisa sola la caja, el catálogo, los proveedores, los gastos y la sincronización, y te dice qué hay para hacer — ordenado de lo más urgente a lo menos.\n\nCada cosa que encuentra viene con tres datos: qué pasa, por qué importa, y qué hacer para resolverlo. El botón "Ir a resolverlo" te lleva derecho a la pantalla donde se arregla, ya filtrada.\n\nNo hay que pedirle nada ni apretar "actualizar": se recalcula sola con lo que va pasando.',
    palabrasClave: ['panel', 'auditoria', 'revision', 'dashboard', 'tablero'],
    requiereSeccion: 'panel',
  },
  {
    id: 'semaforo-panel',
    categoria: 'Panel y pendientes',
    pregunta: '¿Qué significa el puntaje y el color del Panel?',
    respuesta:
      'Es un resumen rápido de cómo viene el negocio en cuanto a cosas pendientes, del 0 al 100. Arranca en 100 y baja según lo que encuentra: mucho por cada tema urgente, poco por cada aviso menor.\n\n🟢 90 o más: todo en orden.\n🟡 70 a 89: hay cosas para revisar, nada grave.\n🟠 40 a 69: varias cosas necesitan atención.\n🔴 menos de 40: hay temas urgentes sin resolver.\n\nNo es una nota del negocio ni de nadie: es cuánto hay pendiente de cargar o corregir en la app.',
    palabrasClave: ['puntaje', 'semaforo', 'colores', 'nota', 'salud'],
    requiereSeccion: 'panel',
  },
  {
    id: 'que-revisa-la-app',
    categoria: 'Panel y pendientes',
    pregunta: '¿Qué cosas revisa la app sola?',
    respuesta:
      'Caja: turnos que quedaron abiertos sin cerrar, cierres con diferencia de caja, y días del mes que no tienen caja cargada.\n\nProductos: los que se venden al costo o por debajo, los que se quedaron sin stock, los que tienen el costo vencido, los que no tienen proveedor asignado, y los pedidos de archivado esperando autorización.\n\nProveedores: a quiénes se les debe plata y cuánto.\n\nGastos: si falta cargar un gasto habitual que el mes pasado sí se pagó (alquiler, luz, sueldos, contador).\n\nSistema: si el dispositivo dejó de sincronizar con la nube.',
    palabrasClave: ['que revisa', 'controles', 'chequeos', 'auditoria'],
    requiereSeccion: 'panel',
  },
  {
    id: 'posponer-aviso',
    categoria: 'Panel y pendientes',
    pregunta: 'Un aviso no lo puedo resolver ahora, ¿lo puedo posponer?',
    respuesta:
      'Sí. Cada aviso que no sea urgente tiene un botón para posponerlo: "Recordar mañana" o "Recordar en una semana", según qué tan importante sea. Mientras tanto deja de aparecer en el Panel, en Mi día y en la campana.\n\nCuando llega la fecha vuelve solo, si el problema sigue estando. Si lo resolviste antes, no vuelve a aparecer nunca.\n\nLos avisos urgentes (los rojos) no se pueden posponer a propósito: son los que hacen perder plata todos los días.\n\nArriba de todo del Panel, si hay algo pospuesto, aparece un botón "Ver de nuevo" para traerlos todos de vuelta.',
    palabrasClave: ['posponer', 'recordar', 'mas tarde', 'silenciar', 'ocultar aviso'],
  },
  {
    id: 'mis-pendientes',
    categoria: 'Panel y pendientes',
    pregunta: '¿Dónde veo lo que me queda pendiente a mí?',
    respuesta:
      'En "Mi día", en el menú de abajo. Es la misma revisión automática del Panel, pero filtrada a lo que vos podés resolver: no te muestra números de ganancia del negocio ni cosas de secciones que no tengas habilitadas.\n\nAbajo también está tu resumen del mes (cuántos productos creaste y actualizaste) y lo más vendido, para tenerlo a mano.',
    palabrasClave: ['pendientes', 'mi dia', 'tareas', 'que tengo que hacer'],
  },
  {
    id: 'recordatorios',
    categoria: 'Panel y pendientes',
    pregunta: '¿Me puede avisar la app con una notificación?',
    respuesta:
      'Sí, para las cosas urgentes. En "Mi día" hay un botón "Activar recordatorios": la primera vez el navegador te va a preguntar si permitís las notificaciones.\n\nDos cosas importantes para que no te sorprenda: avisa como mucho una vez por día por cada cosa (para no volverse molesto), y solo mientras la app está abierta — aunque sea minimizada o en otra pestaña. Con la app cerrada del todo no llega nada, porque la app funciona sola, sin un servidor que mande avisos.\n\nSi no las activás no perdés nada: los mismos avisos están siempre en el Panel, en Mi día y en la campana 🔔.',
    palabrasClave: ['notificacion', 'recordatorio', 'aviso', 'alerta', 'permiso'],
  },

  // ---------- Usuarios y roles ----------
  {
    id: 'por-que-loguearse',
    categoria: 'Usuarios y roles',
    pregunta: '¿Por qué tengo que iniciar sesión para usar la app?',
    respuesta:
      'Solo pasa si el negocio ya activó el respaldo automático (ver la categoría "Sincronización y respaldo"). En ese caso, cada persona entra con su propio mail y contraseña, para que la app sepa quién es quién: eso es lo que permite que un dueño vea todo y un empleado vea solo lo que le corresponde, y que quede anotado quién cargó o cambió cada cosa. Si el negocio todavía no activó el respaldo, no hace falta loguearse: la app anda igual que siempre.',
    palabrasClave: ['iniciar sesion', 'login', 'obligatorio'],
  },
  {
    id: 'diferencia-dueno-empleado',
    categoria: 'Usuarios y roles',
    pregunta: '¿Qué diferencia hay entre un dueño y un empleado?',
    respuesta:
      'Un dueño ve y maneja todo: Caja, Productos, Proveedores, Gastos, Reportes con el margen de ganancia, y Ajustes (respaldo y usuarios del equipo).\n\nUn empleado, por defecto, usa Caja, Productos, Proveedores y Gastos igual que un dueño, y mantiene los costos de compra actualizados — pero no ve el margen de ganancia del negocio (en vez de Reportes tiene "Mi día", con su propio resumen de trabajo), no puede cambiar el precio de venta de un producto, y para archivar un producto tiene que pedirle autorización a un dueño en vez de hacerlo directo. Un dueño puede ajustar cuáles de esas secciones ve cada empleado en particular (ver "¿Puedo elegir qué secciones ve cada empleado?").',
    palabrasClave: ['rol', 'permisos', 'empleada', 'gabriela'],
  },
  {
    id: 'crear-usuario',
    categoria: 'Usuarios y roles',
    pregunta: '¿Cómo doy de alta a alguien nuevo del equipo?',
    respuesta:
      'Solo un dueño puede hacerlo. En Ajustes → "Usuarios del equipo" → "+ Usuario nuevo", cargá su nombre, su mail y una contraseña inicial, y elegí el rol (Dueño/a o Empleado/a). Con eso ya puede entrar a la app desde cualquier dispositivo. Después esa persona puede cambiar su contraseña con "Olvidé mi contraseña" en la pantalla de inicio de sesión.',
    palabrasClave: ['alta', 'nuevo empleado', 'agregar usuario', 'sumar'],
    soloOwner: true,
  },
  {
    id: 'empleado-borrar-producto',
    categoria: 'Usuarios y roles',
    pregunta: 'Soy empleado/a, ¿por qué no puedo borrar un producto directamente?',
    respuesta:
      'Porque en vez de borrarse, un producto se "archiva" (deja de verse en el catálogo y en Caja, pero su historial de ventas y ediciones queda guardado para siempre). Un empleado puede pedir que se archive tocando "Solicitar archivado": eso le manda un aviso a los dueños en la campana 🔔, y cuando lo autorizan recién ahí se archiva. Es a propósito, para que nada se pierda por error.',
    palabrasClave: ['no puedo borrar', 'solicitar', 'autorizacion'],
  },
  {
    id: 'olvide-contrasena',
    categoria: 'Usuarios y roles',
    pregunta: 'Me olvidé mi contraseña, ¿qué hago?',
    respuesta:
      'En la pantalla de inicio de sesión, escribí tu mail y tocá "Olvidé mi contraseña". Te va a llegar un mail para elegir una nueva. Si ese mail no lo revisás seguido, pedile a un dueño que te ayude.',
    palabrasClave: ['recuperar', 'reset', 'no puedo entrar'],
  },
  {
    id: 'desactivar-usuario',
    categoria: 'Usuarios y roles',
    pregunta: '¿Cómo le saco el acceso a alguien del equipo?',
    respuesta:
      'Un dueño puede hacerlo desde Ajustes → "Usuarios del equipo", tocando "Desactivar" al lado de esa persona. Si estaba usando la app en ese momento, se le cierra la sesión sola y no puede volver a entrar hasta que un dueño la reactive con el mismo botón. No borra nada de lo que esa persona cargó: solo le corta el acceso.',
    palabrasClave: ['desactivar', 'sacar acceso', 'echar', 'baja', 'bloquear'],
    soloOwner: true,
  },
  {
    id: 'personalizar-secciones-empleado',
    categoria: 'Usuarios y roles',
    pregunta: '¿Puedo elegir qué secciones ve cada empleado?',
    respuesta:
      'Sí. En Ajustes → "Usuarios del equipo", al lado de cada empleado/a hay un botón "Qué ve": ahí podés tildar o destildar Caja, Productos, Proveedores, Gastos y Reportes, sección por sección y persona por persona. Por ejemplo, podés dejarle ver Reportes puntualmente a alguien de mucha confianza sin cambiarle el rol. Si no tocás nada, un empleado nuevo arranca viendo Caja, Productos, Proveedores y Gastos (lo de siempre), y sin Reportes.',
    palabrasClave: ['permisos', 'que ve', 'personalizar', 'secciones', 'ocultar', 'mostrar'],
    soloOwner: true,
  },

  // ---------- Caja ----------
  {
    id: 'abrir-turno',
    categoria: 'Caja',
    pregunta: '¿Cómo abro un turno?',
    respuesta:
      'Entrá a Caja, elegí la fecha (por defecto es hoy) y el turno (mañana o tarde). Si todavía no está abierto, la app te pide contar la caja: cargá cuántos billetes hay de cada denominación y listo, se calcula solo el total. Tocá "Abrir turno" y ya podés empezar a cargar ventas.',
    palabrasClave: ['arqueo', 'apertura', 'empezar'],
    requiereSeccion: 'caja',
  },
  {
    id: 'cargar-venta',
    categoria: 'Caja',
    pregunta: '¿Cómo cargo una venta?',
    respuesta:
      'Con el turno abierto, en la pestaña "Ventas" escribí el código o el nombre del producto en el buscador. Elegí el que corresponda de la lista, revisá la cantidad y el precio (se completa solo con el precio de venta cargado), elegí el medio de pago, y tocá "Agregar". La venta queda en la lista de abajo, y los totales de arriba se actualizan solos.',
    palabrasClave: ['vender', 'buscar producto', 'cobrar'],
    requiereSeccion: 'caja',
  },
  {
    id: 'vender-sin-catalogo',
    categoria: 'Caja',
    pregunta: 'El producto no aparece en el buscador, ¿puedo venderlo igual?',
    respuesta:
      'Sí. Escribí el nombre en el buscador y, cuando diga "Sin resultados", tocá "Vender igual, sin código": queda registrado con ese nombre y el precio que le pongas a mano, y la venta suma normal a la caja del turno.\n\nSirve para no frenar la atención al cliente. Como no tiene código, esa venta no descuenta stock ni tiene costo cargado, así que va a figurar entre las "ventas sin costo" del mes. Cuando puedas, cargá el producto en Productos para que la próxima vez aparezca completo.',
    palabrasClave: ['no aparece', 'sin codigo', 'no esta en el catalogo', 'venta suelta', 'vender igual'],
    requiereSeccion: 'caja',
  },
  {
    id: 'producto-sin-codigo',
    categoria: 'Caja',
    pregunta: '¿Qué hago si no encuentro el código de un producto?',
    respuesta:
      'Buscalo por nombre en vez de por código: el buscador encuentra igual escribiendo parte de la descripción. Si el producto todavía no está cargado en el catálogo, lo mejor es agregarlo primero desde Productos → "+ Producto nuevo", y recién ahí volver a Caja para venderlo. Así queda con su código, su costo y se puede calcular bien el margen.',
    palabrasClave: ['no aparece', 'no encuentro', 'nuevo producto'],
    requiereSeccion: 'caja',
  },
  {
    id: 'egreso-caja',
    categoria: 'Caja',
    pregunta: '¿Cómo registro un gasto chico durante el turno?',
    respuesta:
      'En Caja, pestaña "Egresos" → elegí "Gasto pagado con la caja" → escribí el concepto (ej: flete, café), el monto y la categoría → "Registrar egreso". Se descuenta solo del efectivo esperado en la caja al momento de cerrar.\n\nLa categoría importa: según cuál elijas, la app lo cuenta como gasto fijo o variable, y eso cambia dónde entra en el reporte del mes. Abajo del selector te dice cuál de los dos va a ser. Un sueldo pagado de la caja del turno es un gasto fijo igual, aunque no salga de la caja grande.',
    palabrasClave: ['flete', 'gasto chico', 'plata que sale'],
    requiereSeccion: 'caja',
  },
  {
    id: 'caja-grande',
    categoria: 'Caja',
    pregunta: '¿Qué es "pasar a caja grande"?',
    respuesta:
      'Es cuando se saca efectivo de la caja del turno para guardarlo en la caja fuerte o caja grande del local (no es un gasto, es plata que cambia de lugar). Se carga igual que un egreso, pero eligiendo "Pase a caja grande" en vez de "Gasto pagado con la caja".',
    palabrasClave: ['caja fuerte', 'guardar plata'],
    requiereSeccion: 'caja',
  },
  {
    id: 'cerrar-turno',
    categoria: 'Caja',
    pregunta: '¿Cómo cierro la caja?',
    respuesta:
      'En la pestaña "Cierre", contá los billetes que quedan en la caja (igual que en la apertura). La app compara ese total contra lo que "debería haber" (caja inicial + efectivo vendido − egresos − pases a caja grande) y te muestra la diferencia. Tocá "Cerrar turno" para confirmar.',
    palabrasClave: ['arqueo de cierre', 'terminar turno'],
    requiereSeccion: 'caja',
  },
  {
    id: 'diferencia-caja',
    categoria: 'Caja',
    pregunta: '¿Qué es la "diferencia de caja"?',
    respuesta:
      'Es la resta entre lo que se contó al cerrar y lo que la app calcula que debería haber, según la plata con la que se abrió más lo vendido en efectivo, menos lo que salió. Si da positiva, sobra plata (puede haber una venta sin cargar). Si da negativa, falta plata (puede haber un egreso sin registrar).',
    palabrasClave: ['falta plata', 'sobra plata', 'no cierra'],
    requiereSeccion: 'caja',
  },
  {
    id: 'reabrir-turno',
    categoria: 'Caja',
    pregunta: 'Cerré el turno por error, ¿puedo volver a abrirlo?',
    respuesta:
      'Sí. En la pestaña "Cierre" de ese turno va a aparecer un botón "Reabrir turno". Al reabrirlo podés seguir cargando ventas o egresos normalmente, y cerrarlo de nuevo cuando termines.',
    palabrasClave: ['error', 'deshacer', 'volver a abrir'],
    requiereSeccion: 'caja',
  },
  {
    id: 'medios-pago',
    categoria: 'Caja',
    pregunta: '¿Por qué hay que elegir el medio de pago en cada venta?',
    respuesta:
      'Porque el efectivo es lo único que hay que contar físicamente al cerrar la caja: las ventas con tarjeta, transferencia o QR no pasan por la caja, van directo al banco. Separarlos hace que el arqueo cierre bien y que el reporte muestre cuánto entró por cada medio.',
    palabrasClave: ['tarjeta', 'transferencia', 'qr', 'debito', 'credito'],
    requiereSeccion: 'caja',
  },

  {
    id: 'cierre-con-diferencia',
    categoria: 'Caja',
    pregunta: 'La caja no me da justa al cerrar, ¿qué hago?',
    respuesta:
      'Cerrá igual. El turno nunca se frena esperando que alguien te autorice: contás la plata que hay de verdad, la app te muestra la diferencia y cerrás.\n\nCuando la caja no da justa, la app te pregunta si sabés a qué se debió. Escribí lo que te acordés —"le di mal un vuelto", "faltaba desde la mañana"— o dejalo vacío si no sabés. Eso le llega al dueño junto con la diferencia.\n\nDespués el dueño lo mira y le da el visto bueno. Vos no tenés que hacer nada más: el aviso le llega solo, no hace falta que le escribas.\n\nSi volvés a ese turno, abajo de la diferencia dice cómo quedó: "Queda esperando el visto bueno del dueño" mientras nadie lo miró, y después el nombre de quién lo dio, cuándo, y lo que haya comentado.',
    palabrasClave: ['diferencia', 'no cierra', 'falta plata', 'sobra plata', 'cierre'],
    requiereSeccion: 'caja',
  },
  {
    id: 'cierre-olvidado',
    categoria: 'Caja',
    pregunta: 'Me olvidé de cerrar un turno, ¿lo puedo cerrar después?',
    respuesta:
      'Sí, pero lo tiene que autorizar un dueño. Entrá a Caja, elegí la fecha y el turno que quedó sin cerrar, andá a la pestaña "Cierre" y contá la plata como siempre. En vez de "Cerrar turno" te va a aparecer "Pedir autorización para cerrar".\n\nTe va a pedir que cuentes qué pasó. Escribilo aunque sea corto ("me olvidé de cerrar anoche"): es lo que el dueño lee para poder autorizarlo.\n\nEl conteo que hiciste queda guardado tal cual. Cuando el dueño autoriza desde su celular, el turno se cierra solo con esos billetes: no hay que volver a contar nada. Mientras tanto podés seguir trabajando y vendiendo normalmente, no te frena nada.\n\nSi el dueño no lo autoriza, te va a aparecer el motivo en esa misma pantalla y podés corregirlo y volver a pedirlo.',
    palabrasClave: [
      'olvide cerrar',
      'cerrar despues',
      'turno sin cerrar',
      'cierre tardio',
      'ayer',
      'autorizacion',
    ],
    requiereSeccion: 'caja',
  },
  {
    id: 'autorizar-cierre-tardio',
    categoria: 'Caja',
    pregunta: '¿Cómo autorizo un turno que quedó sin cerrar?',
    respuesta:
      'Cuando alguien pide cerrar un turno de otro día —o el de la mañana cuando ya arrancó la tarde—, el turno NO se cierra solo: te aparece arriba de todo en Caja, con la fecha, lo que contaron, lo que debería haber, la diferencia que quedaría y el motivo que escribieron.\n\nTenés dos botones. "Autorizar y cerrar" cierra el turno con ese conteo exacto y queda firmado por vos. "No autorizar" pide un motivo, que es lo que va a leer del otro lado para corregirlo, y deja el turno abierto.\n\nNo podés editar el conteo desde acá, a propósito: el pedido es la constancia de lo que se contó en su momento. Si hay algo mal, no lo autorices y explicá qué corregir.\n\nEs lo primero que reclama el Panel, porque mientras no lo resolvés hay alguien esperándote.',
    palabrasClave: [
      'autorizar cierre',
      'cierre tardio',
      'turno sin cerrar',
      'pedido de cierre',
      'correccion',
    ],
    soloOwner: true,
    requiereSeccion: 'caja',
  },
  {
    id: 'visto-bueno-cierre',
    categoria: 'Caja',
    pregunta: '¿Cómo autorizo una diferencia de caja?',
    respuesta:
      'Entrá a Caja: si hay cierres con diferencia sin revisar, aparecen arriba de todo con la fecha, el turno, cuánto faltó o sobró, quién cerró y lo que anotó esa persona.\n\nTocás "Visto bueno" y podés dejar un comentario. Eso NO cambia la diferencia —queda registrada como fue— sino que deja la constancia de que la miraste vos, con tu nombre y la fecha.\n\nSolo un dueño puede darlo. Un empleado no puede aprobarse su propia diferencia: si pudiera, el control no controlaría nada. Está bloqueado también del lado del servidor, no solo en la pantalla.\n\nMientras queden cierres sin revisar, el Panel te lo recuerda.\n\nNo hace falta que te lo pidan: cualquier cierre con diferencia entra solo en esa lista, aunque quien cerró no haya escrito nada. Y quien cerró el turno ve, desde su propio celular, que ya le diste el visto bueno.',
    palabrasClave: ['visto bueno', 'autorizar', 'diferencia de caja', 'aprobar cierre'],
    soloOwner: true,
    requiereSeccion: 'caja',
  },
  // ---------- Productos ----------
  {
    id: 'buscar-producto',
    categoria: 'Productos',
    pregunta: '¿Cómo busco un producto en el catálogo?',
    respuesta:
      'Entrá a Productos y escribí en el buscador de arriba: podés poner el código o parte del nombre. Tocando un producto de la lista se abre para editarlo.',
    requiereSeccion: 'productos',
  },
  {
    id: 'producto-nuevo',
    categoria: 'Productos',
    pregunta: '¿Cómo cargo un producto nuevo?',
    respuesta:
      'En Productos, tocá "+ Producto nuevo". Cargá el código, la descripción, el proveedor (o creá uno nuevo ahí mismo), el precio de compra y el precio de venta. El código no se puede repetir.',
    requiereSeccion: 'productos',
  },
  {
    id: 'rentabilidad',
    categoria: 'Productos',
    pregunta: '¿Qué es la "rentabilidad objetivo"?',
    respuesta:
      'Es el porcentaje que se le quiere ganar a un producto sobre su costo. Por ejemplo, 130% significa que el precio de venta sugerido es el costo multiplicado por 2,3. Cargando el costo y la rentabilidad, la app calcula sola un precio de venta sugerido que podés usar con un toque, o cambiar a mano. Ese precio sugerido siempre se redondea para arriba, a un múltiplo de 100 — nunca queda un número con sueltos ni un centavo de menos, para que sea fácil de cobrar.',
    palabrasClave: ['markup', 'ganancia', 'porcentaje', 'redondeo', 'redondear', 'numero facil de cobrar'],
    requiereSeccion: 'productos',
  },
  {
    id: 'bajo-costo',
    categoria: 'Productos',
    pregunta: '¿Qué significa "BAJO COSTO" en rojo al lado de un producto?',
    respuesta:
      'Que el precio de venta es igual o menor que el precio de compra: cada vez que se vende ese producto, el local pierde plata. Casi siempre pasa porque el proveedor aumentó y el precio de venta quedó sin actualizar.\n\nEs el aviso más urgente de la app, por eso aparece primero y en rojo, tanto en Productos como en la campana 🔔. Tocando "Ver esos productos" quedan filtrados los que hay que corregir. Al abrir cada uno, el precio sugerido según la rentabilidad te da el valor al que debería estar.',
    palabrasClave: ['bajo costo', 'perdida', 'pierdo plata', 'margen negativo', 'vender a perdida'],
  },
  {
    id: 'de-donde-salen-los-precios',
    categoria: 'Productos',
    pregunta: '¿De dónde salen los precios y los costos que trae la app?',
    respuesta:
      'De la planilla "BASE DE DATOS ECDM 2026", que es la lista de precios de siempre del local. Cada tanto se vuelve a traer de ahí lo que haya cambiado: costo de compra, rentabilidad, precio de venta y las dos fechas (la de la última compra y la de la última vez que se actualizó el precio de venta).\n\nTraer la lista nueva nunca pisa lo que se editó desde la app: si un costo se corrigió acá — a mano o cargando una compra en la cuenta corriente del proveedor — ese producto se deja como está, porque lo de la app es más nuevo que la planilla.',
    palabrasClave: ['base de datos', 'lista de precios', 'planilla', 'de donde salen'],
  },
  {
    id: 'costo-viejo',
    categoria: 'Productos',
    pregunta: '¿Por qué dice "COSTO VIEJO" al lado de un producto?',
    respuesta:
      'Porque el precio de compra cargado tiene más de 6 meses, o directamente no está cargado.\n\nOjo con qué significa: esto NO quiere decir que le estés cobrando mal al cliente. El precio de venta puede estar perfecto. Lo que pasa es que, si el costo cargado es más viejo que el real, el margen que muestra el reporte sale más alto de lo que en verdad es. Es un problema del reporte, no de la caja.\n\nConviene actualizar esos costos seguido — el módulo de Proveedores ayuda a hacerlo en bloque. Si es un producto que ya no se fabrica más, mejor que actualizarlo es marcarlo como descontinuado: así deja de avisar para siempre.',
    palabrasClave: ['vencido', 'desactualizado', 'inflado'],
    requiereSeccion: 'productos',
  },
  {
    id: 'producto-descontinuado',
    categoria: 'Productos',
    pregunta: 'Marqué un producto como descontinuado y me sigue apareciendo, ¿por qué?',
    respuesta:
      'Ya no debería. Antes pasaba: al tildar "Ya no se fabrica / no se repone" solo dejaba de reclamar el COSTO, pero seguía apareciendo en "sin stock", en "precio viejo" y en "por debajo de su markup". O sea, hacías el trabajo y el aviso seguía ahí.\n\nAhora un producto descontinuado deja de pedir todo lo que no tiene sentido hacerle: no pide reponer stock (no se repone), no pide remarcarlo (lo estás terminando) y no pide actualizarle el costo (no lo vas a volver a comprar).\n\nLo único que sí sigue avisando es si lo estás vendiendo por debajo de lo que te costó, porque eso es plata que sale cada vez que sale uno del mostrador.\n\nPara marcarlo: abrí el producto y tildá la casilla abajo del stock. Lo puede hacer cualquiera, dueño o empleado. Sigue viéndose y se puede seguir vendiendo — no es lo mismo que archivarlo.',
    palabrasClave: ['descontinuado', 'no se fabrica', 'no se repone', 'costo viejo', 'sigue apareciendo'],
    requiereSeccion: 'productos',
  },
  {
    id: 'stock',
    categoria: 'Productos',
    pregunta: '¿Cómo controlo el stock de un producto?',
    respuesta:
      'Es opcional. Si en el producto cargás un número en "Stock", cada venta de ese producto lo va a descontar sola, y cada compra que registres al proveedor se lo va a sumar sola. Si lo dejás vacío, ese producto no lleva control de stock (es lo normal para la mayoría del catálogo, salvo que quieras controlar algo puntual).',
    requiereSeccion: 'productos',
  },
  {
    id: 'sin-stock',
    categoria: 'Productos',
    pregunta: 'Un producto dice "SIN STOCK", ¿qué significa y qué hago?',
    respuesta:
      'Significa que ese producto lleva control de stock y llegó a cero (o a un número negativo). Aparece con un cartel rojo en Productos, en la campana 🔔 y en "Mi día", y desde ahí podés filtrar para ver todos los que están así de una sola vez.\n\nPara reponerlo: registrá la compra al proveedor desde Proveedores → el proveedor → "+ Registrar compra". El stock se suma solo y el cartel desaparece.\n\nSi el número quedó en negativo, quiere decir que se vendió más de lo que la app creía que había (por ejemplo, llegó mercadería y no se registró la compra). No es un error grave: se acomoda solo en cuanto registres la compra que faltaba.',
    palabrasClave: ['sin stock', 'agotado', 'se acabo', 'reponer', 'faltante', 'stock negativo'],
    requiereSeccion: 'productos',
  },
  {
    id: 'borrar-producto',
    categoria: 'Productos',
    pregunta: '¿Puedo borrar un producto del catálogo?',
    respuesta:
      'No se borra de verdad: se "archiva" (abriendo el producto y tocando "Archivar producto" al final). Deja de verse en el catálogo y en Caja, pero las ventas que ya tuvo y su historial de ediciones quedan guardados para siempre. Un dueño lo puede archivar directo; un empleado tiene que solicitarlo y esperar que un dueño lo autorice (ver la categoría "Usuarios y roles"). Un producto archivado se puede reactivar desde Productos → "Ver archivados".',
    palabrasClave: ['archivar', 'reactivar'],
    requiereSeccion: 'productos',
  },

  {
    id: 'compartir-whatsapp',
    categoria: 'Productos',
    pregunta: '¿Cómo le paso un producto a un cliente por WhatsApp?',
    respuesta:
      'En la lista de Productos, cada producto tiene un botón 💬 al lado del precio. También aparece abajo de todo cuando abrís un producto para editarlo.\n\nAl tocarlo se abre tu WhatsApp con el mensaje ya escrito: el nombre del producto, el precio y el enlace al catálogo. Vos elegís a quién mandárselo y tocás enviar.\n\nUsa el WhatsApp que ya tenés en el celular, con tu número de siempre. No hace falta ninguna cuenta nueva ni configurar nada.',
    palabrasClave: ['whatsapp', 'wsp', 'compartir', 'mandar', 'pasar precio', 'cliente'],
    requiereSeccion: 'productos',
  },
  {
    id: 'catalogo-publico',
    categoria: 'Productos',
    pregunta: '¿Qué es el catálogo público y qué ven los clientes?',
    respuesta:
      'Es una página web que puede abrir cualquiera, sin usuario ni contraseña: app.elclubdelmate.com/catalogo/. Muestra los productos con su nombre, su código y el precio de venta, con un buscador.\n\nSolo se publican esas tres cosas. El precio de compra, la rentabilidad, el proveedor y el stock NO se publican nunca.\n\nTampoco salen los productos inactivos, los archivados, los descontinuados ni los que no tienen precio cargado.\n\nEse mismo catálogo es con lo que arranca un celular recién instalado, así no abre con la pantalla vacía. Los costos y los proveedores le llegan recién al iniciar sesión, desde el servidor: en un celular sin vincular no están, y eso es a propósito.',
    palabrasClave: ['catalogo', 'publico', 'clientes', 'pagina', 'web', 'link', 'enlace'],
    requiereSeccion: 'productos',
  },
  {
    id: 'catalogo-desactualizado',
    categoria: 'Productos',
    pregunta: 'Cambié un precio y el catálogo público sigue mostrando el viejo',
    respuesta:
      'El catálogo público no se actualiza solo: es una página aparte, que se publica cada vez que se sube una lista de precios nueva.\n\nSi editaste precios desde la app y querés que salgan ya, andá a Ajustes → Catálogo público → "Exportar catálogo con los precios de hoy". Eso te descarga un archivo que hay que publicar.\n\nMientras tanto, el catálogo sigue mostrando los precios de la última lista publicada. Por eso la página aclara abajo que los precios pueden cambiar sin aviso.',
    palabrasClave: ['catalogo viejo', 'precio desactualizado', 'no se actualiza', 'publicar'],
    soloOwner: true,
    requiereSeccion: 'productos',
  },
  {
    id: 'dos-fechas',
    categoria: 'Productos',
    pregunta: '¿Qué diferencia hay entre "costo viejo" y "precio viejo"?',
    respuesta:
      'Son dos cosas distintas y conviene no confundirlas, porque se arreglan de manera diferente.\n\nCada producto lleva DOS fechas. Una dice cuándo se actualizó el COSTO (lo que te cuesta a vos), y la otra cuándo se actualizó el PRECIO DE VENTA (lo que le cobrás al cliente). Se mueven por separado: podés remarcar un precio sin haber comprado, y podés comprar sin remarcar.\n\n• COSTO VIEJO → el reporte miente. El margen de contribución te va a dar más alto de lo real, porque el costo cargado es más barato que el de verdad. No perdés plata, pero no podés confiar en el número.\n\n• PRECIO VIEJO → estás cobrando de menos. Hace más de un año que ese precio no se toca, y mientras tanto todo aumentó.\n\n• BAJO SU MARKUP → el más importante de los tres. Con el costo y la rentabilidad que el producto ya tiene cargados, el precio debería ser más alto de lo que es. Este no depende de ninguna fecha: es una cuenta.\n\nEn la lista de Productos cada uno tiene su cartelito, y arriba de todo podés filtrar por cualquiera de ellos.',
    palabrasClave: ['costo viejo', 'precio viejo', 'dos fechas', 'markup', 'rentabilidad', 'desactualizado'],
    requiereSeccion: 'productos',
  },
  {
    id: 'fecha-costo-automatica',
    categoria: 'Productos',
    pregunta: '¿Tengo que poner la fecha a mano cuando cambio un costo?',
    respuesta:
      'No. Si cambiás el precio de compra y no tocás la fecha, la app le pone la de hoy sola. Lo mismo pasa con el precio de venta: cambiás el precio y la fecha se actualiza.\n\nSi querés poner otra fecha (por ejemplo, porque estás cargando una compra de la semana pasada), escribila vos y la app respeta la que pusiste.\n\nEsto es importante para que los avisos sirvan: si la fecha del costo queda vieja aunque el costo haya cambiado, la app te sigue reclamando algo que ya hiciste.',
    palabrasClave: ['fecha', 'automatica', 'costo', 'actualizar fecha'],
    requiereSeccion: 'productos',
  },
  {
    id: 'archivar-o-descontinuar',
    categoria: 'Productos',
    pregunta: '¿Archivo el producto o lo marco como descontinuado?',
    respuesta:
      'Depende de si todavía te queda para vender.\n\n• Si NO queda stock y no se repone más → archivalo. Desaparece del catálogo y de Caja, pero su historial de ventas se guarda para siempre.\n\n• Si TODAVÍA queda stock → marcalo como descontinuado, no lo archives. Así lo seguís viendo y lo podés seguir vendiendo hasta que se termine, pero deja de reclamarte que actualices el costo de algo que no vas a volver a comprar.\n\nSi archivás algo que todavía tenías en el mostrador, no lo vas a poder cargar en una venta. Por eso, cuando autorizás un pedido de archivado, la app te muestra cuánto stock queda antes de que decidas.',
    palabrasClave: ['archivar', 'descontinuado', 'no se fabrica', 'dar de baja', 'borrar producto'],
    requiereSeccion: 'productos',
  },
  {
    id: 'me-llego-lo-del-otro',
    categoria: 'Sincronización y respaldo',
    pregunta: '¿Cómo sé si lo que carga la otra persona me llegó?',
    respuesta:
      'Andá a Ajustes → Respaldo automático. Ahí hay dos renglones:\n\n• "Estado" tiene que decir Sincronizado.\n• "Último cambio recibido" te dice hace cuánto llegó algo de otro dispositivo: "recién", "hace 3 minutos", etc.\n\nNo hace falta recargar ni cerrar la app: los cambios llegan solos en segundos mientras haya internet. Si alguien edita un producto desde el local, en tu celular se actualiza sin que toques nada.\n\nSi dice "todavía nada" pero el estado está en Sincronizado, no hay problema: significa que nadie cargó nada desde que abriste la app.\n\nSi el estado no dice Sincronizado, lo que se cargó no se pierde: queda guardado en el dispositivo y se sube solo apenas vuelve la señal.',
    palabrasClave: ['sincronizar', 'me llego', 'no veo', 'otro celular', 'gabriela', 'actualiza'],
  },
  {
    id: 'productos-sin-precio',
    categoria: 'Productos',
    pregunta: 'Un producto no me aparece para vender, ¿qué pasa?',
    respuesta:
      'Fijate si tiene precio de venta cargado. Sin precio, la app no lo deja poner en una venta ni lo muestra en el catálogo que ven los clientes: no sabría cuánto cobrar.\n\nEn Productos, arriba de todo, hay un aviso rojo con cuántos están así y un botón para verlos todos juntos. Si el producto ya tiene el costo y la rentabilidad cargados, al abrirlo la app te sugiere el precio redondeado y lo ponés de una.',
    palabrasClave: ['sin precio', 'no aparece', 'no lo puedo vender', 'no me deja vender'],
    requiereSeccion: 'productos',
  },
  {
    id: 'stock-negativo',
    categoria: 'Productos',
    pregunta: '¿Por qué un producto tiene el stock en negativo?',
    respuesta:
      'Porque se vendieron más unidades de las que figuraban cargadas. La app no frena la venta —primero está atender al cliente—, pero deja el número en negativo para que se note.\n\nGeneralmente es una de dos: falta registrar una compra al proveedor (llegó mercadería y no se cargó), o el conteo de stock quedó mal de antes.\n\nSe arregla contando lo que hay en el local y corrigiendo el número, o registrando la compra que faltaba desde Proveedores, que suma el stock sola.',
    palabrasClave: ['stock negativo', 'menos de cero', 'stock mal'],
    requiereSeccion: 'productos',
  },
  {
    id: 'revision-completa',
    categoria: 'Panel y pendientes',
    pregunta: '¿Cómo sé todo lo que la app revisa?',
    respuesta:
      'Abajo de todo en el Panel está "Revisión completa". Ahí aparece la lista entera de controles que la app corre sola cada vez que la abrís, con el resultado de cada uno.\n\nEs distinto del resto del Panel: arriba solo se muestra lo que hay para hacer, y acá se ve todo, incluido lo que dio bien. Sirve para saber que el negocio está sano y no solo que la app se quedó callada.\n\nCada control tiene su marca: ✓ está en orden, ! encontró algo, · es un aviso menor, y ? quiere decir que ese control no se pudo revisar (por ejemplo, los del respaldo automático cuando la nube todavía no está activada). Un control que no se pudo correr no cuenta como aprobado.',
    palabrasClave: ['revision completa', 'que revisa', 'controles', 'auditoria', 'todo lo que mira'],
  },
  // ---------- Proveedores ----------
  {
    id: 'asignar-proveedor',
    categoria: 'Proveedores',
    pregunta: '¿Cómo asigno un proveedor a un producto?',
    respuesta:
      'Al editar un producto (en Productos), el campo "Proveedor" es una lista para elegir. Si el proveedor no existe todavía, elegí "+ Proveedor nuevo…" y escribí el nombre ahí mismo: se crea y se asigna en el momento, sin salir del formulario.',
    requiereSeccion: 'proveedores',
  },
  {
    id: 'aumento-bloque',
    categoria: 'Proveedores',
    pregunta: '¿Cómo actualizo de una vez los costos de un proveedor?',
    respuesta:
      'Entrá a Proveedores, elegí el proveedor y abajo vas a ver "Aumentar todos los costos de este proveedor". Cargá el porcentaje que avisó el proveedor (ej: 8) y tocá "Aplicar": se actualiza el costo de todos los productos que ya tenían costo cargado, y queda anotada la fecha de hoy. Los que no tenían costo cargado quedan igual, para completarlos a mano.',
    palabrasClave: ['aumento', 'lista de precios', 'todos juntos', 'masivo'],
    requiereSeccion: 'proveedores',
  },
  {
    id: 'producto-sin-proveedor',
    categoria: 'Proveedores',
    pregunta: 'Un producto no tiene proveedor asignado, ¿es grave?',
    respuesta:
      'No es grave, la app sigue funcionando igual. Solo que ese producto no va a aparecer agrupado en ningún proveedor, así que no se va a beneficiar del aumento en bloque. Conviene asignarle uno cuando tengas un rato, editándolo desde Productos.',
    requiereSeccion: 'proveedores',
  },
  {
    id: 'proveedor-inactivo',
    categoria: 'Proveedores',
    pregunta: 'Ya no trabajamos más con un proveedor, ¿qué hago?',
    respuesta:
      'Entrá al proveedor y tocá "Marcar inactivo". Te va a preguntar si querés que sus productos dejen de figurar como "costo desactualizado" — decile que sí y se marcan todos de una: no tiene sentido seguir pidiendo que se actualice el costo de algo que no se va a volver a comprar. El proveedor queda marcado como inactivo (no se borra, sigue viéndose en la lista) y deja de aparecer para elegir en productos nuevos, aunque los productos que ya tenía asignados siguen funcionando exactamente igual. Se puede reactivar en cualquier momento con el mismo botón.',
    palabrasClave: ['inactivo', 'ya no trabajamos', 'baja de proveedor'],
    requiereSeccion: 'proveedores',
  },
  {
    id: 'registrar-compra',
    categoria: 'Proveedores',
    pregunta: '¿Cómo registro una compra que le hice a un proveedor?',
    respuesta:
      'Entrá al proveedor y tocá "+ Registrar compra", dentro de "Cuenta corriente". Elegí la fecha, y por cada producto que compraste agregá una línea: el producto, la cantidad y el costo unitario (se precarga solo con el último costo cargado, se puede cambiar). Podés agregar todos los productos que necesites con "+ Agregar producto". Al guardar, tres cosas pasan solas: se suma esa cantidad al stock de cada producto, se actualiza su costo y su fecha de compra (deja de figurar como "costo desactualizado"), y el total de la compra queda anotado en la cuenta corriente del proveedor como algo que se le debe.',
    palabrasClave: ['compra', 'ingreso de mercaderia', 'reponer stock', 'cargar compra'],
    requiereSeccion: 'proveedores',
  },
  {
    id: 'cuenta-corriente-proveedor',
    categoria: 'Proveedores',
    pregunta: '¿Qué es la "cuenta corriente" de un proveedor?',
    respuesta:
      'Es cuánto se le debe a ese proveedor en este momento: cada compra que le registrás suma a la deuda, y cada pago que le registrás la descuenta. Se ve arriba de todo en la ficha del proveedor ("Le debemos $X", o "A favor nuestro" si se pagó de más), con el detalle de todos los movimientos abajo. Sirve para saber de un vistazo cuánto falta pagarle, sin tener que llevarlo aparte en un cuaderno.',
    palabrasClave: ['cuenta corriente', 'deuda', 'le debemos', 'saldo proveedor'],
    requiereSeccion: 'proveedores',
  },
  {
    id: 'registrar-pago-proveedor',
    categoria: 'Proveedores',
    pregunta: '¿Cómo registro un pago a un proveedor?',
    respuesta:
      'Entrá al proveedor y tocá "+ Registrar pago", dentro de "Cuenta corriente". Cargá la fecha, el monto, el medio de pago (efectivo, transferencia, etc.) y una nota si hace falta. Al guardar, ese monto descuenta la deuda con el proveedor, y además queda cargado solo como un gasto en Gastos (categoría PROVEEDORES, variable), para no tener que cargarlo dos veces.',
    palabrasClave: ['pagar proveedor', 'pago', 'cancelar deuda', 'efectivo', 'transferencia'],
    requiereSeccion: 'proveedores',
  },
  {
    id: 'borrar-movimiento-proveedor',
    categoria: 'Proveedores',
    pregunta: 'Cargué mal una compra o un pago, ¿cómo lo borro?',
    respuesta:
      'En la lista de movimientos de la cuenta corriente, cada uno tiene su botón "Borrar". La app deshace también lo que ese movimiento había provocado:\n\nSi borrás un PAGO, se borra además el gasto que había generado en Gastos, así no queda un gasto de más inflando el mes.\n\nSi borrás una COMPRA, se descuenta del stock lo que esa compra había sumado. Lo único que no se revierte solo es el costo que quedó cargado en cada producto (la app no sabe cuál era el anterior): si hace falta, corregilo a mano desde Productos o desde la tabla de costos del mismo proveedor.',
    palabrasClave: ['borrar compra', 'borrar pago', 'me equivoque', 'deshacer', 'anular'],
    requiereSeccion: 'proveedores',
  },

  // ---------- Gastos ----------
  {
    id: 'fijo-variable',
    categoria: 'Gastos',
    pregunta: '¿Qué diferencia hay entre un gasto fijo y uno variable?',
    respuesta:
      'Un gasto fijo se paga todos los meses más o menos igual, vendas mucho o poco (alquiler, sueldos, contador). Un gasto variable depende de cuánto se vende (comisiones de tarjeta, flete, packaging). Esta diferencia importa para el reporte: los variables se restan del margen de contribución, los fijos se restan después, para llegar al resultado final del mes.',
    palabrasClave: ['margen de contribucion', 'resultado del mes'],
    requiereSeccion: 'gastos',
  },
  {
    id: 'desglose-gastos',
    categoria: 'Reportes',
    pregunta: '¿Cómo veo de qué están hechos los gastos del mes?',
    respuesta:
      'En Reportes, debajo de "Cómo se arma", está la tarjeta "Gastos del mes en detalle". Separa los gastos en fijos y variables —que es lo que cambia el cálculo del margen— y adentro los agrupa por categoría, de mayor a menor, con cuánto pesa cada una.\n\nTocando una categoría se despliega el detalle: cada gasto con su fecha, su concepto y su monto. Los que salieron de la caja del turno (en vez de la caja grande) quedan marcados, para poder distinguirlos.',
    palabrasClave: ['desglose', 'detalle de gastos', 'en que se gasto', 'categorias'],
    soloOwner: true,
    requiereSeccion: 'reportes',
  },
  {
    id: 'cargar-gasto',
    categoria: 'Gastos',
    pregunta: '¿Cómo cargo un gasto?',
    respuesta:
      'En Gastos, tocá "+ Cargar gasto". Elegí si es un gasto pagado con la caja grande o un ingreso a la caja grande, la fecha, el monto, el concepto, la categoría, y si es fijo o variable (la app sugiere una opción según la categoría, pero se puede cambiar).',
    requiereSeccion: 'gastos',
  },

  // ---------- Reportes ----------
  {
    id: 'margen-contribucion',
    categoria: 'Reportes',
    pregunta: '¿Qué es el margen de contribución?',
    respuesta:
      'Es lo que queda de las ventas después de restar el costo de la mercadería vendida y los gastos variables. Ese número tiene que alcanzar para cubrir los gastos fijos (alquiler, sueldos) — si sobra, el mes dio a favor; si no alcanza, dio en contra. Se ve completo en Reportes, con el detalle de cómo se arma.',
    requiereSeccion: 'reportes',
  },
  {
    id: 'margen-no-cierra',
    categoria: 'Reportes',
    pregunta: '¿Por qué el margen de contribución no coincide con lo que sé que gané?',
    respuesta:
      'Lo más probable es que haya productos vendidos con el costo de compra vencido o sin cargar (mirá el aviso "COSTO VIEJO"). Como el margen se calcula con el costo que está cargado en ese momento, si ese costo está desactualizado el número sale más alto de lo real. Reportes muestra, mes a mes, la lista de productos que más afectan este problema — actualizando esos primero, el número se corrige solo.',
    palabrasClave: ['no coincide', 'esta mal', 'no cierra el numero'],
    requiereSeccion: 'reportes',
  },
  {
    id: 'reporte-anual',
    categoria: 'Reportes',
    pregunta: '¿Puedo ver el año completo en vez de un mes?',
    respuesta:
      'Sí. Arriba de todo en Reportes hay dos pestañas: "Por mes" y "Por año". En la anual elegís el año y ves el resultado del año entero, cómo se arma, y una tabla mes por mes con las ventas, el margen y el resultado de cada uno, para ver la evolución.\n\nTambién te muestra el promedio de ventas por mes, cuál fue el mejor mes y cuál el más flojo, el desglose de los gastos del año y los productos que más facturaron.\n\nEl mes que todavía está corriendo aparece marcado como "en curso". Lo vendido suma al total del año, pero ese mes no se usa para el promedio ni para elegir el mejor y el más flojo: como todavía le faltan días, siempre saldría el más flojo y bajaría el promedio sin que eso signifique nada.\n\nSolo aparecen los meses que tienen algo cargado: un año recién empezado no se llena de meses en cero.',
    palabrasClave: ['anual', 'año', 'todo el año', 'evolucion', 'comparar meses'],
    soloOwner: true,
    requiereSeccion: 'reportes',
  },
  {
    id: 'meses-viejos-planilla',
    categoria: 'Reportes',
    pregunta: '¿De dónde salen los meses anteriores a que empezáramos a usar la app?',
    respuesta:
      'Todo 2026 desde enero se trajo de las planillas de Excel que se usaban antes. Son 2.141 ventas y 482 turnos que la app carga sola la primera vez que se abre, así el reporte anual tiene el año completo y no arranca del día que empezaste a usarla.\n\nEsa carga no pisa nada: un turno que abriste y cerraste vos desde la app queda intacto aunque la planilla tenga ese mismo día.\n\nCada mes importado se controló contra los totales que la propia planilla calculaba: de 482 turnos, 480 dan exactamente igual. Los otros dos son errores de la planilla vieja (una venta que su fórmula no sumaba y otra anotada dos veces), y en la app están bien.',
    palabrasClave: ['excel', 'planilla', 'historico', 'meses viejos', 'enero', 'importado'],
    soloOwner: true,
    requiereSeccion: 'reportes',
  },
  {
    id: 'ver-mes-anterior',
    categoria: 'Reportes',
    pregunta: '¿Cómo veo el reporte de un mes anterior?',
    respuesta:
      'En Reportes, arriba de todo hay un selector de mes. Cambialo y todos los números de la pantalla (margen, actividad, ranking de productos, día por día) se recalculan para ese mes.',
    requiereSeccion: 'reportes',
  },

  // ---------- Sincronización y respaldo ----------
  {
    id: 'que-es-sincronizar',
    categoria: 'Sincronización y respaldo',
    pregunta: '¿Qué es el "respaldo automático" de Ajustes?',
    respuesta:
      'Es lo mismo que la sincronización entre dispositivos, mirado desde otro lado: al vincular un dispositivo (en Ajustes → "Respaldo automático"), todo lo que se carga se guarda en un servidor en la nube, no solo en el celular. Eso quiere decir dos cosas a la vez: (1) es un respaldo automático, porque si el celular se rompe o se pierde, los datos siguen a salvo en el servidor; y (2) todos los dispositivos vinculados ven los mismos datos en segundos, como una venta cargada en el mostrador que aparece enseguida en tu celular.\n\nSigue funcionando exactamente igual sin internet: los cambios se guardan primero en el celular y se suben solos apenas vuelve la señal. No hace falta estar conectado para trabajar.',
    palabrasClave: ['respaldo automatico', 'backup', 'servidor', 'nube', 'sincronizacion'],
  },
  {
    id: 'sync-atrasada',
    categoria: 'Sincronización y respaldo',
    pregunta: 'Me dice que este dispositivo no sincroniza hace días, ¿perdí algo?',
    respuesta:
      'No. Todo lo que cargaste está guardado en el celular y sube solo apenas se vuelva a conectar. El aviso no es que se hayan perdido datos, es que mientras tanto este aparato está trabajando por su cuenta: lo que cargaste acá todavía no lo ven los demás, y lo que cargaron los demás todavía no está acá.\n\nQué hacer: fijate que el celular tenga internet y dejá la app abierta un rato. El aviso desaparece solo cuando vuelve a recibir datos.\n\nSi tenés internet y sigue igual, avisale al dueño: puede ser que se haya cerrado la sesión en este dispositivo y haya que volver a entrar.\n\nLa app avisa recién a los tres días para no molestar por un franco o un fin de semana largo.',
    palabrasClave: [
      'no sincroniza',
      'desactualizado',
      'atrasado',
      'sin internet',
      'no se ve en el otro celular',
      'dias',
    ],
  },
  {
    id: 'vincular-dispositivo',
    categoria: 'Sincronización y respaldo',
    pregunta: '¿Cómo entro en un dispositivo nuevo?',
    respuesta:
      'Abrí la app en ese dispositivo y iniciá sesión con tu propio mail y contraseña (los mismos que usás en los demás celulares). No hay que vincular nada aparte: apenas entrás, tus datos y los del resto del equipo aparecen solos.',
    palabrasClave: ['nuevo celular', 'otro dispositivo', 'iniciar sesion'],
  },
  {
    id: 'hacer-respaldo',
    categoria: 'Sincronización y respaldo',
    pregunta: '¿Cómo hago una copia manual de los datos?',
    respuesta:
      'En Ajustes → "Copia manual" → "Descargar copia". Se descarga un archivo con todo lo cargado (productos, proveedores, turnos, ventas, gastos). Convenís guardarlo en Google Drive de vez en cuando, sobre todo si todavía no activaste el respaldo automático de arriba.',
    palabrasClave: ['backup', 'copia de seguridad', 'exportar', 'respaldo manual'],
    soloOwner: true,
  },
  {
    id: 'perdi-celular',
    categoria: 'Sincronización y respaldo',
    pregunta: 'Se me rompió o perdió el celular, ¿pierdo los datos?',
    respuesta:
      'Si el negocio tiene el respaldo automático activado, no: los datos siguen en el servidor, así que en un celular nuevo alcanza con iniciar sesión con tu mismo mail y contraseña para volver a tenerlos. Si no lo tenías activado, dependés de la última copia manual descargada desde Ajustes — por eso conviene activar el respaldo automático o hacer copias manuales seguido.',
    palabrasClave: ['se rompio', 'se perdio', 'recuperar datos'],
  },
]

/**
 * Deja solo las preguntas que le sirven a quien esta mirando: un empleado
 * no ve las de dueño (usuarios, respaldos) ni las de secciones que tiene
 * apagadas. Sin perfil (app sin nube) se ve todo, como siempre.
 */
export function ayudaParaPerfil(
  entradas: EntradaAyuda[],
  esOwner: boolean,
  secciones: SeccionId[],
): EntradaAyuda[] {
  if (esOwner) return entradas
  return entradas.filter((e) => {
    if (e.soloOwner) return false
    if (e.requiereSeccion && !secciones.includes(e.requiereSeccion)) return false
    return true
  })
}

function coincide(entrada: EntradaAyuda, palabras: string[]): number {
  const texto = normalizar(
    [entrada.pregunta, entrada.respuesta, entrada.categoria, ...(entrada.palabrasClave ?? [])].join(
      ' ',
    ),
  )
  const preguntaNorm = normalizar(entrada.pregunta)
  let puntaje = 0
  for (const palabra of palabras) {
    if (preguntaNorm.includes(palabra)) puntaje += 3
    else if (texto.includes(palabra)) puntaje += 1
  }
  return puntaje
}

/** Busca preguntas frecuentes por coincidencia de palabras, sin depender de ningun servicio externo. */
export function buscarAyuda(consulta: string, entradas: EntradaAyuda[] = AYUDA): EntradaAyuda[] {
  const palabras = normalizar(consulta).split(/\s+/).filter((p) => p.length > 1)
  if (palabras.length === 0) return []

  return entradas
    .map((entrada) => ({ entrada, puntaje: coincide(entrada, palabras) }))
    .filter((r) => r.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .map((r) => r.entrada)
}
