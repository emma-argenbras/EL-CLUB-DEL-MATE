import { describe, expect, it } from 'vitest'
import {
  clasificarPendiente,
  describirPendiente,
  faltanEnTabla,
  filasRetenidasEn,
  firmadosPorOtroEn,
  motivoDeRechazo,
  siguenPendientes,
  textoDeTurnosSinSubir,
  turnosQueFaltan,
  type Pendiente,
  type Revision,
} from './sinSubir'
import { fechaLinda } from '../lib/formato'

const contexto = {
  borrados: new Set(['ventas/borrada-en-la-mac']),
  retenidos: new Set(['gabi-29m']),
  email: 'sucursalconcordia@elclubdelmate.com',
  uid: 'uid-gabi',
}
const p = (tabla: Pendiente['tabla'], clave: string, fila: Record<string, unknown> = {}): Pendiente => ({
  tabla,
  clave,
  fila: { id: clave, ...fila },
})

describe('clasificarPendiente: que es cada cosa que el aviso contaba', () => {
  it('lo que se borro a proposito desde otro aparato se saca de este', () => {
    expect(clasificarPendiente(p('ventas', 'borrada-en-la-mac'), contexto)).toBe('ya-borrado')
  })

  it('lo de un turno retenido no se sube: tiene su propio cartel', () => {
    expect(clasificarPendiente(p('jornadas', 'gabi-29m'), contexto)).toBe('retenido')
    expect(clasificarPendiente(p('ventas', 'g1', { jornadaId: 'gabi-29m' }), contexto)).toBe('retenido')
  })

  it('un renglon del historial firmado por otra persona no lo puede subir esta sesion', () => {
    expect(
      clasificarPendiente(p('historial', 'h1', { quien: 'ventas@elclubdelmate.com' }), contexto),
    ).toBe('firmado-por-otro')
    expect(
      clasificarPendiente(p('historial', 'h2', { quien: 'sucursalconcordia@elclubdelmate.com' }), contexto),
    ).toBe('subir')
  })

  it('un usuario que el servidor ya no tiene no se revive; el propio si se deja', () => {
    expect(clasificarPendiente(p('usuarios', 'uid-viejo'), contexto)).toBe('usuario-viejo')
    expect(clasificarPendiente(p('usuarios', 'uid-gabi'), contexto)).toBe('subir')
  })

  it('una venta comun que no habia subido, se sube', () => {
    expect(clasificarPendiente(p('ventas', 'v-nueva', { jornadaId: 'otro' }), contexto)).toBe('subir')
  })
})

describe('el aviso no cuenta lo que no se sube a proposito', () => {
  const retenidos = [
    { id: 'a', fecha: '2026-10-29', turno: 'M' as const, idEnServidor: 's', ventas: 2, totalVentas: 50000, movimientos: 0 },
  ]

  it('un turno retenido con 2 ventas: el aviso decia 3, ahora 0', () => {
    let total = 0
    total += faltanEnTabla(11, 10, filasRetenidasEn('jornadas', retenidos))
    total += faltanEnTabla(52, 50, filasRetenidasEn('ventas', retenidos))
    total += faltanEnTabla(7, 7, filasRetenidasEn('movimientos', retenidos))
    expect(total).toBe(0)
  })

  it('lo que de verdad falta se sigue contando', () => {
    expect(faltanEnTabla(53, 50, filasRetenidasEn('ventas', retenidos))).toBe(1)
  })

  it('nunca da negativo', () => {
    expect(faltanEnTabla(10, 12, 3)).toBe(0)
  })

  it('los renglones firmados por otra persona se descuentan de su tabla, y solo de esa', () => {
    const revision: Revision = {
      cuando: 0,
      renglones: [
        { tabla: 'historial', clave: 'h1', que: '', resultado: 'firmado-por-otro' },
        { tabla: 'ventas', clave: 'v', que: '', resultado: 'rechazado', motivo: 'x' },
      ],
    }
    expect(firmadosPorOtroEn('historial', revision)).toBe(1)
    expect(firmadosPorOtroEn('ventas', revision)).toBe(0)
    expect(firmadosPorOtroEn('historial', null)).toBe(0)
    expect(siguenPendientes(revision).map((r) => r.clave)).toEqual(['v'])
  })
})

describe('describirPendiente', () => {
  it('dice que es en palabras', () => {
    expect(
      describirPendiente(
        p('ventas', 'v1', { fecha: '2026-11-04', hora: '10:32', descripcion: 'MATE TORPEDO', total: 45000 }),
      ),
    ).toMatch(/^Venta del 04\/11\/2026 a las 10:32: MATE TORPEDO, /)
    expect(describirPendiente(p('jornadas', 'j', { fecha: '2026-11-04', turno: 'M', vendedor: 'Gabriela' }))).toBe(
      'Turno del 04/11/2026 mañana, de Gabriela',
    )
    expect(
      describirPendiente(p('historial', 'h', { queEs: 'MATE TORPEDO (TM015)', quienNombre: 'Sandra' })),
    ).toBe('Renglón del historial: MATE TORPEDO (TM015), anotado por Sandra')
  })
})

describe('motivoDeRechazo', () => {
  it('un turno con el cierre autorizado: dice quien lo puede subir', () => {
    expect(
      motivoDeRechazo('jornadas', { cierreAutorizado: { quien: 'x' } }, { code: 'permission-denied' }),
    ).toMatch(/alguien al mando/)
  })
  it('lo demas que las reglas no dejan', () => {
    expect(motivoDeRechazo('ventas', {}, { code: 'permission-denied' })).toMatch(/reglas/)
  })
})

describe('los turnos que no llegaron al servidor (07/11)', () => {
  const j = (id: string, fecha: string, turno: 'M' | 'T', creadoEn = 1) => ({ id, fecha, turno, creadoEn })
  const contexto = {
    enServidor: new Set(['ok']),
    retenidos: new Set(['retenido']),
    desde: '2026-10-20',
    creadoAntesDe: 1000,
  }

  it('por id, no por cantidades: los recientes que el servidor no tiene, en orden', () => {
    const faltan = turnosQueFaltan(
      [
        j('bf387987', '2026-11-04', 'T'),
        j('ok', '2026-11-05', 'M'),
        j('a75ebe2e', '2026-11-03', 'M'),
        j('3fbc0d84', '2026-11-03', 'T'),
      ],
      contexto,
    )
    expect(faltan.map((t) => t.id)).toEqual(['a75ebe2e', '3fbc0d84', 'bf387987'])
  })

  it('no cuenta los retenidos, los viejos ni los recién abiertos, que pueden estar viajando', () => {
    const faltan = turnosQueFaltan(
      [j('retenido', '2026-11-03', 'M'), j('viejo', '2026-10-19', 'M'), j('recien', '2026-11-06', 'T', 5000)],
      contexto,
    )
    expect(faltan).toEqual([])
  })

  it('el cartel nombra cada turno con sus ventas', () => {
    expect(textoDeTurnosSinSubir([{ id: 'a', fecha: '2026-11-03', turno: 'M', ventas: 1 }])).toBe(
      `El turno del ${fechaLinda('2026-11-03')} mañana (1 venta) no llegó al servidor.`,
    )
    expect(
      textoDeTurnosSinSubir([
        { id: 'a', fecha: '2026-11-03', turno: 'M', ventas: 8 },
        { id: 'b', fecha: '2026-11-03', turno: 'T', ventas: 0 },
        { id: 'c', fecha: '2026-11-04', turno: 'T', ventas: 11 },
      ]),
    ).toBe(
      `Los turnos del ${fechaLinda('2026-11-03')} mañana (8 ventas), ${fechaLinda('2026-11-03')} tarde y ${fechaLinda('2026-11-04')} tarde (11 ventas) no llegaron al servidor.`,
    )
  })
})
