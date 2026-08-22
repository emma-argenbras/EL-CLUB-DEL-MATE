import {
  comoRemoto,
  db,
  derivarProveedoresDesdeProductos,
  guardarAjuste,
  leerAjuste,
  nuevoId,
  type Jornada,
  type Movimiento,
  type Producto,
  type Venta,
} from './db'

const CLAVE_SEMILLA = 'catalogo_sembrado'

/**
 * Un producto tal como viene del catalogo publico. Los nombres son de
 * una letra porque el mismo archivo lo baja el celular de un cliente.
 */
interface ProductoPublico {
  /** codigo */ c: string
  /** descripcion */ d: string
  /** precio de venta */ p: number
  /** texto normalizado para buscar */ b: string
}

/**
 * El catalogo vive en un archivo aparte y no dentro del JS de la app:
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
 * La primera vez que se abre la app carga el catalogo, para que un
 * dispositivo recien instalado no arranque con la pantalla vacia.
 *
 * Carga SOLO codigo, descripcion y precio de venta. El costo, la
 * rentabilidad y el proveedor no viajan en este archivo a proposito:
 * la app se publica en un hosting estatico, asi que cualquier archivo
 * que se sube queda a la vista de cualquiera que sepa la direccion. Los
 * numeros con los que se calcula el margen no pueden estar ahi.
 *
 * Esos datos llegan al iniciar sesion, desde el servidor, que es el
 * unico lugar donde estan protegidos por las reglas de Firestore. Un
 * dispositivo sin vincular queda con un catalogo para vender, sin los
 * numeros internos --que es exactamente lo que corresponde.
 *
 * Si ya hay productos cargados no toca nada: manda lo que hay.
 */
export async function sembrarCatalogo(): Promise<number> {
  if ((await leerAjuste(CLAVE_SEMILLA)) === 'si') return 0

  if ((await db.productos.count()) > 0) {
    await guardarAjuste(CLAVE_SEMILLA, 'si')
    return 0
  }

  const publicos = await bajarJSON<ProductoPublico[]>('catalogo.json')
  const productos: Producto[] = publicos.map((p) => ({
    codigo: p.c,
    descripcion: p.d,
    proveedor: null,
    proveedorId: null,
    fechaCompra: null,
    precioCompra: null,
    rentabilidad: null,
    precioVenta: p.p,
    fechaPrecioVenta: null,
    busqueda: p.b,
    stock: null,
    activo: true,
  }))
  await db.productos.bulkPut(productos)
  await guardarAjuste(CLAVE_SEMILLA, 'si')
  await guardarAjuste('catalogo_origen', 'catalogo publico (sin costos)')
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

const MARCA_HISTORICO = 'Importado desde la planilla de Google Sheets.'

/**
 * Se sube de numero cuando se corrige el importador y hay que volver a
 * cargar un mes que ya se habia importado. Las jornadas que cargo una
 * persona a mano nunca se tocan, se reconocen porque no tienen la marca.
 */
const VERSION_IMPORTACION = '4'

/**
 * Trae de la planilla un mes que la app todavia no tiene, o vuelve a
 * traer uno que se habia importado con una version vieja del script.
 *
 * A diferencia de sembrarHistorico (que solo corre en un dispositivo
 * recien instalado), esta funcion sirve con la app ya en uso: va turno
 * por turno y solo toca los que estan marcados como importados. Un turno
 * que abrio y cerro una persona desde la app queda intacto, aunque la
 * planilla tenga ese mismo dia cargado.
 */
export async function sincronizarMesImportado(mes: string): Promise<{
  jornadasNuevas: number
  jornadasActualizadas: number
  ventas: number
  movimientos: number
}> {
  const resultado = { jornadasNuevas: 0, jornadasActualizadas: 0, ventas: 0, movimientos: 0 }
  const clave = `historico_${mes}_version`
  if ((await leerAjuste(clave)) === VERSION_IMPORTACION) return resultado

  const datos = await bajarJSON<HistoricoMes>(`historico-${mes}.seed.json`)

  // Los gastos de caja grande no cuelgan de ningun turno: se reconocen
  // por fecha + concepto + monto para no cargarlos dos veces.
  const sueltos = datos.movimientos.filter((m) => m._jornadaIndice === null)
  const yaCargados = new Set(
    (await db.movimientos.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray()).map(
      (m) => `${m.fecha}|${m.concepto}|${m.monto}`,
    ),
  )

  await db.transaction('rw', db.jornadas, db.ventas, db.movimientos, async () => {
    for (const [indice, jornadaSeed] of datos.jornadas.entries()) {
      const existente = await db.jornadas
        .where('[fecha+turno]')
        .equals([jornadaSeed.fecha, jornadaSeed.turno])
        .first()

      // Turno cargado por una persona desde la app: no se toca nunca.
      if (existente && existente.notas !== MARCA_HISTORICO) continue

      let jornadaId: string
      if (existente) {
        jornadaId = existente.id
        await db.jornadas.update(jornadaId, {
          cajaInicial: jornadaSeed.cajaInicial,
          arqueoApertura: jornadaSeed.arqueoApertura,
          arqueoCierre: jornadaSeed.arqueoCierre,
        })
        // Se reemplaza lo que habia traido la version anterior del script.
        const viejas = await db.ventas.where('jornadaId').equals(jornadaId).primaryKeys()
        await db.ventas.bulkDelete(viejas as string[])
        const viejos = await db.movimientos.where('jornadaId').equals(jornadaId).primaryKeys()
        await db.movimientos.bulkDelete(viejos as string[])
        resultado.jornadasActualizadas++
      } else {
        jornadaId = nuevoId()
        await db.jornadas.add({ ...jornadaSeed, id: jornadaId })
        resultado.jornadasNuevas++
      }

      const ventas = datos.ventas
        .filter((v) => v._jornadaIndice === indice)
        .map(({ _jornadaIndice: _, ...resto }) => ({ ...resto, id: nuevoId(), jornadaId }))
      await db.ventas.bulkAdd(ventas)
      resultado.ventas += ventas.length

      const movimientos = datos.movimientos
        .filter((m) => m._jornadaIndice === indice)
        .map(({ _jornadaIndice: _, ...resto }) => ({ ...resto, id: nuevoId(), jornadaId }))
      await db.movimientos.bulkAdd(movimientos)
      resultado.movimientos += movimientos.length
    }

    for (const { _jornadaIndice: _, ...gasto } of sueltos) {
      if (yaCargados.has(`${gasto.fecha}|${gasto.concepto}|${gasto.monto}`)) continue
      await db.movimientos.add({ ...gasto, id: nuevoId(), jornadaId: null })
      resultado.movimientos++
    }
  })

  await guardarAjuste(clave, VERSION_IMPORTACION)
  return resultado
}

/** Campos que puede traer la lista de precios de la planilla. */
type CampoPrecio = 'precioCompra' | 'fechaCompra' | 'rentabilidad' | 'precioVenta' | 'fechaPrecioVenta'

interface CambioPrecio {
  codigo: string
  anterior: Partial<Record<CampoPrecio, unknown>>
  nuevo: Partial<Record<CampoPrecio, unknown>>
}

interface ParchePrecios {
  mes: string
  cambios: CambioPrecio[]
  nuevos: Producto[]
}

/**
 * Trae la lista de precios actualizada de la planilla "BASE DE DATOS
 * ECDM 2026" (ver scripts/actualizar-precios.py).
 *
 * Respeta lo que se haya editado desde la app: cada campo se pisa
 * solamente si lo guardado sigue siendo igual a lo que decia la lista
 * anterior. Si alguien ya corrigio ese costo a mano — o lo actualizo una
 * compra cargada en la cuenta corriente del proveedor — ese campo se
 * deja como esta, porque es mas nuevo que la planilla.
 */
export async function aplicarPreciosNuevos(mes: string): Promise<{
  actualizados: number
  nuevos: number
  respetados: number
}> {
  const resultado = { actualizados: 0, nuevos: 0, respetados: 0 }
  const clave = `precios_${mes}_aplicados`
  if ((await leerAjuste(clave)) === 'si') return resultado

  const parche = await bajarJSON<ParchePrecios>(`precios-${mes}.seed.json`)

  // comoRemoto: es la misma lista de precios para todos los dispositivos,
  // asi que cada uno la aplica igual por su cuenta. No tiene sentido
  // anotarlo en el historial a nombre de quien abrio la app, ni mandar
  // los mismos cambios a la nube desde cada telefono.
  await comoRemoto(async () => {
    await db.transaction('rw', db.productos, async () => {
      for (const cambio of parche.cambios) {
        const producto = await db.productos.get(cambio.codigo)
        if (!producto) continue

        const aplicar: Partial<Producto> = {}
        let respetado = false
        for (const [campo, valor] of Object.entries(cambio.nuevo) as [CampoPrecio, never][]) {
          if (producto[campo] === cambio.anterior[campo]) {
            aplicar[campo] = valor
          } else {
            respetado = true
          }
        }

        if (Object.keys(aplicar).length > 0) {
          await db.productos.update(cambio.codigo, aplicar)
          resultado.actualizados++
        }
        if (respetado) resultado.respetados++
      }

      for (const producto of parche.nuevos) {
        if (await db.productos.get(producto.codigo)) continue
        await db.productos.add(producto)
        resultado.nuevos++
      }
    })
  })

  if (resultado.nuevos > 0) await derivarProveedoresDesdeProductos()
  await guardarAjuste(clave, 'si')
  return resultado
}
