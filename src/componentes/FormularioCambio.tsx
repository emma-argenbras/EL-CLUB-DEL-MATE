import { useState } from 'react'
import { MEDIOS_PAGO, type Jornada, type MedioPago, type Producto } from '../db/db'
import {
  diferenciaCambio,
  problemaDelCambio,
  registrarCambio,
  type LadoCambio,
} from '../db/cambioProducto'
import { horaAhora, leerNumero, plata } from '../lib/formato'
import { useSinGuardar } from '../lib/sinGuardar'
import BuscadorProducto from './BuscadorProducto'

/**
 * Cargar un cambio de producto en Caja: lo que trae el cliente, lo que
 * se lleva, y la diferencia (ver db/cambioProducto.ts).
 */
export default function FormularioCambio({
  jornada,
  onListo,
  onCancelar,
}: {
  jornada: Jornada
  onListo: (registrado: { cambioId: string; texto: string }) => void
  onCancelar: () => void
}) {
  const [vuelve, setVuelve] = useState<Producto | null>(null)
  const [cantVuelve, setCantVuelve] = useState('1')
  const [precioVuelve, setPrecioVuelve] = useState('')
  const [lleva, setLleva] = useState<Producto | null>(null)
  const [cantLleva, setCantLleva] = useState('1')
  const [precioLleva, setPrecioLleva] = useState('')
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  useSinGuardar('un cambio de producto', vuelve !== null || lleva !== null)

  const lado = (p: Producto | null, cant: string, precio: string): LadoCambio | null =>
    p ? { producto: p, cantidad: leerNumero(cant) ?? 0, precioUnitario: leerNumero(precio) ?? -1 } : null
  const ladoVuelve = lado(vuelve, cantVuelve, precioVuelve)
  const ladoLleva = lado(lleva, cantLleva, precioLleva)
  const problema = problemaDelCambio(ladoVuelve, ladoLleva)
  const diferencia = problema ? null : diferenciaCambio(ladoVuelve!, ladoLleva!)

  function elegir(
    p: Producto,
    setProducto: (p: Producto) => void,
    setPrecio: (s: string) => void,
  ) {
    setProducto(p)
    setPrecio(p.precioVenta != null ? String(p.precioVenta) : '')
    setError('')
  }

  async function registrar() {
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    try {
      const r = await registrarCambio(jornada, ladoVuelve!, ladoLleva!, medio, horaAhora())
      onListo({
        cambioId: r.cambioId,
        texto: `Cambio cargado: vuelve ${vuelve!.descripcion}, se lleva ${lleva!.descripcion}`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      {error && <div className="aviso aviso-error">{error}</div>}

      <Lado
        titulo="Lo que trae el cliente"
        producto={vuelve}
        onElegir={(p) => elegir(p, setVuelve, setPrecioVuelve)}
        onCambiar={() => setVuelve(null)}
        cantidad={cantVuelve}
        setCantidad={setCantVuelve}
        precio={precioVuelve}
        setPrecio={setPrecioVuelve}
        etiquetaPrecio="Precio al que se lo vendieron"
        autoFoco
      />
      <Lado
        titulo="Lo que se lleva"
        producto={lleva}
        onElegir={(p) => elegir(p, setLleva, setPrecioLleva)}
        onCambiar={() => setLleva(null)}
        cantidad={cantLleva}
        setCantidad={setCantLleva}
        precio={precioLleva}
        setPrecio={setPrecioLleva}
        etiquetaPrecio="Precio unitario"
      />

      {diferencia !== null && (
        <div className={diferencia < 0 ? 'aviso aviso-ojo' : 'aviso aviso-ok'}>
          {diferencia > 0 && (
            <>
              El cliente paga <strong>{plata(diferencia)}</strong> de diferencia.
            </>
          )}
          {diferencia < 0 && (
            <>
              Le devolvés <strong>{plata(-diferencia)}</strong>.
            </>
          )}
          {diferencia === 0 && <>Sin diferencia: no se mueve plata.</>}
        </div>
      )}

      {diferencia !== null && diferencia !== 0 && (
        <div className="campo">
          <label htmlFor="cambio-medio">
            {diferencia > 0 ? '¿Cómo paga la diferencia?' : '¿Cómo se la devolvés?'}
          </label>
          <select
            id="cambio-medio"
            value={medio}
            onChange={(e) => setMedio(e.target.value as MedioPago)}
          >
            {MEDIOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {diferencia < 0 && medio === 'EFECTIVO' && (
            <p className="silencio" style={{ marginTop: 4, marginBottom: 0 }}>
              Sale del cajón: el efectivo esperado al cierre baja {plata(-diferencia)}. No hace
              falta cargarlo como egreso.
            </p>
          )}
        </div>
      )}

      <div className="botonera">
        <button onClick={onCancelar}>Cancelar</button>
        <button
          className="boton-principal"
          onClick={() => void registrar()}
          disabled={guardando || problema !== null}
        >
          {guardando ? 'Guardando…' : 'Registrar cambio'}
        </button>
      </div>
    </>
  )
}

function Lado({
  titulo,
  producto,
  onElegir,
  onCambiar,
  cantidad,
  setCantidad,
  precio,
  setPrecio,
  etiquetaPrecio,
  autoFoco,
}: {
  titulo: string
  producto: Producto | null
  onElegir: (p: Producto) => void
  onCambiar: () => void
  cantidad: string
  setCantidad: (s: string) => void
  precio: string
  setPrecio: (s: string) => void
  etiquetaPrecio: string
  autoFoco?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p className="silencio" style={{ margin: '0 0 6px', fontWeight: 600 }}>
        {titulo}
      </p>
      {!producto ? (
        <BuscadorProducto onElegir={onElegir} autoFoco={autoFoco} />
      ) : (
        <>
          <div className="item" style={{ borderBottom: 'none', paddingTop: 0 }}>
            <div>
              <div className="item-titulo">{producto.descripcion}</div>
              <div className="item-sub">{producto.codigo || 'sin código'}</div>
            </div>
            <button className="boton-chico" onClick={onCambiar}>
              Cambiar
            </button>
          </div>
          <div className="grilla grilla-2">
            <div className="campo">
              <label>Cantidad</label>
              <input
                inputMode="numeric"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="campo">
              <label>{etiquetaPrecio}</label>
              <input
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
