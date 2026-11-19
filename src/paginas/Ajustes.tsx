import { useEffect, useState } from 'react'
import { useSinGuardar } from '../lib/sinGuardar'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  conMotivo,
  db,
  nuevoId,
  SECCIONES_CONFIGURABLES,
  SECCIONES_POR_DEFECTO_EMPLEADO,
  type Rol,
  type SeccionId,
  type Usuario,
} from '../db/db'
import { haceCuanto, hoyISO, normalizar, numero } from '../lib/formato'
import CampoContrasena from '../componentes/CampoContrasena'
import { CompartirCatalogo } from '../componentes/BotonWhatsApp'
import {
  ETIQUETA_ROL,
  QUE_HACE_CADA_ROL,
  esDueno,
  puedeBorrarTodo,
  puedeImportarRespaldo,
  puedeTocarUsuarioConRol,
  rolesQuePuedeAsignar,
} from '../sync/permisos'
import { URL_CATALOGO } from '../lib/whatsapp'
import { nubeConfigurada } from '../sync/config'
import { useEstadoNube } from '../sync/useEstadoNube'
import { estaAlMando } from '../sync/permisos'
import { fechaLinda, plata } from '../lib/formato'
import type { Coincidencia, TurnoRetenido } from '../sync/retener'
import { Link } from 'react-router-dom'
import { useSesion } from '../sync/useSesion'
import {
  importarRespaldo,
  preguntaAntesDeImportar,
  TABLAS_RESPALDO,
  type Respaldo,
} from '../db/importarRespaldo'
import { apagarModoConsulta, leerModoConsulta, prenderModoConsulta } from '../lib/modoConsulta'
import {
  MOTIVO_DUENO_SIN_CUENTA,
  apodosLimpios,
  duenoSinCuenta,
  problemaDelDuenoSinCuenta,
  textoDeConfirmacionDuenoSinCuenta,
} from '../lib/sueldos'

export default function Ajustes() {
  const sesion = useSesion()
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const modoConsulta = useLiveQuery(() => leerModoConsulta(), [], false)

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
    setTrabajando(true)
    try {
      const datos: unknown = JSON.parse(await archivo.text())
      // La pregunta va con el archivo ya leido: dice de cuando es y
      // cuanto trae, y que el servidor no se toca (ver importarRespaldo).
      if (!confirm(preguntaAntesDeImportar(datos))) return
      const { faltantes } = await importarRespaldo(datos)
      setMensaje({
        tipo: 'ok',
        texto: faltantes.length
          ? `Respaldo importado en este aparato. Era una copia vieja, así que no traía: ${faltantes.join(', ')}. Eso quedó como estaba.`
          : 'Respaldo importado en este aparato. En el servidor no cambió nada.',
      })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo importar: ${e instanceof Error ? e.message : e}` })
    } finally {
      setTrabajando(false)
    }
  }

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
      <TarjetaRetenidos />
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
        {/* Importar reemplaza lo de ESTE aparato por lo que diga el
            archivo; al servidor no le borra ni le pisa nada (19/11, ver
            db/importarRespaldo.ts). Sigue con el candado de la zona
            peligrosa: lo que el archivo tenga y el servidor no, se sube. */}
        {puedeImportarRespaldo(sesion.perfil) && (
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
        )}
        <button style={{ width: '100%', marginTop: 6 }} onClick={exportarVentasCSV}>
          Exportar ventas a CSV (para Excel)
        </button>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Turnos del día</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Todos los turnos de un día, incluso si quedaron dos cargados para el mismo momento
          desde dos dispositivos. Desde acá se puede borrar el que sobra, con motivo y registrado
          en el historial.
        </p>
        <Link className="boton-chico" style={{ width: '100%', textAlign: 'center' }} to="/turnos">
          Ver los turnos de un día
        </Link>
      </div>

      {esDueno(sesion.perfil) && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Recuperar costos y proveedores</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Para los productos que quedaron sin costo o sin proveedor el 20/10. Saca los datos del
            historial de la app y, si hace falta, de un archivo (el Excel, la foto de agosto).
            Rellena <strong>solo lo que está vacío</strong>: no pisa nada de lo que se cargó
            después. Muestra la vista previa antes de tocar nada.
          </p>
          <Link
            className="boton-chico"
            style={{ width: '100%', textAlign: 'center' }}
            to="/recuperar"
          >
            Ver qué se puede recuperar
          </Link>
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Unir proveedores</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Cuando el mismo proveedor quedó cargado dos veces. Muestra las fichas que parecen la
          misma, y al unirlas pasan los productos y la cuenta corriente —compras y pagos— a la
          que queda. El nombre de la otra queda guardado como «otro nombre», así no se vuelve a
          crear sola.
        </p>
        <Link
          className="boton-chico"
          style={{ width: '100%', textAlign: 'center' }}
          to="/unir-proveedores"
        >
          Unir proveedores
        </Link>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Revisión de costos</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Los productos sin costo o con el costo vencido, filtrados por proveedor y corregibles
          en la misma lista, sin entrar uno por uno. Se guarda el costo y su fecha; el precio de
          venta y el resto no se tocan.
        </p>
        <Link
          className="boton-chico"
          style={{ width: '100%', textAlign: 'center' }}
          to="/revision-costos"
        >
          Revisar costos
        </Link>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Ventas sin código</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Lo que se vendió con «Vender igual, sin código», para decir de a una qué producto
          era. Así esas ventas pasan a tener costo y a mover stock. Muestra también los
          productos comodín que tienen ventas, sin tocarlos.
        </p>
        <Link
          className="boton-chico"
          style={{ width: '100%', textAlign: 'center' }}
          to="/ventas-sin-codigo"
        >
          Ver ventas sin código
        </Link>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Revisión de proveedores</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Cuántos proveedores hay, cuáles están repetidos, cuáles están inactivos y cuáles usan
          los productos sin que exista la ficha. Es solo para mirar: no cambia nada.
        </p>
        <Link
          className="boton-chico"
          style={{ width: '100%', textAlign: 'center' }}
          to="/revision-proveedores"
        >
          Ver la revisión
        </Link>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Modo consulta de precios</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Para el celular del salón. La app abre directo en el buscador, con el precio grande y
          sin los avisos arriba. No se ve el costo ni el margen: la pantalla se da vuelta hacia
          el cliente.
        </p>
        <p className="silencio">
          Se configura <strong>por dispositivo</strong>: prenderlo acá no se lo prende a nadie
          más. {modoConsulta ? 'Este dispositivo lo tiene prendido.' : 'Este dispositivo lo tiene apagado.'}
        </p>
        <div className="botonera">
          {modoConsulta ? (
            <button onClick={() => apagarModoConsulta()}>Apagar en este dispositivo</button>
          ) : (
            <button onClick={() => prenderModoConsulta()}>Prender en este dispositivo</button>
          )}
          <Link className="boton-chico" style={{ textAlign: 'center' }} to="/consulta">
            Probarlo
          </Link>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Cómo venimos</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          El uso de la app semana por semana: días con la caja cargada, ventas cargadas en el
          momento o después, y lo que entró de los proveedores. Para el seguimiento del lunes.
        </p>
        <Link className="boton-chico" style={{ width: '100%', textAlign: 'center' }} to="/uso">
          Ver cómo venimos
        </Link>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Historial de modificaciones</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Quién creó, editó, archivó o borró cada cosa, con el valor de antes y el de después.
          No se puede editar ni borrar, por ningún rol.
        </p>
        <Link className="boton-chico" style={{ width: '100%', textAlign: 'center' }} to="/historial">
          Ver el historial
        </Link>
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

      {puedeBorrarTodo(sesion.perfil) && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Zona peligrosa</p>
          <button className="boton-peligro" style={{ width: '100%' }} onClick={borrarTodo}>
            Borrar todos los datos
          </button>
        </div>
      )}
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

/**
 * Los turnos que la subida inicial retuvo para no duplicar (ver
 * sync/retener.ts). Quien esta al mando decide, turno por turno.
 */
function TarjetaRetenidos() {
  const estado = useEstadoNube()
  const sesion = useSesion()
  const [mensaje, setMensaje] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [comparacion, setComparacion] = useState<Map<string, Coincidencia> | null>(null)
  const alMando = estaAlMando(sesion.perfil)
  const retenidos = estado.retenidos

  // Cada vez que cambia la lista se vuelve a comparar con lo que el
  // servidor ya tiene (ver compararConServidor en retener.ts).
  useEffect(() => {
    let vigente = true
    setComparacion(null)
    if (retenidos.length === 0) return
    import('../sync/motor')
      .then(({ compararRetenidos }) => compararRetenidos(retenidos))
      .then((c) => {
        if (vigente) setComparacion(c)
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [retenidos])

  if (!nubeConfigurada || retenidos.length === 0) return null
  const nombreTurno = (t: TurnoRetenido) =>
    `${fechaLinda(t.fecha)} ${t.turno === 'M' ? 'mañana' : 'tarde'}`

  const copias = comparacion ? retenidos.filter((t) => comparacion.get(t.id) === 'igual') : []
  const sinServidor = comparacion
    ? retenidos.filter((t) => comparacion.get(t.id) === 'sin-servidor').length
    : 0
  const paraMirar = comparacion
    ? retenidos.filter((t) => comparacion.get(t.id) !== 'igual')
    : retenidos
  const ventasDeCopias = copias.reduce((s, t) => s + t.ventas, 0)
  const MOSTRAR = 30

  async function descartarCopias() {
    const movimientos = copias.reduce((s, t) => s + t.movimientos, 0)
    if (
      !confirm(
        `¿Sacar de este aparato ${copias.length} turnos con ${ventasDeCopias.toLocaleString('es-AR')} ventas y ${movimientos} movimientos?\n\n` +
          'Son copias exactas de turnos que ya están en el servidor: mismo día, mismo horario, mismas ventas y mismos montos. ' +
          'En el servidor no cambia nada. Queda un renglón en el historial con el motivo.',
      )
    ) {
      return
    }
    setTrabajando('copias')
    try {
      const { descartarCopiasRetenidas } = await import('../sync/motor')
      const r = await descartarCopiasRetenidas(
        'Copias exactas de turnos que ya estaban en el servidor (importación vieja de la planilla). Se sacaron solo de este aparato.',
      )
      setMensaje(
        `Listo: se sacaron de este aparato ${r.turnos} turnos con ${r.ventas.toLocaleString('es-AR')} ventas. El servidor quedó igual.`,
      )
    } catch (e) {
      setMensaje(`No se pudo: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTrabajando(null)
    }
  }

  async function descartar(t: TurnoRetenido) {
    if (
      !confirm(
        `¿Descartar el turno ${nombreTurno(t)} de este aparato?\n\nSe borran de ACÁ sus ${t.ventas} ventas (${plata(t.totalVentas)}) y ${t.movimientos} egresos. El servidor no cambia: ahí queda el turno cargado desde el otro aparato.`,
      )
    ) {
      return
    }
    setTrabajando(t.id)
    try {
      const { descartarTurnoRetenido } = await import('../sync/motor')
      await descartarTurnoRetenido(t.id)
      setMensaje(`Descartado el turno ${nombreTurno(t)} de este aparato.`)
    } finally {
      setTrabajando(null)
    }
  }

  async function subir(t: TurnoRetenido) {
    if (
      !confirm(
        `¿Subir igual el turno ${nombreTurno(t)}?\n\nVa a quedar un segundo turno para esa fecha y horario, con sus ${t.ventas} ventas (${plata(t.totalVentas)}). Solo si de verdad no está cargado. Después se ve en Turnos del día.`,
      )
    ) {
      return
    }
    setTrabajando(t.id)
    try {
      const { subirTurnoRetenido } = await import('../sync/motor')
      const n = await subirTurnoRetenido(t.id)
      setMensaje(`Subido el turno ${nombreTurno(t)}: ${n} registros.`)
    } catch (e) {
      setMensaje(`No se pudo subir: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Cargas retenidas</p>
      <div className="aviso aviso-error">
        Estos turnos están en este aparato pero <strong>no se subieron</strong>: el servidor ya
        tiene un turno para esa misma fecha y horario, cargado desde otro aparato. Subirlos a
        ciegas los duplicaría. Si ya están cargados allá, descartalos de acá. Si de verdad
        faltan, subilos.
      </div>
      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

      {!comparacion ? (
        <p className="silencio">
          Comparando {retenidos.length.toLocaleString('es-AR')} turnos con lo que tiene el servidor…
        </p>
      ) : (
        <>
          <div className="fila">
            <span className="fila-etiqueta">Copias exactas de lo que ya está en el servidor</span>
            <span className="fila-valor">{copias.length.toLocaleString('es-AR')}</span>
          </div>
          <div className="fila">
            <span className="fila-etiqueta">Distintas: hay que mirarlas</span>
            <span className="fila-valor">{(paraMirar.length - sinServidor).toLocaleString('es-AR')}</span>
          </div>
          {sinServidor > 0 && (
            <div className="fila">
              <span className="fila-etiqueta">Todavía sin el turno del servidor para comparar</span>
              <span className="fila-valor">{sinServidor.toLocaleString('es-AR')}</span>
            </div>
          )}
          {copias.length > 0 &&
            (alMando ? (
              <button
                className="boton-principal"
                style={{ marginTop: 8 }}
                disabled={trabajando !== null}
                onClick={() => void descartarCopias()}
              >
                {trabajando === 'copias'
                  ? 'Sacando…'
                  : `Sacar de este aparato las ${copias.length.toLocaleString('es-AR')} copias exactas`}
              </button>
            ) : (
              <p className="silencio">Lo decide un dueño o la encargada desde este mismo aparato.</p>
            ))}
        </>
      )}

      {paraMirar.length > 0 && (
        <ul className="lista" style={{ marginTop: 8 }}>
          {paraMirar.slice(0, MOSTRAR).map((t) => (
            <li className="item" key={t.id} style={{ display: 'block' }}>
              <div className="item-titulo">{nombreTurno(t)}</div>
              <div className="item-sub">
                {t.ventas} {t.ventas === 1 ? 'venta' : 'ventas'} por {plata(t.totalVentas)} ·{' '}
                {t.movimientos} {t.movimientos === 1 ? 'egreso' : 'egresos'}
                {comparacion?.get(t.id) === 'distinto' && ' · no coincide con el del servidor'}
                {comparacion?.get(t.id) === 'sin-servidor' && ' · falta el del servidor para comparar'}
              </div>
              {alMando ? (
                <div className="botonera" style={{ marginTop: 6 }}>
                  <button
                    className="boton-chico"
                    disabled={trabajando !== null}
                    onClick={() => void descartar(t)}
                  >
                    Ya está cargado: descartar
                  </button>
                  <button
                    className="boton-chico"
                    disabled={trabajando !== null}
                    onClick={() => void subir(t)}
                  >
                    Falta de verdad: subirlo
                  </button>
                </div>
              ) : (
                <p className="silencio" style={{ marginTop: 4, marginBottom: 0 }}>
                  Lo decide un dueño o la encargada desde este mismo aparato.
                </p>
              )}
            </li>
          ))}
          {paraMirar.length > MOSTRAR && (
            <li className="item silencio">
              Y {(paraMirar.length - MOSTRAR).toLocaleString('es-AR')} más. Aparecen a medida que se
              resuelven los de arriba.
            </li>
          )}
        </ul>
      )}
    </div>
  )
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
      <div className="fila">
        <span className="fila-etiqueta">Último cambio recibido</span>
        <span className="fila-valor">{haceCuanto(estado.ultimaRecepcion)}</span>
      </div>
      {/* Para saber, cuando algo falla en un aparato, si tiene la ultima
          version o una vieja sin "Actualizar". */}
      <div className="fila" style={{ marginBottom: 10 }}>
        <span className="fila-etiqueta">Versión de la app</span>
        <span className="fila-valor">{__VERSION_APP__}</span>
      </div>
      <div className="fila" style={{ marginBottom: 10 }}>
        <span className="fila-etiqueta">Lo que no subió</span>
        <span className="fila-valor">
          <Link to="/sin-subir">Ver y revisar</Link>
        </span>
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
  const [sumandoDueno, setSumandoDueno] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [conApodos, setConApodos] = useState<string | null>(null)
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
    // Un dueño sin cuenta no tiene acceso que apagar: desactivarlo es
    // sacarlo de la lista para anotarle retiros.
    const pregunta = !u.sinCuenta
      ? `¿Seguro que querés ${verbo} a ${u.nombre}?`
      : u.activo === false
        ? `¿Volver a poner a ${u.nombre} en la lista de dueños para anotarle retiros?`
        : `¿Sacar a ${u.nombre} de la lista de dueños? Ya no aparece para anotarle retiros nuevos; los que tiene quedan.`
    if (!confirm(pregunta)) return
    await db.usuarios.update(u.id, { activo: u.activo === false })
    setMensaje(
      u.sinCuenta
        ? u.activo === false
          ? `${u.nombre} vuelve a aparecer para anotarle retiros.`
          : `${u.nombre} ya no aparece para anotarle retiros. Los que tiene quedan.`
        : u.activo === false
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
                  <div className="item-sub">
                    {u.sinCuenta ? 'Sin cuenta: no entra a la app. Está para anotarle los retiros.' : u.email}
                  </div>
                  {u.apodos && <div className="item-sub">En los gastos también figura como: {u.apodos}</div>}
                </div>
                <span className={u.rol === 'owner' ? 'chip chip-banco' : 'chip'}>
                  {ETIQUETA_ROL[u.rol]}
                  {u.sinCuenta ? ' · sin cuenta' : ''}
                </span>
                {u.rol === 'empleado' && puedeTocarUsuarioConRol(sesion.perfil, u.rol) && (
                  <button
                    className="boton-chico"
                    onClick={() => setEditando(editando === u.id ? null : u.id)}
                  >
                    {editando === u.id ? 'Cerrar' : 'Qué ve'}
                  </button>
                )}
                {puedeTocarUsuarioConRol(sesion.perfil, u.rol) && (
                  <button
                    className="boton-chico"
                    onClick={() => setConApodos(conApodos === u.id ? null : u.id)}
                  >
                    {conApodos === u.id ? 'Cerrar' : 'Apodos'}
                  </button>
                )}
                {/* Un encargado no le apaga el acceso a un dueño: si
                    pudiera, el limite de su rol seria una formalidad. */}
                {u.id !== sesion.uid && puedeTocarUsuarioConRol(sesion.perfil, u.rol) && (
                  <button className="boton-chico" onClick={() => cambiarActivo(u)}>
                    {u.activo === false ? 'Reactivar' : 'Desactivar'}
                  </button>
                )}
              </div>
              {conApodos === u.id && (
                <EditorApodos
                  usuario={u}
                  onGuardado={() => {
                    setMensaje(`Se guardó cómo figura ${u.nombre} en los gastos.`)
                    setConApodos(null)
                  }}
                />
              )}
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

      {/* Los dueños que no usan la app (19/11): solo un dueño los agrega. */}
      {esDueno(sesion.perfil) &&
        (sumandoDueno ? (
          <FormularioDuenoSinCuenta
            existentes={usuarios ?? []}
            onSalir={() => setSumandoDueno(false)}
            onAgregado={(nombre) => {
              setMensaje(`${nombre} quedó entre los dueños, sin cuenta. Ya se le pueden anotar retiros.`)
              setSumandoDueno(false)
            }}
          />
        ) : (
          <button style={{ width: '100%', marginTop: 8 }} onClick={() => setSumandoDueno(true)}>
            + Dueño que no usa la app
          </button>
        ))}
    </div>
  )
}

/**
 * Un dueño que no usa la app (19/11): queda en la lista para anotarle los
 * retiros, sin mail ni clave. Crearle una cuenta que nadie usa sería un
 * acceso total de más; esto no da acceso a nada.
 */
function FormularioDuenoSinCuenta({
  existentes,
  onSalir,
  onAgregado,
}: {
  existentes: Usuario[]
  onSalir: () => void
  onAgregado: (nombre: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  useSinGuardar('el dueño nuevo', nombre.trim() !== '')

  async function agregar() {
    const problema = problemaDelDuenoSinCuenta(nombre, existentes)
    setError(problema ?? '')
    if (problema || !confirm(textoDeConfirmacionDuenoSinCuenta(nombre))) return
    setTrabajando(true)
    try {
      const nuevo = duenoSinCuenta(nombre, nuevoId())
      await conMotivo(MOTIVO_DUENO_SIN_CUENTA, () => db.usuarios.add(nuevo))
      onAgregado(nuevo.nombre)
    } catch (e) {
      setError(`No se pudo agregar: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="tarjeta" style={{ marginTop: 10, marginBottom: 0, background: 'var(--crema)' }}>
      {error && <div className="aviso aviso-error">{error}</div>}
      <div className="campo">
        <label htmlFor="dueno-sin-cuenta">Nombre del dueño</label>
        <input
          id="dueno-sin-cuenta"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Elena"
          autoFocus
        />
        <p className="silencio" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
          Para quien es dueño y no usa la app: queda en la lista para anotarle los retiros, sin mail ni
          clave, así que no puede entrar. No hace falta crearle una cuenta.
        </p>
      </div>
      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={agregar} disabled={trabajando}>
          {trabajando ? 'Agregando…' : 'Agregar'}
        </button>
      </div>
    </div>
  )
}

/**
 * Con que otros nombres figura alguien en los conceptos de los gastos
 * (19/11): «Gabi» por Gabriela. Con eso la app reconoce de quien es un
 * sueldo o un retiro anotado a mano (ver lib/sueldos.ts).
 */
function EditorApodos({ usuario, onGuardado }: { usuario: Usuario; onGuardado: () => void }) {
  const [texto, setTexto] = useState(usuario.apodos ?? '')
  const [trabajando, setTrabajando] = useState(false)

  async function guardar() {
    setTrabajando(true)
    try {
      await db.usuarios.update(usuario.id, { apodos: apodosLimpios(texto) })
      onGuardado()
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="tarjeta" style={{ marginTop: 10, marginBottom: 0, background: 'var(--crema)' }}>
      <div className="campo">
        <label htmlFor={`apodos-${usuario.id}`}>¿Cómo le dicen? (separados por coma)</label>
        <input
          id={`apodos-${usuario.id}`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: Gabi, Gaby"
          autoFocus
        />
        <p className="silencio" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
          Sirve para reconocer sus pagos: si un gasto dice «SEMANA GABI», la app sabe que es de{' '}
          {usuario.nombre}. Lo ve todo el equipo, como el nombre.
        </p>
      </div>
      <button className="boton-principal" style={{ width: '100%' }} onClick={guardar} disabled={trabajando}>
        {trabajando ? 'Guardando…' : 'Guardar'}
      </button>
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
  const sesion = useSesion()
  // Solo los roles que esta persona puede asignar. Un encargado no crea
  // dueños, asi que la opcion no esta ni en la lista.
  const asignables = rolesQuePuedeAsignar(sesion.perfil)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [rol, setRol] = useState<Rol>('empleado')

  const [secciones, setSecciones] = useState<SeccionId[]>(SECCIONES_POR_DEFECTO_EMPLEADO)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  useSinGuardar('el usuario nuevo', nombre.trim() !== '' || email.trim() !== '')

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
          {asignables.map((r) => (
            <option key={r} value={r}>
              {QUE_HACE_CADA_ROL[r]}
            </option>
          ))}
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
