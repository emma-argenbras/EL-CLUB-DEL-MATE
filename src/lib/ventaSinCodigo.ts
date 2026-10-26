import type { Producto, Venta } from '../db/db'
import { normalizar } from './formato'

/**
 * Las ventas sin código: lo que se vende en el mostrador y todavía no
 * está en el catálogo.
 *
 * La app ya dejaba "Vender igual, sin código", y está bien que sea así:
 * frenar la venta con el cliente esperando para dar de alta un producto
 * termina en productos hechos a las apuradas. Pero hasta el 26/10 se
 * aceptaba cualquier texto, y se usaban productos comodín («SALDOS – DE
 * TODO», «DIF – Diferencia por cambio») para lo mismo: $100.700 que no
 * dicen qué salió.
 *
 * Tres cosas, aprobadas por Emmanuel:
 *   - la descripción tiene que decir qué es;
 *   - una lista para resolverlas después, asignando cada venta a su
 *     producto (así se corrigen solos el margen y el stock);
 *   - un aviso en el Panel, que incluye los productos comodín.
 */

/**
 * Desde cuándo se miran. Hasta agosto las ventas vienen de la planilla
 * vieja, importadas tal cual: lo que vale la pena resolver es lo que se
 * cargó en la app.
 */
export const VENTAS_SIN_CODIGO_DESDE = '2026-09-01'

/** Palabras que no dicen qué se vendió. */
const GENERICAS = new Set([
  'saldo', 'saldos', 'varios', 'varias', 'vario', 'todo', 'dif', 'diferencia', 'diferencias',
  'otro', 'otros', 'otra', 'otras', 'producto', 'productos', 'articulo', 'articulos',
  'mercaderia', 'cosa', 'cosas', 'item', 'items', 'venta', 'ventas', 'cambio', 'generico', 'x',
])

/** Las que no suman ni restan: "de todo" es tan genérico como "todo". */
const DE_RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'por', 'a', 'un', 'una', 'en'])

export const LARGO_MINIMO_DESCRIPCION = 4

/**
 * Qué le falta a la descripción de una venta sin código, o null si dice
 * qué es.
 */
export function problemaDescripcionSuelta(texto: string): string | null {
  const limpio = normalizar(texto).trim()
  if (limpio.replace(/[^a-z0-9]/g, '').length < LARGO_MINIMO_DESCRIPCION) {
    return 'Escribí qué es lo que se vende, por ejemplo «bombilla de alpaca».'
  }
  // Hace falta al menos una palabra que diga algo: que no sea generica
  // ni de relleno, y de tres letras o mas («saldos zz» no dice que es).
  const queDicenAlgo = limpio
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !DE_RELLENO.has(p) && !GENERICAS.has(p))
  if (queDicenAlgo.length === 0) {
    return `«${texto.trim()}» no dice qué salió. Escribí qué es, por ejemplo «bombilla de alpaca».`
  }
  return null
}

export function esVentaSinCodigo(v: Pick<Venta, 'codigo'>): boolean {
  return !v.codigo
}

/** Las ventas sin código a resolver, de la más nueva a la más vieja. */
export function ventasSinCodigo(ventas: Venta[], desde = VENTAS_SIN_CODIGO_DESDE): Venta[] {
  return ventas
    .filter((v) => esVentaSinCodigo(v) && v.fecha >= desde)
    .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
}

/**
 * Un producto comodín: tiene ventas pero no dice de quién es, cuánto
 * costó ni a cuánto se vende. Es el caso de «SALDOS – DE TODO» y «DIF –
 * Diferencia por cambio».
 */
export function esComodin(p: Producto): boolean {
  return (
    p.archivado !== true &&
    !p.proveedorId &&
    !p.proveedor &&
    (p.precioCompra === null || p.precioCompra === undefined) &&
    (p.precioVenta === null || p.precioVenta === undefined || p.precioVenta === 0)
  )
}

/** Los productos comodín que tienen ventas, con cuántas y por cuánto. */
export function comodinesConVentas(
  productos: Producto[],
  ventas: Venta[],
): { producto: Producto; ventas: number; monto: number }[] {
  const porCodigo = new Map<string, { ventas: number; monto: number }>()
  for (const v of ventas) {
    if (!v.codigo) continue
    const actual = porCodigo.get(v.codigo) ?? { ventas: 0, monto: 0 }
    actual.ventas += 1
    actual.monto += v.total
    porCodigo.set(v.codigo, actual)
  }
  return productos
    .filter((p) => esComodin(p) && porCodigo.has(p.codigo))
    .map((p) => ({ producto: p, ...porCodigo.get(p.codigo)! }))
    .sort((a, b) => b.monto - a.monto)
}
