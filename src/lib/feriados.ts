/**
 * Los feriados nacionales (20/11): los días en que el local no abre y,
 * por eso, ni el Panel ni «Cómo venimos» reclaman la caja.
 *
 * Salió del lunes 23/11/2026, Día de la Soberanía Nacional (trasladado
 * del viernes 20): sin esto, el martes el Panel iba a decir que faltaba
 * cargar la caja de un día en que el local estuvo cerrado.
 *
 * Qué entra y qué no:
 * - Los feriados nacionales, inamovibles y trasladables, el día en que se
 *   observan (Ley 27.399), y los que agrega un decreto (el lunes 9/11/2026,
 *   por la visita del papa: Decreto 1103/2026).
 * - NO los días no laborables con fines turísticos (en 2026: 23/3, 10/7 y
 *   7/12): ahí cada comercio decide si abre. Si el local no abre, el aviso
 *   sale como cualquier otro día y ya dice que puede haber estado cerrado.
 * - NO los feriados de una sola provincia o ciudad.
 *
 * Si el local abre igual un feriado, el turno cargado cuenta como cualquier
 * otro: lo único que cambia es que, si no hay caja, no se reclama.
 *
 * 2026 sale del calendario oficial (argentina.gob.ar, «Feriados 2026»).
 * 2027 tiene los inamovibles y los trasladables movidos como dice la Ley
 * 27.399 (martes y miércoles al lunes anterior, jueves y viernes al lunes
 * siguiente). Si un decreto agrega o mueve alguno, se corrige acá. Antes
 * de que termine 2027 hay que sumar 2028.
 */
const FERIADOS: ReadonlyMap<string, string> = new Map([
  // 2026
  ['2026-01-01', 'Año Nuevo'],
  ['2026-02-16', 'Carnaval'],
  ['2026-02-17', 'Carnaval'],
  ['2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'],
  ['2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'],
  ['2026-04-03', 'Viernes Santo'],
  ['2026-05-01', 'Día del Trabajador'],
  ['2026-05-25', 'Día de la Revolución de Mayo'],
  ['2026-06-15', 'Paso a la Inmortalidad del General Güemes'],
  ['2026-06-20', 'Paso a la Inmortalidad del General Belgrano'],
  ['2026-07-09', 'Día de la Independencia'],
  ['2026-08-17', 'Paso a la Inmortalidad del General San Martín'],
  ['2026-10-12', 'Día del Respeto a la Diversidad Cultural'],
  ['2026-11-09', 'Feriado nacional por la visita del papa'],
  ['2026-11-23', 'Día de la Soberanía Nacional'],
  ['2026-12-08', 'Inmaculada Concepción de María'],
  ['2026-12-25', 'Navidad'],
  // 2027 (por ley; revisar cuando salga el calendario oficial)
  ['2027-01-01', 'Año Nuevo'],
  ['2027-02-08', 'Carnaval'],
  ['2027-02-09', 'Carnaval'],
  ['2027-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'],
  ['2027-03-26', 'Viernes Santo'],
  ['2027-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'],
  ['2027-05-01', 'Día del Trabajador'],
  ['2027-05-25', 'Día de la Revolución de Mayo'],
  ['2027-06-20', 'Paso a la Inmortalidad del General Belgrano'],
  ['2027-06-21', 'Paso a la Inmortalidad del General Güemes'],
  ['2027-07-09', 'Día de la Independencia'],
  ['2027-08-16', 'Paso a la Inmortalidad del General San Martín'],
  ['2027-10-11', 'Día del Respeto a la Diversidad Cultural'],
  ['2027-11-20', 'Día de la Soberanía Nacional'],
  ['2027-12-08', 'Inmaculada Concepción de María'],
  ['2027-12-25', 'Navidad'],
])

/** El nombre del feriado nacional de ese día ('yyyy-mm-dd'), o null si no es feriado. */
export function feriadoDe(fecha: string): string | null {
  return FERIADOS.get(fecha) ?? null
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Si ese día se espera caja cargada: el local abre de lunes a sábado,
 * salvo los feriados.
 *
 * Un día que no existe tampoco: el navegador convierte el 30 de febrero
 * en el 2 de marzo sin quejarse, así que se mira que el día vuelva igual.
 */
export function seEsperaCaja(fecha: string): boolean {
  const partes = DIA.exec(fecha)
  if (!partes) return false
  const [a, m, d] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const dia = new Date(Date.UTC(a, m - 1, d))
  if (dia.getUTCFullYear() !== a || dia.getUTCMonth() !== m - 1 || dia.getUTCDate() !== d) return false
  if (dia.getUTCDay() === 0) return false
  return !FERIADOS.has(fecha)
}
