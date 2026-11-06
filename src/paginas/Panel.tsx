import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Jornada } from '../db/db'
import { resumirMes } from '../lib/calculos'
import { fechaLinda, hoyISO, mesActualISO, mesLindo, numero, plata, porcentaje } from '../lib/formato'
import { saldoDeCuenta } from '../lib/cajaGrande'
import { lunesDe, resumenDeHoy, saludo, ventasDeLaSemana } from '../lib/tablero'
import Icono from '../componentes/Icono'
import { puntajeSalud } from '../lib/auditoria'
import { agruparPorPlazo, TITULO_PLAZO } from '../lib/agruparAvisos'
import { reactivarPospuestos, useAuditoria } from '../lib/useAuditoria'
import ListaHallazgos from '../componentes/ListaHallazgos'
import RevisionCompleta from '../componentes/RevisionCompleta'
import { seccionesVisibles } from '../sync/sesion'
import { useSesion } from '../sync/useSesion'
import { estaAlMando } from '../sync/permisos'


function semaforo(puntaje: number): { emoji: string; texto: string; clase: string } {
  if (puntaje >= 90) return { emoji: '🟢', texto: 'Todo en orden', clase: 'positivo' }
  if (puntaje >= 70) return { emoji: '🟡', texto: 'Hay cosas para revisar', clase: '' }
  if (puntaje >= 40) return { emoji: '🟠', texto: 'Varias cosas necesitan atención', clase: '' }
  return { emoji: '🔴', texto: 'Hay temas urgentes sin resolver', clase: 'negativo' }
}

/**
 * Panel: la auditoria automatica del negocio en una sola pantalla.
 *
 * Revisa sola todos los modulos (caja, productos, proveedores, gastos y
 * sincronizacion) y muestra que hay para hacer, ordenado por gravedad y
 * con un boton que lleva derecho a donde se resuelve. Cada persona ve
 * solo lo que le compete y puede arreglar.
 */
export default function Panel() {
  const sesion = useSesion()
  const esOwner = estaAlMando(sesion.perfil)
  const { cargando, hallazgos, pospuestos, datos: datosAuditoria } = useAuditoria()
  const mes = mesActualISO()

  const ventas = useLiveQuery(
    () => db.ventas.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )
  const movimientos = useLiveQuery(
    () => db.movimientos.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )
  const resumen = useMemo(
    () => resumirMes(ventas ?? [], movimientos ?? []),
    [ventas, movimientos],
  )

  const porPlazo = useMemo(() => agruparPorPlazo(hallazgos), [hallazgos])
  // Lo de mantenimiento arranca plegado: es trabajo de a poco, no de hoy.
  const [verCuandoPuedas, setVerCuandoPuedas] = useState(false)

  const puntaje = puntajeSalud(hallazgos)
  const luz = semaforo(puntaje)
  const urgentes = hallazgos.filter((h) => h.nivel === 'critico').length

  const puntajeTarjeta = (
          <div className="tarjeta">
            <p className="tarjeta-titulo">Revisión automática · {fechaLinda(hoyISO())}</p>
            <div className="cifra">
              <div className={`cifra-valor ${luz.clase}`}>
                {luz.emoji} {puntaje}/100
              </div>
              <div className="cifra-etiqueta">{luz.texto}</div>
            </div>
            <p className="silencio" style={{ marginTop: 10, marginBottom: 0 }}>
              {hallazgos.length === 0
                ? 'La app revisó la caja, el catálogo, los proveedores y los gastos, y no encontró nada pendiente.'
                : `${hallazgos.length} ${hallazgos.length === 1 ? 'cosa' : 'cosas'} para revisar${urgentes > 0 ? `, ${urgentes} ${urgentes === 1 ? 'urgente' : 'urgentes'}` : ''}. Se revisa sola cada vez que abrís la app.`}
              {pospuestos > 0 && (
                <>
                  {' '}
                  Hay {pospuestos} {pospuestos === 1 ? 'aviso pospuesto' : 'avisos pospuestos'}.{' '}
                  <button className="boton-chico" onClick={() => reactivarPospuestos()}>
                    Ver de nuevo
                  </button>
                </>
              )}
            </p>
          </div>
  )

  return (
    <>
      <h2 className="solo-celular">Panel</h2>
      <div className="solo-escritorio">
        <Tablero
          // Sin nube el perfil se llama «Vos»: «Buenas tardes, Vos» no va.
          nombre={sesion.perfil && sesion.perfil.nombre !== 'Vos' ? sesion.perfil.nombre : null}
          esOwner={esOwner}
          paraHoy={urgentes}
          conCaja={seccionesVisibles(sesion.perfil).includes('caja')}
        />
      </div>

      {cargando ? (
        <p className="vacio">Revisando el negocio…</p>
      ) : (
        <>
          <div className="solo-celular">{puntajeTarjeta}</div>

          <div className="plazos">
          {porPlazo.map(({ plazo, hallazgos: delPlazo }) => (
            <div key={plazo} className="plazo">
              <p className="tarjeta-titulo" style={{ marginTop: 16, marginBottom: 8 }}>
                {TITULO_PLAZO[plazo]} · {delPlazo.length}
              </p>
              {plazo === 'cuandoPuedas' && !verCuandoPuedas ? (
                <button className="boton-chico" onClick={() => setVerCuandoPuedas(true)}>
                  Mostrar {delPlazo.length === 1 ? 'el aviso' : `los ${delPlazo.length} avisos`} de
                  mantenimiento
                </button>
              ) : (
                <ListaHallazgos hallazgos={delPlazo} />
              )}
            </div>
          ))}
          </div>

          {hallazgos.length === 0 && <ListaHallazgos hallazgos={[]} />}

          <div className="solo-escritorio">
            <SemanaYTurnos />
            {puntajeTarjeta}
          </div>

          <RevisionCompleta
            hallazgos={hallazgos}
            esOwner={esOwner}
            secciones={seccionesVisibles(sesion.perfil)}
            datos={datosAuditoria}
          />

          {esOwner && (
            <div className="tarjeta" style={{ marginTop: 16 }}>
              <p className="tarjeta-titulo">Cómo viene {mesLindo(mes)}</p>
              {resumen.operaciones === 0 ? (
                <p className="vacio">Todavía no hay ventas cargadas este mes.</p>
              ) : (
                <>
                  <div className="fila">
                    <span className="fila-etiqueta">Ventas del mes</span>
                    <span className="fila-valor">{plata(resumen.ventasTotales)}</span>
                  </div>
                  <div className="fila">
                    <span className="fila-etiqueta">Operaciones · días con ventas</span>
                    <span className="fila-valor">
                      {numero(resumen.operaciones)} · {numero(resumen.diasConVentas)}
                    </span>
                  </div>
                  <div className="fila destacada">
                    <span className="fila-etiqueta">Margen de contribución</span>
                    <span
                      className={
                        resumen.margenContribucion >= 0
                          ? 'fila-valor positivo'
                          : 'fila-valor negativo'
                      }
                    >
                      {plata(resumen.margenContribucion)} ·{' '}
                      {porcentaje(resumen.margenContribucionPorcentual)}
                    </span>
                  </div>
                  <div className="fila">
                    <span className="fila-etiqueta">Resultado del mes hasta hoy</span>
                    <span
                      className={resumen.resultado >= 0 ? 'fila-valor positivo' : 'fila-valor negativo'}
                    >
                      {plata(resumen.resultado)}
                    </span>
                  </div>
                  <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
                    El detalle completo, mes por mes, está en Reportes.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Lo de arriba del Panel en la compu (opcion B, 06/11): el saludo y lo de
 * hoy en cuatro recuadros. En el celular no se muestra.
 */
function Tablero({
  nombre,
  esOwner,
  paraHoy,
  conCaja,
}: {
  nombre: string | null
  esOwner: boolean
  paraHoy: number
  conCaja: boolean
}) {
  const hoy = hoyISO()
  const datos = useLiveQuery(async () => {
    const [ventas, jornadas, movimientos] = await Promise.all([
      db.ventas.where('fecha').equals(hoy).toArray(),
      db.jornadas.where('fecha').equals(hoy).toArray(),
      db.movimientos.where('fecha').equals(hoy).toArray(),
    ])
    // La caja grande la ve solo quien esta al mando, como su pantalla.
    let cajaGrande: number | null = null
    if (esOwner) {
      const [conteos, todos] = await Promise.all([
        db.arqueosCuenta.where('cuenta').equals('cajaGrande').toArray(),
        db.movimientos.toArray(),
      ])
      cajaGrande = saldoDeCuenta('cajaGrande', conteos, todos).saldo
    }
    return { hoyEs: resumenDeHoy(jornadas, ventas, movimientos), cajaGrande }
  }, [hoy, esOwner])

  const h = datos?.hoyEs
  return (
    <>
      <div className="tablero-cabecera">
        <div>
          <p className="silencio" style={{ margin: 0, fontSize: '0.95rem' }}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h2 style={{ margin: '4px 0 0' }}>
            {saludo(new Date().getHours())}
            {nombre ? `, ${nombre}` : ''}
          </h2>
        </div>
        {conCaja && (
          <Link className="boton-chico boton-verde-enlace" to="/caja">
            Ir a la caja
          </Link>
        )}
      </div>
      <div className="kpis">
        <div className="tarjeta kpi">
          <span className="kpi-ficha" style={{ background: '#d8f3dc', color: '#1b4332' }}>
            <Icono nombre="caja" tamano={22} />
          </span>
          <div>
            <div className="kpi-etiqueta">Vendido hoy</div>
            <div className="kpi-valor">{h ? plata(h.vendido) : '…'}</div>
            <div className="kpi-etiqueta">
              {h ? `${numero(h.operaciones)} ${h.operaciones === 1 ? 'operación' : 'operaciones'}` : ''}
            </div>
          </div>
        </div>
        <div className="tarjeta kpi">
          <span className="kpi-ficha" style={{ background: '#f6e7d8', color: '#8a4a12' }}>
            <Icono nombre="efectivo" tamano={22} />
          </span>
          <div>
            <div className="kpi-etiqueta">Efectivo en el cajón</div>
            <div className="kpi-valor">{h ? (h.enElCajon === null ? '—' : plata(h.enElCajon)) : '…'}</div>
            <div className="kpi-etiqueta">{h && h.enElCajon === null ? 'No hay turno abierto' : 'Lo que debería haber'}</div>
          </div>
        </div>
        <div className="tarjeta kpi">
          <span className="kpi-ficha" style={{ background: '#e0eaff', color: '#1e40af' }}>
            <Icono nombre="tarjeta" tamano={22} />
          </span>
          <div>
            <div className="kpi-etiqueta">Tarjetas y transferencias</div>
            <div className="kpi-valor">{h ? plata(h.banco) : '…'}</div>
            <div className="kpi-etiqueta">Van al banco</div>
          </div>
        </div>
        {esOwner ? (
          <Link className="tarjeta kpi kpi-enlace" to="/caja-grande">
            <span className="kpi-ficha" style={{ background: '#eef0eb', color: '#1c1917' }}>
              <Icono nombre="gastos" tamano={22} />
            </span>
            <div>
              <div className="kpi-etiqueta">Caja grande</div>
              <div className="kpi-valor">
                {datos ? (datos.cajaGrande === null ? 'Sin contar' : plata(datos.cajaGrande)) : '…'}
              </div>
              <div className="kpi-etiqueta">Ver y contar</div>
            </div>
          </Link>
        ) : (
          <div className="tarjeta kpi">
            <span className="kpi-ficha" style={{ background: '#fdecea', color: '#b3261e' }}>
              <Icono nombre="panel" tamano={22} />
            </span>
            <div>
              <div className="kpi-etiqueta">Para hoy</div>
              <div className="kpi-valor">{paraHoy}</div>
              <div className="kpi-etiqueta">{paraHoy === 1 ? 'aviso' : 'avisos'}</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/** Las ventas de la semana en barras, y los turnos de hoy. Solo en la compu. */
function SemanaYTurnos() {
  const hoy = hoyISO()
  const lunes = lunesDe(hoy)
  const datos = useLiveQuery(async () => {
    const sabado = new Date(`${lunes}T12:00:00`)
    sabado.setDate(sabado.getDate() + 5)
    const hasta = `${sabado.getFullYear()}-${String(sabado.getMonth() + 1).padStart(2, '0')}-${String(sabado.getDate()).padStart(2, '0')}`
    const [ventas, jornadas] = await Promise.all([
      db.ventas.where('fecha').between(lunes, hasta, true, true).toArray(),
      db.jornadas.where('fecha').equals(hoy).toArray(),
    ])
    return { semana: ventasDeLaSemana(lunes, ventas), jornadas }
  }, [hoy, lunes])
  if (!datos) return null
  const maximo = Math.max(1, ...datos.semana.map((d) => d.total))
  const turnos = [...datos.jornadas].sort((a, b) => a.turno.localeCompare(b.turno))
  const resumenSemana = datos.semana.map((d) => `${d.dia} ${plata(d.total)}`).join(', ')
  return (
    <div className="semana-y-turnos">
      <div className="tarjeta">
        <p className="tarjeta-titulo">Ventas de la semana</p>
        <div className="barras" role="img" aria-label={`Ventas de la semana: ${resumenSemana}`}>
          {datos.semana.map((d) => (
            <div key={d.fecha} className="barra-dia">
              <span className={d.fecha === hoy ? 'barra-numero hoy' : 'barra-numero'}>
                {d.total > 0 ? numero(Math.round(d.total / 1000)) : '—'}
              </span>
              <div
                className={d.fecha === hoy ? 'barra hoy' : 'barra'}
                style={{ height: `${Math.max(2, (d.total / maximo) * 100)}%` }}
              />
              <span className={d.fecha === hoy ? 'barra-dia-nombre hoy' : 'barra-dia-nombre'}>{d.dia}</span>
            </div>
          ))}
        </div>
        <p className="silencio" style={{ margin: '10px 0 0' }}>En miles de pesos, de lunes a sábado.</p>
      </div>
      <div className="tarjeta">
        <p className="tarjeta-titulo">Turnos de hoy</p>
        {turnos.length === 0 ? (
          <p className="vacio">Todavía no se abrió ningún turno hoy.</p>
        ) : (
          turnos.map((j: Jornada) => (
            <div key={j.id} className="fila-turno">
              <div>
                <div style={{ fontWeight: 600 }}>
                  {j.turno === 'M' ? 'Mañana' : 'Tarde'}
                  {j.vendedor ? ` · ${j.vendedor}` : ''}
                </div>
                <div className="silencio">
                  {j.estado === 'cerrado'
                    ? `Cerrado${j.horaCierre ? ` a las ${j.horaCierre}` : ''}`
                    : `Abierto${j.horaApertura ? ` desde las ${j.horaApertura}` : ''}`}
                </div>
              </div>
              <span className={j.estado === 'cerrado' ? 'chip' : 'chip chip-banco'}>
                {j.estado === 'cerrado' ? 'CERRADO' : 'ABIERTO'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
