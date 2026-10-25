/**
 * Rules for every image a user uploads, and in-browser shrinking before upload.
 *
 * Accepted: JPEG, PNG, WebP, AVIF. These are what every current browser can
 * preview, and what Cloudinary re-encodes well.
 * Refused, on purpose:
 *   - GIF: animated files are huge and profile/trip photos never need motion.
 *   - HEIC/HEIF: most browsers cannot preview them. iPhones convert photos to
 *     JPEG automatically when the file picker does not list HEIC, which is
 *     exactly what ACCEPT_ATTRIBUTE below does.
 *   - SVG: can carry scripts.
 *   - BMP/TIFF: uncompressed, often tens of MB.
 *
 * server/src/lib/cloudinary.ts enforces the same list on the upload itself.
 */

import { t } from '@/i18n'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

/** For `<input type="file" accept=…>`. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',')

export const ACCEPTED_LABEL = 'JPG, PNG, WebP, AVIF'

/** Largest original a user may pick. It is shrunk well below this before upload. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024

/** Largest file actually sent, after shrinking. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Files already this small and within size limits are sent untouched. */
const SMALL_ENOUGH_BYTES = 800 * 1024
const QUALITY = 0.85

/** Why a picked file cannot be used, or null when it can. */
export function checkImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return t('Định dạng ảnh không được hỗ trợ. Vui lòng chọn ảnh {formats}.', { formats: ACCEPTED_LABEL })
  }
  if (file.size > MAX_SOURCE_BYTES) return t('Ảnh quá lớn. Vui lòng chọn ảnh dưới 15 MB.')
  return null
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  await img.decode()
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/**
 * Shrinks an image so its longest side is at most `maxSide` pixels and
 * re-encodes it as WebP (JPEG where the browser cannot write WebP). A phone
 * photo of 4–8 MB usually ends up at 200–600 KB, so uploads are fast even on
 * mobile data. Throws when the result is still over MAX_UPLOAD_BYTES.
 */
export async function prepareImageForUpload(file: File, maxSide: number): Promise<File> {
  const image = await decode(file).catch(() => {
    throw new Error(t('Không đọc được ảnh này. Vui lòng chọn ảnh khác.'))
  })

  try {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    let blob = await toBlob(drawOn(ctx, canvas, image.source, false), 'image/webp')
    let type = 'image/webp'
    // Safari cannot encode WebP and hands back PNG instead: use JPEG there, on
    // white, since JPEG has no transparency.
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(drawOn(ctx, canvas, image.source, true), 'image/jpeg')
      type = 'image/jpeg'
    }
    if (!blob) return file

    // Re-encoding a small, already-compressed file can make it bigger.
    const result = scale === 1 && blob.size >= file.size ? file : new File([blob], renamed(file.name, type), { type })
    if (result.size > MAX_UPLOAD_BYTES) throw new Error(t('Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác.'))
    return result
  } finally {
    image.close()
  }
}

function drawOn(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  whiteBackground: boolean,
): HTMLCanvasElement {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (whiteBackground) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function renamed(name: string, type: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image'
  return `${base}.${type === 'image/webp' ? 'webp' : 'jpg'}`
}
