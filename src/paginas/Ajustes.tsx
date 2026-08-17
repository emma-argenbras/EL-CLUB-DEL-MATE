import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Rol, type Usuario } from '../db/db'
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
      <TarjetaUsuarios />

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

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Respaldo automático</p>
      <div className="fila" style={{ marginBottom: 10 }}>
        <span className="fila-etiqueta">Estado</span>
        <span className={info.clase}>{info.texto}</span>
      </div>
      <p className="silencio" style={{ marginBottom: 0 }}>
        Todo lo que se carga en cualquier dispositivo se guarda en el servidor (no solo en el
        celular) y se ve en los demás en cuanto haya internet. Sin conexión la app sigue
        funcionando exactamente igual: nada se pierde, se sube solo apenas vuelve la señal.
      </p>
      {estado.error && (
        <div className="aviso aviso-error" style={{ marginTop: 10 }}>
          {estado.error}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

const ETIQUETA_ROL: Record<Rol, string> = {
  owner: 'Dueño/a',
  empleado: 'Empleado/a',
}

function TarjetaUsuarios() {
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const usuarios = useLiveQuery(
    () =>
      nubeConfigurada
        ? db.usuarios.toArray().then((filas) => filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
        : Promise.resolve<Usuario[]>([]),
    [],
  )

  if (!nubeConfigurada) return null

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Usuarios del equipo</p>
      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}
      {!usuarios ? (
        <p className="vacio">Cargando…</p>
      ) : usuarios.length === 0 ? (
        <p className="vacio">Todavía no hay nadie más cargado.</p>
      ) : (
        <ul className="lista">
          {usuarios.map((u) => (
            <li className="item" key={u.id}>
              <div style={{ minWidth: 0 }}>
                <div className="item-titulo">{u.nombre}</div>
                <div className="item-sub">{u.email}</div>
              </div>
              <span className={u.rol === 'owner' ? 'chip chip-banco' : 'chip'}>
                {ETIQUETA_ROL[u.rol]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {creando ? (
        <FormularioUsuario
          onSalir={() => setCreando(false)}
          onCreado={(nombre) => {
            setMensaje(`Se creó el usuario de ${nombre}. Ya puede iniciar sesión con su mail.`)
            setCreando(false)
          }}
        />
      ) : (
        <button
          className="boton-principal"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => setCreando(true)}
        >
          + Usuario nuevo
        </button>
      )}
    </div>
  )
}

function FormularioUsuario({
  onSalir,
  onCreado,
}: {
  onSalir: () => void
  onCreado: (nombre: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [rol, setRol] = useState<Rol>('empleado')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  async function guardar() {
    setError('')
    if (!nombre.trim()) return setError('Ponele un nombre.')
    if (!email.trim()) return setError('Cargá el mail.')
    if (contrasena.length < 6) return setError('La contraseña tiene que tener al menos 6 caracteres.')
    setTrabajando(true)
    try {
      const { crearUsuario } = await import('../sync/motor')
      await crearUsuario(email, contrasena, nombre, rol)
      onCreado(nombre.trim())
    } catch (e) {
      const codigo = (e as { code?: string }).code
      setError(
        codigo === 'auth/email-already-in-use'
          ? 'Ya existe una cuenta con ese mail.'
          : `No se pudo crear: ${e}`,
      )
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="tarjeta" style={{ marginTop: 10, marginBottom: 0, background: 'var(--crema)' }}>
      {error && <div className="aviso aviso-error">{error}</div>}
      <div className="campo">
        <label htmlFor="u-nombre">Nombre</label>
        <input
          id="u-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Gabriela"
          autoFocus
        />
      </div>
      <div className="campo">
        <label htmlFor="u-email">Mail</label>
        <input
          id="u-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="gabriela@elclubdelmate.com"
        />
      </div>
      <div className="campo">
        <label htmlFor="u-pass">Contraseña inicial</label>
        <input
          id="u-pass"
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div className="campo">
        <label htmlFor="u-rol">Rol</label>
        <select id="u-rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          <option value="empleado">Empleado/a — opera la caja, no ve ganancias</option>
          <option value="owner">Dueño/a — ve y maneja todo</option>
        </select>
      </div>
      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar} disabled={trabajando}>
          {trabajando ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </div>
  )
}
