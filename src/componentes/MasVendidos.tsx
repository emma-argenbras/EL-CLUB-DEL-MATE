import { useLiveQuery } from 'dexie-react-hooks'
import { db, productoVisible, type Producto } from '../db/db'
import { hoyISO, plata } from '../lib/formato'
import { masVendidos } from '../lib/masVendidos'
import { sumarDias } from '../lib/tablero'
import { pideDescripcionAlVender } from '../lib/ventaSinCodigo'

/**
 * Lo que mas salio en los ultimos siete dias, a un toque, en la caja de la
 * compu (opcion B, 06/11). Tocar uno es lo mismo que elegirlo en el
 * buscador.
 */
export default function MasVendidos({ onElegir }: { onElegir: (p: Producto) => void }) {
  const hoy = hoyISO()
  const productos = useLiveQuery(async () => {
    const ventas = await db.ventas.where('fecha').between(sumarDias(hoy, -6), hoy, true, true).toArray()
    // Se piden de mas: alguno puede estar archivado o pausado.
    const codigos = masVendidos(ventas, 12)
    const encontrados = await db.productos.bulkGet(codigos)
    return encontrados
      .filter((p): p is Producto => p !== undefined && p.activo !== false && productoVisible(p))
      .slice(0, 6)
  }, [hoy])

  if (!productos || productos.length === 0) return null
  return (
    <>
      <p className="tarjeta-titulo" style={{ margin: '16px 0 8px' }}>
        Lo más vendido de la semana
      </p>
      <div className="mas-vendidos">
        {productos.map((p) => (
          <button key={p.codigo} className="mas-vendido" onClick={() => onElegir(p)}>
            <span className="mas-vendido-nombre">{p.descripcion}</span>
            <span className="silencio">
              {p.codigo}
              {pideDescripcionAlVender(p)
                ? ' · pide qué salió'
                : p.stock !== null && p.stock !== undefined
                  ? ` · quedan ${p.stock}`
                  : ''}
            </span>
            <strong>{p.precioVenta ? plata(p.precioVenta) : 'Precio a mano'}</strong>
          </button>
        ))}
      </div>
    </>
  )
}
