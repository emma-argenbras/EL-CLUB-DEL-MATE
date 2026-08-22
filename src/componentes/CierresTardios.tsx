import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Jornada, type Venta, type Movimiento } from '../db/db'
import { resumirJornada, totalArqueo } from '../lib/calculos'
import { fechaLinda, haceCuanto, horaAhora, plata } from '../lib/formato'
import { useSesion } from '../sync/useSesion'

interface Pedido {
  jornada: Jornada
  /** Lo que deberia haber en la caja segun lo cargado en el turno. */
  esperado: number
  /** Lo contado menos lo esperado. Puede ser cero. */
  diferencia: number
}

/**
 * Los pedidos para cerrar un turno tarde, esperando al dueño.
 *
 * Es distinto del visto bueno sobre una diferencia: aca el turno
 * todavia esta ABIERTO y no se cierra hasta que el dueño diga que si.
 * Es una correccion sobre algo que ya paso --un turno que quedo sin
 * cerrar-- y la idea es justamente que el dueño se entere en el
 * momento, no cuando revise el mes.
 *
 * El conteo no se puede retocar desde aca: se autoriza o se rechaza el
 * que hizo quien atendio. Si el dueño pudiera editarlo, el pedido
 * dejaria de ser la constancia de lo que se conto.
 */
export default function CierresTardios() {
  const sesion = useSesion()
  const esOwner = sesion.perfil?.rol === 'owner'

  const pedidos = useLiveQuery(async (): Promise<Pedido[]> => {
    if (!esOwner) return []

    const abiertas = await db.jornadas
      .filter((j) => j.solicitudCierre?.estado === 'pendiente')
      .toArray()

    const encontrados: Pedido[] = []
    for (const jornada of abiertas) {
      const [ventas, movimientos] = await Promise.all([
        db.ventas.where('jornadaId').equals(jornada.id).toArray() as Promise<Venta[]>,
        db.movimientos.where('jornadaId').equals(jornada.id).toArray() as Promise<Movimiento[]>,
      ])
      const resumen = resumirJornada(jornada.cajaInicial, ventas, movimientos)
      const contado = totalArqueo(jornada.solicitudCierre!.arqueo)
      encontrados.push({
        jornada,
        esperado: resumen.cierreEsperado,
        diferencia: contado - resumen.cierreEsperado,
      })
    }
    return encontrados.sort((a, b) =>
      (a.jornada.fecha + a.jornada.turno).localeCompare(b.jornada.fecha + b.jornada.turno),
    )
  }, [esOwner])

  async function autorizar({ jornada, diferencia }: Pedido) {
    const pedido = jornada.solicitudCierre
    if (!pedido) return
    const aviso =
      diferencia === 0
        ? 'La caja da justa.'
        : `Queda una diferencia de ${plata(diferencia)}, que se registra como tal.`
    const comentario = prompt(
      `Vas a cerrar el turno del ${fechaLinda(jornada.fecha)} ${jornada.turno === 'M' ? 'a la mañana' : 'a la tarde'} con los ${plata(totalArqueo(pedido.arqueo))} que contó ${pedido.porNombre}.\n\n${aviso}\n\nPodés anotar algo (opcional).`,
      '',
    )
    if (comentario === null) return

    await db.jornadas.update(jornada.id, {
      estado: 'cerrado',
      arqueoCierre: pedido.arqueo,
      horaCierre: horaAhora(),
      notaCierre: pedido.motivo,
      // Autorizar el cierre tardio ya es haber mirado la diferencia: no
      // tiene sentido reclamarle al dueño un segundo visto bueno por lo
      // mismo, dos minutos despues.
      cierreAutorizado: {
        por: sesion.email ?? 'local',
        porNombre: sesion.perfil?.nombre ?? 'Dueño',
        cuando: Date.now(),
        comentario: comentario.trim() || null,
      },
      solicitudCierre: null,
    })
  }

  async function rechazar({ jornada }: Pedido) {
    const pedido = jornada.solicitudCierre
    if (!pedido) return
    const comentario = prompt(
      `¿Por qué no lo autorizás? Lo que escribas es lo que va a leer ${pedido.porNombre} para poder corregirlo.`,
      '',
    )
    if (comentario === null) return
    if (!comentario.trim()) {
      alert('Escribí el motivo: sin eso, del otro lado no se sabe qué corregir.')
      return
    }
    await db.jornadas.update(jornada.id, {
      solicitudCierre: {
        ...pedido,
        estado: 'rechazada',
        respuestaPorNombre: sesion.perfil?.nombre ?? 'Dueño',
        respuestaCuando: Date.now(),
        respuestaComentario: comentario.trim(),
      },
    })
  }

  if (!esOwner || !pedidos || pedidos.length === 0) return null

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">
        {pedidos.length === 1
          ? 'Un turno espera que autorices cerrarlo'
          : `${pedidos.length} turnos esperan que autorices cerrarlos`}
      </p>
      <p className="silencio" style={{ marginTop: 0 }}>
        Quedaron sin cerrar en su momento. Hasta que autorices, siguen abiertos.
      </p>
      <ul className="lista">
        {pedidos.map((p) => {
          const pedido = p.jornada.solicitudCierre!
          return (
            <li className="item" key={p.jornada.id} style={{ display: 'block' }}>
              <div className="item-titulo">
                {fechaLinda(p.jornada.fecha)} · {p.jornada.turno === 'M' ? 'Mañana' : 'Tarde'}
              </div>
              <div className="item-sub">
                Contó {plata(totalArqueo(pedido.arqueo))} · debería haber {plata(p.esperado)}
              </div>
              <div className="item-sub">
                {p.diferencia === 0 ? (
                  'La caja da justa.'
                ) : (
                  <>
                    {p.diferencia > 0 ? 'Sobra ' : 'Falta '}
                    <strong className={p.diferencia > 0 ? 'positivo' : 'negativo'}>
                      {plata(Math.abs(p.diferencia))}
                    </strong>
                  </>
                )}
              </div>
              <div className="item-sub">
                «{pedido.motivo}» — {pedido.porNombre}, {haceCuanto(pedido.cuando)}
              </div>
              <div className="botonera" style={{ marginTop: 8 }}>
                <button className="boton-chico" onClick={() => autorizar(p)}>
                  Autorizar y cerrar
                </button>
                <button className="boton-chico" onClick={() => rechazar(p)}>
                  No autorizar
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
