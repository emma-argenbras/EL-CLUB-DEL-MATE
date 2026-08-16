import { db, guardarAjuste, leerAjuste, nuevoId, type Jornada, type Movimiento, type Producto, type Venta } from './db'

const CLAVE_SEMILLA = 'catalogo_sembrado'

/**
 * El catalogo original (1336 productos exportados de la planilla)
 * vive en un archivo aparte y no dentro del JS de la app:
 * asi la app abre rapido y el archivo se baja una sola vez.
 */
async function bajarJSON<T>(archivo: string): Promise<T> {
  const respuesta = await fetch(`${import.meta.env.BASE_URL}${archivo}`)
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer ${archivo} (${respuesta.status})`)
  }
  return (await respuesta.json()) as T
}

/**
 * La primera vez que se abre la app carga el catalogo que venia
 * de la planilla de Google Sheets. Si ya hay productos cargados,
 * no los pisa: manda lo que edito el usuario.
 */
export async function sembrarCatalogo(): Promise<number> {
  if ((await leerAjuste(CLAVE_SEMILLA)) === 'si') return 0

  if ((await db.productos.count()) > 0) {
    await guardarAjuste(CLAVE_SEMILLA, 'si')
    return 0
  }

  const productos = await bajarJSON<Producto[]>('productos.seed.json')
  await db.productos.bulkPut(productos)
  await guardarAjuste(CLAVE_SEMILLA, 'si')
  await guardarAjuste('catalogo_origen', 'JULIO 2026 nueva ECDM - CON BASE DE DATOS')
  return productos.length
}

/** Vuelve a cargar el catalogo original, pisando lo que haya con el mismo codigo. */
export async function resembrarCatalogo(): Promise<number> {
  const productos = await bajarJSON<Producto[]>('productos.seed.json')
  await db.productos.bulkPut(productos)
  await guardarAjuste(CLAVE_SEMILLA, 'si')
  return productos.length
}

interface VentaHistorica extends Omit<Venta, 'id' | 'jornadaId'> {
  _jornadaIndice: number
}
interface MovimientoHistorico extends Omit<Movimiento, 'id' | 'jornadaId'> {
  _jornadaIndice: number | null
}
interface HistoricoMes {
  mes: string
  jornadas: Omit<Jornada, 'id'>[]
  ventas: VentaHistorica[]
  movimientos: MovimientoHistorico[]
}

/**
 * Carga las jornadas, ventas y gastos que ya estaban anotados en la
 * planilla vieja para un mes puntual (hoy solo julio 2026), asi el
 * primer reporte de margen de contribucion no arranca en cero.
 *
 * Es prudente: si el negocio ya tiene turnos cargados (es decir, ya se
 * empezo a usar la app para cargar caja de verdad), no toca nada.
 */
export async function sembrarHistorico(mes: string): Promise<{
  jornadas: number
  ventas: number
  movimientos: number
}> {
  const clave = `historico_${mes}_sembrado`
  const vacio = { jornadas: 0, ventas: 0, movimientos: 0 }

  if ((await leerAjuste(clave)) === 'si') return vacio
  if ((await db.jornadas.count()) > 0) {
    await guardarAjuste(clave, 'si')
    return vacio
  }

  const datos = await bajarJSON<HistoricoMes>(`historico-${mes}.seed.json`)

  const idsJornadas = datos.jornadas.map(() => nuevoId())
  const jornadas: Jornada[] = datos.jornadas.map((j, i) => ({ ...j, id: idsJornadas[i] }))

  const ventas: Venta[] = datos.ventas.map((v) => {
    const { _jornadaIndice, ...resto } = v
    return { ...resto, id: nuevoId(), jornadaId: idsJornadas[_jornadaIndice] }
  })

  const movimientos: Movimiento[] = datos.movimientos.map((m) => {
    const { _jornadaIndice, ...resto } = m
    return {
      ...resto,
      id: nuevoId(),
      jornadaId: _jornadaIndice === null ? null : idsJornadas[_jornadaIndice],
    }
  })

  await db.transaction('rw', db.jornadas, db.ventas, db.movimientos, async () => {
    await db.jornadas.bulkAdd(jornadas)
    await db.ventas.bulkAdd(ventas)
    await db.movimientos.bulkAdd(movimientos)
  })

  await guardarAjuste(clave, 'si')
  return { jornadas: jornadas.length, ventas: ventas.length, movimientos: movimientos.length }
}
