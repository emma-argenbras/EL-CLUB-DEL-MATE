import { esRecargo, type MotivoDiferencia, type Movimiento, type Venta } from '../db/db'
import { plata } from './formato'

/**
 * Lo que ayuda a cerrar la caja bien (punto 5 del pedido del 06/11).
 *
 * Hay 9 cierres con diferencia esperando visto bueno, por $ 644.700. La
 * mayoria se explica despues, mirando el dia a mano: una venta cargada
 * en efectivo que fue por transferencia, un egreso que no salio del
 * cajon, un billete mal contado. Esto hace esa mirada en el momento,
 * cuando todavia se puede corregir.
 */

/** Desde esta diferencia la app pide recontar antes de cerrar. */
export const UMBRAL_RECUENTO = 2000

export function pideRecuento(diferencia: number): boolean {
  return Math.abs(diferencia) >= UMBRAL_RECUENTO
}

export type { MotivoDiferencia }

export const MOTIVOS_DIFERENCIA: MotivoDiferencia[] = [
  'conteo',
  'vuelto',
  'venta-mal-cargada',
  'egreso-sin-cargar',
  'pase-sin-cargar',
  'no-se',
]

export const ETIQUETA_MOTIVO: Record<MotivoDiferencia, string> = {
  conteo: 'Error de conteo',
  vuelto: 'Vuelto mal dado',
  'venta-mal-cargada': 'Venta mal cargada',
  'egreso-sin-cargar': 'Egreso sin cargar',
  'pase-sin-cargar': 'Pase a caja grande sin cargar',
  'no-se': 'No sé',
}

const DENOMINACIONES_GRANDES = [20000, 10000, 2000, 1000]
const MAXIMO_DE_PISTAS = 4

const igual = (a: number, b: number) => Math.abs(a - b) < 1

/**
 * Movimientos del turno que explicarian la diferencia por si solos, en
 * criollo. Positiva: sobra plata. Negativa: falta.
 */
export function pistasDeLaDiferencia(
  diferencia: number,
  ventas: (Pick<Venta, 'id' | 'codigo' | 'descripcion' | 'hora' | 'total' | 'medioPago' | 'cambioId'> &
    Partial<Pick<Venta, 'pagos'>>)[],
  movimientos: Pick<Movimiento, 'tipo' | 'concepto' | 'monto'>[],
): string[] {
  if (igual(diferencia, 0)) return []
  const monto = Math.abs(diferencia)
  const pistas: string[] = []
  // Un renglon pagado con dos medios no tiene un medio para preguntar.
  // Y el recargo de una tarjeta no es una venta que se pueda haber cargado mal.
  const sueltas = ventas.filter(
    (v) => !v.cambioId && !((v.pagos?.length ?? 0) > 1) && !esRecargo(v),
  )

  if (diferencia < 0) {
    for (const v of sueltas) {
      if (v.medioPago === 'EFECTIVO' && igual(v.total, monto)) {
        pistas.push(
          `La venta de ${v.descripcion} de las ${v.hora} (${plata(v.total)}) está cargada en efectivo: ¿se cobró en efectivo, o fue con tarjeta o transferencia?`,
        )
      }
    }
    const vistas = new Map<string, number>()
    for (const v of sueltas) {
      if (v.medioPago !== 'EFECTIVO' || !igual(v.total, monto)) continue
      const clave = `${v.codigo}|${v.total}`
      vistas.set(clave, (vistas.get(clave) ?? 0) + 1)
    }
    for (const [clave, veces] of vistas) {
      if (veces < 2) continue
      const v = sueltas.find((x) => `${x.codigo}|${x.total}` === clave)!
      pistas.unshift(`La venta de ${v.descripcion} por ${plata(v.total)} está cargada ${veces} veces: ¿se vendió ${veces} veces, o se cargó de más?`)
    }
  } else {
    for (const v of sueltas) {
      if (v.medioPago !== 'EFECTIVO' && igual(v.total, monto)) {
        pistas.push(
          `La venta de ${v.descripcion} de las ${v.hora} (${plata(v.total)}) está cargada como ${v.medioPago}: ¿se cobró en efectivo?`,
        )
      }
    }
    for (const m of movimientos) {
      if (m.tipo === 'EGRESO_CAJA' && igual(m.monto, monto)) {
        pistas.push(`El egreso «${m.concepto}» de ${plata(m.monto)} descuenta del cajón: ¿esa plata salió de verdad del cajón?`)
      }
      if (m.tipo === 'A_CAJA_GRANDE' && igual(m.monto, monto)) {
        pistas.push(`El pase a caja grande de ${plata(m.monto)}: ¿se sacó de verdad del cajón?`)
      }
    }
  }

  const billete = DENOMINACIONES_GRANDES.find((d) => monto % d === 0 && monto / d <= 5)
  if (billete !== undefined) {
    pistas.push(
      `${diferencia < 0 ? 'Faltan' : 'Sobran'} justo ${plata(monto)}: ¿están bien contados los billetes de ${plata(billete)}?`,
    )
  }
  return pistas.slice(0, MAXIMO_DE_PISTAS)
}
