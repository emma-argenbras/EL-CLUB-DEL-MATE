import { idDeProveedor } from '../lib/idProveedor'
import Dexie, {
  type CreatingHookContext,
  type DeletingHookContext,
  type Table,
  type UpdatingHookContext,
} from 'dexie'

/**
 * Base de datos local (IndexedDB) del Club del Mate.
 *
 * Todo vive primero en el dispositivo: la app funciona sin internet.
 * Si en Ajustes se vincula una cuenta en la nube, un motor de
 * sincronización (src/sync/motor.ts) escucha los cambios de estas
 * tablas y los replica en Firestore, y viceversa. Sin vincular, la
 * app funciona exactamente igual, solo que sin compartir datos entre
 * dispositivos.
 */

export type MedioPago = 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'QR'

export const MEDIOS_PAGO: MedioPago[] = [
  'EFECTIVO',
  'DEBITO',
  'CREDITO',
  'TRANSFERENCIA',
  'QR',
]

/** Los medios que no son efectivo entran por banco, no por la caja. */
export const MEDIOS_BANCO: MedioPago[] = ['DEBITO', 'CREDITO', 'TRANSFERENCIA', 'QR']

export type Turno = 'M' | 'T'

/**
 * Genera un identificador unico por dispositivo (UUID v4).
 * Es clave para la sincronizacion: si dos celulares crean una venta
 * al mismo tiempo estando sin internet, cada una necesita un id
 * distinto para que al sincronizar no se pisen entre si.
 */
export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Alternativa por si el navegador es muy viejo y no trae crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Quien pidio borrar un producto, a la espera de que un dueño lo autorice. */
export interface SolicitudBorrado {
  por: string
  porNombre: string
  cuando: number
  motivo: string | null
}

export interface Producto {
  codigo: string
  descripcion: string
  /** Nombre del proveedor tal como venia de la planilla vieja. Se mantiene
   *  para historial, pero para agrupar/filtrar se usa proveedorId. */
  proveedor: string | null
  /** Vinculo al proveedor real (tabla proveedores). Null = sin asignar. */
  proveedorId: string | null
  fechaCompra: string | null
  precioCompra: number | null
  /** Markup objetivo cargado en la planilla: 1.3 = 130 %. */
  rentabilidad: number | null
  precioVenta: number | null
  fechaPrecioVenta: string | null
  /** Texto normalizado (minusculas, sin acentos) para el buscador. */
  busqueda: string
  stock: number | null
  activo: boolean
  /**
   * Nunca se borra un producto de verdad: se archiva. Asi el historial
   * de ventas y de ediciones queda intacto para siempre.
   */
  archivado?: boolean
  /**
   * Ya no se fabrica / no se va a reponer, pero todavia puede quedar
   * stock para vender: a diferencia de archivado, sigue viendose en el
   * catalogo y en Caja. Sirve para que deje de aparecer como "costo
   * desactualizado", ya que nadie va a actualizar el costo de algo que
   * no se vuelve a comprar.
   */
  descontinuado?: boolean
  /** Un empleado pidio archivarlo; espera que un dueño lo autorice. */
  solicitudBorrado?: SolicitudBorrado | null
  creadoPor?: string | null
  actualizadoPor?: string | null
  creadoEn?: number
  actualizadoEn?: number
}

/** Una edicion de un producto, para poder ver quien cambio que y cuando. */
/**
 * Que paso con el documento.
 *
 * "archivo" es aparte de "borro" a proposito: en esta app casi nada se
 * borra de verdad --un producto se archiva, un proveedor se desactiva--
 * y mezclarlos haria que el historial diga "borrado" sobre algo que
 * sigue existiendo.
 */
export type AccionHistorial = 'creo' | 'edito' | 'archivo' | 'borro'

/**
 * Un renglon del historial de modificaciones.
 *
 * Reemplaza a HistorialProducto, que solo cubria productos y solo
 * ediciones. Esta tabla cubre las ocho entidades del negocio y las tres
 * cosas que se les pueden hacer.
 *
 * Es un registro: se agregan renglones y nunca se editan ni se borran,
 * por ningun rol, ni siquiera un dueño (ver firestore.rules). Un
 * historial que se puede retocar no sirve como historial.
 */
export interface EntradaHistorial {
  id: string
  /** En que tabla paso. */
  tabla: NombreTabla
  /** La clave del documento: el codigo de un producto, el id de un turno. */
  clave: string
  accion: AccionHistorial
  /**
   * Que es el documento, en palabras, guardado en el momento del cambio.
   *
   * Sin esto, un renglon dice "ventas / a3f9-21bc / creo", que no le
   * sirve a nadie. Y no se puede resolver despues: si el documento se
   * borro, ya no hay de donde sacar el nombre.
   */
  queEs: string
  /** Solo en 'edito': que campo cambio. En los demas, null. */
  campo: string | null
  valorAnterior: unknown
  valorNuevo: unknown
  quien: string
  quienNombre: string
  /** Con que rol lo hizo. Null en los renglones que no los tenian. */
  quienRol: Rol | null
  cuando: number
  /**
   * De que operacion vino, cuando no fue una edicion suelta a mano:
   * "Importación Excel 11/10". Null en lo normal.
   */
  motivo: string | null
}

/** @deprecated Reemplazada por EntradaHistorial. Queda para la migracion. */
export interface HistorialProducto {
  id: string
  codigo: string
  campo: string
  valorAnterior: unknown
  valorNuevo: unknown
  quien: string
  quienNombre: string
  cuando: number
}

export interface Proveedor {
  id: string
  nombre: string
  contacto: string | null
  notas: string | null
  activo: boolean
  /**
   * Otros nombres con los que aparece este mismo proveedor.
   *
   * El id sale del nombre (ver lib/idProveedor.ts), asi que dos formas
   * de escribirlo que no se normalizan igual --"ARANDU" y "ARANDUPO"--
   * darian dos fichas distintas. Cargar el segundo como alias de la
   * ficha buena las junta, y mantiene juntas a las que vengan despues:
   * la importacion del Excel tambien mira los alias antes de crear.
   *
   * Es a proposito que esto sea un dato y no una regla en el codigo.
   * Cada caso nuevo se resuelve cargando el alias desde Proveedores,
   * sin tocar la app ni esperar una version nueva.
   */
  alias?: string[]
  /**
   * Como se le compra: por WhatsApp, por la pagina, en persona, por
   * viajante. No es un dato de color: define a quien hay que escribirle
   * y por donde, que es la mitad del trabajo de reponer mercaderia.
   */
  comoSeCompra?: string | null
  /** Pagina web o Instagram. */
  web?: string | null
  /** Alias o CBU para transferirle. */
  aliasCbu?: string | null
  /** A nombre de quien esta esa cuenta. */
  titular?: string | null
  ciudad?: string | null
  creadoEn?: number
  actualizadoEn?: number
}

/** Las formas en que se le compra a un proveedor. */
export const FORMAS_DE_COMPRA = [
  'WhatsApp',
  'Página web',
  'En persona',
  'Viajante',
  'Teléfono',
] as const

/** Una linea de producto dentro de una compra: lo que se lleva a stock. */
export interface ItemCompra {
  codigo: string
  descripcion: string
  cantidad: number
  costoUnitario: number
}

export type TipoMovimientoProveedor = 'compra' | 'pago'

/**
 * Cuenta corriente con un proveedor: una "compra" suma a lo que se le
 * debe (y ademas actualiza stock y costo de cada producto), un "pago"
 * lo descuenta (y ademas genera un gasto de caja grande, categoria
 * PROVEEDORES, para que aparezca en Gastos y en el margen del mes).
 */
export interface MovimientoProveedor {
  id: string
  proveedorId: string
  tipo: TipoMovimientoProveedor
  /** Fecha en formato yyyy-mm-dd. */
  fecha: string
  /** Total de la compra, o monto del pago. */
  monto: number
  /** Solo en pagos. */
  medioPago: MedioPago | null
  /** Solo en compras: que productos y cuanto de cada uno. */
  items: ItemCompra[] | null
  notas: string | null
  /**
   * Solo en pagos: el gasto que se genero en Gastos por este pago. Se
   * guarda para poder borrar los dos juntos si el pago se cargo mal, y
   * que no quede un gasto huerfano inflando el mes.
   */
  movimientoGastoId?: string | null
  creadoPor?: string | null
  creadoEn?: number
  actualizadoEn?: number
}

/**
 * El dueño miro una diferencia de caja y la dio por buena.
 *
 * No es una correccion: la diferencia queda como fue. Es la constancia
 * de que alguien con responsabilidad la vio y la acepto, con quien y
 * cuando, para que no quede flotando sin dueño.
 */
export interface VistoBuenoCierre {
  por: string
  porNombre: string
  /**
   * Con que rol se firmo. Un encargado autoriza de verdad, pero la
   * constancia tiene que decir que fue un encargado y no dar a entender
   * que lo miro un dueño: para eso sirve una constancia.
   *
   * Opcional porque las firmas anteriores a esto no lo tienen.
   */
  porRol?: Rol
  cuando: number
  comentario: string | null
}

/**
 * Un pedido para cerrar un turno tarde: quien atendio se olvido de
 * cerrar y lo quiere hacer despues, cuando ya arranco otro turno o ya
 * paso el dia.
 *
 * Guarda el conteo tal como lo hizo esa persona en el momento de pedir.
 * Cuando el dueño autoriza, el turno se cierra con EXACTAMENTE ese
 * conteo: si el dueño pudiera retocarlo, el pedido dejaria de ser una
 * constancia de lo que se conto y pasaria a ser una negociacion.
 */
export interface SolicitudCierre {
  /** El conteo de billetes que hizo quien pide, congelado. */
  arqueo: Arqueo
  /** Por que se cierra tarde. Obligatorio: es lo que el dueño lee. */
  motivo: string
  por: string
  porNombre: string
  cuando: number
  estado: 'pendiente' | 'rechazada'
  /** Solo cuando el dueño rechaza: quien y por que. */
  respuestaPorNombre?: string | null
  respuestaCuando?: number | null
  respuestaComentario?: string | null
}

/**
 * La constancia de que algo se borro a proposito.
 *
 * Existe por un motivo muy concreto: la subida inicial de cada
 * dispositivo manda al servidor TODO lo que el servidor no tenga. Es lo
 * que permite que un celular que estuvo sin señal ponga al dia lo suyo
 * --y tambien, sin esto, lo que hace que algo borrado vuelva a
 * aparecer--. Si alguien borra un turno desde la PC y en otro celular
 * todavia quedaba la copia local, al abrir la app ese celular lo ve
 * "faltando" en el servidor y lo vuelve a subir. El borrado se deshace
 * solo, sin que nadie toque nada.
 *
 * Con esta tabla, el que sube pregunta primero que fue borrado a
 * proposito y no lo resucita. Se lee del servidor, no de la copia
 * local, porque es justamente el caso en que la copia local esta
 * atrasada.
 */
export interface Borrado {
  /** `tabla/clave` de lo que se borro. */
  id: string
  tabla: NombreTabla
  clave: string
  cuando: number
  quien: string | null
  motivo: string | null
}

export interface Jornada {
  id: string
  /** Fecha en formato yyyy-mm-dd. */
  fecha: string
  turno: Turno
  estado: 'abierto' | 'cerrado'
  vendedor: string | null
  /** Efectivo con el que arranca la caja. */
  cajaInicial: number
  horaApertura: string | null
  horaCierre: string | null
  /** Conteo de billetes al abrir y al cerrar. */
  arqueoApertura: Arqueo | null
  arqueoCierre: Arqueo | null
  /**
   * Lo que anoto quien cerro, cuando la caja no dio justa: "le di mal
   * el vuelto a un cliente", "faltaba plata desde la mañana". Sirve
   * para que el dueño entienda antes de preguntar.
   */
  notaCierre?: string | null
  /**
   * El visto bueno del dueño sobre la diferencia de este cierre.
   * Mientras esta en null, el cierre figura pendiente de revisar.
   * Solo un dueño lo puede escribir (ver firestore.rules).
   */
  cierreAutorizado?: VistoBuenoCierre | null
  /**
   * Pedido de cierre tardio esperando --o rechazado por-- el dueño.
   * Mientras hay uno pendiente, el turno sigue abierto: la app no lo
   * cierra sola. Solo un dueño lo puede resolver (ver firestore.rules).
   */
  solicitudCierre?: SolicitudCierre | null
  notas: string | null
  creadoEn?: number
  actualizadoEn?: number
}

/** Cantidad de billetes por denominacion + un monto suelto de monedas. */
export interface Arqueo {
  billetes: Record<string, number>
  monedas: number
}

export interface Venta {
  id: string
  jornadaId: string
  fecha: string
  hora: string
  codigo: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  /**
   * Costo unitario congelado en el momento de la venta.
   * Es la clave para que el margen historico no cambie
   * cuando despues se actualiza el precio de compra.
   */
  costoUnitario: number | null
  medioPago: MedioPago
  total: number
  vendedor: string | null
  /**
   * Si este renglon es parte de un cambio de producto (ver
   * cambioProducto.ts): los dos renglones de un cambio comparten el id.
   * El que vuelve va en negativo, el que se lleva en positivo.
   */
  cambioId?: string | null
  cambio?: 'vuelve' | 'lleva' | null
  creadoEn?: number
  actualizadoEn?: number
}

export type TipoMovimiento =
  /** Plata que sale de la caja del turno (gastos chicos del dia). */
  | 'EGRESO_CAJA'
  /** Efectivo que se pasa de la caja del turno a la caja grande. */
  | 'A_CAJA_GRANDE'
  /** Gasto pagado desde la caja grande (alquiler, proveedores, servicios). */
  | 'GASTO_CAJA_GRANDE'
  /** Aporte de plata a la caja grande que no viene de ventas. */
  | 'INGRESO_CAJA_GRANDE'

export const CATEGORIAS_GASTO = [
  'ALQUILER',
  'SERVICIOS',
  'PROVEEDORES',
  'SUELDOS',
  'IMPUESTOS',
  'CONTADOR',
  'MANTENIMIENTO',
  'RETIRO SOCIOS',
  'OTROS',
] as const

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]

/**
 * De que cuenta del negocio sale (o entra) la plata.
 *
 * Es otra pregunta que `tipo`, y las dos hacen falta.
 *
 * `tipo` decide la ARITMETICA: EGRESO_CAJA sale del cajon del turno y
 * el cierre lo descuenta del efectivo esperado; GASTO_CAJA_GRANDE no
 * toca ese cajon. La app no lleva un saldo de caja grande: ese tipo
 * significa "es un gasto del negocio que no sale del cajon", nada mas.
 *
 * `cuenta` dice DE DONDE salio de verdad. Un pago por transferencia
 * desde el banco y uno desde Mercado Pago son los dos "no sale del
 * cajon", pero no son la misma plata, y a fin de mes hay que poder
 * conciliar cada cuenta con su resumen.
 *
 * Por eso el tipo se deriva de la cuenta --cajon es lo unico que toca
 * el turno-- y no al reves.
 */
export type CuentaDePago = 'cajon' | 'cajaGrande' | 'banco' | 'mercadoPago'

export const ETIQUETA_CUENTA: Record<CuentaDePago, string> = {
  cajon: 'Cajón del turno',
  cajaGrande: 'Caja grande',
  banco: 'Banco',
  mercadoPago: 'Mercado Pago',
}

/** Las cuentas que no tocan la caja del turno. */
export function tipoSegunCuenta(cuenta: CuentaDePago): TipoMovimiento {
  return cuenta === 'cajon' ? 'EGRESO_CAJA' : 'GASTO_CAJA_GRANDE'
}

export interface Movimiento {
  id: string
  fecha: string
  tipo: TipoMovimiento
  /**
   * De que cuenta salio la plata. Opcional: los movimientos cargados
   * antes del 21/10/2026 no la tienen, y los de la planilla vieja
   * tampoco. Sin esto no habia forma de decir "esto se pago por
   * Mercado Pago", que es por lo que quedaron tres movimientos sin
   * clasificar.
   */
  cuenta?: CuentaDePago | null
  concepto: string
  monto: number
  categoria: CategoriaGasto | null
  jornadaId: string | null
  /**
   * Un gasto fijo (alquiler, luz) no se descuenta del margen de contribucion:
   * se descuenta despues, para llegar al resultado del mes.
   * Un gasto variable (comisiones, packaging, flete) si afecta el margen.
   */
  esVariable: boolean
  creadoEn?: number
  actualizadoEn?: number
}

export interface Ajuste {
  clave: string
  valor: string
}

/**
 * "owner" ve y maneja todo el negocio. "empleado" (Gabriela) opera la caja
 * del dia a dia y mantiene los costos al dia, pero no ve numeros de
 * ganancia ni puede borrar cosas sin autorizacion.
 */
/**
 * owner    : dueño. Ademas de todo lo del encargado, es el unico que
 *            puede borrar los datos, importar un respaldo y decidir
 *            quien mas es dueño.
 * encargado: maneja la operacion completa --ganancias, autorizaciones,
 *            precios, proveedores, gastos y el equipo-- sin poder
 *            destruir el negocio ni repartirlo.
 * empleado : el dia a dia del mostrador, con las secciones que se le
 *            habiliten.
 *
 * Quien puede hacer que esta en src/sync/permisos.ts, en un solo lugar.
 */
export type Rol = 'owner' | 'encargado' | 'empleado'

/**
 * Secciones que un owner puede prender o apagar para un empleado en
 * particular (ademas de Caja/Productos/Proveedores/Gastos, que trae
 * habilitadas por defecto). "Mi dia" y "Ajustes" no entran aca: la
 * primera siempre esta disponible para un empleado, la segunda nunca.
 */
export const SECCIONES_CONFIGURABLES = [
  'panel',
  'caja',
  'productos',
  'proveedores',
  'gastos',
  'reportes',
] as const

export type SeccionId = (typeof SECCIONES_CONFIGURABLES)[number]

/** Lo que ve un empleado si nadie le toco nunca las secciones (comportamiento de siempre). */
export const SECCIONES_POR_DEFECTO_EMPLEADO: SeccionId[] = [
  'panel',
  'caja',
  'productos',
  'proveedores',
  'gastos',
]

/** Una persona con su propio login. El id es el uid de Firebase Auth. */
export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: Rol
  activo: boolean
  /**
   * Solo se usa si rol es "empleado". null/undefined = todavia nadie
   * los toco: se usan las secciones por defecto (asi una cuenta ya
   * creada antes de que existiera esto no pierde acceso a nada).
   */
  secciones?: SeccionId[] | null
  creadoEn?: number
  actualizadoEn?: number
}

/** Nombre de tabla tal como se usa en Firestore y en los ganchos de sync. */
export type NombreTabla =
  | 'productos'
  | 'jornadas'
  | 'ventas'
  | 'movimientos'
  | 'proveedores'
  | 'usuarios'
  | 'historialProductos'
  | 'movimientosProveedor'
  | 'historial'
  | 'borrados'

export type AccionCambio = 'guardar' | 'borrar'

/**
 * El motor de sincronizacion (src/sync/motor.ts) se engancha aca en vez
 * de que db.ts dependa de el. Asi la base de datos funciona sola, sin
 * Firebase, y el motor se activa solamente si esta vinculado.
 */
let alCambiar: ((tabla: NombreTabla, accion: AccionCambio, clave: string, doc: unknown) => void) | null =
  null

export function engancharSync(
  callback: (tabla: NombreTabla, accion: AccionCambio, clave: string, doc: unknown) => void,
): void {
  alCambiar = callback
}

/** Quien esta usando la app ahora mismo, segun el modulo de sesion (src/auth). */
export interface Autor {
  email: string
  nombre: string
  /** Con que rol hizo el cambio. Lo guarda el historial. */
  rol?: Rol
}

let obtenerAutor: (() => Autor | null) | null = null

/**
 * El modulo de sesion se engancha aca (igual que engancharSync) para que
 * db.ts pueda anotar quien crea/edita cada producto sin depender de
 * Firebase Auth directamente. Sin sesion iniciada (o sin nube configurada),
 * obtenerAutor() no esta enganchado y esos campos quedan sin anotar.
 */
export function engancharAutor(callback: () => Autor | null): void {
  obtenerAutor = callback
}

/**
 * Mientras se esta aplicando un cambio que llego DESDE la nube, hay que
 * evitar que los ganchos de escritura lo reenvien de vuelta a la nube:
 * eso generaria un eco infinito entre dispositivos.
 */
/**
 * Cuantos "aplicar cambio remoto" hay en curso ahora mismo.
 *
 * Era un booleano, y eso causo el peor error que tuvo esta app.
 *
 * comoRemoto es asincrono y se llama desde varios lados a la vez: los
 * ocho listeners de Firestore, la lista de precios y la carga de los
 * meses historicos. Con un booleano, el PRIMERO que terminaba lo ponia
 * en false mientras los demas seguian escribiendo, y desde ese instante
 * los datos que bajaban del servidor se registraban como ediciones
 * hechas a mano por quien estuviera logueado.
 *
 * Asi fue como el 14/10, en el primer login de Sandra, quedaron 1.506
 * cambios de productos a su nombre: era la sincronizacion inicial
 * trayendo los costos reales del servidor sobre un catalogo recien
 * sembrado sin costos. Ella no habia tocado nada.
 *
 * Con un contador, el modo remoto dura hasta que termina el ULTIMO, que
 * es lo que se queria decir desde el principio.
 *
 * Lo que este arreglo NO resuelve: el marcador sigue siendo global, asi
 * que una edicion hecha a mano justo mientras baja una sincronizacion se
 * toma por remota y no deja renglon. Es un problema mucho mas chico
 * --una edicion suelta contra 1.506 renglones falsos-- y para
 * resolverlo bien hay que pasar el marcador por cada escritura en vez de
 * tenerlo global. Queda anotado y no disimulado.
 */
let remotoEnCurso = 0

export function comoRemoto<T>(fn: () => Promise<T>): Promise<T> {
  remotoEnCurso++
  return fn().finally(() => {
    remotoEnCurso--
  })
}

/** Si en este momento se esta aplicando algo que vino del servidor. */
function esCambioRemoto(): boolean {
  return remotoEnCurso > 0
}

class BaseECDM extends Dexie {
  productos!: Table<Producto, string>
  jornadas!: Table<Jornada, string>
  ventas!: Table<Venta, string>
  movimientos!: Table<Movimiento, string>
  ajustes!: Table<Ajuste, string>
  proveedores!: Table<Proveedor, string>
  usuarios!: Table<Usuario, string>
  historialProductos!: Table<HistorialProducto, string>
  historial!: Table<EntradaHistorial, string>
  movimientosProveedor!: Table<MovimientoProveedor, string>
  borrados!: Table<Borrado, string>

  constructor() {
    super('el-club-del-mate')

    // v1 uso ids autoincrementales (numero). v2 pasa a ids propios (uuid),
    // necesarios para que dos dispositivos puedan crear datos sin internet
    // al mismo tiempo sin pisarse. Como la app recien se esta empezando a
    // usar, la migracion simplemente reconstruye los indices.
    this.version(1).stores({
      productos: 'codigo, descripcion, proveedor, busqueda, activo',
      jornadas: '++id, [fecha+turno], fecha, estado',
      ventas: '++id, jornadaId, fecha, codigo, medioPago',
      movimientos: '++id, fecha, tipo, categoria, jornadaId',
      ajustes: 'clave',
    })

    this.version(2)
      .stores({
        productos: 'codigo, descripcion, proveedor, busqueda, activo',
        jornadas: 'id, [fecha+turno], fecha, estado',
        ventas: 'id, jornadaId, fecha, codigo, medioPago',
        movimientos: 'id, fecha, tipo, categoria, jornadaId',
        ajustes: 'clave',
      })
      .upgrade(async (tx) => {
        // Los ids viejos eran numeros autoincrementales; los pasamos a
        // texto y actualizamos las referencias cruzadas (jornadaId).
        const mapaJornadas = new Map<number, string>()
        await tx
          .table('jornadas')
          .toCollection()
          .modify((j: Jornada & { id: unknown }) => {
            const idViejo = j.id as unknown as number
            const idNuevo = nuevoId()
            mapaJornadas.set(idViejo, idNuevo)
            j.id = idNuevo as unknown as string
          })
        await tx
          .table('ventas')
          .toCollection()
          .modify((v: Venta & { id: unknown }) => {
            v.id = nuevoId() as unknown as string
            v.jornadaId = (mapaJornadas.get(v.jornadaId as unknown as number) ??
              String(v.jornadaId)) as unknown as string
          })
        await tx
          .table('movimientos')
          .toCollection()
          .modify((m: Movimiento & { id: unknown }) => {
            m.id = nuevoId() as unknown as string
            if (m.jornadaId !== null && m.jornadaId !== undefined) {
              m.jornadaId = (mapaJornadas.get(m.jornadaId as unknown as number) ??
                String(m.jornadaId)) as unknown as string
            }
          })
      })

    // v3 agrega el modulo de Proveedores: un proveedor real (con su propio
    // id) en vez de un texto suelto en cada producto. Migra los nombres de
    // proveedor que ya estaban cargados (texto libre, con alguna variante
    // de mayusculas/espacios) a proveedores propiamente dichos, agrupando
    // los que tienen el mismo nombre normalizado.
    this.version(3)
      .stores({
        productos: 'codigo, descripcion, proveedor, proveedorId, busqueda, activo',
        jornadas: 'id, [fecha+turno], fecha, estado',
        ventas: 'id, jornadaId, fecha, codigo, medioPago',
        movimientos: 'id, fecha, tipo, categoria, jornadaId',
        ajustes: 'clave',
        proveedores: 'id, nombre, activo',
      })
      .upgrade(async (tx) => {
        const porNombre = new Map<string, Proveedor>()
        const ahora = Date.now()

        await tx
          .table('productos')
          .toCollection()
          .modify((p: Producto) => {
            const nombreCrudo = (p.proveedor ?? '').trim()
            if (!nombreCrudo) {
              p.proveedorId = null
              return
            }
            // El id sale del nombre, no de nuevoId(): asi dos
            // dispositivos que migran por separado llegan al mismo id
            // para el mismo proveedor. Con el id al azar, cada celular
            // creaba su propia copia de cada proveedor y despues los
            // cinco sincronizaban.
            const clave = idDeProveedor(nombreCrudo)
            let proveedor = porNombre.get(clave)
            if (!proveedor) {
              proveedor = {
                id: clave,
                nombre: nombreCrudo,
                contacto: null,
                notas: null,
                activo: true,
                creadoEn: ahora,
                actualizadoEn: ahora,
              }
              porNombre.set(clave, proveedor)
            }
            p.proveedorId = proveedor.id
          })

        await tx.table('proveedores').bulkAdd([...porNombre.values()])
      })

    // v4 agrega usuarios (roles) e historial de productos, para el reparto
    // de permisos entre dueños y empleados.
    this.version(4).stores({
      productos: 'codigo, descripcion, proveedor, proveedorId, busqueda, activo, archivado',
      jornadas: 'id, [fecha+turno], fecha, estado',
      ventas: 'id, jornadaId, fecha, codigo, medioPago',
      movimientos: 'id, fecha, tipo, categoria, jornadaId',
      ajustes: 'clave',
      proveedores: 'id, nombre, activo',
      usuarios: 'id, email, rol',
      historialProductos: 'id, codigo, cuando',
    })

    // v5 agrega el modulo de compras: cuenta corriente por proveedor
    // (compras que suman deuda + pagos que la descuentan).
    this.version(5).stores({
      productos: 'codigo, descripcion, proveedor, proveedorId, busqueda, activo, archivado',
      jornadas: 'id, [fecha+turno], fecha, estado',
      ventas: 'id, jornadaId, fecha, codigo, medioPago',
      movimientos: 'id, fecha, tipo, categoria, jornadaId',
      ajustes: 'clave',
      proveedores: 'id, nombre, activo',
      usuarios: 'id, email, rol',
      historialProductos: 'id, codigo, cuando',
      movimientosProveedor: 'id, proveedorId, fecha, tipo',
    })

    // v6: el historial pasa a cubrir las ocho entidades y no solo
    // productos. Tabla nueva en vez de ensanchar la vieja, porque
    // "historialProductos" con ventas y turnos adentro es un nombre que
    // miente, y los nombres que mienten se pagan despues.
    //
    // Indices: cuando (para ordenar y filtrar por fecha), quien (filtro
    // por usuario), tabla (filtro por tipo) y [tabla+clave] para ver la
    // historia de un producto o un turno puntual.
    this.version(6)
      .stores({
        productos: 'codigo, descripcion, proveedor, proveedorId, busqueda, activo, archivado',
        jornadas: 'id, [fecha+turno], fecha, estado',
        ventas: 'id, jornadaId, fecha, codigo, medioPago',
        movimientos: 'id, fecha, tipo, categoria, jornadaId',
        ajustes: 'clave',
        proveedores: 'id, nombre, activo',
        usuarios: 'id, email, rol',
        historialProductos: 'id, codigo, cuando',
        movimientosProveedor: 'id, proveedorId, fecha, tipo',
        historial: 'id, cuando, quien, tabla, [tabla+clave]',
      })
      .upgrade(async (tx) => {
        // Lo que haya en la tabla vieja se pasa a la nueva, para no
        // perder lo poco que alcanzo a grabarse desde que se arreglo.
        const viejas = await tx.table('historialProductos').toArray()
        if (viejas.length === 0) return
        await tx.table('historial').bulkPut(
          viejas.map((v: HistorialProducto) => ({
            id: v.id,
            tabla: 'productos' as NombreTabla,
            clave: v.codigo,
            accion: 'edito' as AccionHistorial,
            queEs: v.codigo,
            campo: v.campo,
            valorAnterior: v.valorAnterior,
            valorNuevo: v.valorNuevo,
            quien: v.quien,
            quienNombre: v.quienNombre,
            quienRol: null,
            cuando: v.cuando,
            motivo: null,
          })),
        )
      })

    // v7: la tabla de borrados. Sirve para que un dispositivo que
    // estuvo desconectado no resucite lo que se borro a proposito
    // mientras no miraba (ver la interfaz Borrado, arriba).
    this.version(7).stores({
      productos: 'codigo, descripcion, proveedor, proveedorId, busqueda, activo, archivado',
      jornadas: 'id, [fecha+turno], fecha, estado',
      ventas: 'id, jornadaId, fecha, codigo, medioPago',
      movimientos: 'id, fecha, tipo, categoria, jornadaId',
      ajustes: 'clave',
      proveedores: 'id, nombre, activo',
      usuarios: 'id, email, rol',
      historialProductos: 'id, codigo, cuando',
      movimientosProveedor: 'id, proveedorId, fecha, tipo',
      historial: 'id, cuando, quien, tabla, [tabla+clave]',
      borrados: 'id, cuando, tabla',
    })

    // Que campos se anotan cuando cambian, por tabla. El resto
    // (busqueda, actualizadoEn, los derivados) son ruido: ya se ven en
    // otro lado o no los decidio una persona.
    //
    // En jornadas estan los tres momentos que importan: estado cubre el
    // cierre, cierreAutorizado la autorizacion, y la apertura queda como
    // un 'creo'.
    const CAMPOS_POR_TABLA: Record<NombreTabla, readonly string[]> = {
      productos: [
        'descripcion',
        'precioCompra',
        'fechaCompra',
        'precioVenta',
        'fechaPrecioVenta',
        'rentabilidad',
        'proveedorId',
        'stock',
        'activo',
        'archivado',
        'descontinuado',
        'solicitudBorrado',
      ],
      // turno entra porque un turno abierto en el horario equivocado se
      // puede corregir (cambiarTurno.ts), y eso cambia en que caja del
      // dia cuenta: tiene que quedar escrito.
      jornadas: [
        'turno',
        'estado',
        'cajaInicial',
        'arqueoApertura',
        'arqueoCierre',
        'vendedor',
        'notaCierre',
        'cierreAutorizado',
        'solicitudCierre',
      ],
      // jornadaId entra porque una venta se puede pasar de un turno al
      // otro cuando se cargo en el equivocado, y eso mueve plata de una
      // caja a la otra: tiene que quedar escrito.
      ventas: ['codigo', 'descripcion', 'cantidad', 'precioUnitario', 'medioPago', 'jornadaId'],
      movimientos: ['tipo', 'concepto', 'monto', 'categoria', 'esVariable', 'cuenta'],
      proveedores: [
        'nombre',
        'contacto',
        'activo',
        'notas',
        'alias',
        'comoSeCompra',
        'web',
        'aliasCbu',
        'titular',
        'ciudad',
      ],
      // proveedorId esta en la lista porque mover una compra o un pago
      // de un proveedor a otro es mover PLATA de una cuenta corriente a
      // otra. Sin esto, unir dos fichas movia los saldos sin dejar
      // rastro, que es justo lo que el historial existe para evitar.
      movimientosProveedor: ['tipo', 'monto', 'fecha', 'concepto', 'proveedorId'],
      usuarios: ['nombre', 'email', 'rol', 'activo', 'secciones'],
      // Las dos tablas de historial no se registran a si mismas: un
      // registro del registro no agrega nada y crece sin freno.
      historialProductos: [],
      historial: [],
      // La constancia de un borrado no se edita: el renglon del
      // historial ya lo deja escrito el borrado en si.
      borrados: [],
    }

    /**
     * Que es el documento, en palabras. Se guarda en el renglon, no se
     * resuelve despues: si el documento se borro, ya no hay de donde
     * sacarle el nombre.
     */
    function describir(tabla: NombreTabla, clave: string, fila: Record<string, unknown>): string {
      const texto = (k: string) => (fila[k] == null ? '' : String(fila[k]))
      switch (tabla) {
        case 'productos':
          return texto('descripcion') || clave
        case 'jornadas': {
          const turno = texto('turno') === 'M' ? 'mañana' : 'tarde'
          return `Turno del ${texto('fecha')} a la ${turno}`
        }
        case 'ventas':
          return `Venta de ${texto('descripcion') || texto('codigo') || 'algo'}`
        case 'movimientos':
          return texto('concepto') || texto('tipo') || clave
        case 'proveedores':
          return texto('nombre') || clave
        case 'movimientosProveedor':
          return `${texto('tipo') === 'PAGO' ? 'Pago a' : 'Compra a'} proveedor`
        case 'usuarios':
          return texto('nombre') || texto('email') || clave
        default:
          return clave
      }
    }

    // Estos ganchos son el corazon de la sincronizacion: cada vez que se
    // crea, edita o borra un producto/jornada/venta/movimiento/proveedor/
    // usuario en CUALQUIER parte de la app, quedan registrados aca una sola
    // vez, sin tener que acordarse de llamar a nada especial desde cada
    // pantalla. Usamos this.onsuccess (no el cuerpo del hook) para que el
    // aviso de sync salga recien cuando la escritura local ya se confirmo.
    //
    // `borrados` va aca desde el 22/10. Antes no estaba: la constancia de
    // un borrado quedaba en el dispositivo que borraba y recien subia la
    // proxima vez que ese dispositivo iniciaba sesion (empujarTodoLocal).
    // Mientras tanto, cualquier otro que arrancara no la veia, y la
    // constancia existe justamente para esos otros.
    //
    // Las tablas que ya son una constancia no llevan historial propio:
    // seria anotar que se anoto.
    const sinHistorialPropio = new Set<string>(['historialProductos', 'historial', 'borrados'])
    for (const nombre of [
      'productos',
      'jornadas',
      'ventas',
      'movimientos',
      'proveedores',
      'usuarios',
      'historialProductos',
      'movimientosProveedor',
      'historial',
      'borrados',
    ] as const) {
      const tabla: Table<Record<string, unknown>, string> = this.table(nombre)

      tabla.hook('creating', function (
        this: CreatingHookContext<Record<string, unknown>, string>,
        _clave,
        obj,
      ) {
        const registro = obj
        const ahora = Date.now()
        if (!registro.creadoEn) registro.creadoEn = ahora
        registro.actualizadoEn = ahora
        if (nombre === 'productos' && !esCambioRemoto()) {
          const autor = obtenerAutor?.()
          if (autor && !registro.creadoPor) registro.creadoPor = autor.email
        }

        const autorCrea = esCambioRemoto() ? null : (obtenerAutor?.() ?? null)
        const avisarSyncCrea = !esCambioRemoto() && Boolean(alCambiar)

        if (autorCrea || avisarSyncCrea) {
          this.onsuccess = (claveFinal) => {
            if (autorCrea && !sinHistorialPropio.has(nombre)) {
              anotarEnHistorial([
                {
                  id: nuevoId(),
                  tabla: nombre,
                  clave: String(claveFinal),
                  accion: 'creo',
                  queEs: describir(nombre, String(claveFinal), registro),
                  campo: null,
                  valorAnterior: null,
                  valorNuevo: null,
                  quien: autorCrea.email,
                  quienNombre: autorCrea.nombre,
                  quienRol: autorCrea.rol ?? null,
                  cuando: Date.now(),
                  motivo: motivoActual,
                },
              ])
            }
            if (avisarSyncCrea) alCambiar!(nombre, 'guardar', String(claveFinal), registro)
          }
        }
      })

      tabla.hook('updating', function (
        this: UpdatingHookContext<Record<string, unknown>, string>,
        mods,
        clave,
        obj,
      ) {
        const combinados: Record<string, unknown> = {
          ...(mods as Record<string, unknown>),
          actualizadoEn: Date.now(),
        }

        // Anotamos quien edito y guardamos un renglon de historial por cada
        // campo que cambio, para poder responder "quien tocó esto y cuándo"
        // sin ambigüedad.
        const entradasHistorial: EntradaHistorial[] = []
        if (!esCambioRemoto() && !sinHistorialPropio.has(nombre)) {
          const autor = obtenerAutor?.()
          if (autor) {
            if (nombre === 'productos') combinados.actualizadoPor = autor.email
            const cambios = mods as Record<string, unknown>
            const antesTodo = obj as Record<string, unknown>
            // Archivar no es borrar, pero tampoco es una edicion mas: en
            // esta app es la forma de sacar algo de circulacion, asi que
            // se marca distinto para que se lea de un vistazo.
            const archivando =
              ('archivado' in cambios && cambios.archivado === true) ||
              ('activo' in cambios && cambios.activo === false)

            for (const campo of CAMPOS_POR_TABLA[nombre]) {
              if (!(campo in cambios)) continue
              const antes = antesTodo[campo]
              const despues = cambios[campo]
              if (mismoValor(antes, despues)) continue
              entradasHistorial.push({
                id: nuevoId(),
                tabla: nombre,
                clave: String(clave),
                accion: archivando ? 'archivo' : 'edito',
                queEs: describir(nombre, String(clave), antesTodo),
                campo,
                valorAnterior: antes ?? null,
                valorNuevo: despues ?? null,
                quien: autor.email,
                quienNombre: autor.nombre,
                quienRol: autor.rol ?? null,
                cuando: Date.now(),
                motivo: motivoActual,
              })
            }
          }
        }

        const avisarSync = !esCambioRemoto() && Boolean(alCambiar)
        if (avisarSync || entradasHistorial.length > 0) {
          const final = { ...obj, ...combinados }
          this.onsuccess = () => {
            anotarEnHistorial(entradasHistorial)
            if (avisarSync) alCambiar!(nombre, 'guardar', String(clave), final)
          }
        }
        return combinados
      })

      tabla.hook('deleting', function (
        this: DeletingHookContext<Record<string, unknown>, string>,
        clave,
        obj,
      ) {
        const autorBorra = esCambioRemoto() ? null : (obtenerAutor?.() ?? null)
        const avisarSyncBorra = !esCambioRemoto() && Boolean(alCambiar)

        if (autorBorra || avisarSyncBorra) {
          this.onsuccess = () => {
            if (autorBorra && !sinHistorialPropio.has(nombre)) {
              // Lo que se guarda es el documento ENTERO como estaba, no
              // solo su clave: una vez borrado no hay de donde sacarlo, y
              // "se borro la venta a3f9" sin mas no le sirve a nadie.
              anotarEnHistorial([
                {
                  id: nuevoId(),
                  tabla: nombre,
                  clave: String(clave),
                  accion: 'borro',
                  queEs: describir(nombre, String(clave), obj as Record<string, unknown>),
                  campo: null,
                  valorAnterior: obj ?? null,
                  valorNuevo: null,
                  quien: autorBorra.email,
                  quienNombre: autorBorra.nombre,
                  quienRol: autorBorra.rol ?? null,
                  cuando: Date.now(),
                  motivo: motivoActual,
                },
              ])
            }
            if (avisarSyncBorra) alCambiar!(nombre, 'borrar', String(clave), null)
          }
        }
      })
    }
  }
}

export const db = new BaseECDM()

/**
 * Guarda renglones de historial sin pelearse con la transaccion en curso.
 *
 * El problema que arregla: `db.productos.update(...)` abre una
 * transaccion que incluye SOLO la tabla productos. Escribir desde ahi en
 * historialProductos --que no esta en el alcance-- hace que Dexie tire
 * NotFoundError. El gancho lo intentaba igual y el error terminaba en un
 * console.warn, asi que la edicion se guardaba, el historial no, y nadie
 * se enteraba. La tabla estuvo dos meses en la app con cero registros
 * por esto.
 *
 * La solucion no es declarar las dos tablas en cada uno de los diez
 * lugares que editan un producto: alcanza con que alguien agregue el
 * once y vuelve el agujero. Se espera a que la transaccion commitee y
 * recien ahi se escribe, en una transaccion aparte.
 *
 * Esperar al commit tambien es lo correcto por otro motivo: si la
 * edicion se termina revirtiendo, no queda un renglon de historial
 * diciendo que paso algo que no paso.
 */
/**
 * De que operacion vienen los cambios que se estan haciendo ahora.
 *
 * Una edicion a mano no tiene motivo. Una importacion si: los 800
 * renglones que deja tienen que poder leerse como un bloque y no como
 * 800 ediciones sueltas de la misma persona en el mismo segundo.
 */
let motivoActual: string | null = null

/**
 * Corre algo dejando anotado en el historial de donde vinieron los
 * cambios.
 *
 * Se restaura en un finally: si la operacion falla, el motivo no queda
 * pegado contaminando las ediciones que vengan despues.
 */
export async function conMotivo<T>(motivo: string, fn: () => Promise<T>): Promise<T> {
  const anterior = motivoActual
  motivoActual = motivo
  try {
    return await fn()
  } finally {
    motivoActual = anterior
  }
}

/**
 * Si dos valores son el mismo para el historial.
 *
 * No alcanza con ===: los campos que mas importan de una jornada son
 * objetos (el arqueo, el visto bueno), y dos objetos distintos con el
 * mismo contenido darian un renglon de historial que dice que algo
 * cambio cuando no cambio nada.
 */
function mismoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  return false
}

/**
 * Id fijo del renglon que marca desde cuando el historial registra de
 * verdad. Fijo a proposito: todos los dispositivos escriben el mismo, y
 * al ser la misma clave no se duplica ni queda uno por aparato.
 */
export const ID_ARRANQUE_HISTORIAL = 'historial-arranca-2026-10-11'

/**
 * El dia en que el historial empezo a funcionar.
 *
 * Es una constante y no Date.now() porque cada dispositivo escribe el
 * mismo renglon: con la hora de cada uno, la fecha del arranque
 * cambiaria segun quien abrio la app ultimo.
 *
 * Y es la MEDIANOCHE de ese dia, no una hora cualquiera: el renglon
 * tiene que quedar ordenado antes que todos los cambios reales. Con el
 * mediodia, una edicion hecha a la mañana del mismo dia aparecia antes
 * del arranque, que es justo la confusion que este renglon viene a
 * evitar.
 */
const CUANDO_ARRANCO_EL_HISTORIAL = Date.parse('2026-10-11T00:00:00-03:00')

/**
 * Deja constancia de que el historial arranca en una fecha, y que antes
 * de eso no hay registro.
 *
 * Hace falta porque la tabla existio dos meses sin grabar nada (ver
 * anotarEnHistorial): sin este renglon, dentro de unos meses el silencio
 * anterior se lee como "no se toco nada", que es lo contrario de lo que
 * paso. Un registro que miente por omision es peor que no tenerlo.
 *
 * Se usa put y no add: si dos dispositivos lo escriben, la clave es la
 * misma y queda un solo renglon.
 */
export async function marcarArranqueDelHistorial(): Promise<void> {
  await comoRemoto(async () => {
    await db.historial.put({
      id: ID_ARRANQUE_HISTORIAL,
      tabla: 'historial',
      clave: ID_ARRANQUE_HISTORIAL,
      accion: 'creo',
      queEs: 'Arranque del historial',
      campo: null,
      valorAnterior: 'Antes de esta fecha no hay registro de cambios.',
      valorNuevo: 'Desde acá queda registrado quién cambió qué, y cuándo.',
      quien: 'sistema',
      quienNombre: 'El Club del Mate',
      quienRol: null,
      cuando: CUANDO_ARRANCO_EL_HISTORIAL,
      motivo: null,
    })
  })
}

/**
 * Cuantas escrituras de historial estan en el aire.
 *
 * Se incrementa SINCRONICAMENTE cuando el gancho decide anotar algo
 * --todavia dentro de la transaccion-- y se decrementa cuando la
 * escritura termino. Asi, para cuando el `await` de la edicion vuelve,
 * el contador ya refleja lo que falta.
 */
let historialPendiente = 0

/**
 * Espera a que terminen de aterrizar los renglones de historial.
 *
 * Hace falta porque el historial se escribe a proposito DESPUES de que
 * la transaccion que lo genero haya commiteado, asi que entre la edicion
 * y el renglon hay un salto. Quien necesite leer el historial
 * inmediatamente despues de editar --las pruebas, y el importador
 * cuando informa cuantos cambios dejo-- tiene que esperar esto.
 */
export async function historialAlDia(): Promise<void> {
  for (let vueltas = 0; vueltas < 200 && historialPendiente > 0; vueltas++) {
    await new Promise((listo) => setTimeout(listo, 0))
  }
}

function anotarEnHistorial(entradas: EntradaHistorial[]): void {
  if (entradas.length === 0) return

  historialPendiente++
  const guardar = () => {
    db.historial
      .bulkAdd(entradas)
      .catch((e) => console.warn('No se pudo guardar el historial:', e))
      .finally(() => {
        historialPendiente--
      })
  }

  const transaccion = Dexie.currentTransaction
  if (transaccion) {
    transaccion.on('complete', guardar)
  } else {
    guardar()
  }
}

/**
 * La ficha que corresponde a este nombre, mirando el nombre propio y
 * tambien los alias.
 *
 * Compara por id derivado y no por texto, asi que encuentra igual a
 * "Mohicano " cuando la ficha se llama "MOHICANO".
 */
export function buscarPorNombreOAlias(
  nombre: string,
  proveedores: Proveedor[],
): Proveedor | undefined {
  const buscado = idDeProveedor(nombre)
  return proveedores.find(
    (p) =>
      idDeProveedor(p.nombre) === buscado ||
      p.id === buscado ||
      (p.alias ?? []).some((a) => idDeProveedor(a) === buscado),
  )
}

/**
 * Devuelve el id del proveedor que se llama asi, creandolo si no esta.
 *
 * Es el unico lugar por donde se crea un proveedor a partir de un
 * nombre: lo usan el alta de Proveedores, el "+ Proveedor nuevo..." de
 * Productos y la importacion del Excel, que trae el proveedor por
 * nombre y va a pasar por aca varias decenas de veces.
 *
 * Que sea uno solo es lo que garantiza que los tres caminos lleguen al
 * mismo id para el mismo nombre. Si la importacion creara los suyos por
 * su cuenta, dejaria una segunda copia de cada proveedor que ya existe,
 * que es exactamente el lio que estamos limpiando.
 *
 * Busca primero por id --que ya es buscar por nombre, porque el id sale
 * del nombre-- y despues por el texto, para encontrar tambien a las
 * fichas viejas que todavia tienen un id al azar.
 */
export async function asegurarProveedor(nombreCrudo: string): Promise<string | null> {
  const nombre = nombreCrudo.trim()
  if (!nombre) return null

  const id = idDeProveedor(nombre)
  // Primero por id, que es lo barato. Si no esta, se recorren las
  // fichas: son algunas decenas, y ahi se miran los alias y los
  // nombres de las que todavia tienen un id al azar.
  const existente =
    (await db.proveedores.get(id)) ?? buscarPorNombreOAlias(nombre, await db.proveedores.toArray())
  if (existente) return existente.id

  await db.proveedores.add({
    id,
    nombre,
    contacto: null,
    notas: null,
    activo: true,
    creadoEn: Date.now(),
    actualizadoEn: Date.now(),
  })
  return id
}

/**
 * Agrupa por nombre (normalizado) los productos que todavia no tienen
 * proveedorId y crea un Proveedor por cada nombre distinto. Se usa la
 * primera vez que se siembra el catalogo en un dispositivo nuevo: la
 * migracion de Dexie (version 3) solo corre en dispositivos que ya
 * tenian datos, no cuando el catalogo se carga de cero desde el JSON.
 * No hace nada si ya existe algun proveedor (evita duplicar).
 */
export async function derivarProveedoresDesdeProductos(): Promise<number> {
  if ((await db.proveedores.count()) > 0) return 0

  const productos = await db.productos.toArray()
  const porNombre = new Map<string, Proveedor>()
  const ahora = Date.now()

  for (const p of productos) {
    const nombreCrudo = (p.proveedor ?? '').trim()
    if (!nombreCrudo) continue
    // Mismo criterio que la migracion: el id lo decide el nombre.
    const clave = idDeProveedor(nombreCrudo)
    let proveedor = porNombre.get(clave)
    if (!proveedor) {
      proveedor = {
        id: clave,
        nombre: nombreCrudo,
        contacto: null,
        notas: null,
        activo: true,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      porNombre.set(clave, proveedor)
    }
    if (p.proveedorId !== proveedor.id) {
      await db.productos.update(p.codigo, { proveedorId: proveedor.id })
    }
  }

  if (porNombre.size > 0) await db.proveedores.bulkAdd([...porNombre.values()])
  return porNombre.size
}

/** Un producto archivado no deberia aparecer en listados ni en la busqueda de Caja. */
export function productoVisible(p: Producto): boolean {
  return p.archivado !== true
}

export async function leerAjuste(clave: string, porDefecto = ''): Promise<string> {
  const fila = await db.ajustes.get(clave)
  return fila?.valor ?? porDefecto
}

export async function guardarAjuste(clave: string, valor: string): Promise<void> {
  await db.ajustes.put({ clave, valor })
}
