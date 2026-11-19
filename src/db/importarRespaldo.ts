import { comoRemoto, db } from './db'
import { fechaLinda, numero } from '../lib/formato'

/**
 * Todo lo que entra en una copia manual. Cada vez que se suma una tabla
 * a la base hay que sumarla aca tambien, o esa informacion no viaja en el
 * respaldo (los usuarios no se incluyen: sus cuentas viven en Firebase
 * Auth, no en la base local, y restaurarlos sin sus logins no serviria).
 */
export const TABLAS_RESPALDO = [
  'productos',
  'proveedores',
  'movimientosProveedor',
  'jornadas',
  'ventas',
  'movimientos',
  'historialProductos',
  'ajustes',
] as const

export type TablaRespaldo = (typeof TABLAS_RESPALDO)[number]

export interface Respaldo extends Partial<Record<TablaRespaldo, unknown[]>> {
  app: string
  version: number
  fecha: string
}

/** Como se nombra cada tabla al decir cuanto trae el archivo. */
const NOMBRE: Record<TablaRespaldo, [string, string]> = {
  productos: ['producto', 'productos'],
  proveedores: ['proveedor', 'proveedores'],
  movimientosProveedor: ['compra o pago a proveedores', 'compras y pagos a proveedores'],
  jornadas: ['turno', 'turnos'],
  ventas: ['venta', 'ventas'],
  movimientos: ['gasto o movimiento de caja', 'gastos y movimientos de caja'],
  historialProductos: ['renglón del historial de productos', 'renglones del historial de productos'],
  ajustes: ['ajuste de este aparato', 'ajustes de este aparato'],
}

function esRespaldoDeLaApp(datos: unknown): datos is Respaldo {
  return typeof datos === 'object' && datos !== null && (datos as { app?: unknown }).app === 'el-club-del-mate'
}

/** Las tablas que el archivo trae de verdad (un respaldo viejo no las trae todas). */
function tablasPresentes(datos: Respaldo): TablaRespaldo[] {
  return TABLAS_RESPALDO.filter((t) => Array.isArray(datos[t]))
}

/**
 * Lo que se pregunta antes de importar: de cuando es el archivo, cuanto
 * trae, y que hace y que no hace. Importar reemplaza muchos registros de
 * una, asi que dice cuantos.
 */
export function preguntaAntesDeImportar(datos: unknown): string {
  if (!esRespaldoDeLaApp(datos)) throw new Error('El archivo no es un respaldo de esta app.')
  const cuanto = tablasPresentes(datos)
    .filter((t) => t !== 'ajustes' && t !== 'historialProductos')
    .map((t) => {
      const n = datos[t]!.length
      return `${numero(n)} ${n === 1 ? NOMBRE[t][0] : NOMBRE[t][1]}`
    })
  const deCuando = /^\d{4}-\d{2}-\d{2}/.test(datos.fecha ?? '') ? ` del ${fechaLinda(datos.fecha.slice(0, 10))}` : ''
  return (
    `Vas a reemplazar los datos de ESTE aparato por los del respaldo${deCuando}` +
    (cuanto.length > 0 ? `: ${cuanto.join(', ')}.` : '.') +
    '\n\nEn el servidor no se borra ni se pisa nada. Lo que el servidor ya tiene vuelve a bajar a este aparato la próxima vez que se abra la app; lo que tenga el archivo y el servidor no, se sube.' +
    '\n\n¿Seguís?'
  )
}

export interface ResultadoImportar {
  importadas: TablaRespaldo[]
  /** Las que el archivo no traia: quedan como estaban. */
  faltantes: TablaRespaldo[]
  filas: number
}

/**
 * Reemplaza los datos de ESTE aparato por los de un respaldo.
 *
 * Va marcado como remoto (ver comoRemoto en db.ts): no se sube nada y no
 * queda en el historial. Es a proposito, y hasta el 19/11 no era asi.
 *
 * Importar vacia cada tabla y la vuelve a llenar. Sin la marca, cada
 * fila que se vacia es un borrado que viaja al servidor y cada fila que
 * se llena es un alta: con la base real son decenas de miles de
 * escrituras, de a una, mas un renglon de historial por cada una. El
 * plan gratis de Firebase corta mucho antes de terminar, y el servidor
 * queda borrado a medias, para todos los aparatos.
 *
 * Y asi era. En la prueba contra los emuladores, con la version que
 * estaba publicada, importar un respaldo de dos productos con la sesion
 * abierta fue borrando el catalogo del servidor: de 1.283 productos a
 * 1.210 en un minuto, y seguia. Nadie lo habia usado con la
 * sincronizacion prendida, que se sepa.
 *
 * Lo que queda: el aparato muestra lo del archivo; el servidor manda
 * sobre todo lo que ya tiene (vuelve a bajar al abrir la app), y lo que
 * el archivo tenga y el servidor no, se sube como lo de cualquier
 * aparato atrasado. Recuperar el negocio entero desde un respaldo, si
 * algun dia hace falta, es otra herramienta: en lotes, contando y
 * preguntando.
 */
export async function importarRespaldo(datos: unknown): Promise<ResultadoImportar> {
  if (!esRespaldoDeLaApp(datos)) throw new Error('El archivo no es un respaldo de esta app.')
  // Un respaldo viejo (version 1) no trae proveedores ni cuenta
  // corriente: se importa igual lo que si tenga, sin vaciar el resto.
  const presentes = tablasPresentes(datos)
  let filas = 0
  if (presentes.length > 0) {
    await comoRemoto(
      presentes.map((t) => db.table(t)),
      async () => {
        for (const tabla of presentes) {
          await db.table(tabla).clear()
          await db.table(tabla).bulkPut(datos[tabla] as never[])
          filas += datos[tabla]!.length
        }
      },
    )
  }
  return { importadas: presentes, faltantes: TABLAS_RESPALDO.filter((t) => !presentes.includes(t)), filas }
}
