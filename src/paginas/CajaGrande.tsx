import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ETIQUETA_CUENTA, nuevoId, type Arqueo, type CuentaDePago } from '../db/db'
import { arqueoVacio, totalArqueo } from '../lib/calculos'
import { fechaLinda, haceCuanto, hoyISO, horaAhora, leerNumero, mesActualISO, plata } from '../lib/formato'
import { cajaVirtual, saldoDeCuenta } from '../lib/cajaGrande'
import ArqueoCaja from '../componentes/ArqueoCaja'
import { useSesion } from '../sync/useSesion'

/**
 * La caja grande, con su saldo (punto 13 del pedido del 06/11).
 *
 * El saldo sale del ultimo conteo mas lo que entro y menos lo que salio
 * despues: pases desde el cajon, gastos pagados con ella, ingresos y
 * depositos. Contarla de vez en cuando es lo que la mantiene al dia: la
 * diferencia entre lo contado y lo esperado dice si falta anotar algo.
 */
export default function CajaGrande() {
  const sesion = useSesion()
  const hoy = hoyISO()
  const mes = mesActualISO()
  const datos = useLiveQuery(async () => {
    const [conteos, movimientos, ventasHoy, ventasMes] = await Promise.all([
      db.arqueosCuenta.where('cuenta').equals('cajaGrande').toArray(),
      db.movimientos.toArray(),
      db.ventas.where('fecha').equals(hoy).toArray(),
      db.ventas.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    ])
    return { conteos, movimientos, ventasHoy, ventasMes }
  }, [hoy, mes])

  const [contando, setContando] = useState(false)
  const [arqueo, setArqueo] = useState<Arqueo>(arqueoVacio())
  const [visto, setVisto] = useState(false)
  const [nota, setNota] = useState('')
  const [pasando, setPasando] = useState(false)
  const [monto, setMonto] = useState('')
  const [destino, setDestino] = useState<CuentaDePago>('banco')
  const [haciaCajaGrande, setHaciaCajaGrande] = useState(false)
  const [mensaje, setMensaje] = useState('')

  if (!datos) return <p className="vacio">Calculando la caja grande…</p>

  const { saldo, ultimoConteo, movimientos } = saldoDeCuenta('cajaGrande', datos.conteos, datos.movimientos)
  const contado = totalArqueo(arqueo)

  async function guardarConteo() {
    const diferencia = saldo === null ? null : contado - saldo
    if (
      !confirm(
        saldo === null
          ? `¿Guardar ${plata(contado)} como el saldo de la caja grande? Desde acá la app lleva la cuenta.`
          : `Contaste ${plata(contado)} y debería haber ${plata(saldo)}${diferencia ? ` (diferencia de ${plata(diferencia)})` : ''}. ¿Guardar el conteo?`,
      )
    ) {
      return
    }
    await db.arqueosCuenta.add({
      id: nuevoId(),
      cuenta: 'cajaGrande',
      fecha: hoyISO(),
      hora: horaAhora(),
      cuando: Date.now(),
      contado,
      esperado: saldo,
      quien: sesion.email ?? null,
      quienNombre: sesion.perfil?.nombre ?? null,
      nota: nota.trim() || null,
    })
    setContando(false)
    setVisto(false)
    setArqueo(arqueoVacio())
    setNota('')
    setMensaje(`Conteo guardado: ${plata(contado)}.`)
  }

  async function guardarPase() {
    const valor = leerNumero(monto) ?? 0
    if (valor <= 0) return
    const desde: CuentaDePago = haciaCajaGrande ? destino : 'cajaGrande'
    const hacia: CuentaDePago = haciaCajaGrande ? 'cajaGrande' : destino
    if (!confirm(`¿Pasar ${plata(valor)} de ${ETIQUETA_CUENTA[desde]} a ${ETIQUETA_CUENTA[hacia]}?`)) return
    await db.movimientos.add({
      id: nuevoId(),
      fecha: hoyISO(),
      tipo: 'PASE_ENTRE_CUENTAS',
      cuenta: desde,
      cuentaDestino: hacia,
      concepto: `De ${ETIQUETA_CUENTA[desde]} a ${ETIQUETA_CUENTA[hacia]}`,
      monto: valor,
      categoria: null,
      jornadaId: null,
      esVariable: false,
    })
    setPasando(false)
    setMonto('')
    setMensaje(`Anotado: ${plata(valor)} de ${ETIQUETA_CUENTA[desde]} a ${ETIQUETA_CUENTA[hacia]}.`)
  }

  const conteosAnteriores = [...datos.conteos].sort((a, b) => b.cuando - a.cuando).slice(0, 6)
  const virtualHoy = cajaVirtual(datos.ventasHoy)
  const virtualMes = cajaVirtual(datos.ventasMes)

  return (
    <>
      <h2>Caja grande</h2>
      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Saldo</p>
        {saldo === null ? (
          <p style={{ marginTop: 0 }}>
            Todavía no se contó. Contala una vez y desde ahí la app lleva la cuenta: le suma los pases
            desde el cajón y los ingresos, y le resta los gastos pagados con ella y los depósitos.
          </p>
        ) : (
          <>
            <div className="cifra">
              <div className="cifra-valor">{plata(saldo)}</div>
              <div className="cifra-etiqueta">debería haber en la caja grande</div>
            </div>
            <p className="silencio" style={{ marginBottom: 0 }}>
              Desde el conteo del {fechaLinda(ultimoConteo!.fecha)} a las {ultimoConteo!.hora}
              {ultimoConteo!.quienNombre ? `, de ${ultimoConteo!.quienNombre}` : ''}: {plata(ultimoConteo!.contado)}.
            </p>
          </>
        )}
        <div className="botonera" style={{ marginTop: 10 }}>
          <button className="boton-chico" onClick={() => setContando((c) => !c)}>
            {contando ? 'Cancelar el conteo' : 'Contar la caja grande'}
          </button>
          <button className="boton-chico" onClick={() => setPasando((c) => !c)}>
            {pasando ? 'Cancelar' : 'Depositar o pasar plata'}
          </button>
        </div>
      </div>

      {contando && (
        <>
          <ArqueoCaja arqueo={arqueo} onCambiar={setArqueo} titulo="Conteo de la caja grande" />
          <div className="tarjeta">
            <div className="fila destacada">
              <span className="fila-etiqueta">Contado</span>
              <span className="fila-valor">{plata(contado)}</span>
            </div>
            {saldo !== null && !visto ? (
              <button className="boton-principal" style={{ marginTop: 8 }} onClick={() => setVisto(true)}>
                Ya conté: ver cómo da
              </button>
            ) : (
              <>
                {saldo !== null && (
                  <>
                    <div className="fila">
                      <span className="fila-etiqueta">Debería haber</span>
                      <span className="fila-valor">{plata(saldo)}</span>
                    </div>
                    <div className="fila">
                      <span className="fila-etiqueta">Diferencia</span>
                      <span className={contado - saldo === 0 ? 'fila-valor' : contado - saldo > 0 ? 'fila-valor positivo' : 'fila-valor negativo'}>
                        {plata(contado - saldo)}
                      </span>
                    </div>
                  </>
                )}
                <div className="campo" style={{ marginTop: 8 }}>
                  <label htmlFor="nota-cg">Nota (opcional)</label>
                  <input id="nota-cg" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Por ejemplo: faltaba anotar el pago del alquiler" />
                </div>
                <button className="boton-principal" onClick={() => void guardarConteo()} disabled={contado <= 0}>
                  Guardar el conteo
                </button>
              </>
            )}
          </div>
        </>
      )}

      {pasando && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Depositar o pasar plata</p>
          <div className="botonera">
            <button className={!haciaCajaGrande ? 'boton-chico boton-principal' : 'boton-chico'} onClick={() => setHaciaCajaGrande(false)}>
              Sale de la caja grande
            </button>
            <button className={haciaCajaGrande ? 'boton-chico boton-principal' : 'boton-chico'} onClick={() => setHaciaCajaGrande(true)}>
              Entra a la caja grande
            </button>
          </div>
          <div className="grilla grilla-2" style={{ marginTop: 8 }}>
            <div className="campo">
              <label htmlFor="cuenta-pase">{haciaCajaGrande ? 'Viene de' : 'Va a'}</label>
              <select id="cuenta-pase" value={destino} onChange={(e) => setDestino(e.target.value as CuentaDePago)}>
                <option value="banco">Banco</option>
                <option value="mercadoPago">Mercado Pago</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="monto-pase">Monto</label>
              <input id="monto-pase" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
            </div>
          </div>
          <button className="boton-principal" onClick={() => void guardarPase()} disabled={(leerNumero(monto) ?? 0) <= 0}>
            Anotar
          </button>
          <p className="silencio" style={{ marginBottom: 0 }}>
            No es un gasto: la plata sigue siendo del negocio, solo cambia de lugar. Los pases desde el
            cajón del turno se cargan en Caja, en Egresos.
          </p>
        </div>
      )}

      {saldo !== null && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Lo que la movió desde el último conteo</p>
          {movimientos.length === 0 ? (
            <p className="vacio">Nada todavía.</p>
          ) : (
            <ul className="lista">
              {movimientos.map(({ movimiento: m, efecto }) => (
                <li className="item" key={m.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="item-titulo">{m.concepto}</div>
                    <div className="item-sub">{fechaLinda(m.fecha)}</div>
                  </div>
                  <div className={efecto > 0 ? 'item-monto positivo' : 'item-monto negativo'}>
                    {efecto > 0 ? '+' : ''}
                    {plata(efecto)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Caja virtual</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Lo cobrado sin efectivo: va al banco o a Mercado Pago, no a una caja.
        </p>
        {[
          { titulo: 'Hoy', filas: virtualHoy },
          { titulo: 'Este mes', filas: virtualMes },
        ].map(({ titulo, filas }) => (
          <div key={titulo} style={{ marginTop: 8 }}>
            <div className="item-sub" style={{ fontWeight: 600 }}>{titulo}</div>
            {filas.length === 0 ? (
              <div className="silencio">Sin cobros sin efectivo.</div>
            ) : (
              filas.map((f) => (
                <div className="fila" key={f.medio}>
                  <span className="fila-etiqueta">{f.medio}</span>
                  <span className="fila-valor">{plata(f.total)}</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {conteosAnteriores.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Conteos anteriores</p>
          <ul className="lista">
            {conteosAnteriores.map((c) => (
              <li className="item" key={c.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">
                    {fechaLinda(c.fecha)} {c.hora}
                    {c.quienNombre ? ` · ${c.quienNombre}` : ''}
                  </div>
                  <div className="item-sub">
                    {c.esperado === null
                      ? 'Primer conteo'
                      : c.contado - c.esperado === 0
                        ? 'Dio justo'
                        : `Diferencia ${plata(c.contado - c.esperado)}`}
                    {c.nota ? ` · «${c.nota}»` : ''} · {haceCuanto(c.cuando)}
                  </div>
                </div>
                <div className="item-monto">{plata(c.contado)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
