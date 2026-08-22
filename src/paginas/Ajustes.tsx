import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  SECCIONES_CONFIGURABLES,
  SECCIONES_POR_DEFECTO_EMPLEADO,
  type Rol,
  type SeccionId,
  type Usuario,
} from '../db/db'
import { haceCuanto, hoyISO, normalizar, numero } from '../lib/formato'
import CampoContrasena from '../componentes/CampoContrasena'
import { CompartirCatalogo } from '../componentes/BotonWhatsApp'
import { URL_CATALOGO } from '../lib/whatsapp'
import { nubeConfigurada } from '../sync/config'
import { useEstadoNube } from '../sync/useEstadoNube'
import { useSesion } from '../sync/useSesion'

/**
 * Todo lo que entra en una copia manual. Cada vez que se suma una tabla
 * a la base hay que sumarla aca tambien, o esa informacion no viaja en el
 * respaldo (los usuarios no se incluyen: sus cuentas viven en Firebase
 * Auth, no en la base local, y restaurarlos sin sus logins no serviria).
 */
const TABLAS_RESPALDO = [
  'productos',
  'proveedores',
  'movimientosProveedor',
  'jornadas',
  'ventas',
  'movimientos',
  'historialProductos',
  'ajustes',
] as const

type TablaRespaldo = (typeof TABLAS_RESPALDO)[number]

interface Respaldo extends Partial<Record<TablaRespaldo, unknown[]>> {
  app: string
  version: number
  fecha: string
}

export default function Ajustes() {
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const conteos = useLiveQuery(async () => ({
    productos: await db.productos.count(),
    proveedores: await db.proveedores.count(),
    jornadas: await db.jornadas.count(),
    ventas: await db.ventas.count(),
    movimientos: await db.movimientos.count(),
    movimientosProveedor: await db.movimientosProveedor.count(),
  }), [])

  async function exportar() {
    setTrabajando(true)
    try {
      const respaldo: Respaldo = {
        app: 'el-club-del-mate',
        version: 2,
        fecha: new Date().toISOString(),
      }
      for (const tabla of TABLAS_RESPALDO) {
        respaldo[tabla] = await db.table(tabla).toArray()
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
      // Un respaldo viejo (version 1) no trae proveedores ni cuenta
      // corriente: se importa igual lo que si tenga, sin vaciar el resto.
      const presentes = TABLAS_RESPALDO.filter((t) => Array.isArray(datos[t]))
      await db.transaction(
        'rw',
        presentes.map((t) => db.table(t)),
        async () => {
          for (const tabla of presentes) {
            await db.table(tabla).clear()
            await db.table(tabla).bulkPut(datos[tabla] as never[])
          }
        },
      )
      const faltantes = TABLAS_RESPALDO.filter((t) => !presentes.includes(t))
      setMensaje({
        tipo: 'ok',
        texto: faltantes.length
          ? `Respaldo importado. Era una copia vieja, así que no traía: ${faltantes.join(', ')}. Eso quedó como estaba.`
          : 'Respaldo importado.',
      })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo importar: ${e}` })
    } finally {
      setTrabajando(false)
    }
  }

  /**
   * Arma el mismo catalogo.json que publica scripts/generar-catalogo-publico.py,
   * pero con los precios que estan HOY en la app. Sirve cuando se
   * editaron precios desde acá y no desde la planilla de precios.
   *
   * Solo salen tres campos: codigo, descripcion y precio de venta. El
   * costo, la rentabilidad y el proveedor no se publican nunca.
   */
  async function exportarCatalogoPublico() {
    setTrabajando(true)
    try {
      const productos = await db.productos.toArray()
      const publicos = productos
        .filter(
          (p) =>
            p.activo &&
            !p.archivado &&
            !p.descontinuado &&
            p.precioVenta !== null &&
            p.precioVenta > 0 &&
            p.descripcion.trim() !== '',
        )
        .map((p) => ({
          c: p.codigo.trim(),
          d: p.descripcion.trim(),
          p: Math.round(p.precioVenta as number),
          b: normalizar(`${p.codigo} ${p.descripcion}`),
        }))
        .sort((a, b) => a.b.localeCompare(b.b))

      const blob = new Blob([JSON.stringify(publicos)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'catalogo.json'
      a.click()
      URL.revokeObjectURL(url)
      setMensaje({
        tipo: 'ok',
        texto: `Catálogo público con ${publicos.length} productos descargado. Pasámelo y lo publico.`,
      })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo exportar: ${e}` })
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
          <span className="fila-etiqueta">Proveedores</span>
          <span className="fila-valor">{numero(conteos?.proveedores ?? null)}</span>
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
        <div className="fila">
          <span className="fila-etiqueta">Compras y pagos a proveedores</span>
          <span className="fila-valor">{numero(conteos?.movimientosProveedor ?? null)}</span>
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
        <p className="tarjeta-titulo">Catálogo público</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Es la página que ven los clientes: solo nombre, código y precio de venta. El costo,
          la rentabilidad y el proveedor no se publican.
        </p>
        <div className="botonera" style={{ marginBottom: 8 }}>
          <a
            className="boton-chico boton-wa"
            style={{ flex: 1, justifyContent: 'center' }}
            href={URL_CATALOGO}
            target="_blank"
            rel="noopener noreferrer"
          >
            👀 Ver cómo se ve
          </a>
          <CompartirCatalogo />
        </div>
        <button style={{ width: '100%' }} onClick={exportarCatalogoPublico} disabled={trabajando}>
          Exportar catálogo con los precios de hoy
        </button>
        <p className="silencio" style={{ marginBottom: 0 }}>
          La página se actualiza cuando se publica una lista de precios nueva. Si editaste
          precios desde la app y querés que salgan ya, exportá el archivo y pasámelo.
        </p>
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
      <div className="fila">
        <span className="fila-etiqueta">Estado</span>
        <span className={info.clase}>{info.texto}</span>
      </div>
      {/* Contesta de un vistazo "¿lo que carga la otra persona me
          llega?", que es la duda concreta cuando dos personas trabajan
          a la vez. Si dice "todavía nada" con el estado en verde, es
          que nadie cargó nada desde que se abrió la app. */}
      <div className="fila" style={{ marginBottom: 10 }}>
        <span className="fila-etiqueta">Último cambio recibido</span>
        <span className="fila-valor">{haceCuanto(estado.ultimaRecepcion)}</span>
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

const ETIQUETA_SECCION: Record<SeccionId, string> = {
  panel: '🧭 Panel (revisión automática y pendientes)',
  caja: '🧉 Caja',
  productos: '🏷️ Productos',
  proveedores: '🚚 Proveedores',
  gastos: '💸 Gastos',
  reportes: '📊 Reportes (margen de ganancia)',
}

/** Casillas para elegir que secciones ve un empleado. Se usa al crear y al editar. */
function SelectorSecciones({
  value,
  onChange,
}: {
  value: SeccionId[]
  onChange: (secciones: SeccionId[]) => void
}) {
  function alternar(s: SeccionId) {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s])
  }

  return (
    <div className="campo">
      <label>Qué puede ver</label>
      {SECCIONES_CONFIGURABLES.map((s) => (
        <label
          key={s}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            fontWeight: 400,
            fontSize: '0.92rem',
          }}
        >
          <input
            type="checkbox"
            checked={value.includes(s)}
            onChange={() => alternar(s)}
            style={{ width: 'auto' }}
          />
          {ETIQUETA_SECCION[s]}
        </label>
      ))}
    </div>
  )
}

function TarjetaUsuarios() {
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const sesion = useSesion()
  const usuarios = useLiveQuery(
    () =>
      nubeConfigurada
        ? db.usuarios.toArray().then((filas) => filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
        : Promise.resolve<Usuario[]>([]),
    [],
  )

  if (!nubeConfigurada) return null

  async function cambiarActivo(u: Usuario) {
    const verbo = u.activo === false ? 'reactivar' : 'desactivar'
    if (!confirm(`¿Seguro que querés ${verbo} a ${u.nombre}?`)) return
    await db.usuarios.update(u.id, { activo: u.activo === false })
    setMensaje(
      u.activo === false
        ? `${u.nombre} vuelve a tener acceso.`
        : `Se desactivó el acceso de ${u.nombre}. Si estaba usando la app, se le cierra la sesión sola.`,
    )
  }

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
            <li className="item" key={u.id} style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="item-titulo">
                    {u.nombre}
                    {u.activo === false && (
                      <span className="chip" style={{ marginLeft: 6 }}>
                        Desactivado
                      </span>
                    )}
                  </div>
                  <div className="item-sub">{u.email}</div>
                </div>
                <span className={u.rol === 'owner' ? 'chip chip-banco' : 'chip'}>
                  {ETIQUETA_ROL[u.rol]}
                </span>
                {u.rol === 'empleado' && (
                  <button
                    className="boton-chico"
                    onClick={() => setEditando(editando === u.id ? null : u.id)}
                  >
                    {editando === u.id ? 'Cerrar' : 'Qué ve'}
                  </button>
                )}
                {u.id !== sesion.uid && (
                  <button className="boton-chico" onClick={() => cambiarActivo(u)}>
                    {u.activo === false ? 'Reactivar' : 'Desactivar'}
                  </button>
                )}
              </div>
              {editando === u.id && (
                <EditorSecciones
                  usuario={u}
                  onGuardado={() => {
                    setMensaje(`Se actualizó qué puede ver ${u.nombre}.`)
                    setEditando(null)
                  }}
                />
              )}
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

/** Deja tocar que secciones ve un empleado que ya existe. */
function EditorSecciones({
  usuario,
  onGuardado,
}: {
  usuario: Usuario
  onGuardado: () => void
}) {
  const [secciones, setSecciones] = useState<SeccionId[]>(
    usuario.secciones ?? SECCIONES_POR_DEFECTO_EMPLEADO,
  )
  const [trabajando, setTrabajando] = useState(false)

  async function guardar() {
    setTrabajando(true)
    try {
      await db.usuarios.update(usuario.id, { secciones })
      onGuardado()
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="tarjeta" style={{ marginTop: 10, marginBottom: 0, background: 'var(--crema)' }}>
      <SelectorSecciones value={secciones} onChange={setSecciones} />
      <button className="boton-principal" style={{ width: '100%' }} onClick={guardar} disabled={trabajando}>
        {trabajando ? 'Guardando…' : 'Guardar'}
      </button>
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
  const [secciones, setSecciones] = useState<SeccionId[]>(SECCIONES_POR_DEFECTO_EMPLEADO)
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
      await crearUsuario(email, contrasena, nombre, rol, secciones)
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
        <CampoContrasena
          id="u-pass"
          value={contrasena}
          onChange={setContrasena}
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
      {rol === 'empleado' && <SelectorSecciones value={secciones} onChange={setSecciones} />}
      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar} disabled={trabajando}>
          {trabajando ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </div>
  )
}
