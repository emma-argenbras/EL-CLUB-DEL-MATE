import { db, guardarAjuste, leerAjuste } from '../db/db'

/**
 * El borrador de una compra a medio cargar.
 *
 * Una compra se carga con la factura delante, línea por línea, y hasta
 * que se toca "Guardar compra" vive solo en la pantalla. Si en el medio
 * se cierra la app, se apaga el celular o alguien toca "Actualizar", se
 * pierde todo y hay que empezar de nuevo, con veinte productos.
 *
 * Mientras se carga, se guarda una copia en este dispositivo (en
 * `ajustes`, que no se sincroniza: es trabajo a medias de quien lo está
 * cargando, no un dato del negocio). Al volver a abrir la compra de ese
 * proveedor, se recupera. Al guardar la compra o al cancelarla, se borra.
 */

export interface LineaBorrador {
  codigo: string
  cantidad: string
  costoUnitario: string
}

export interface BorradorCompra {
  fecha: string
  lineas: LineaBorrador[]
  notas: string
  /** Cuándo se tocó por última vez, para decirlo al recuperarlo. */
  guardadoEn: number
}

export function claveBorradorCompra(proveedorId: string): string {
  return `borradorCompra:${proveedorId}`
}

/**
 * Si hay algo que valga la pena guardar. Una línea vacía con la
 * cantidad en 1 --como arranca el formulario-- no cuenta.
 */
export function tieneContenido(b: Pick<BorradorCompra, 'lineas' | 'notas'>): boolean {
  if (b.notas.trim() !== '') return true
  return b.lineas.some(
    (l) => l.codigo !== '' || l.costoUnitario.trim() !== '' || !['', '1'].includes(l.cantidad.trim()),
  )
}

export async function leerBorradorCompra(proveedorId: string): Promise<BorradorCompra | null> {
  const texto = await leerAjuste(claveBorradorCompra(proveedorId))
  if (!texto) return null
  try {
    const b = JSON.parse(texto) as BorradorCompra
    if (!Array.isArray(b.lineas) || b.lineas.length === 0 || !tieneContenido(b)) return null
    return b
  } catch {
    // Un borrador ilegible no puede frenar la carga de una compra.
    return null
  }
}

export async function guardarBorradorCompra(
  proveedorId: string,
  b: Omit<BorradorCompra, 'guardadoEn'>,
): Promise<void> {
  if (!tieneContenido(b)) {
    await descartarBorradorCompra(proveedorId)
    return
  }
  await guardarAjuste(claveBorradorCompra(proveedorId), JSON.stringify({ ...b, guardadoEn: Date.now() }))
}

export async function descartarBorradorCompra(proveedorId: string): Promise<void> {
  await db.ajustes.delete(claveBorradorCompra(proveedorId))
}
