/** Utilidades de formato para Argentina: pesos, fechas y texto. */

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const pesosConCentavos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function plata(valor: number | null | undefined, centavos = false): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  return centavos ? pesosConCentavos.format(valor) : pesos.format(valor)
}

export function porcentaje(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—'
  return `${valor.toFixed(decimales).replace('.', ',')} %`
}

export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  return new Intl.NumberFormat('es-AR').format(valor)
}

/** Fecha de hoy en formato yyyy-mm-dd, en hora local (no UTC). */
export function hoyISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** Mes actual en formato yyyy-mm. */
export function mesActualISO(): string {
  return hoyISO().slice(0, 7)
}

export function horaAhora(): string {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/** "2026-07-15" -> "15/07/2026" */
export function fechaLinda(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  if (!a || !m || !d) return iso
  return `${d}/${m}/${a}`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2026-07" -> "julio 2026" */
export function mesLindo(iso: string): string {
  const [a, m] = iso.split('-')
  const indice = Number(m) - 1
  if (!a || indice < 0 || indice > 11) return iso
  return `${MESES[indice]} ${a}`
}

/** Minusculas y sin acentos, para comparar en el buscador. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Lee un numero escrito por una persona: "1.234,50", "1234.5", "$ 900". */
/**
 * Un punto solo, sin coma: "31.000" en Argentina son treinta y un mil,
 * no treinta y uno con cero. Pero "3.5" si es tres con medio, porque
 * nadie escribe un separador de miles de un solo digito.
 *
 * La regla que los separa es la forma: grupos de EXACTAMENTE tres
 * digitos despues de cada punto. 31.000 y 1.500.000 entran; 3.5, 3.50 y
 * 0.5 no.
 */
const MILES_CON_PUNTO = /^-?\d{1,3}(\.\d{3})+$/

/**
 * Lee un numero escrito a mano, como se escribe acá.
 *
 * Esto estaba mal y se encontro probando la pantalla de revision de
 * costos: escribir "31.000" guardaba 31. No era solo de esa pantalla,
 * era de todas --Caja, Productos, Proveedores-- porque Number("31.000")
 * da 31, y escribir el punto de los miles es lo mas natural del mundo.
 */
export function leerNumero(texto: string): number | null {
  if (typeof texto === 'number') return texto
  let limpio = String(texto).replace(/[^\d,.-]/g, '')
  if (!limpio) return null
  if (limpio.includes(',') && limpio.includes('.')) {
    // "31.000,50": los puntos son miles y la coma es el decimal.
    limpio = limpio.replace(/\./g, '').replace(',', '.')
  } else if (limpio.includes(',')) {
    limpio = limpio.replace(',', '.')
  } else if (MILES_CON_PUNTO.test(limpio)) {
    limpio = limpio.replace(/\./g, '')
  }
  const valor = Number(limpio)
  return Number.isFinite(valor) ? valor : null
}

/**
 * "hace 2 minutos", "hace 3 horas". Sirve para contestar de un vistazo
 * "¿lo que cargo la otra persona ya me llego?", que con una fecha y
 * hora exactas hay que ponerse a calcular.
 */
export function haceCuanto(cuando: number | null | undefined, ahora = Date.now()): string {
  if (!cuando) return 'todavía nada'
  const segundos = Math.round((ahora - cuando) / 1000)
  if (segundos < 0) return 'recién'
  if (segundos < 60) return 'recién'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.round(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}
