import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type AccionHistorial, type EntradaHistorial, type NombreTabla } from '../db/db'
import { fechaLinda, haceCuanto, plata } from '../lib/formato'
import { ETIQUETA_ROL } from '../sync/permisos'

/**
 * El historial de modificaciones.
 *
 * Esta pantalla existe por una razon concreta: el 14/10 aparecieron
 * 1.506 cambios en dos minutos y no habia forma de mirarlos sin abrir la
 * base de datos del navegador. Un registro que no se puede leer no sirve
 * de mucho mas que el que no existe.
 *
 * De ahi el orden: primero el RESUMEN de lo que quedo filtrado --cuantos
 * cambios, de quien, entre que horas, repartidos por campo-- y despues
 * la lista. Con 1.506 renglones, la pregunta nunca es "que dice el
 * renglon 700": es "que paso y quien lo hizo".
 */

/** De a cuantos renglones se muestran. Con miles, cargar todo cuelga la pantalla. */
const TANDA = 60

const ETIQUETA_TABLA: Record<NombreTabla, string> = {
  productos: 'Productos',
  jornadas: 'Turnos de caja',
  ventas: 'Ventas',
  movimientos: 'Movimientos de plata',
  proveedores: 'Proveedores',
  movimientosProveedor: 'Compras y pagos',
  usuarios: 'Usuarios',
  historialProductos: 'Historial (viejo)',
  historial: 'Historial',
  borrados: 'Borrados',
}

const ETIQUETA_ACCION: Record<AccionHistorial, string> = {
  creo: 'Creó',
  edito: 'Editó',
  archivo: 'Archivó',
  borro: 'Borró',
}

/** Nombres de campo como los lee una persona, no como se llaman en el código. */
const ETIQUETA_CAMPO: Record<string, string> = {
  descripcion: 'nombre',
  precioCompra: 'costo',
  fechaCompra: 'fecha del costo',
  precioVenta: 'precio de venta',
  fechaPrecioVenta: 'fecha del precio',
  rentabilidad: 'markup',
  proveedorId: 'proveedor',
  stock: 'stock',
  activo: 'activo',
  archivado: 'archivado',
  descontinuado: 'descontinuado',
  solicitudBorrado: 'pedido de archivado',
  estado: 'estado del turno',
  cajaInicial: 'caja inicial',
  arqueoApertura: 'conteo de apertura',
  arqueoCierre: 'conteo de cierre',
  vendedor: 'vendedor',
  notaCierre: 'nota del cierre',
  cierreAutorizado: 'visto bueno',
  solicitudCierre: 'pedido de cierre',
  rol: 'rol',
  secciones: 'qué ve',
  nombre: 'nombre',
  email: 'mail',
  monto: 'monto',
  concepto: 'concepto',
  categoria: 'categoría',
  tipo: 'tipo',
}

/** Los campos que son plata, para mostrarlos con formato de plata. */
const CAMPOS_DE_PLATA = new Set([
  'precioCompra',
  'precioVenta',
  'monto',
  'cajaInicial',
  'precioUnitario',
])

function etiquetaCampo(campo: string | null): string {
  if (!campo) return ''
  return ETIQUETA_CAMPO[campo] ?? campo
}

/**
 * Un valor como se lee en pantalla.
 *
 * Los objetos (un arqueo, un visto bueno) no se despliegan: ocuparian
 * media pantalla y no se leen. Se dice que cambiaron y listo.
 */
function comoSeLee(valor: unknown, campo: string | null): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no'
  if (typeof valor === 'number' && campo && CAMPOS_DE_PLATA.has(campo)) return plata(valor)
  if (typeof valor === 'object') return '(cambió)'
  return String(valor)
}

export default function Historial() {
  const [quien, setQuien] = useState('')
  const [tabla, setTabla] = useState('')
  const [campo, setCampo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [cuantos, setCuantos] = useState(TANDA)

  // Se trae todo y se filtra en memoria. Con decenas de miles de
  // renglones habria que paginar en la base; con los miles que maneja
  // este negocio, traerlos es mas simple y los filtros responden al
  // toque, sin un viaje a la base por cada tecla.
  const todo = useLiveQuery(() => db.historial.orderBy('cuando').reverse().toArray(), [])

  const personas = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const h of todo ?? []) mapa.set(h.quien, h.quienNombre)
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1]))
  }, [todo])

  const camposPresentes = useMemo(() => {
    const vistos = new Set<string>()
    for (const h of todo ?? []) if (h.campo) vistos.add(h.campo)
    return [...vistos].sort((a, b) => etiquetaCampo(a).localeCompare(etiquetaCampo(b)))
  }, [todo])

  const filtrado = useMemo(() => {
    // El 'desde' incluye todo el dia; el 'hasta' tambien, de ahi el
    // +1 dia: alguien que filtra "hasta el 14" espera ver el 14.
    const minimo = desde ? Date.parse(`${desde}T00:00:00`) : null
    const maximo = hasta ? Date.parse(`${hasta}T00:00:00`) + 86_400_000 : null

    return (todo ?? []).filter((h) => {
      if (quien && h.quien !== quien) return false
      if (tabla && h.tabla !== tabla) return false
      if (campo && h.campo !== campo) return false
      if (minimo !== null && h.cuando < minimo) return false
      if (maximo !== null && h.cuando >= maximo) return false
      return true
    })
  }, [todo, quien, tabla, campo, desde, hasta])

  /**
   * El resumen de lo filtrado. Es lo primero que se mira: con miles de
   * renglones, la pregunta es "que paso", no "que dice el renglon 700".
   */
  const resumen = useMemo(() => {
    if (filtrado.length === 0) return null
    const porCampo = new Map<string, number>()
    const porPersona = new Map<string, number>()
    for (const h of filtrado) {
      const clave = h.campo ? etiquetaCampo(h.campo) : ETIQUETA_ACCION[h.accion].toLowerCase()
      porCampo.set(clave, (porCampo.get(clave) ?? 0) + 1)
      porPersona.set(h.quienNombre, (porPersona.get(h.quienNombre) ?? 0) + 1)
    }
    return {
      total: filtrado.length,
      // Ya viene ordenado de mas nuevo a mas viejo.
      hasta: filtrado[0].cuando,
      desde: filtrado[filtrado.length - 1].cuando,
      porCampo: [...porCampo].sort((a, b) => b[1] - a[1]),
      porPersona: [...porPersona].sort((a, b) => b[1] - a[1]),
      conMotivo: [...new Set(filtrado.map((h) => h.motivo).filter(Boolean))] as string[],
    }
  }, [filtrado])

  const hayFiltro = Boolean(quien || tabla || campo || desde || hasta)

  function limpiar() {
    setQuien('')
    setTabla('')
    setCampo('')
    setDesde('')
    setHasta('')
    setCuantos(TANDA)
  }

  return (
    <>
      <h2>Historial de modificaciones</h2>

      <div className="aviso aviso-ojo">
        Queda registrado quién creó, editó, archivó o borró cada cosa, con el valor de antes y el
        de después. <strong>No se puede editar ni borrar</strong>, por ningún rol.
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Filtros</p>

        <div className="campo">
          <label htmlFor="h-quien">Quién</label>
          <select id="h-quien" value={quien} onChange={(e) => setQuien(e.target.value)}>
            <option value="">Cualquiera</option>
            {personas.map(([mail, nombre]) => (
              <option key={mail} value={mail}>
                {nombre} ({mail})
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="h-tabla">Dónde</label>
          <select id="h-tabla" value={tabla} onChange={(e) => setTabla(e.target.value)}>
            <option value="">Todo</option>
            {(
              [
                'productos',
                'jornadas',
                'ventas',
                'movimientos',
                'proveedores',
                'movimientosProveedor',
                'usuarios',
              ] as NombreTabla[]
            ).map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TABLA[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="h-campo">Qué cambió</label>
          <select id="h-campo" value={campo} onChange={(e) => setCampo(e.target.value)}>
            <option value="">Cualquier cosa</option>
            {camposPresentes.map((c) => (
              <option key={c} value={c}>
                {etiquetaCampo(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="grilla grilla-2">
          <div className="campo">
            <label htmlFor="h-desde">Desde</label>
            <input
              id="h-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="h-hasta">Hasta</label>
            <input
              id="h-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        </div>

        {hayFiltro && (
          <button className="boton-chico" style={{ width: '100%' }} onClick={limpiar}>
            Limpiar los filtros
          </button>
        )}
      </div>

      {todo === undefined ? (
        <p className="vacio">Cargando…</p>
      ) : resumen === null ? (
        <p className="vacio">
          {hayFiltro ? 'No hay cambios con esos filtros.' : 'Todavía no hay cambios registrados.'}
        </p>
      ) : (
        <>
          <div className="tarjeta">
            <p className="tarjeta-titulo">
              {resumen.total === 1 ? '1 cambio' : `${resumen.total.toLocaleString('es-AR')} cambios`}
            </p>
            <div className="fila">
              <span className="fila-etiqueta">Entre</span>
              <span className="fila-valor">
                {fechaLinda(new Date(resumen.desde).toISOString().slice(0, 10))}
                {' y '}
                {fechaLinda(new Date(resumen.hasta).toISOString().slice(0, 10))}
              </span>
            </div>
            {resumen.porPersona.map(([nombre, cuenta]) => (
              <div className="fila" key={nombre}>
                <span className="fila-etiqueta">{nombre}</span>
                <span className="fila-valor">{cuenta.toLocaleString('es-AR')}</span>
              </div>
            ))}
            {resumen.conMotivo.length > 0 && (
              <div className="fila">
                <span className="fila-etiqueta">De</span>
                <span className="fila-valor">{resumen.conMotivo.join(', ')}</span>
              </div>
            )}

            <p className="silencio" style={{ marginBottom: 4, marginTop: 10 }}>
              Repartidos así:
            </p>
            <ul className="lista">
              {resumen.porCampo.map(([nombre, cuenta]) => (
                <li className="item" key={nombre}>
                  <span className="item-titulo">{nombre}</span>
                  <span className="fila-valor">{cuenta.toLocaleString('es-AR')}</span>
                </li>
              ))}
            </ul>
            <p className="silencio" style={{ marginBottom: 0 }}>
              Dos campos con la misma cantidad suelen venir de un cambio en bloque: por ejemplo un
              aumento de costos actualiza el costo y su fecha en cada producto.
            </p>
          </div>

          <ul className="lista">
            {filtrado.slice(0, cuantos).map((h) => (
              <Renglon entrada={h} key={h.id} />
            ))}
          </ul>

          {filtrado.length > cuantos && (
            <button
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => setCuantos((n) => n + TANDA)}
            >
              Ver {Math.min(TANDA, filtrado.length - cuantos)} más (quedan{' '}
              {(filtrado.length - cuantos).toLocaleString('es-AR')})
            </button>
          )}
        </>
      )}
    </>
  )
}

function Renglon({ entrada }: { entrada: EntradaHistorial }) {
  const esEdicion = entrada.accion === 'edito' || entrada.accion === 'archivo'

  return (
    <li className="item" style={{ display: 'block' }}>
      <div className="item-titulo">
        {ETIQUETA_ACCION[entrada.accion]}
        {entrada.campo ? ` ${etiquetaCampo(entrada.campo)} de ` : ' '}
        {entrada.queEs}
      </div>

      {esEdicion && (
        <div className="item-sub">
          {comoSeLee(entrada.valorAnterior, entrada.campo)} →{' '}
          <strong>{comoSeLee(entrada.valorNuevo, entrada.campo)}</strong>
        </div>
      )}

      <div className="item-sub">
        {entrada.quienNombre}
        {entrada.quienRol ? ` (${ETIQUETA_ROL[entrada.quienRol]})` : ''} ·{' '}
        {haceCuanto(entrada.cuando)} ·{' '}
        {new Date(entrada.cuando).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      {entrada.motivo && <div className="item-sub">«{entrada.motivo}»</div>}

      <div className="item-sub silencio">
        {ETIQUETA_TABLA[entrada.tabla]} · {entrada.clave}
      </div>
    </li>
  )
}
