import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { fechaLinda, hoyISO } from '../lib/formato'
import { lunesDe, sumarDias } from '../lib/tablero'
import {
  porcentajeEnElDia,
  resumenParaCopiar,
  senalDeLaSemana,
  usoPorSemana,
  type SemanaDeUso,
  type Senal,
} from '../lib/usoDeLaApp'

/** Cuántas semanas se muestran, contando la que está en curso. */
const SEMANAS = 6

const CARTEL: Record<Senal, { texto: string; clase: string }> = {
  bien: { texto: 'BIEN', clase: 'chip' },
  mirar: { texto: 'PARA MIRAR', clase: 'chip chip-banco' },
  mal: { texto: 'FALTA CARGAR', clase: 'chip chip-alerta' },
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const diaCorto = (fecha: string) => `${DIAS[new Date(`${fecha}T12:00:00`).getDay()]} ${fechaLinda(fecha).slice(0, 5)}`

/**
 * «Cómo venimos»: el uso de la app semana por semana (19/11).
 *
 * Es de lectura: no escribe nada. Los números salen de lo que ya está en
 * el aparato (ver lib/usoDeLaApp.ts) y sirven para el seguimiento del
 * lunes: si la caja se carga todos los días, si las ventas se cargan en
 * el momento, y si las entregas de los proveedores se cargan en la app.
 */
export default function Uso() {
  const hoy = hoyISO()
  const desde = sumarDias(lunesDe(hoy), -7 * (SEMANAS - 1))
  const [aviso, setAviso] = useState('')
  const [paraCopiarAMano, setParaCopiarAMano] = useState('')

  const datos = useLiveQuery(async () => {
    const [jornadas, ventas, productos, movimientosProveedor] = await Promise.all([
      db.jornadas.where('fecha').aboveOrEqual(desde).toArray(),
      db.ventas.where('fecha').aboveOrEqual(desde).toArray(),
      db.productos.toArray(),
      db.movimientosProveedor.where('fecha').aboveOrEqual(desde).toArray(),
    ])
    return { jornadas, ventas, productos, movimientosProveedor }
  }, [desde])

  const semanas = useMemo(() => (datos ? usoPorSemana(datos, hoy, SEMANAS) : []), [datos, hoy])

  if (!datos) return <p className="vacio">Mirando cómo venimos…</p>

  async function copiar() {
    const texto = resumenParaCopiar(semanas)
    try {
      await navigator.clipboard.writeText(texto)
      setParaCopiarAMano('')
      setAviso('Copiado. Pegalo en WhatsApp o donde quieras.')
    } catch {
      // Sin permiso para el portapapeles (pasa en algunos celulares): se
      // deja el texto a la vista para copiarlo a mano.
      setAviso('')
      setParaCopiarAMano(texto)
    }
  }

  return (
    <>
      <h2>Cómo venimos</h2>

      <div className="aviso aviso-ojo">
        Cómo se viene usando la app, semana por semana. Sale de lo que ya está cargado y no cambia
        nada. No es para marcarle nada a nadie: es para ver qué parte todavía cuesta más que el
        cuaderno o que el Excel, y arreglar esa parte.
      </div>

      {semanas.map((s, i) => (
        <Semana key={s.lunes} semana={s} esLaActual={i === 0} />
      ))}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Cómo leerlo</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          <strong>Caja:</strong> de lunes a sábado, los días que tienen al menos un turno cargado.
          Los feriados nacionales no se cuentan. Los días no laborables con fines turísticos sí: el
          comercio puede abrir.
        </p>
        <p className="silencio">
          <strong>Ventas cargadas en el día:</strong> las que se cargaron el mismo día de la venta.
          Las «después» se pasaron más tarde, casi siempre desde el cuaderno.
        </p>
        <p className="silencio" style={{ marginBottom: 0 }}>
          <strong>Costos actualizados e ingresos de mercadería:</strong> lo que entró de los
          proveedores y se cargó en la app esa semana. Si llegó mercadería y los dos números están
          en cero, se anotó en otro lado.
        </p>
      </div>

      <button className="boton-principal" onClick={() => void copiar()}>
        Copiar el resumen
      </button>
      {aviso && (
        <p className="aviso aviso-ok" role="status">
          {aviso}
        </p>
      )}
      {paraCopiarAMano && (
        <div className="campo" style={{ marginTop: 10 }}>
          <label htmlFor="resumen-uso">No se pudo copiar solo. Seleccioná el texto y copialo:</label>
          <textarea id="resumen-uso" readOnly rows={SEMANAS + 2} value={paraCopiarAMano} onFocus={(e) => e.target.select()} />
        </div>
      )}
    </>
  )
}

function Semana({ semana: s, esLaActual }: { semana: SemanaDeUso; esLaActual: boolean }) {
  const cartel = CARTEL[senalDeLaSemana(s)]
  const enElDia = porcentajeEnElDia(s)
  const titulo = esLaActual ? 'Esta semana' : `Semana del ${fechaLinda(s.lunes).slice(0, 5)}`
  return (
    <section className="tarjeta" aria-label={titulo}>
      <p className="tarjeta-titulo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>
          {titulo}
          <span className="silencio" style={{ fontWeight: 400, textTransform: 'none' }}>
            {' '}
            · {fechaLinda(s.lunes).slice(0, 5)} al {fechaLinda(s.sabado).slice(0, 5)}
          </span>
        </span>
        <span className={cartel.clase}>{cartel.texto}</span>
      </p>

      <div className="fila">
        <span className="fila-etiqueta">Caja cargada</span>
        <span className={s.diasSinCaja.length > 0 ? 'fila-valor negativo' : 'fila-valor'}>
          {s.diasHabiles === 0
            ? 'ningún día hábil todavía'
            : `${s.diasConCaja} de ${s.diasHabiles} ${s.diasHabiles === 1 ? 'día' : 'días'}`}
        </span>
      </div>
      {s.feriados.length > 0 && (
        <p className="item-sub" style={{ margin: '2px 0 6px' }}>
          {s.feriados.length === 1 ? 'Feriado, no se cuenta: ' : 'Feriados, no se cuentan: '}
          {s.feriados.map((f) => `${diaCorto(f.fecha)} (${f.nombre})`).join(', ')}.
        </p>
      )}
      {s.diasSinCaja.length > 0 && (
        <p className="item-sub negativo" style={{ margin: '2px 0 6px' }}>
          Sin caja: {s.diasSinCaja.map(diaCorto).join(', ')}.{' '}
          <Link to="/turnos">Ver los turnos de un día</Link>
        </p>
      )}
      {s.turnosSinCerrar > 0 && (
        <div className="fila">
          <span className="fila-etiqueta">Turnos de días anteriores sin cerrar</span>
          <span className="fila-valor negativo">{s.turnosSinCerrar}</span>
        </div>
      )}

      <div className="fila">
        <span className="fila-etiqueta">Ventas</span>
        <span className="fila-valor">{s.ventas}</span>
      </div>
      {s.ventas > 0 && (
        <div className="fila">
          <span className="fila-etiqueta">Cargadas en el día</span>
          <span className={enElDia !== null && enElDia < 90 ? 'fila-valor negativo' : 'fila-valor'}>
            {enElDia === null ? 'sin dato' : `${enElDia} %`}
            {s.ventasDespues > 0 ? ` (${s.ventasDespues} después)` : ''}
          </span>
        </div>
      )}
      {s.ventasSinCodigo > 0 && (
        <div className="fila">
          <span className="fila-etiqueta">
            <Link to="/ventas-sin-codigo">Ventas sin código</Link>
          </span>
          <span className="fila-valor">{s.ventasSinCodigo}</span>
        </div>
      )}

      <div className="fila">
        <span className="fila-etiqueta">Costos actualizados</span>
        <span className="fila-valor">{s.costosActualizados}</span>
      </div>
      <div className="fila">
        <span className="fila-etiqueta">Ingresos de mercadería</span>
        <span className="fila-valor">{s.ingresos}</span>
      </div>
    </section>
  )
}
