import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * El Panel mira, no toca.
 *
 * Esto nace de un susto concreto. El 14/10 aparecieron 1.506 cambios de
 * productos en el historial a nombre de Sandra, el dia de su primer
 * login, y lo unico que ella habia hecho era apretar "Ir a resolverlo"
 * para mirar. La causa real era otra --el marcador de sincronizacion,
 * arreglado en db.ts-- pero la sospecha era perfectamente razonable: si
 * un boton que dice "ir a resolverlo" tambien resolviera, nadie podria
 * mirar los pendientes sin miedo.
 *
 * Asi que queda como regla verificada: ningun archivo del camino de la
 * auditoria escribe en los datos del negocio. Llevan a la pantalla
 * donde se arregla, y se arregla ahi, a la vista, producto por producto.
 *
 * Se revisa sobre el texto del archivo y no con una prueba de pantalla a
 * proposito: lo que hay que garantizar es que la escritura NO EXISTA,
 * y una prueba de pantalla solo puede mostrar que no paso por el camino
 * que se probo.
 *
 * db.ajustes queda permitido: son marcas del dispositivo --que hallazgo
 * se pospuso hasta cuando-- que no se sincronizan ni son datos del
 * negocio. Posponer un recordatorio no cambia un precio.
 */

const DEL_CAMINO_DE_LA_AUDITORIA = [
  'src/paginas/Panel.tsx',
  'src/componentes/ListaHallazgos.tsx',
  'src/componentes/RevisionCompleta.tsx',
  'src/lib/auditoria.ts',
  'src/lib/useAuditoria.ts',
]

/** Las tablas que son datos del negocio: las que viajan a la nube. */
const TABLAS_DEL_NEGOCIO = [
  'productos',
  'proveedores',
  'jornadas',
  'ventas',
  'movimientos',
  'movimientosProveedor',
  'usuarios',
  'historial',
]

const ESCRITURAS = ['add', 'put', 'update', 'delete', 'bulkAdd', 'bulkPut', 'bulkDelete', 'clear']

/** `db.productos.update(` y tambien `db.table('productos').update(`. */
function escriturasEn(fuente: string): string[] {
  const encontradas: string[] = []
  for (const tabla of TABLAS_DEL_NEGOCIO) {
    for (const metodo of ESCRITURAS) {
      // Se permite un salto de linea entre la tabla y el metodo porque
      // el formateador parte las cadenas largas.
      const directo = new RegExp(`db\\.${tabla}\\s*\\.\\s*${metodo}\\s*\\(`)
      if (directo.test(fuente)) encontradas.push(`db.${tabla}.${metodo}()`)
    }
  }
  if (/db\s*\.\s*table\s*\(/.test(fuente)) encontradas.push('db.table(...)')
  return encontradas
}

describe('el Panel mira y no toca', () => {
  it.each(DEL_CAMINO_DE_LA_AUDITORIA)('%s no escribe en los datos del negocio', (ruta) => {
    const fuente = readFileSync(resolve(process.cwd(), ruta), 'utf8')
    expect(escriturasEn(fuente)).toEqual([])
  })

  it('la revision encuentra una escritura si alguien la agrega', () => {
    // Sin esta prueba, la de arriba podria estar pasando porque el
    // detector no detecta nada.
    expect(escriturasEn('await db.productos.update(codigo, { precioCompra: 0 })')).toEqual([
      'db.productos.update()',
    ])
    expect(escriturasEn("await db.table('productos').clear()")).toEqual(['db.table(...)'])
    expect(escriturasEn('const todos = await db.productos.toArray()')).toEqual([])
  })
})
