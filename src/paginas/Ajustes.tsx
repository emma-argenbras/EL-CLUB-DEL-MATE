import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { resembrarCatalogo } from '../db/sembrar'
import { hoyISO, numero } from '../lib/formato'
import { nubeConfigurada } from '../sync/config'
import { useEstadoNube } from '../sync/useEstadoNube'

interface Respaldo {
  app: string
  version: number
  fecha: string
  productos: unknown[]
  jornadas: unknown[]
  ventas: unknown[]
  movimientos: unknown[]
  ajustes: unknown[]
}

export default function Ajustes() {
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const conteos = useLiveQuery(async () => ({
    productos: await db.productos.count(),
    jornadas: await db.jornadas.count(),
    ventas: await db.ventas.count(),
    movimientos: await db.movimientos.count(),
  }), [])

  async function exportar() {
    setTrabajando(true)
    try {
      const respaldo: Respaldo = {
        app: 'el-club-del-mate',
        version: 1,
        fecha: new Date().toISOString(),
        productos: await db.productos.toArray(),
        jornadas: await db.jornadas.toArray(),
        ventas: await db.ventas.toArray(),
        movimientos: await db.movimientos.toArray(),
        ajustes: await db.ajustes.toArray(),
      }
      const blob = new Blob([JSON.stringify(respaldo)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `respaldo-ecdm-${hoyISO()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMensaje({ tipo: 'ok', texto: 'Respaldo descargado. Guardalo en Drive o mandátelo por mail.' })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo exportar: ${e}` })
    } finally {
      setTrabajando(false)
    }
  }

  async function importar(archivo: File) {
    if (
      !confirm(
        'Importar un respaldo reemplaza TODOS los datos que tenés ahora en este dispositivo. ¿Seguís?',
      )
    )
      return
    setTrabajando(true)
    try {
      const datos = JSON.parse(await archivo.text()) as Respaldo
      if (datos.app !== 'el-club-del-mate') {
        throw new Error('El archivo no es un respaldo de esta app.')
      }
      await db.transaction(
        'rw',
        [db.productos, db.jornadas, db.ventas, db.movimientos, db.ajustes],
        async () => {
          await Promise.all([
            db.productos.clear(),
            db.jornadas.clear(),
            db.ventas.clear(),
            db.movimientos.clear(),
            db.ajustes.clear(),
          ])
          await db.productos.bulkPut(datos.productos as never[])
          await db.jornadas.bulkPut(datos.jornadas as never[])
          await db.ventas.bulkPut(datos.ventas as never[])
          await db.movimientos.bulkPut(datos.movimientos as never[])
          await db.ajustes.bulkPut(datos.ajustes as never[])
        },
      )
      setMensaje({ tipo: 'ok', texto: 'Respaldo importado.' })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo importar: ${e}` })
    } finally {
      setTrabajando(false)
    }
  }

  async function exportarVentasCSV() {
    const ventas = await db.ventas.orderBy('fecha').toArray()
    const cabecera = [
      'fecha', 'hora', 'codigo', 'descripcion', 'cantidad',
      'precio_unitario', 'costo_unitario', 'total', 'medio_pago', 'vendedor',
    ]
    const filas = ventas.map((v) =>
      [
        v.fecha, v.hora, v.codigo,
        `"${v.descripcion.replace(/"/g, '""')}"`,
        v.cantidad, v.precioUnitario, v.costoUnitario ?? '',
        v.total, v.medioPago, v.vendedor ?? '',
      ].join(','),
    )
    const csv = [cabecera.join(','), ...filas].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas-ecdm-${hoyISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function recargarCatalogo() {
    if (!confirm('Vuelve a cargar el catálogo original de la planilla. Los productos que hayas editado con el mismo código se pisan. ¿Seguís?')) return
    setTrabajando(true)
    try {
      const n = await resembrarCatalogo()
      setMensaje({ tipo: 'ok', texto: `Catálogo recargado: ${n} productos.` })
    } finally {
      setTrabajando(false)
    }
  }

  async function borrarTodo() {
    if (!confirm('Esto borra TODO: ventas, turnos, gastos y catálogo. ¿Seguro?')) return
    if (!confirm('Última confirmación. No se puede deshacer.')) return
    await db.delete()
    location.reload()
  }

  return (
    <>
      <h2>Ajustes</h2>

      {mensaje && (
        <div className={mensaje.tipo === 'ok' ? 'aviso aviso-ok' : 'aviso aviso-error'}>
          {mensaje.texto}
        </div>
      )}

      <TarjetaRespaldo />

      <div className="tarjeta">
        <p className="tarjeta-titulo">Qué hay guardado</p>
        <div className="fila">
          <span className="fila-etiqueta">Productos</span>
          <span className="fila-valor">{numero(conteos?.productos ?? null)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Turnos</span>
          <span className="fila-valor">{numero(conteos?.jornadas ?? null)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Ventas</span>
          <span className="fila-valor">{numero(conteos?.ventas ?? null)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Movimientos de plata</span>
          <span className="fila-valor">{numero(conteos?.movimientos ?? null)}</span>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Copia manual</p>
        <p className="silencio" style={{ marginBottom: 10 }}>
          {nubeConfigurada
            ? 'Además del respaldo automático de arriba, podés bajar una copia manual cuando quieras y guardarla en Drive o mandártela por mail.'
            : 'Todavía no está activado el respaldo automático de arriba, así que esta es tu única copia de seguridad: hacela seguido y guardala en Drive. Si se pierde o se rompe el celular sin haber bajado una copia, se pierden los datos.'}
        </p>
        <div className="botonera">
          <button className="boton-principal" onClick={exportar} disabled={trabajando}>
            Descargar copia
          </button>
        </div>
        <div className="campo" style={{ marginTop: 10 }}>
          <label htmlFor="archivo">Importar un respaldo</label>
          <input
            id="archivo"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              if (archivo) importar(archivo)
              e.target.value = ''
            }}
          />
        </div>
        <button style={{ width: '100%', marginTop: 6 }} onClick={exportarVentasCSV}>
          Exportar ventas a CSV (para Excel)
        </button>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Catálogo</p>
        <button style={{ width: '100%' }} onClick={recargarCatalogo} disabled={trabajando}>
          Recargar catálogo original
        </button>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Zona peligrosa</p>
        <button className="boton-peligro" style={{ width: '100%' }} onClick={borrarTodo}>
          Borrar todos los datos
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  'sin-configurar': { texto: 'No configurada', clase: 'chip' },
  desconectado: { texto: 'Este dispositivo no está vinculado', clase: 'chip chip-alerta' },
  conectando: { texto: 'Conectando…', clase: 'chip chip-alerta' },
  sincronizado: { texto: 'Sincronizado', clase: 'chip chip-banco' },
  error: { texto: 'Hay un problema de conexión', clase: 'chip chip-alerta' },
}

function TarjetaRespaldo() {
  const estado = useEstadoNube()
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  if (!nubeConfigurada) {
    return (
      <div className="tarjeta">
        <p className="tarjeta-titulo">Respaldo automático</p>
        <div className="aviso aviso-ojo" style={{ marginBottom: 0 }}>
          Por ahora los datos viven solamente en este dispositivo: si el celular se pierde o se
          rompe, se pierden los datos con él. Para que se guarden solos en un servidor —y se
          compartan entre todos los dispositivos del negocio— falta activar la sincronización
          gratuita, un paso único (ver la categoría "Sincronización y respaldo" en la Ayuda).
          Mientras tanto, hacé copias manuales seguido más abajo.
        </div>
      </div>
    )
  }

  const info = ETIQUETA_ESTADO[estado.estado]

  async function vincular() {
    setError('')
    if (!email.trim() || contrasena.length < 6) {
      setError('Cargá el mail y una contraseña de al menos 6 caracteres.')
      return
    }
    setTrabajando(true)
    try {
      const { vincularDispositivo } = await import('../sync/motor')
      await vincularDispositivo(email.trim(), contrasena)
      setContrasena('')
    } catch (e) {
      const codigo = (e as { code?: string }).code
      setError(
        codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential'
          ? 'La contraseña no coincide con la de los demás dispositivos.'
          : `No se pudo vincular: ${e}`,
      )
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Respaldo automático</p>
      <div className="fila" style={{ marginBottom: 10 }}>
        <span className="fila-etiqueta">Estado</span>
        <span className={info.clase}>{info.texto}</span>
      </div>

      {estado.email ? (
        <>
          <p className="silencio" style={{ marginBottom: 10 }}>
            Vinculado como <strong>{estado.email}</strong>. Todo lo que cargás se guarda solo en
            el servidor (no solo en este celular) y se ve en los demás dispositivos vinculados en
            cuanto haya internet. Sin conexión la app sigue funcionando exactamente igual: nada se
            pierde, se sube solo apenas vuelve la señal.
          </p>
          {estado.error && <div className="aviso aviso-error">{estado.error}</div>}
          <button
            style={{ width: '100%' }}
            onClick={() => import('../sync/motor').then((m) => m.desvincularDispositivo())}
          >
            Desvincular este dispositivo
          </button>
        </>
      ) : (
        <>
          <p className="silencio" style={{ marginBottom: 10 }}>
            Usá el mismo mail y contraseña en todos los dispositivos del negocio: el primero crea
            la cuenta compartida, los demás se suman con las mismas claves. Una vez vinculado,
            el respaldo en el servidor queda automático y la app sigue andando sin internet.
          </p>
          {error && <div className="aviso aviso-error">{error}</div>}
          <div className="campo">
            <label htmlFor="sync-email">Mail del negocio</label>
            <input
              id="sync-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="elclubdelmate@gmail.com"
            />
          </div>
          <div className="campo">
            <label htmlFor="sync-pass">Contraseña</label>
            <input
              id="sync-pass"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <button className="boton-principal" onClick={vincular} disabled={trabajando}>
            Vincular este dispositivo
          </button>
        </>
      )}
    </div>
  )
}
