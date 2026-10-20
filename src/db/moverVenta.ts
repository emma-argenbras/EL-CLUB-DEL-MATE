import { conMotivo, db } from './db'

/**
 * Pasa una venta de un turno al otro, dentro del mismo dia.
 *
 * Por que tan acotado
 * -------------------
 * El caso real es uno solo: "la cargue en la mañana y era de la tarde".
 * Todo lo demas trae problemas que no valen la pena.
 *
 * **Solo el mismo dia**, porque la venta tiene su propia fecha y los
 * reportes suman POR FECHA mientras la caja cuenta POR TURNO. Moverla a
 * otro dia sin tocar las dos cosas deja el reporte y el arqueo
 * diciendo cosas distintas.
 *
 * **Solo entre turnos abiertos**, porque un turno cerrado se cerro
 * contando una plata: meterle --o sacarle-- una venta despues hace que
 * el arqueo que se firmo ya no corresponda con lo que deberia haber
 * habido. Si hace falta mover algo de un turno cerrado, primero se
 * reabre, y asi el cierre se vuelve a contar con la plata de verdad.
 */
export async function moverVenta(ventaId: string, jornadaDestinoId: string): Promise<void> {
  const venta = await db.ventas.get(ventaId)
  if (!venta) throw new Error('Esa venta ya no está.')
  if (venta.jornadaId === jornadaDestinoId) return

  const [origen, destino] = await Promise.all([
    db.jornadas.get(venta.jornadaId),
    db.jornadas.get(jornadaDestinoId),
  ])
  if (!destino) throw new Error('No encuentro el turno al que la querés pasar.')
  if (!origen) throw new Error('No encuentro el turno en el que está la venta.')
  if (origen.fecha !== destino.fecha) {
    throw new Error('Una venta solo se puede pasar entre turnos del mismo día.')
  }
  if (origen.estado !== 'abierto' || destino.estado !== 'abierto') {
    const cual = origen.estado !== 'abierto' ? 'en el que está' : 'al que la querés pasar'
    throw new Error(
      `El turno ${cual} está cerrado. Reabrí el turno primero, así el cierre se vuelve a contar con la plata de verdad.`,
    )
  }

  const nombre = (t: string) => (t === 'M' ? 'la mañana' : 'la tarde')
  await conMotivo(
    `Venta pasada de ${nombre(origen.turno)} a ${nombre(destino.turno)}`,
    async () => db.ventas.update(ventaId, { jornadaId: jornadaDestinoId }),
  )
}
