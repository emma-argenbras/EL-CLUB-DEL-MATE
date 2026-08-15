/**
 * Genera los iconos PNG de la PWA (192 y 512 px) a partir del SVG,
 * usando solo lo que trae Node: sin dependencias ni herramientas extra.
 *
 * Uso: node scripts/generar-iconos.mjs
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

const VERDE = [27, 67, 50]
const CALABAZA = [181, 101, 29]
const CALABAZA_OSCURA = [140, 74, 21]
const VIROLA = [224, 195, 65]
const YERBA = [45, 106, 79]
const METAL = [225, 225, 225]

/** Devuelve el color del pixel (x, y) en un lienzo de lado `lado`. */
function color(x, y, lado) {
  // Trabajamos en coordenadas de 0 a 512 para copiar el SVG.
  const u = (x / lado) * 512
  const v = (y / lado) * 512

  // Bombilla: barra inclinada que sale hacia arriba a la derecha.
  const bx = u - 318
  const by = v - 190
  const angulo = (24 * Math.PI) / 180
  const rx = bx * Math.cos(angulo) + by * Math.sin(angulo)
  const ry = -bx * Math.sin(angulo) + by * Math.cos(angulo)
  if (Math.abs(rx) < 17 && ry > -110 && ry < 70) return METAL

  // Calabaza: circulo grande.
  const dx = u - 256
  const dy = v - 288
  const distancia = Math.sqrt(dx * dx + dy * dy * 0.82)
  if (distancia < 112) {
    // Virola dorada arriba.
    if (v > 188 && v < 222) return VIROLA
    // Boca con yerba.
    if (v >= 222 && v < 262 && Math.abs(dx) < 62) return YERBA
    if (distancia < 84) return CALABAZA_OSCURA
    return CALABAZA
  }
  // Virola sobresale un poco de la calabaza.
  if (v > 188 && v < 222 && Math.abs(dx) < 88) return VIROLA

  return VERDE
}

function crearPNG(lado) {
  const filas = []
  for (let y = 0; y < lado; y++) {
    const fila = Buffer.alloc(lado * 4 + 1)
    fila[0] = 0 // filtro "none"
    for (let x = 0; x < lado; x++) {
      const [r, g, b] = color(x, y, lado)
      const i = 1 + x * 4
      fila[i] = r
      fila[i + 1] = g
      fila[i + 2] = b
      fila[i + 3] = 255
    }
    filas.push(fila)
  }
  const pixeles = deflateSync(Buffer.concat(filas), { level: 9 })

  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(calcularCRC(cuerpo) >>> 0)
    return Buffer.concat([largo, cuerpo, crc])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lado, 0)
  ihdr.writeUInt32BE(lado, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', pixeles),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

const TABLA_CRC = (() => {
  const tabla = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c
  }
  return tabla
})()

function calcularCRC(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return c ^ 0xffffffff
}

for (const lado of [192, 512]) {
  const salida = join(RAIZ, 'public', `icono-${lado}.png`)
  writeFileSync(salida, crearPNG(lado))
  console.log(`Generado public/icono-${lado}.png`)
}
