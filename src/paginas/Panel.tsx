import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { resumirMes } from '../lib/calculos'
import { fechaLinda, hoyISO, mesActualISO, mesLindo, numero, plata, porcentaje } from '../lib/formato'
import { ETIQUETA_MODULO, puntajeSalud, type ModuloAuditoria } from '../lib/auditoria'
import { reactivarPospuestos, useAuditoria } from '../lib/useAuditoria'
import ListaHallazgos from '../componentes/ListaHallazgos'
import { useSesion } from '../sync/useSesion'

const ORDEN_MODULOS: ModuloAuditoria[] = ['caja', 'productos', 'proveedores', 'gastos', 'sistema']

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
  const esOwner = sesion.perfil?.rol === 'owner'
  const { cargando, hallazgos, pospuestos } = useAuditoria()
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

  const porModulo = useMemo(() => {
    const mapa = new Map<ModuloAuditoria, typeof hallazgos>()
    for (const h of hallazgos) {
      const actual = mapa.get(h.modulo)
      if (actual) actual.push(h)
      else mapa.set(h.modulo, [h])
    }
    return mapa
  }, [hallazgos])

  const puntaje = puntajeSalud(hallazgos)
  const luz = semaforo(puntaje)
  const urgentes = hallazgos.filter((h) => h.nivel === 'critico').length

  return (
    <>
      <h2>Panel</h2>

      {cargando ? (
        <p className="vacio">Revisando el negocio…</p>
      ) : (
        <>
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

          {ORDEN_MODULOS.filter((m) => porModulo.has(m)).map((modulo) => (
            <div key={modulo}>
              <p className="tarjeta-titulo" style={{ marginTop: 16, marginBottom: 8 }}>
                {ETIQUETA_MODULO[modulo]}
              </p>
              <ListaHallazgos hallazgos={porModulo.get(modulo) ?? []} />
            </div>
          ))}

          {hallazgos.length === 0 && <ListaHallazgos hallazgos={[]} />}

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
