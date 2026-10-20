import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { nubeConfigurada } from '../sync/config'
import { esDueno } from '../sync/permisos'
import { useSesion } from '../sync/useSesion'
import {
  aplicarPlanProveedores,
  textoDeConfirmacion,
  type ResultadoLimpieza,
} from '../db/limpiarProveedores'
import { armarPlanProveedores } from '../lib/planProveedores'

/** "1 producto" / "3 productos", sin que quede "1 productos". */
function cuantos(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * El estado real de los proveedores, y que habria que hacer.
 *
 * Esta pantalla NO cambia nada. Es a proposito: el arreglo mueve el
 * proveedor de cientos de productos de una, y eso se mira antes de que
 * pase. Cuando el plan este aprobado se agrega el boton de aplicar,
 * con su confirmacion y su motivo en el historial.
 */
export default function RevisionProveedores() {
  const sesion = useSesion()
  const [trabajando, setTrabajando] = useState(false)
  const [hecho, setHecho] = useState<ResultadoLimpieza | null>(null)
  const [error, setError] = useState<string | null>(null)

  const plan = useLiveQuery(async () => {
    const [proveedores, productos] = await Promise.all([
      db.proveedores.toArray(),
      db.productos.toArray(),
    ])
    return armarPlanProveedores(proveedores, productos)
  }, [])

  if (!plan) return <p className="vacio">Revisando…</p>

  const hoy = plan.activos + plan.inactivos
  const hayQueHacer =
    plan.unificar.length + plan.reenganchar.length + plan.crear.length + plan.reactivar.length > 0

  // El historial solo anota si hay alguien a quien atribuirle el
  // cambio. Una limpieza que toca cientos de productos sin dejar
  // constancia es justo lo que el historial existe para que no pase,
  // asi que con la nube configurada y sin sesion el boton no va.
  const hayQuienFirme = !nubeConfigurada || Boolean(sesion.perfil)

  // Aplicar el plan reescribe cientos de productos de una. Desde el
  // 20/10 el orden de los proveedores se hace a mano, asi que este
  // boton no es una herramienta del dia a dia: es la salida de
  // emergencia, y queda del lado del dueño. La revision --que es la
  // lista de trabajo-- la sigue viendo un encargado completa.
  const puedeAplicar = esDueno(sesion.perfil)

  async function aplicar() {
    if (!plan || !confirm(textoDeConfirmacion(plan))) return
    setTrabajando(true)
    setError(null)
    try {
      setHecho(await aplicarPlanProveedores())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <>
      <h2>Revisión de proveedores</h2>

      {hecho ? (
        <div className="aviso aviso-ok">
          <strong>Listo.</strong> Quedaron {hecho.fichasFinales} fichas y {hecho.productosTocados}{' '}
          productos pasaron a su proveedor. Está todo en el historial como «Limpieza de
          proveedores».
        </div>
      ) : (
        <div className="aviso aviso-ojo">
          Acá está el plan con los números de tu base. <strong>No se cambia nada</strong> hasta
          que toques el botón del final y confirmes.
        </div>
      )}

      {error && (
        <div className="aviso aviso-error">
          No se pudo aplicar: {error}. No quedó nada a medias — o se hace todo o no se hace nada.
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Cómo están hoy</p>
        <div className="fila">
          <span className="fila-etiqueta">Fichas de proveedor</span>
          <span className="fila-valor">{hoy}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Activas (las únicas que aparecen al editar un producto)</span>
          <span className={plan.activos === 0 ? 'fila-valor negativo' : 'fila-valor'}>
            {plan.activos}
          </span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Inactivas</span>
          <span className="fila-valor">{plan.inactivos}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Proveedores que los productos usan y no tienen ficha</span>
          <span className="fila-valor">{plan.idsPerdidos.length}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Productos sin proveedor asignado</span>
          <span className="fila-valor">{plan.sinProveedor}</span>
        </div>
        <div className="fila destacada">
          <span className="fila-etiqueta">Fichas al terminar el plan</span>
          <span className="fila-valor">
            {hoy} → {plan.fichasFinales}
          </span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Productos que cambian de proveedor</span>
          <span className="fila-valor">{plan.productosAfectados}</span>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">El plan, paso por paso</p>

        <Paso
          n={1}
          primero
          titulo={`Unificar ${cuantos(plan.unificar.length, 'ficha', 'fichas')}`}
          detalle="Las copias del mismo proveedor se juntan en una sola: sobrevive la que más productos tiene (a igualdad, la más vieja) y las demás le ceden los suyos. Además, cada ficha pasa a tener un id derivado de su nombre, así dos dispositivos que nunca se hablaron llegan al mismo id y esto no se vuelve a armar solo. Por eso también entran las que no están repetidas pero tienen un id al azar."
          vacio="Ninguna: todas las fichas ya tienen el id que les corresponde y no hay repetidas."
        >
          {plan.unificar.map((d) => (
            <li className="item" key={d.id} style={{ display: 'block' }}>
              <div className="item-titulo">{d.nombre}</div>
              <div className="item-sub">
                {d.fichas.length > 1 ? `${d.fichas.length} fichas → 1` : 'cambia de id'} ·{' '}
                {cuantos(d.productosAMover, 'producto cambia de ficha', 'productos cambian de ficha')}
              </div>
              {d.fichas.length > 1 && (
                <div className="item-sub silencio">
                  Se conservan el nombre, el contacto y las notas de la ficha con{' '}
                  {cuantos(d.sobrevive!.productos, 'producto', 'productos')}.{' '}
                  {d.fichas.length === 2 ? 'Se absorbe' : 'Se absorben'}{' '}
                  {d.fichas
                    .filter((f) => f !== d.sobrevive)
                    .map((f) =>
                      f.productos === 0
                        ? 'una sin productos'
                        : `una con ${cuantos(f.productos, 'producto', 'productos')}`,
                    )
                    .join(' y ')}
                  .
                </div>
              )}
              {d.rescataDatos && (
                <div className="item-sub silencio">
                  Se rescatan el contacto y las notas de una ficha absorbida, porque la que queda
                  los tiene vacíos.
                </div>
              )}
              {d.alias.length > 0 && (
                <div className="item-sub silencio">
                  Queda con otros nombres: {d.alias.join(', ')}.
                </div>
              )}
              <div className="item-sub silencio">
                Queda como {d.id}, con {cuantos(d.productosFinales, 'producto', 'productos')}
                {d.productosRecuperados > 0 &&
                  ` (${d.productosRecuperados} llegan de fichas perdidas, paso 2)`}
                .
              </div>
            </li>
          ))}
        </Paso>

        <Paso
          n={2}
          titulo={`Reenganchar ${cuantos(plan.reenganchar.length, 'proveedor', 'proveedores')}`}
          detalle="Productos que apuntan a una ficha que ya no existe, pero cuyo proveedor sí existe con otro id. No hay que crear nada: se los reapunta a la ficha que queda."
          vacio="Ninguno: no hay productos apuntando a fichas perdidas que se puedan recuperar así."
        >
          {plan.reenganchar.map((d) => (
            <li className="item" key={d.id} style={{ display: 'block' }}>
              <div className="item-titulo">{d.nombre}</div>
              <div className="item-sub">
                recupera {cuantos(d.productosRecuperados, 'producto', 'productos')} · queda con{' '}
                {d.productosFinales}
              </div>
            </li>
          ))}
        </Paso>

        <Paso
          n={3}
          titulo={`Crear ${cuantos(plan.crear.length, 'ficha', 'fichas')}`}
          detalle="De estos proveedores no quedó ficha en ningún lado: solo el nombre que los productos traen escrito. Se agrupan por nombre —una ficha por nombre, aunque los productos vengan apuntando a tres ids distintos— y se crean activas."
          vacio="Ninguna: de todos los proveedores que usan los productos quedó al menos una ficha."
        >
          {plan.crear.map((d) => (
            <li className="item" key={d.id} style={{ display: 'block' }}>
              <div className="item-titulo">{d.nombre}</div>
              <div className="item-sub">{cuantos(d.productosFinales, 'producto', 'productos')}</div>
            </li>
          ))}
        </Paso>

        <Paso
          n={4}
          titulo={`Reactivar ${cuantos(plan.reactivar.length, 'ficha', 'fichas')}`}
          detalle="Calculado sobre cómo quedan las cosas DESPUÉS de los pasos 1 a 3, no sobre la foto de hoy: una ficha inactiva que hoy figura sin productos puede recibir varios al reenganchar, y entonces sí hay que reactivarla. Se reactivan solo las que terminan con productos vigentes; si todos sus productos quedaron descontinuados, esa decisión fue a propósito y no se deshace."
          vacio="Ninguna: ninguna ficha inactiva termina con productos vigentes."
        >
          {plan.reactivar.map((d) => (
            <li className="item" key={d.id} style={{ display: 'block' }}>
              <div className="item-titulo">{d.nombre}</div>
              <div className="item-sub">
                termina con {cuantos(d.vigentesFinales, 'producto vigente', 'productos vigentes')}
                {d.productosRecuperados > 0 && ` · ${d.productosRecuperados} recuperados en el paso 2`}
              </div>
            </li>
          ))}
        </Paso>
      </div>

      {plan.sinNombre.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Esto el plan no lo puede resolver solo</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            {cuantos(plan.sinNombre.length, 'proveedor', 'proveedores')} que los productos usan sin
            que quede ni la ficha ni el nombre escrito. Hay que asignarlos a mano desde Productos.
          </p>
          <ul className="lista">
            {plan.sinNombre.map((h) => (
              <li className="item" key={h.id}>
                <div className="item-sub">
                  {cuantos(h.productos, 'producto', 'productos')} sin proveedor reconocible
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hayQueHacer && !hecho && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Aplicar</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Quedan {plan.fichasFinales} fichas de las {hoy} de ahora, y {plan.productosAfectados}{' '}
            productos pasan a su proveedor. Antes de hacerlo te va a pedir que confirmes. Todo
            queda en el historial como «Limpieza de proveedores», con el valor de antes y el de
            después, y no se borra ningún producto ni ninguna venta.
          </p>
          {!puedeAplicar ? (
            <div className="aviso aviso-ojo" style={{ marginBottom: 0 }}>
              Esta pantalla es la lista de trabajo para ordenar los proveedores a mano, desde
              Proveedores y Productos. Aplicar el plan de una sola vez lo hace un dueño.
            </div>
          ) : hayQuienFirme ? (
            <button
              className="boton-principal"
              style={{ width: '100%' }}
              disabled={trabajando}
              onClick={aplicar}
            >
              {trabajando ? 'Aplicando…' : 'Aplicar el plan'}
            </button>
          ) : (
            <div className="aviso aviso-ojo" style={{ marginBottom: 0 }}>
              Para aplicarlo hay que estar con la sesión iniciada: si no, el historial no puede
              registrar quién lo hizo, y esto toca demasiadas cosas como para que no quede
              constancia.
            </div>
          )}
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Todas las fichas de hoy</p>
        <ul className="lista">
          {plan.conUso.map((c) => (
            <li className="item" key={c.proveedor.id}>
              <div>
                <div className="item-titulo">
                  {c.proveedor.nombre}
                  {c.proveedor.activo === false && <span className="chip"> inactivo</span>}
                </div>
                <div className="item-sub">
                  {c.productos === 0
                    ? 'sin productos'
                    : `${cuantos(c.productos, 'producto', 'productos')}, ${c.vigentes} vigentes`}
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
  vacio,
  primero,
  children,
}: {
  n: number
  titulo: string
  detalle: string
  vacio: string
  primero?: boolean
  children: React.ReactNode[]
}) {
  const hay = Array.isArray(children) && children.length > 0
  return (
    <div style={{ marginTop: primero ? 0 : 18 }}>
      <p style={{ fontWeight: 700, margin: '0 0 2px' }}>
        {n}. {titulo}
      </p>
      <p className="silencio" style={{ marginTop: 0 }}>
        {hay ? detalle : vacio}
      </p>
      {hay && <ul className="lista">{children}</ul>}
    </div>
  )
}
