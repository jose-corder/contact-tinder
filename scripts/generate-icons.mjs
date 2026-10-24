// Resize the existing artwork with Node built-ins; no platform-specific raster tool.
// The source must be a non-interlaced, 8-bit RGBA PNG (our checked-in icon-512.png).
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const folder = new URL('../public/icons/', import.meta.url)
const source = readFileSync(new URL('icon-512.png', folder))
const width = source.readUInt32BE(16)
const height = source.readUInt32BE(20)
if (source[24] !== 8 || source[25] !== 6 || source[28] !== 0) throw new Error('Expected 8-bit RGBA PNG')
const chunks = []
for (let pos = 8; pos < source.length;) {
  const length = source.readUInt32BE(pos)
  if (source.toString('ascii', pos + 4, pos + 8) === 'IDAT') chunks.push(source.subarray(pos + 8, pos + 8 + length))
  pos += length + 12
}
const raw = inflateSync(Buffer.concat(chunks))
const pixels = Buffer.alloc(width * height * 4)
const stride = width * 4
function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)]
  if (filter > 4) throw new Error('Unknown PNG filter')
  for (let x = 0; x < stride; x++) {
    const index = y * stride + x
    const a = x >= 4 ? pixels[index - 4] : 0
    const b = y ? pixels[index - stride] : 0
    const c = x >= 4 && y ? pixels[index - stride - 4] : 0
    const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]
    pixels[index] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255
  }
}

function chunk(type, data) {
  const bytes = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  const result = Buffer.alloc(data.length + 12)
  result.writeUInt32BE(data.length)
  bytes.copy(result, 4)
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4)
  return result
}

function generate(size, padding, name) {
  const inset = Math.ceil(size * padding)
  const content = size - inset * 2
  const rows = Buffer.alloc(size * (size * 4 + 1))
  const paper = [244, 239, 230]
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const out = y * (size * 4 + 1) + 1 + x * 4
    for (let c = 0; c < 3; c++) rows[out + c] = paper[c]
    rows[out + 3] = 255
    if (x < inset || y < inset || x >= size - inset || y >= size - inset) continue
    // Box sampling keeps the existing serif edges smooth at smaller sizes.
    const x0 = (x - inset) * width / content, x1 = (x - inset + 1) * width / content
    const y0 = (y - inset) * height / content, y1 = (y - inset + 1) * height / content
    const sums = [0, 0, 0]
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
      const weight = (Math.min(sx + 1, x1) - Math.max(sx, x0)) * (Math.min(sy + 1, y1) - Math.max(sy, y0))
      const index = (Math.min(sy, height - 1) * width + Math.min(sx, width - 1)) * 4
      const alpha = pixels[index + 3] / 255
      for (let c = 0; c < 3; c++) sums[c] += (pixels[index + c] * alpha + paper[c] * (1 - alpha)) * weight
    }
    for (let c = 0; c < 3; c++) rows[out + c] = Math.round(sums[c] / ((x1 - x0) * (y1 - y0)))
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  writeFileSync(new URL(name, folder), Buffer.concat([
    source.subarray(0, 8), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]))
  console.log(`${name}: ${size}×${size}, ${inset}px padding, opaque cream background`)
}

generate(512, 0.2, 'icon-maskable-512.png')
generate(180, 0, 'apple-touch-icon.png')
