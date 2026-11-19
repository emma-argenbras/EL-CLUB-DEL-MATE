import { conMotivo, db, type Producto } from './db'
import { costoDesactualizado, precioAtrasado } from '../lib/calculos'
import { hoyISO, plata } from '../lib/formato'

/**
 * Corregir costos de a muchos, sin entrar producto por producto.
 *
 * Sandra actualiza costos mirando las facturas del proveedor: abre la
 * lista de ese proveedor y va corrigiendo los que estan vacios o
 * vencidos. Entrando y saliendo de cada ficha, de a 100 productos, eso
 * no se termina nunca.
 *
 * Se escriben DOS campos y nada mas --el costo y su fecha-- y solo en
 * los renglones que ella toca. El precio de venta, la rentabilidad, el
 * stock y el proveedor quedan como estan: esta pantalla corrige costos,
 * no es un editor de productos.
 */

export const MOTIVO_REVISION_COSTOS = 'Revisión de costos'

/** Por que este producto esta en la lista de trabajo. */
export type MotivoRevision = 'sin-costo' | 'vencido'

export interface ParaRevisar {
  producto: Producto
  motivo: MotivoRevision
}

/**
 * Los productos que hay que mirar, de un proveedor o de todos.
 *
 * Primero los que no tienen costo --ahi el margen directamente no se
 * puede calcular-- y despues los vencidos, del mas viejo al mas nuevo,
 * que es el orden en que conviene atacarlos.
 */
export function productosParaRevisar(
  productos: Producto[],
  proveedorId: string | null,
): ParaRevisar[] {
  const salida: ParaRevisar[] = []
  for (const producto of productos) {
    if (producto.archivado) continue
    // Un descontinuado no se repone: su costo viejo no le molesta a
    // nadie y llenaria la lista de trabajo con ruido.
    if (producto.descontinuado) continue
    if (proveedorId && producto.proveedorId !== proveedorId) continue
    if (producto.precioCompra == null) salida.push({ producto, motivo: 'sin-costo' })
    else if (costoDesactualizado(producto)) salida.push({ producto, motivo: 'vencido' })
  }

  return salida.sort((a, b) => {
    if (a.motivo !== b.motivo) return a.motivo === 'sin-costo' ? -1 : 1
    const fa = a.producto.fechaCompra ?? ''
    const fb = b.producto.fechaCompra ?? ''
    if (fa !== fb) return fa < fb ? -1 : 1
    return a.producto.codigo.localeCompare(b.producto.codigo)
  })
}

/** Como esta el costo de un producto en la planilla de su proveedor. */
export type EstadoDelCosto = MotivoRevision | 'al-dia'

export interface EnPlanilla {
  producto: Producto
  estado: EstadoDelCosto
}

export interface Planilla {
  filas: EnPlanilla[]
  /** Cuantos de ese proveedor no se muestran por estar descontinuados. */
  descontinuados: number
}

/**
 * La planilla de un proveedor (19/11): TODOS sus productos, no solo los
 * que tienen el costo vacio o vencido.
 *
 * Sale de mirar el Excel: un mes despues de dejarlo, cada entrega de un
 * proveedor se seguia anotando ahi (140 productos entre el 21/10 y el
 * 18/11). En el Excel los productos de un proveedor estan todos juntos y
 * actualizar una lista de precios es bajar por una columna; la revision
 * de costos mostraba solo los vencidos, y el ingreso de mercaderia pide
 * buscar cada producto. Esto es esa misma columna.
 *
 * Van en el orden de sus codigos, que es como estan en el Excel y en la
 * factura. Los archivados y los descontinuados no: no se reponen.
 */
export function planillaDelProveedor(productos: Producto[], proveedorId: string): Planilla {
  const filas: EnPlanilla[] = []
  let descontinuados = 0
  for (const producto of productos) {
    if (producto.proveedorId !== proveedorId || producto.archivado) continue
    if (producto.descontinuado) {
      descontinuados++
      continue
    }
    const estado: EstadoDelCosto =
      producto.precioCompra == null ? 'sin-costo' : costoDesactualizado(producto) ? 'vencido' : 'al-dia'
    filas.push({ producto, estado })
  }
  filas.sort((a, b) => a.producto.codigo.localeCompare(b.producto.codigo, 'es', { numeric: true }))
  return { filas, descontinuados }
}

export interface PrecioParaPoner {
  codigo: string
  descripcion: string
  actual: number
  sugerido: number
}

/**
 * Los productos de la planilla que se venden por debajo de lo que pide
 * su markup, con el costo al dia.
 *
 * En el Excel el precio se movia solo al cambiar el costo. Aca se
 * ofrece: uno por uno en su renglon, o todos juntos al final de la
 * planilla. Con el costo vencido o vacio no se ofrece nada: seria
 * remarcar sobre un numero que nadie confirmo.
 */
export function preciosParaPoner(filas: EnPlanilla[]): PrecioParaPoner[] {
  const lista: PrecioParaPoner[] = []
  for (const { producto, estado } of filas) {
    if (estado !== 'al-dia') continue
    const atrasado = precioAtrasado(producto)
    if (!atrasado) continue
    lista.push({
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      actual: atrasado.actual,
      sugerido: atrasado.sugerido,
    })
  }
  return lista
}

/**
 * Lo que se pregunta antes de poner varios precios de una: cuantos son,
 * de quien, y un ejemplo con sus dos numeros.
 */
export function preguntaAntesDePonerPrecios(lista: PrecioParaPoner[], proveedor: string): string {
  const cuantos = lista.length === 1 ? '1 producto' : `${lista.length} productos`
  const ej = lista[0]
  return (
    `Vas a cambiar el precio de venta de ${cuantos} de ${proveedor} al que pide su markup.` +
    (ej ? `\n\nPor ejemplo, ${ej.descripcion}: de ${plata(ej.actual)} a ${plata(ej.sugerido)}.` : '') +
    '\n\nQueda en el historial con el motivo. Acordate de cambiar las etiquetas en el local.'
  )
}

export interface ProveedorConCostos {
  /** '' es «sin proveedor». */
  id: string
  nombre: string
  /** Productos que se reponen: ni archivados ni descontinuados. */
  productos: number
  paraRevisar: number
}

/**
 * Los proveedores para elegir: primero los que tienen costos para
 * revisar, del que mas tiene al que menos (por donde conviene empezar);
 * despues el resto, por nombre, para encontrar al que acaba de entregar.
 */
export function proveedoresConCostos(
  productos: Producto[],
  proveedores: { id: string; nombre: string }[],
): ProveedorConCostos[] {
  const nombre = new Map(proveedores.map((p) => [p.id, p.nombre]))
  const cuenta = new Map<string, { productos: number; paraRevisar: number }>()
  for (const p of productos) {
    if (p.archivado || p.descontinuado) continue
    const id = p.proveedorId ?? ''
    const c = cuenta.get(id) ?? { productos: 0, paraRevisar: 0 }
    c.productos++
    if (p.precioCompra == null || costoDesactualizado(p)) c.paraRevisar++
    cuenta.set(id, c)
  }
  return [...cuenta.entries()]
    .map(([id, c]) => ({
      id,
      nombre: id ? (nombre.get(id) ?? `(ficha que no existe: ${id})`) : '(sin proveedor)',
      ...c,
    }))
    .sort(
      (a, b) =>
        Number(b.paraRevisar > 0) - Number(a.paraRevisar > 0) ||
        b.paraRevisar - a.paraRevisar ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )
}

/**
 * La fecha de una compra: un dia de verdad y no del futuro. En el Excel
 * anotaban la fecha de la factura, que no siempre es la del dia en que
 * la cargan.
 */
export function problemaDeLaFecha(fecha: string, hoy: string = hoyISO()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(`${fecha}T12:00:00`).getTime())) {
    return 'Elegí la fecha de la compra.'
  }
  if (fecha > hoy) return 'La fecha de la compra no puede ser futura.'
  return null
}

export type ResultadoGuardar =
  | { estado: 'guardado' }
  | { estado: 'no-existe' }
  /** Alguien lo cambio entre que se dibujo la lista y que ella guardo. */
  | { estado: 'cambio-mientras-tanto'; costoAhora: number | null }

/**
 * Guarda el costo de un producto, si nadie lo movio mientras tanto.
 *
 * `costoQueSeVeia` es el costo que la lista tenia dibujado cuando ella
 * escribio el nuevo. Si en el servidor ya es otro, alguien lo corrigio
 * en el medio --desde otro celular, o el propio motor de
 * sincronizacion-- y guardar seria pisarle el trabajo. En ese caso no
 * se escribe nada y se avisa, que es lo unico honesto: la pantalla no
 * puede saber cual de los dos es el bueno.
 */
export async function guardarCosto(
  codigo: string,
  costoNuevo: number,
  costoQueSeVeia: number | null,
  /** La fecha de la compra. Si no se dice, hoy. */
  fecha: string = hoyISO(),
): Promise<ResultadoGuardar> {
  const mal = problemaDeLaFecha(fecha)
  if (mal) throw new Error(mal)
  return conMotivo(MOTIVO_REVISION_COSTOS, async () => {
    const producto = await db.productos.get(codigo)
    if (!producto) return { estado: 'no-existe' } as const

    const costoAhora = producto.precioCompra ?? null
    if (costoAhora !== costoQueSeVeia) {
      return { estado: 'cambio-mientras-tanto', costoAhora } as const
    }

    await db.productos.update(codigo, { precioCompra: costoNuevo, fechaCompra: fecha })
    return { estado: 'guardado' } as const
  })
}

export const MOTIVO_COSTO_CONFIRMADO = 'Costo confirmado: sigue valiendo lo mismo'

/**
 * "Lo confirmé, sigue valiendo lo mismo".
 *
 * Un costo vencido no siempre cambió: muchas veces Sandra mira la
 * factura y el proveedor cobra lo mismo que hace seis meses. Hasta ahora
 * la única forma de sacarlo de la lista era volver a tipear el mismo
 * número, que es trabajo de más y una oportunidad más de equivocarse un
 * cero.
 *
 * Renueva SOLO la fecha. El costo no se escribe: si alguien lo cambió
 * mientras tanto, no se confirma nada (se confirmaría un número que ella
 * no vio). Queda en el historial con su propio motivo, para que se
 * distinga de una corrección.
 */
export async function confirmarCosto(
  codigo: string,
  costoQueSeVeia: number,
  /** La fecha de la compra. Si no se dice, hoy. */
  fecha: string = hoyISO(),
): Promise<ResultadoGuardar> {
  const mal = problemaDeLaFecha(fecha)
  if (mal) throw new Error(mal)
  return conMotivo(MOTIVO_COSTO_CONFIRMADO, async () => {
    const producto = await db.productos.get(codigo)
    if (!producto) return { estado: 'no-existe' } as const

    const costoAhora = producto.precioCompra ?? null
    if (costoAhora !== costoQueSeVeia) {
      return { estado: 'cambio-mientras-tanto', costoAhora } as const
    }

    await db.productos.update(codigo, { fechaCompra: fecha })
    return { estado: 'guardado' } as const
  })
}
