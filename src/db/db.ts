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
  actualizadoEn?: number
}

export interface Proveedor {
  id: string
  nombre: string
  contacto: string | null
  notas: string | null
  activo: boolean
  creadoEn?: number
  actualizadoEn?: number
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

export interface Movimiento {
  id: string
  fecha: string
  tipo: TipoMovimiento
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

/** Nombre de tabla tal como se usa en Firestore y en los ganchos de sync. */
export type NombreTabla = 'productos' | 'jornadas' | 'ventas' | 'movimientos' | 'proveedores'

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

/**
 * Mientras se esta aplicando un cambio que llego DESDE la nube, hay que
 * evitar que los ganchos de escritura lo reenvien de vuelta a la nube:
 * eso generaria un eco infinito entre dispositivos.
 */
let aplicandoCambioRemoto = false

export function comoRemoto<T>(fn: () => Promise<T>): Promise<T> {
  aplicandoCambioRemoto = true
  return fn().finally(() => {
    aplicandoCambioRemoto = false
  })
}

class BaseECDM extends Dexie {
  productos!: Table<Producto, string>
  jornadas!: Table<Jornada, string>
  ventas!: Table<Venta, string>
  movimientos!: Table<Movimiento, string>
  ajustes!: Table<Ajuste, string>
  proveedores!: Table<Proveedor, string>

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
            const clave = nombreCrudo.toLowerCase()
            let proveedor = porNombre.get(clave)
            if (!proveedor) {
              proveedor = {
                id: nuevoId(),
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

    // Estos ganchos son el corazon de la sincronizacion: cada vez que se
    // crea, edita o borra un producto/jornada/venta/movimiento/proveedor en
    // CUALQUIER parte de la app, quedan registrados aca una sola vez, sin
    // tener que acordarse de llamar a nada especial desde cada pantalla.
    // Usamos this.onsuccess (no el cuerpo del hook) para que el aviso de
    // sync salga recien cuando la escritura local ya se confirmo.
    for (const nombre of ['productos', 'jornadas', 'ventas', 'movimientos', 'proveedores'] as const) {
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
        if (!aplicandoCambioRemoto && alCambiar) {
          this.onsuccess = (claveFinal) => alCambiar!(nombre, 'guardar', String(claveFinal), registro)
        }
      })

      tabla.hook('updating', function (
        this: UpdatingHookContext<Record<string, unknown>, string>,
        mods,
        clave,
        obj,
      ) {
        const combinados = { ...(mods as Record<string, unknown>), actualizadoEn: Date.now() }
        if (!aplicandoCambioRemoto && alCambiar) {
          const final = { ...obj, ...combinados }
          this.onsuccess = () => alCambiar!(nombre, 'guardar', String(clave), final)
        }
        return combinados
      })

      tabla.hook('deleting', function (
        this: DeletingHookContext<Record<string, unknown>, string>,
        clave,
      ) {
        if (!aplicandoCambioRemoto && alCambiar) {
          this.onsuccess = () => alCambiar!(nombre, 'borrar', String(clave), null)
        }
      })
    }
  }
}

export const db = new BaseECDM()

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
    const clave = nombreCrudo.toLowerCase()
    let proveedor = porNombre.get(clave)
    if (!proveedor) {
      proveedor = {
        id: nuevoId(),
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

export async function leerAjuste(clave: string, porDefecto = ''): Promise<string> {
  const fila = await db.ajustes.get(clave)
  return fila?.valor ?? porDefecto
}

export async function guardarAjuste(clave: string, valor: string): Promise<void> {
  await db.ajustes.put({ clave, valor })
}
