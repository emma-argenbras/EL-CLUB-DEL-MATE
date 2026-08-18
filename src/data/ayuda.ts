import { normalizar } from '../lib/formato'

export interface EntradaAyuda {
  id: string
  categoria: string
  pregunta: string
  /** Puede tener varios parrafos separados por '\n\n'. */
  respuesta: string
  /** Palabras extra que la gente podria escribir y no estan en la pregunta. */
  palabrasClave?: string[]
}

export const CATEGORIAS_AYUDA = [
  'Primeros pasos',
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
      '🧉 Caja: abrir el turno, cargar ventas y cerrar la caja. Es lo que se usa todos los días.\n\n🏷️ Productos: el catálogo completo, buscar y editar precios y costos.\n\n🚚 Proveedores: quién provee cada producto, para actualizar costos en bloque.\n\n💸 Gastos: alquiler, sueldos, proveedores pagados con la caja grande.\n\n📊 Reportes (dueños): el margen de contribución del mes, si dio a favor o en contra.\n\n⭐ Mi día (empleados): en vez de Reportes, un resumen del propio trabajo — costos pendientes, cuánto cargaste este mes, lo más vendido.\n\n⚙️ Ajustes (dueños): respaldo de los datos y usuarios del equipo.',
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
    id: 'notificaciones',
    categoria: 'Primeros pasos',
    pregunta: '¿Para qué sirve la campana 🔔 de arriba?',
    respuesta:
      'Avisa sola de cosas para revisar: productos con el costo de compra vencido, ventas del mes sin costo cargado, una diferencia de caja en el último cierre, o problemas de sincronización. Tocando cada aviso te lleva directo a la pantalla donde se soluciona.',
    palabrasClave: ['campana', 'avisos', 'alertas'],
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
  },
  {
    id: 'personalizar-secciones-empleado',
    categoria: 'Usuarios y roles',
    pregunta: '¿Puedo elegir qué secciones ve cada empleado?',
    respuesta:
      'Sí. En Ajustes → "Usuarios del equipo", al lado de cada empleado/a hay un botón "Qué ve": ahí podés tildar o destildar Caja, Productos, Proveedores, Gastos y Reportes, sección por sección y persona por persona. Por ejemplo, podés dejarle ver Reportes puntualmente a alguien de mucha confianza sin cambiarle el rol. Si no tocás nada, un empleado nuevo arranca viendo Caja, Productos, Proveedores y Gastos (lo de siempre), y sin Reportes.',
    palabrasClave: ['permisos', 'que ve', 'personalizar', 'secciones', 'ocultar', 'mostrar'],
  },

  // ---------- Caja ----------
  {
    id: 'abrir-turno',
    categoria: 'Caja',
    pregunta: '¿Cómo abro un turno?',
    respuesta:
      'Entrá a Caja, elegí la fecha (por defecto es hoy) y el turno (mañana o tarde). Si todavía no está abierto, la app te pide contar la caja: cargá cuántos billetes hay de cada denominación y listo, se calcula solo el total. Tocá "Abrir turno" y ya podés empezar a cargar ventas.',
    palabrasClave: ['arqueo', 'apertura', 'empezar'],
  },
  {
    id: 'cargar-venta',
    categoria: 'Caja',
    pregunta: '¿Cómo cargo una venta?',
    respuesta:
      'Con el turno abierto, en la pestaña "Ventas" escribí el código o el nombre del producto en el buscador. Elegí el que corresponda de la lista, revisá la cantidad y el precio (se completa solo con el precio de venta cargado), elegí el medio de pago, y tocá "Agregar". La venta queda en la lista de abajo, y los totales de arriba se actualizan solos.',
    palabrasClave: ['vender', 'buscar producto', 'cobrar'],
  },
  {
    id: 'producto-sin-codigo',
    categoria: 'Caja',
    pregunta: '¿Qué hago si no encuentro el código de un producto?',
    respuesta:
      'Buscalo por nombre en vez de por código: el buscador encuentra igual escribiendo parte de la descripción. Si el producto todavía no está cargado en el catálogo, lo mejor es agregarlo primero desde Productos → "+ Producto nuevo", y recién ahí volver a Caja para venderlo. Así queda con su código, su costo y se puede calcular bien el margen.',
    palabrasClave: ['no aparece', 'no encuentro', 'nuevo producto'],
  },
  {
    id: 'egreso-caja',
    categoria: 'Caja',
    pregunta: '¿Cómo registro un gasto chico durante el turno?',
    respuesta:
      'En Caja, pestaña "Egresos" → elegí "Gasto pagado con la caja" → escribí el concepto (ej: flete, café) y el monto → "Registrar egreso". Se descuenta solo del efectivo esperado en la caja al momento de cerrar.',
    palabrasClave: ['flete', 'gasto chico', 'plata que sale'],
  },
  {
    id: 'caja-grande',
    categoria: 'Caja',
    pregunta: '¿Qué es "pasar a caja grande"?',
    respuesta:
      'Es cuando se saca efectivo de la caja del turno para guardarlo en la caja fuerte o caja grande del local (no es un gasto, es plata que cambia de lugar). Se carga igual que un egreso, pero eligiendo "Pase a caja grande" en vez de "Gasto pagado con la caja".',
    palabrasClave: ['caja fuerte', 'guardar plata'],
  },
  {
    id: 'cerrar-turno',
    categoria: 'Caja',
    pregunta: '¿Cómo cierro la caja?',
    respuesta:
      'En la pestaña "Cierre", contá los billetes que quedan en la caja (igual que en la apertura). La app compara ese total contra lo que "debería haber" (caja inicial + efectivo vendido − egresos − pases a caja grande) y te muestra la diferencia. Tocá "Cerrar turno" para confirmar.',
    palabrasClave: ['arqueo de cierre', 'terminar turno'],
  },
  {
    id: 'diferencia-caja',
    categoria: 'Caja',
    pregunta: '¿Qué es la "diferencia de caja"?',
    respuesta:
      'Es la resta entre lo que se contó al cerrar y lo que la app calcula que debería haber, según la plata con la que se abrió más lo vendido en efectivo, menos lo que salió. Si da positiva, sobra plata (puede haber una venta sin cargar). Si da negativa, falta plata (puede haber un egreso sin registrar).',
    palabrasClave: ['falta plata', 'sobra plata', 'no cierra'],
  },
  {
    id: 'reabrir-turno',
    categoria: 'Caja',
    pregunta: 'Cerré el turno por error, ¿puedo volver a abrirlo?',
    respuesta:
      'Sí. En la pestaña "Cierre" de ese turno va a aparecer un botón "Reabrir turno". Al reabrirlo podés seguir cargando ventas o egresos normalmente, y cerrarlo de nuevo cuando termines.',
    palabrasClave: ['error', 'deshacer', 'volver a abrir'],
  },
  {
    id: 'medios-pago',
    categoria: 'Caja',
    pregunta: '¿Por qué hay que elegir el medio de pago en cada venta?',
    respuesta:
      'Porque el efectivo es lo único que hay que contar físicamente al cerrar la caja: las ventas con tarjeta, transferencia o QR no pasan por la caja, van directo al banco. Separarlos hace que el arqueo cierre bien y que el reporte muestre cuánto entró por cada medio.',
    palabrasClave: ['tarjeta', 'transferencia', 'qr', 'debito', 'credito'],
  },

  // ---------- Productos ----------
  {
    id: 'buscar-producto',
    categoria: 'Productos',
    pregunta: '¿Cómo busco un producto en el catálogo?',
    respuesta:
      'Entrá a Productos y escribí en el buscador de arriba: podés poner el código o parte del nombre. Tocando un producto de la lista se abre para editarlo.',
  },
  {
    id: 'producto-nuevo',
    categoria: 'Productos',
    pregunta: '¿Cómo cargo un producto nuevo?',
    respuesta:
      'En Productos, tocá "+ Producto nuevo". Cargá el código, la descripción, el proveedor (o creá uno nuevo ahí mismo), el precio de compra y el precio de venta. El código no se puede repetir.',
  },
  {
    id: 'rentabilidad',
    categoria: 'Productos',
    pregunta: '¿Qué es la "rentabilidad objetivo"?',
    respuesta:
      'Es el porcentaje que se le quiere ganar a un producto sobre su costo. Por ejemplo, 130% significa que el precio de venta sugerido es el costo multiplicado por 2,3. Cargando el costo y la rentabilidad, la app calcula sola un precio de venta sugerido que podés usar con un toque, o cambiar a mano.',
    palabrasClave: ['markup', 'ganancia', 'porcentaje'],
  },
  {
    id: 'costo-viejo',
    categoria: 'Productos',
    pregunta: '¿Por qué dice "COSTO VIEJO" al lado de un producto?',
    respuesta:
      'Porque el precio de compra cargado tiene más de 6 meses, o directamente no tiene precio de compra cargado. Mientras el precio de venta se actualiza seguido por la inflación, si el costo queda atrás el margen calculado va a parecer más alto de lo que es en realidad. Conviene actualizar esos costos seguido — el módulo de Proveedores ayuda a hacerlo en bloque.',
    palabrasClave: ['vencido', 'desactualizado', 'inflado'],
  },
  {
    id: 'stock',
    categoria: 'Productos',
    pregunta: '¿Cómo controlo el stock de un producto?',
    respuesta:
      'Es opcional. Si en el producto cargás un número en "Stock", cada venta de ese producto lo va a descontar sola. Si lo dejás vacío, ese producto no lleva control de stock (es lo normal para la mayoría del catálogo, salvo que quieras controlar algo puntual).',
  },
  {
    id: 'borrar-producto',
    categoria: 'Productos',
    pregunta: '¿Puedo borrar un producto del catálogo?',
    respuesta:
      'No se borra de verdad: se "archiva" (abriendo el producto y tocando "Archivar producto" al final). Deja de verse en el catálogo y en Caja, pero las ventas que ya tuvo y su historial de ediciones quedan guardados para siempre. Un dueño lo puede archivar directo; un empleado tiene que solicitarlo y esperar que un dueño lo autorice (ver la categoría "Usuarios y roles"). Un producto archivado se puede reactivar desde Productos → "Ver archivados".',
    palabrasClave: ['archivar', 'reactivar'],
  },

  // ---------- Proveedores ----------
  {
    id: 'asignar-proveedor',
    categoria: 'Proveedores',
    pregunta: '¿Cómo asigno un proveedor a un producto?',
    respuesta:
      'Al editar un producto (en Productos), el campo "Proveedor" es una lista para elegir. Si el proveedor no existe todavía, elegí "+ Proveedor nuevo…" y escribí el nombre ahí mismo: se crea y se asigna en el momento, sin salir del formulario.',
  },
  {
    id: 'aumento-bloque',
    categoria: 'Proveedores',
    pregunta: '¿Cómo actualizo de una vez los costos de un proveedor?',
    respuesta:
      'Entrá a Proveedores, elegí el proveedor y abajo vas a ver "Aumentar todos los costos de este proveedor". Cargá el porcentaje que avisó el proveedor (ej: 8) y tocá "Aplicar": se actualiza el costo de todos los productos que ya tenían costo cargado, y queda anotada la fecha de hoy. Los que no tenían costo cargado quedan igual, para completarlos a mano.',
    palabrasClave: ['aumento', 'lista de precios', 'todos juntos', 'masivo'],
  },
  {
    id: 'producto-sin-proveedor',
    categoria: 'Proveedores',
    pregunta: 'Un producto no tiene proveedor asignado, ¿es grave?',
    respuesta:
      'No es grave, la app sigue funcionando igual. Solo que ese producto no va a aparecer agrupado en ningún proveedor, así que no se va a beneficiar del aumento en bloque. Conviene asignarle uno cuando tengas un rato, editándolo desde Productos.',
  },

  // ---------- Gastos ----------
  {
    id: 'fijo-variable',
    categoria: 'Gastos',
    pregunta: '¿Qué diferencia hay entre un gasto fijo y uno variable?',
    respuesta:
      'Un gasto fijo se paga todos los meses más o menos igual, vendas mucho o poco (alquiler, sueldos, contador). Un gasto variable depende de cuánto se vende (comisiones de tarjeta, flete, packaging). Esta diferencia importa para el reporte: los variables se restan del margen de contribución, los fijos se restan después, para llegar al resultado final del mes.',
    palabrasClave: ['margen de contribucion', 'resultado del mes'],
  },
  {
    id: 'cargar-gasto',
    categoria: 'Gastos',
    pregunta: '¿Cómo cargo un gasto?',
    respuesta:
      'En Gastos, tocá "+ Cargar gasto". Elegí si es un gasto pagado con la caja grande o un ingreso a la caja grande, la fecha, el monto, el concepto, la categoría, y si es fijo o variable (la app sugiere una opción según la categoría, pero se puede cambiar).',
  },

  // ---------- Reportes ----------
  {
    id: 'margen-contribucion',
    categoria: 'Reportes',
    pregunta: '¿Qué es el margen de contribución?',
    respuesta:
      'Es lo que queda de las ventas después de restar el costo de la mercadería vendida y los gastos variables. Ese número tiene que alcanzar para cubrir los gastos fijos (alquiler, sueldos) — si sobra, el mes dio a favor; si no alcanza, dio en contra. Se ve completo en Reportes, con el detalle de cómo se arma.',
  },
  {
    id: 'margen-no-cierra',
    categoria: 'Reportes',
    pregunta: '¿Por qué el margen de contribución no coincide con lo que sé que gané?',
    respuesta:
      'Lo más probable es que haya productos vendidos con el costo de compra vencido o sin cargar (mirá el aviso "COSTO VIEJO"). Como el margen se calcula con el costo que está cargado en ese momento, si ese costo está desactualizado el número sale más alto de lo real. Reportes muestra, mes a mes, la lista de productos que más afectan este problema — actualizando esos primero, el número se corrige solo.',
    palabrasClave: ['no coincide', 'esta mal', 'no cierra el numero'],
  },
  {
    id: 'ver-mes-anterior',
    categoria: 'Reportes',
    pregunta: '¿Cómo veo el reporte de un mes anterior?',
    respuesta:
      'En Reportes, arriba de todo hay un selector de mes. Cambialo y todos los números de la pantalla (margen, actividad, ranking de productos, día por día) se recalculan para ese mes.',
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
export function buscarAyuda(consulta: string): EntradaAyuda[] {
  const palabras = normalizar(consulta).split(/\s+/).filter((p) => p.length > 1)
  if (palabras.length === 0) return []

  return AYUDA.map((entrada) => ({ entrada, puntaje: coincide(entrada, palabras) }))
    .filter((r) => r.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .map((r) => r.entrada)
}
