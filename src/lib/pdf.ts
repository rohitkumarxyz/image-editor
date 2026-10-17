import type { TextRegion } from '../types'
import { downloadBlob } from './download'
import { createCanvas, get2d } from './image'
import { renderComposite } from './render'

const JPEG_QUALITY = 0.95
/** CSS pixels → PDF points (72 per inch vs 96 per inch), so the page prints at the image's natural size. */
const POINTS_PER_PIXEL = 0.75

function jpegBytes(canvas: HTMLCanvasElement): Uint8Array {
  const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/**
 * Builds a one-page PDF with the image as a JPEG. PDF supports JPEG data directly (DCTDecode),
 * so no library is needed: just the objects, their byte offsets (xref) and a trailer.
 */
function buildPdf(jpeg: Uint8Array, width: number, height: number): Blob {
  const pageW = (width * POINTS_PER_PIXEL).toFixed(2)
  const pageH = (height * POINTS_PER_PIXEL).toFixed(2)
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`
  const encoder = new TextEncoder()

  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part
    parts.push(bytes)
    length += bytes.length
  }
  const object = (body: string, stream?: Uint8Array) => {
    offsets.push(length)
    push(`${offsets.length} 0 obj\n${body}\n`)
    if (stream) {
      push('stream\n')
      push(stream)
      push('\nendstream\n')
    }
    push('endobj\n')
  }

  push('%PDF-1.4\n')
  object('<< /Type /Catalog /Pages 2 0 R >>')
  object('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)
  object(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg,
  )
  object(`<< /Length ${content.length} >>`, encoder.encode(content))

  const xrefStart = length
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`)
  offsets.forEach((o) => push(`${String(o).padStart(10, '0')} 00000 n \n`))
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`)

  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

/** Downloads the edited image as a PDF. Transparent areas (e.g. after a circle crop) become white. */
export function exportPdf(base: HTMLCanvasElement, regions: TextRegion[], fileName: string): void {
  const composite = createCanvas(base.width, base.height)
  renderComposite(composite, base, regions)

  const flat = createCanvas(base.width, base.height)
  const ctx = get2d(flat)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(composite, 0, 0)

  downloadBlob(buildPdf(jpegBytes(flat), flat.width, flat.height), fileName)
}
