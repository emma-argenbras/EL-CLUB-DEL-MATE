import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Jornada, type Venta, type Movimiento } from '../db/db'
import { resumirJornada, totalArqueo } from '../lib/calculos'
import { fechaLinda, plata } from '../lib/formato'
import { useSesion } from '../sync/useSesion'

/**
 * Cuantos meses para atras se buscan cierres sin revisar.
 *
 * Es a proposito mas amplio que el Panel, que solo reclama el mes en
 * curso (es lo unico para lo que tiene los datos cargados). Asi, si
 * quedo algo colgado de meses anteriores, aparece igual cada vez que se
 * abre Caja en vez de perderse.
 */
const MESES_ATRAS = 3

interface Pendiente {
  jornada: Jornada
  diferencia: number
}

/**
 * Los cierres de caja que dieron diferencia y todavia nadie con
 * responsabilidad miro.
 *
 * El turno nunca se frena esperando una autorizacion: quien cierra
 * cuenta la plata, anota lo que sabe y se va. Lo que queda pendiente es
 * el visto bueno del dueño, que aparece aca.
 *
 * El visto bueno no corrige la diferencia --queda como fue-- sino que
 * deja la constancia de que alguien la vio y la acepto.
 */
export default function CierresPendientes() {
  const sesion = useSesion()
  const esOwner = sesion.perfil?.rol === 'owner'

  const pendientes = useLiveQuery(async (): Promise<Pendiente[]> => {
    if (!esOwner) return []

    const desde = new Date()
    desde.setMonth(desde.getMonth() - MESES_ATRAS)
    const desdeISO = desde.toISOString().slice(0, 10)

    const cerradas = await db.jornadas
      .where('fecha')
      .aboveOrEqual(desdeISO)
      .filter((j) => j.estado === 'cerrado' && !!j.arqueoCierre && !j.cierreAutorizado)
      .toArray()

    const encontrados: Pendiente[] = []
    for (const jornada of cerradas) {
      const [ventas, movimientos] = await Promise.all([
        db.ventas.where('jornadaId').equals(jornada.id).toArray() as Promise<Venta[]>,
        db.movimientos.where('jornadaId').equals(jornada.id).toArray() as Promise<Movimiento[]>,
      ])
      const resumen = resumirJornada(jornada.cajaInicial, ventas, movimientos)
      const diferencia = totalArqueo(jornada.arqueoCierre) - resumen.cierreEsperado
      if (diferencia !== 0) encontrados.push({ jornada, diferencia })
    }
    return encontrados.sort((a, b) =>
      (b.jornada.fecha + b.jornada.turno).localeCompare(a.jornada.fecha + a.jornada.turno),
    )
  }, [esOwner])

  async function autorizar({ jornada, diferencia }: Pendiente) {
    const comentario = prompt(
      `Vas a dar por buena la diferencia de ${plata(diferencia)} del ${fechaLinda(jornada.fecha)} ${jornada.turno === 'M' ? 'a la mañana' : 'a la tarde'}.\n\nLa diferencia queda como está: esto deja la constancia de que la miraste. Podés anotar algo (opcional).`,
      '',
    )
    if (comentario === null) return
    await db.jornadas.update(jornada.id, {
      cierreAutorizado: {
        // Sin sincronizacion no hay login: la app corre en un solo
        // dispositivo y quien la usa es el dueño. Se firma igual, para
        // que el visto bueno funcione en los dos modos.
        por: sesion.email ?? 'local',
        porNombre: sesion.perfil?.nombre ?? 'Dueño',
        cuando: Date.now(),
        comentario: comentario.trim() || null,
      },
    })
  }

  if (!esOwner || !pendientes || pendientes.length === 0) return null

  const total = pendientes.reduce((suma, p) => suma + Math.abs(p.diferencia), 0)

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">
        {pendientes.length}{' '}
        {pendientes.length === 1
          ? 'cierre con diferencia esperando tu visto bueno'
          : 'cierres con diferencia esperando tu visto bueno'}
      </p>
      <p className="silencio" style={{ marginTop: 0 }}>
        Suman {plata(total)}. Dar el visto bueno no cambia la diferencia: deja la constancia de
        que la miraste vos.
      </p>
      <ul className="lista">
        {pendientes.map((p) => (
          <li className="item" key={p.jornada.id} style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="item-titulo">
                {fechaLinda(p.jornada.fecha)} · {p.jornada.turno === 'M' ? 'Mañana' : 'Tarde'}
              </div>
              <div className="item-sub">
                {p.diferencia > 0 ? 'Sobró ' : 'Faltó '}
                <strong className={p.diferencia > 0 ? 'positivo' : 'negativo'}>
                  {plata(Math.abs(p.diferencia))}
                </strong>
                {p.jornada.vendedor ? ` · cerró ${p.jornada.vendedor}` : ''}
              </div>
              {p.jornada.notaCierre && (
                <div className="item-sub">«{p.jornada.notaCierre}»</div>
              )}
            </div>
            <button
              className="boton-chico"
              style={{ flexShrink: 0 }}
              onClick={() => autorizar(p)}
            >
              Visto bueno
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
