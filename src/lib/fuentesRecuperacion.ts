import type { Fuente, ValoresProducto } from '../db/recuperarProductos'

/**
 * Leer las fuentes de recuperacion que vienen en un archivo.
 *
 * Dos formatos, por dos motivos distintos:
 *
 *   - **JSON**, el que genero yo a partir de la foto que quedo en el
 *     historial de git. Ya viene limpio.
 *   - **CSV**, el que sale de exportar el Excel del negocio. Viene
 *     como viene, y eso es la mitad del trabajo de este archivo.
 *
 * Nada de esto se publica ni se guarda en el repositorio: el archivo
 * lo elige una persona desde su computadora y se lee en el navegador.
 */

/* ---------------------------- CSV ---------------------------- */

/**
 * Parte una linea de CSV respetando las comillas.
 *
 * Hace falta de verdad: hay descripciones con comillas adentro
 * --JUEGO "J" DOBLE CABO MADERA-- y al exportar quedan escapadas.
 * Partir por comas a lo bruto las rompe.
 */
export function partirLineaCSV(linea: string): string[] {
  const campos: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (entreComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          actual += '"'
          i++
        } else entreComillas = false
      } else actual += c
    } else if (c === '"') entreComillas = true
    else if (c === ',') {
      campos.push(actual)
      actual = ''
    } else actual += c
  }
  campos.push(actual)
  return campos
}

/**
 * Plata en formato argentino: " $1.111,20" -> 1111.2
 *
 * Devuelve null para cualquier cosa que no sea un numero, incluido
 * "SIN STOCK", que aparece escrito en la columna del precio.
 */
export function leerPlata(celda: string): number | null {
  const limpio = celda.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
  if (!limpio || !/^-?\d+(\.\d+)?$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

/** "165%" -> 1.65 */
export function leerPorcentaje(celda: string): number | null {
  const limpio = celda.replace(/[%\s]/g, '').replace(',', '.')
  if (!limpio || !/^-?\d+(\.\d+)?$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n / 100 : null
}

/**
 * Fecha a ISO, solo si esta completa.
 *
 * La planilla tiene cuatro formas en la misma columna: 22/08/2026,
 * 9/09/2026, 22/8/2026 y roturas como "22/8" --sin año-- o "21-12-24".
 * Las rotas se descartan: una fecha inventada es peor que ninguna,
 * porque de la fecha depende que un costo figure vencido o actual.
 */
export function leerFecha(celda: string): string | null {
  const m = celda.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mes, a] = m
  const dia = Number(d)
  const numeroMes = Number(mes)
  if (dia < 1 || dia > 31 || numeroMes < 1 || numeroMes > 12) return null
  return `${a}-${String(numeroMes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Lee el CSV de la "LISTA DE PRECIOS" del Excel del negocio.
 *
 * Columnas: CODIGOS, PRODUCTOS, PROVEEDOR, FECHA (compra),
 * PRECIO COMPRA, RENTABILIDAD, PRECIO VENTA, FECHA (venta).
 *
 * Se saltean las filas en blanco --separan un proveedor del
 * siguiente-- y las que no tienen codigo. Un codigo repetido no pisa
 * al primero: en la planilla hay codigos repetidos con productos
 * distintos, y para recuperar un costo no se puede elegir a ciegas.
 */
export function leerFuenteCSV(texto: string, nombre: string, fecha: string | null): Fuente {
  const valores = new Map<string, ValoresProducto>()
  const lineas = texto.split(/\r?\n/)

  for (const [i, linea] of lineas.entries()) {
    if (i === 0 || !linea.trim()) continue
    const campos = partirLineaCSV(linea)
    const codigo = (campos[0] ?? '').trim().toUpperCase()
    if (!codigo) continue
    if (valores.has(codigo)) continue

    const proveedor = (campos[2] ?? '').trim()
    const entrada: ValoresProducto = {}
    if (proveedor) entrada.proveedor = proveedor
    const fechaCompra = leerFecha(campos[3] ?? '')
    if (fechaCompra) entrada.fechaCompra = fechaCompra
    const precioCompra = leerPlata(campos[4] ?? '')
    if (precioCompra != null) entrada.precioCompra = precioCompra
    const rentabilidad = leerPorcentaje(campos[5] ?? '')
    if (rentabilidad != null) entrada.rentabilidad = rentabilidad

    if (Object.keys(entrada).length > 0) valores.set(codigo, entrada)
  }

  return { nombre, fecha, valores }
}

/* ---------------------------- JSON ---------------------------- */

interface ProductoDeArchivo {
  codigo: string
  proveedor?: string | null
  precioCompra?: number | null
  rentabilidad?: number | null
  fechaCompra?: string | null
}

/**
 * Lee un JSON con la forma de un respaldo de productos: una lista de
 * objetos con codigo y los campos que se quieran recuperar.
 */
export function leerFuenteJSON(texto: string, nombre: string, fecha: string | null): Fuente {
  const dato: unknown = JSON.parse(texto)
  const lista: ProductoDeArchivo[] = Array.isArray(dato)
    ? (dato as ProductoDeArchivo[])
    : ((dato as { productos?: ProductoDeArchivo[] }).productos ?? [])

  const valores = new Map<string, ValoresProducto>()
  for (const p of lista) {
    const codigo = (p?.codigo ?? '').trim().toUpperCase()
    if (!codigo || valores.has(codigo)) continue
    const entrada: ValoresProducto = {}
    if (typeof p.precioCompra === 'number') entrada.precioCompra = p.precioCompra
    if (typeof p.rentabilidad === 'number') entrada.rentabilidad = p.rentabilidad
    if (typeof p.fechaCompra === 'string' && p.fechaCompra) entrada.fechaCompra = p.fechaCompra
    if (typeof p.proveedor === 'string' && p.proveedor.trim()) entrada.proveedor = p.proveedor.trim()
    if (Object.keys(entrada).length > 0) valores.set(codigo, entrada)
  }
  return { nombre, fecha, valores }
}

/** Elige el lector segun como se llame el archivo. */
export function leerFuente(nombreArchivo: string, texto: string, fecha: string | null): Fuente {
  const nombre = nombreArchivo.replace(/\.(csv|json)$/i, '')
  return nombreArchivo.toLowerCase().endsWith('.csv')
    ? leerFuenteCSV(texto, nombre, fecha)
    : leerFuenteJSON(texto, nombre, fecha)
}
