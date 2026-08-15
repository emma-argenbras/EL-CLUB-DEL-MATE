import { db, guardarAjuste, leerAjuste, type Producto } from './db'

const CLAVE_SEMILLA = 'catalogo_sembrado'
const ARCHIVO = `${import.meta.env.BASE_URL}productos.seed.json`

/**
 * El catalogo original (1336 productos exportados de la planilla)
 * vive en un archivo aparte y no dentro del JS de la app:
 * asi la app abre rapido y el archivo se baja una sola vez.
 */
async function bajarSemilla(): Promise<Producto[]> {
  const respuesta = await fetch(ARCHIVO)
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer el catálogo (${respuesta.status})`)
  }
  return (await respuesta.json()) as Producto[]
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

  const productos = await bajarSemilla()
  await db.productos.bulkPut(productos)
  await guardarAjuste(CLAVE_SEMILLA, 'si')
  await guardarAjuste('catalogo_origen', 'JULIO 2026 nueva ECDM - CON BASE DE DATOS')
  return productos.length
}

/** Vuelve a cargar el catalogo original, pisando lo que haya con el mismo codigo. */
export async function resembrarCatalogo(): Promise<number> {
  const productos = await bajarSemilla()
  await db.productos.bulkPut(productos)
  await guardarAjuste(CLAVE_SEMILLA, 'si')
  return productos.length
}
