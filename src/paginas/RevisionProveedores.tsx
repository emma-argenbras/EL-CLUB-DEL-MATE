import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { armarPlanProveedores } from '../lib/planProveedores'
import { fechaLinda } from '../lib/formato'

/**
 * El estado real de los proveedores, y que habria que hacer.
 *
 * Esta pantalla NO cambia nada. Es a proposito: el arreglo mueve el
 * proveedor de cientos de productos de una, y eso se mira antes de que
 * pase. Cuando el plan este aprobado se agrega el boton de aplicar,
 * con su confirmacion y su motivo en el historial.
 */
/** "1 proveedor" / "3 proveedores", sin que quede "1 proveedores". */
function cuantos(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export default function RevisionProveedores() {
  const datos = useLiveQuery(async () => {
    const [proveedores, productos] = await Promise.all([
      db.proveedores.toArray(),
      db.productos.toArray(),
    ])
    return armarPlanProveedores(proveedores, productos)
  }, [])

  if (!datos) return <p className="vacio">Revisando…</p>

  const { activos, inactivos, duplicados, huerfanos, aCrear, aReactivar, sinProveedor } = datos
  const aReenganchar = huerfanos.filter((h) => h.seEnganchaA)

  return (
    <>
      <h2>Revisión de proveedores</h2>

      <div className="aviso aviso-ojo">
        Esta pantalla <strong>no toca nada</strong>. Muestra cómo están los datos hoy y qué
        habría que hacer. El arreglo se aplica después, con confirmación.
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Cómo están hoy</p>
        <div className="fila">
          <span className="fila-etiqueta">Proveedores cargados</span>
          <span className="fila-valor">{activos + inactivos}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Activos (los únicos que aparecen al editar un producto)</span>
          <span className={activos === 0 ? 'fila-valor negativo' : 'fila-valor'}>{activos}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Inactivos</span>
          <span className="fila-valor">{inactivos}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Proveedores repetidos (mismo nombre, distinto id)</span>
          <span className="fila-valor">{duplicados.length}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Proveedores que los productos usan y no existen</span>
          <span className="fila-valor">{huerfanos.length}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Productos sin proveedor asignado</span>
          <span className="fila-valor">{sinProveedor}</span>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">El plan, paso por paso</p>

        <Paso
          n={1}
          titulo={`Unificar ${cuantos(duplicados.length, 'proveedor repetido', 'proveedores repetidos')}`}
          detalle="Es el mismo proveedor cargado varias veces, con ids distintos. Se conserva el que más productos tiene y los demás le ceden sus productos; después se borran los que quedan vacíos."
        >
          {duplicados.map((d) => (
            <li className="item" key={d.sobrevive.proveedor.id} style={{ display: 'block' }}>
              <div className="item-titulo">{d.nombre}</div>
              <div className="item-sub">
                Queda 1 de {d.absorbidos.length + 1} · se mueven {d.productosAMover}{' '}
                {d.productosAMover === 1 ? 'producto' : 'productos'}
              </div>
              <div className="item-sub silencio">
                Conserva el de {d.sobrevive.productos}{' '}
                {d.sobrevive.productos === 1 ? 'producto' : 'productos'}; absorbe{' '}
                {d.absorbidos.map((a) => `${a.productos}`).join(' + ')}
              </div>
            </li>
          ))}
        </Paso>

        <Paso
          n={2}
          titulo={`Reenganchar ${cuantos(aReenganchar.length, 'proveedor perdido', 'proveedores perdidos')}`}
          detalle="Son productos que apuntan a un proveedor que no existe como ficha, pero que sí existe con el mismo nombre bajo otro id. No hay que crear nada: se los reapunta al que existe."
        >
          {aReenganchar.map((h) => (
            <li className="item" key={h.id}>
              <div className="item-titulo">{h.nombre}</div>
              <div className="item-sub">
                {h.productos} {h.productos === 1 ? 'producto' : 'productos'} · pasan a la ficha que
                ya existe
              </div>
            </li>
          ))}
        </Paso>

        <Paso
          n={3}
          titulo={`Crear ${cuantos(aCrear.length, 'proveedor que falta', 'proveedores que faltan')}`}
          detalle="De estos no quedó ninguna ficha en ningún lado: solo el nombre que los productos traen escrito. Se crean con ese nombre, activos, y sus productos quedan enganchados."
        >
          {aCrear.map((h) => (
            <li className="item" key={h.id}>
              <div className="item-titulo">{h.nombre ?? '(sin nombre)'}</div>
              <div className="item-sub">
                {h.productos} {h.productos === 1 ? 'producto' : 'productos'}
              </div>
            </li>
          ))}
        </Paso>
        <Paso
          n={4}
          titulo={`Reactivar ${cuantos(aReactivar.length, 'proveedor', 'proveedores')}`}
          detalle={
            aReactivar.length === 0
              ? 'Ninguno: los inactivos no tienen productos vigentes, así que quedan como están.'
              : 'Están inactivos pero todavía tienen productos que se venden. Mientras estén inactivos no aparecen en la lista al editar un producto, y por eso hoy solo se ve “Sin proveedor”. Va al final a propósito: después de unificar hay menos fichas que reactivar, así que de esta lista quedan solo las que sobrevivan al paso 1. Los que tienen todos sus productos descontinuados no se tocan: esa decisión fue a propósito.'
          }
        >
          {aReactivar.map((c) => (
            <li className="item" key={c.proveedor.id}>
              <div className="item-titulo">{c.proveedor.nombre}</div>
              <div className="item-sub">
                {c.vigentes} {c.vigentes === 1 ? 'producto vigente' : 'productos vigentes'} de{' '}
                {c.productos}
                {c.proveedor.creadoEn
                  ? ` · creado el ${fechaLinda(new Date(c.proveedor.creadoEn).toISOString().slice(0, 10))}`
                  : ''}
              </div>
            </li>
          ))}
        </Paso>

      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Todos los proveedores</p>
        <ul className="lista">
          {datos.conUso.map((c) => (
            <li className="item" key={c.proveedor.id}>
              <div>
                <div className="item-titulo">
                  {c.proveedor.nombre}
                  {c.proveedor.activo === false && <span className="chip"> inactivo</span>}
                </div>
                <div className="item-sub">
                  {c.productos === 0
                    ? 'sin productos'
                    : `${c.productos} ${c.productos === 1 ? 'producto' : 'productos'}, ${c.vigentes} vigentes`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

function Paso({
  n,
  titulo,
  detalle,
  children,
}: {
  n: number
  titulo: string
  detalle: string
  children: React.ReactNode
}) {
  const hay = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div style={{ marginTop: n === 1 ? 0 : 18 }}>
      <p style={{ fontWeight: 700, margin: '0 0 2px' }}>
        {n}. {titulo}
      </p>
      <p className="silencio" style={{ marginTop: 0 }}>
        {detalle}
      </p>
      {hay && <ul className="lista">{children}</ul>}
    </div>
  )
}
