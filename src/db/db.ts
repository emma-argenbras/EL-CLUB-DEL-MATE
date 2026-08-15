import Dexie, { type Table } from 'dexie'

/**
 * Base de datos local (IndexedDB) del Club del Mate.
 *
 * Todo vive en el dispositivo: la app funciona sin internet.
 * El respaldo se hace exportando un archivo JSON desde Ajustes.
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

export interface Producto {
  codigo: string
  descripcion: string
  proveedor: string | null
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
}

export interface Jornada {
  id?: number
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
}

/** Cantidad de billetes por denominacion + un monto suelto de monedas. */
export interface Arqueo {
  billetes: Record<string, number>
  monedas: number
}

export interface Venta {
  id?: number
  jornadaId: number
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
  id?: number
  fecha: string
  tipo: TipoMovimiento
  concepto: string
  monto: number
  categoria: CategoriaGasto | null
  jornadaId: number | null
  /**
   * Un gasto fijo (alquiler, luz) no se descuenta del margen de contribucion:
   * se descuenta despues, para llegar al resultado del mes.
   * Un gasto variable (comisiones, packaging, flete) si afecta el margen.
   */
  esVariable: boolean
}

export interface Ajuste {
  clave: string
  valor: string
}

class BaseECDM extends Dexie {
  productos!: Table<Producto, string>
  jornadas!: Table<Jornada, number>
  ventas!: Table<Venta, number>
  movimientos!: Table<Movimiento, number>
  ajustes!: Table<Ajuste, string>

  constructor() {
    super('el-club-del-mate')
    this.version(1).stores({
      productos: 'codigo, descripcion, proveedor, busqueda, activo',
      jornadas: '++id, [fecha+turno], fecha, estado',
      ventas: '++id, jornadaId, fecha, codigo, medioPago',
      movimientos: '++id, fecha, tipo, categoria, jornadaId',
      ajustes: 'clave',
    })
  }
}

export const db = new BaseECDM()

export async function leerAjuste(clave: string, porDefecto = ''): Promise<string> {
  const fila = await db.ajustes.get(clave)
  return fila?.valor ?? porDefecto
}

export async function guardarAjuste(clave: string, valor: string): Promise<void> {
  await db.ajustes.put({ clave, valor })
}
