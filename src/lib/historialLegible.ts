import type { EntradaHistorial } from '../db/db'
import { plata } from './formato'

/*
 * Como se lee el historial en pantalla. Lo usan la pantalla del historial y
 * la ficha del producto (06/11).
 */

/** Nombres de campo como los lee una persona, no como se llaman en el código. */
export const ETIQUETA_CAMPO: Record<string, string> = {
  descripcion: 'nombre',
  precioCompra: 'costo',
  fechaCompra: 'fecha del costo',
  precioVenta: 'precio de venta',
  fechaPrecioVenta: 'fecha del precio',
  rentabilidad: 'markup',
  proveedorId: 'proveedor',
  stock: 'stock',
  activo: 'activo',
  archivado: 'archivado',
  descontinuado: 'descontinuado',
  solicitudBorrado: 'pedido de archivado',
  estado: 'estado del turno',
  cajaInicial: 'caja inicial',
  arqueoApertura: 'conteo de apertura',
  arqueoCierre: 'conteo de cierre',
  vendedor: 'vendedor',
  notaCierre: 'nota del cierre',
  cierreAutorizado: 'visto bueno',
  solicitudCierre: 'pedido de cierre',
  rol: 'rol',
  secciones: 'qué ve',
  nombre: 'nombre',
  email: 'mail',
  monto: 'monto',
  concepto: 'concepto',
  categoria: 'categoría',
  tipo: 'tipo',
}

/** Los campos que son plata, para mostrarlos con formato de plata. */
const CAMPOS_DE_PLATA = new Set([
  'precioCompra',
  'precioVenta',
  'monto',
  'cajaInicial',
  'precioUnitario',
])

export function etiquetaCampo(campo: string | null): string {
  if (!campo) return ''
  return ETIQUETA_CAMPO[campo] ?? campo
}

/**
 * Un valor como se lee en pantalla.
 *
 * Los objetos (un arqueo, un visto bueno) no se despliegan: ocuparian
 * media pantalla y no se leen. Se dice que cambiaron y listo.
 */
export function comoSeLee(valor: unknown, campo: string | null): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no'
  if (typeof valor === 'number' && campo && CAMPOS_DE_PLATA.has(campo)) return plata(valor)
  if (typeof valor === 'object') return '(cambió)'
  return String(valor)
}

/**
 * Los productos distintos que esa persona edito en ese mes (yyyy-mm). Lee
 * la tabla `historial`: la vieja, `historialProductos`, dejo de escribirse en
 * la version 6 y su contenido se paso a esta.
 */
export function productosEditadosEnElMes(entradas: EntradaHistorial[], email: string, mes: string): number {
  const codigos = new Set<string>()
  for (const h of entradas) {
    if (h.tabla !== 'productos' || h.quien !== email || h.accion !== 'edito') continue
    const d = new Date(h.cuando)
    const suyo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (suyo === mes) codigos.add(h.clave)
  }
  return codigos.size
}

/** Las fechas se mueven solas con cada costo o precio: en la ficha son ruido. */
const CAMPOS_QUE_NO_SE_MUESTRAN = new Set(['fechaCompra', 'fechaPrecioVenta', 'busqueda'])

/** Lo que se le cambio a un producto, lo mas nuevo primero (la ficha y el formulario). */
export function cambiosDelProducto(entradas: EntradaHistorial[]): EntradaHistorial[] {
  return entradas
    .filter((h) => h.accion === 'edito' && h.campo !== null && !CAMPOS_QUE_NO_SE_MUESTRAN.has(h.campo))
    .sort((a, b) => b.cuando - a.cuando)
}
