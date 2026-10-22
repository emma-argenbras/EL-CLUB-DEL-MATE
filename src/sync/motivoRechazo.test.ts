import { describe, expect, it } from 'vitest'
import { camposParaConservar, motivosDelRechazo, textoDelRechazo } from './motivoRechazo'

// Un producto como esta en el servidor, con todo cargado.
const EN_EL_SERVIDOR = {
  codigo: 'DLB001',
  descripcion: 'MATE DE CALABAZA',
  precioCompra: 2000,
  precioVenta: 4000,
  rentabilidad: 1,
  proveedor: 'MOHICANO',
  proveedorId: 'mohicano',
  archivado: false,
  stock: null,
}

const ENCARGADA = { rol: 'encargado', activo: true }
const EMPLEADA = { rol: 'empleado', activo: true }

describe('motivosDelRechazo: lo mismo que pregunta la regla de productos', () => {
  it('una edicion que la regla acepta no tiene motivo conocido', () => {
    const enviado = { ...EN_EL_SERVIDOR, precioCompra: 2500, precioVenta: 5000 }
    expect(motivosDelRechazo('guardar', enviado, EN_EL_SERVIDOR, ENCARGADA)).toEqual([
      { tipo: 'no-se-sabe' },
    ])
  })

  it('un empleado que cambia el precio de venta: es el rol', () => {
    const enviado = { ...EN_EL_SERVIDOR, precioVenta: 5000 }
    expect(motivosDelRechazo('guardar', enviado, EN_EL_SERVIDOR, EMPLEADA)).toEqual([
      { tipo: 'rol', rol: 'empleado', campos: ['precioVenta'] },
    ])
  })

  it('un empleado que solo cambia el costo pasa', () => {
    const enviado = { ...EN_EL_SERVIDOR, precioCompra: 2500 }
    expect(motivosDelRechazo('guardar', enviado, EN_EL_SERVIDOR, EMPLEADA)).toEqual([
      { tipo: 'no-se-sabe' },
    ])
  })

  it('el rol se compara exacto, como en la regla: «Encargado» no es «encargado»', () => {
    const enviado = { ...EN_EL_SERVIDOR, archivado: true }
    expect(
      motivosDelRechazo('guardar', enviado, EN_EL_SERVIDOR, { rol: 'Encargado', activo: true }),
    ).toEqual([{ tipo: 'rol', rol: 'Encargado', campos: ['archivado'] }])
  })

  it('un campo que en el servidor no existe y se manda sin valor: aparece, y se puede reintentar', () => {
    // El diff de la regla cuenta los campos que aparecen. Un producto
    // de la semilla, sin «archivado», y una edicion que lo manda en
    // false toca «archivado» para la regla, aunque nadie lo haya querido
    // tocar. Es lo que le pasaba a Gabriela.
    const { archivado: _sinArchivado, ...servidor } = EN_EL_SERVIDOR
    const enviado = { ...servidor, archivado: false, precioCompra: 2500 }
    const motivos = motivosDelRechazo('guardar', enviado, servidor, EMPLEADA)
    expect(motivos).toEqual([{ tipo: 'aparece', campos: ['archivado'] }])
    expect(camposParaConservar(motivos)).toEqual(['archivado'])
  })

  it('pero si aparece CON valor, es un cambio de verdad y es el rol', () => {
    const { archivado: _sinArchivado, ...servidor } = EN_EL_SERVIDOR
    const enviado = { ...servidor, archivado: true }
    expect(motivosDelRechazo('guardar', enviado, servidor, EMPLEADA)).toEqual([
      { tipo: 'rol', rol: 'empleado', campos: ['archivado'] },
    ])
  })

  it('dejar vacio el proveedor que el servidor tiene: es el vacio, aunque sea encargada', () => {
    const enviado = { ...EN_EL_SERVIDOR, archivado: false, proveedor: null }
    expect(motivosDelRechazo('guardar', enviado, EN_EL_SERVIDOR, ENCARGADA)).toEqual([
      { tipo: 'vacio', campos: [{ campo: 'proveedor', enElServidor: 'MOHICANO' }] },
    ])
  })

  it('un campo que no se manda cuenta como vacio, igual que get(campo, null)', () => {
    const { rentabilidad: _sinRentabilidad, ...enviado } = EN_EL_SERVIDOR
    expect(motivosDelRechazo('guardar', enviado, EN_EL_SERVIDOR, ENCARGADA)).toEqual([
      { tipo: 'vacio', campos: [{ campo: 'rentabilidad', enElServidor: 1 }] },
    ])
  })

  it('vacio sobre vacio no es pisar nada', () => {
    const servidor = { ...EN_EL_SERVIDOR, precioCompra: null }
    const enviado = { ...servidor, precioVenta: 5000 }
    expect(motivosDelRechazo('guardar', enviado, servidor, ENCARGADA)).toEqual([
      { tipo: 'no-se-sabe' },
    ])
  })

  it('los dos motivos a la vez se dicen los dos', () => {
    const enviado = { ...EN_EL_SERVIDOR, precioVenta: 5000, proveedorId: null }
    expect(motivosDelRechazo('guardar', enviado, EN_EL_SERVIDOR, EMPLEADA)).toEqual([
      { tipo: 'rol', rol: 'empleado', campos: ['precioVenta'] },
      { tipo: 'vacio', campos: [{ campo: 'proveedorId', enElServidor: 'mohicano' }] },
    ])
  })

  it('sin perfil en el servidor, o desactivado, es lo primero que se dice', () => {
    expect(motivosDelRechazo('guardar', EN_EL_SERVIDOR, EN_EL_SERVIDOR, null)).toEqual([
      { tipo: 'sin-perfil' },
    ])
    expect(
      motivosDelRechazo('guardar', EN_EL_SERVIDOR, EN_EL_SERVIDOR, { rol: 'owner', activo: false }),
    ).toEqual([{ tipo: 'desactivado' }])
  })

  it('borrar: al mando es la regla publicada; si no, el rol', () => {
    expect(motivosDelRechazo('borrar', null, EN_EL_SERVIDOR, ENCARGADA)).toEqual([
      { tipo: 'borrar-no-permitido' },
    ])
    expect(motivosDelRechazo('borrar', null, EN_EL_SERVIDOR, EMPLEADA)).toEqual([
      { tipo: 'rol', rol: 'empleado', campos: [] },
    ])
  })
})

describe('camposParaConservar: cuando se puede volver a mandar sin lo vacio', () => {
  it('si lo unico que falla es el vacio, se conservan esos campos', () => {
    expect(
      camposParaConservar([
        { tipo: 'vacio', campos: [{ campo: 'proveedor', enElServidor: 'MOHICANO' }] },
      ]),
    ).toEqual(['proveedor'])
  })

  it('si ademas falla el rol, no: reintentar no lo arregla', () => {
    expect(
      camposParaConservar([
        { tipo: 'rol', rol: 'empleado', campos: ['precioVenta'] },
        { tipo: 'vacio', campos: [{ campo: 'proveedor', enElServidor: 'MOHICANO' }] },
      ]),
    ).toBeNull()
  })

  it('lo vacio y lo que aparece se arreglan juntos', () => {
    expect(
      camposParaConservar([
        { tipo: 'aparece', campos: ['archivado'] },
        { tipo: 'vacio', campos: [{ campo: 'proveedor', enElServidor: 'MOHICANO' }] },
      ]),
    ).toEqual(['archivado', 'proveedor'])
  })

  it('si el motivo no se sabe, no se reintenta a ciegas', () => {
    expect(camposParaConservar([{ tipo: 'no-se-sabe' }])).toBeNull()
  })
})

describe('textoDelRechazo: lo que lee la persona en la campana', () => {
  it('dice el codigo y el rol con el que figura', () => {
    const texto = textoDelRechazo('LST006', [{ tipo: 'rol', rol: 'empleado', campos: ['archivado'] }])
    expect(texto).toContain('LST006')
    expect(texto).toContain('«empleado»')
    expect(texto).toContain('archivar o desarchivar')
  })

  it('dice que campo se dejaba vacio', () => {
    const texto = textoDelRechazo('DLB001', [
      { tipo: 'vacio', campos: [{ campo: 'proveedor', enElServidor: 'MOHICANO' }] },
    ])
    expect(texto).toContain('el proveedor')
  })
})
