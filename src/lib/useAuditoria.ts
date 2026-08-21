import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento, type Venta } from '../db/db'
import { hoyISO, mesActualISO } from './formato'
import {
  auditar,
  hallazgosVisibles,
  type DatosAuditoria,
  type Hallazgo,
} from './auditoria'
import { seccionesVisibles } from '../sync/sesion'
import { useEstadoNube } from '../sync/useEstadoNube'
import { useSesion } from '../sync/useSesion'

/** Prefijo de la clave con que se guarda un hallazgo pospuesto. */
const PREFIJO_POSPUESTO = 'pospuesto_'

/** El mes anterior a uno dado, en formato yyyy-mm. */
function mesAnteriorA(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number)
  const fecha = new Date(anio, numero - 1, 1)
  fecha.setMonth(fecha.getMonth() - 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

function agrupar<T>(filas: T[], clave: (fila: T) => string | null): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const fila of filas) {
    const id = clave(fila)
    if (!id) continue
    const actual = mapa.get(id)
    if (actual) actual.push(fila)
    else mapa.set(id, [fila])
  }
  return mapa
}

export interface ResultadoAuditoria {
  cargando: boolean
  /** Lo que esta persona puede ver y resolver, sin lo pospuesto. */
  hallazgos: Hallazgo[]
  /** Cuantos hay guardados para mas adelante. */
  pospuestos: number
  /**
   * Lo que se le paso al motor. La revision completa lo usa para saber
   * que controles no se pudieron correr, que es distinto de que hayan
   * dado bien.
   */
  datos?: DatosAuditoria
}

/**
 * Corre la auditoria del negocio con los datos en vivo y devuelve solo
 * lo que esta persona puede ver y resolver. Lo usan el Panel, la campana
 * y los pendientes de Mi dia, para que los tres digan siempre lo mismo.
 */
export function useAuditoria(): ResultadoAuditoria {
  const sesion = useSesion()
  const nube = useEstadoNube()
  const esOwner = sesion.perfil?.rol === 'owner'
  const secciones = seccionesVisibles(sesion.perfil)

  const hoy = hoyISO()
  const mes = mesActualISO()
  const anterior = mesAnteriorA(mes)

  const datos = useLiveQuery(async () => {
    const [
      productos,
      proveedores,
      jornadas,
      ventasMes,
      movimientosMes,
      movimientosMesAnterior,
      cuentaCorriente,
      pospuestos,
    ] = await Promise.all([
      db.productos.toArray(),
      db.proveedores.toArray(),
      db.jornadas.toArray(),
      db.ventas.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
      db.movimientos.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
      db.movimientos.where('fecha').between(`${anterior}-00`, `${anterior}-32`).toArray(),
      db.movimientosProveedor.toArray(),
      db.ajustes.where('clave').startsWith(PREFIJO_POSPUESTO).toArray(),
    ])

    // Para calcular la diferencia de caja hace falta lo de cada turno
    // cerrado del mes, no solo lo del mes en general.
    const idsDelMes = new Set(
      jornadas.filter((j) => j.fecha.startsWith(mes)).map((j) => j.id),
    )
    const ventasDeTurnos: Venta[] = ventasMes.filter((v) => idsDelMes.has(v.jornadaId))
    const movimientosDeTurnos: Movimiento[] = movimientosMes.filter(
      (m) => m.jornadaId && idsDelMes.has(m.jornadaId),
    )

    return {
      productos,
      proveedores,
      jornadas,
      ventasMes,
      movimientosMes,
      movimientosMesAnterior,
      cuentaCorriente,
      ventasPorJornada: agrupar(ventasDeTurnos, (v) => v.jornadaId),
      movimientosPorJornada: agrupar(movimientosDeTurnos, (m) => m.jornadaId),
      // Un hallazgo pospuesto vuelve a aparecer cuando llega la fecha.
      silenciados: new Set(
        pospuestos
          .filter((a) => a.valor > hoy)
          .map((a) => a.clave.slice(PREFIJO_POSPUESTO.length)),
      ),
    }
  }, [mes, anterior, hoy])

  return useMemo(() => {
    if (!datos) return { cargando: true, hallazgos: [], pospuestos: 0, datos: undefined }

    const entrada: DatosAuditoria = {
      productos: datos.productos,
      proveedores: datos.proveedores,
      jornadas: datos.jornadas,
      ventas: datos.ventasMes,
      movimientos: datos.movimientosMes,
      movimientosMesAnterior: datos.movimientosMesAnterior,
      ventasPorJornada: datos.ventasPorJornada,
      movimientosPorJornada: datos.movimientosPorJornada,
      cuentaCorriente: datos.cuentaCorriente,
      estadoNube: nube.estado,
      errorNube: nube.error,
      hoy,
      mes,
    }
    const todos = auditar(entrada)

    const mios = hallazgosVisibles(todos, esOwner, secciones)
    return {
      cargando: false,
      hallazgos: mios.filter((h) => !datos.silenciados.has(h.id)),
      pospuestos: mios.filter((h) => datos.silenciados.has(h.id)).length,
      // La revision completa lo necesita para saber que controles no
      // se pudieron correr (por ejemplo, la nube sin configurar).
      datos: entrada,
    }
    // secciones se recrea en cada render; se compara por contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, nube.estado, nube.error, esOwner, secciones.join(','), hoy, mes])
}

/** Guarda un hallazgo para que no moleste hasta la fecha indicada. */
export async function posponerHallazgo(id: string, hastaISO: string): Promise<void> {
  await db.ajustes.put({ clave: `${PREFIJO_POSPUESTO}${id}`, valor: hastaISO })
}

/** Vuelve a mostrar todo lo que se habia pospuesto. */
export async function reactivarPospuestos(): Promise<void> {
  const claves = await db.ajustes.where('clave').startsWith(PREFIJO_POSPUESTO).primaryKeys()
  await db.ajustes.bulkDelete(claves as string[])
}
