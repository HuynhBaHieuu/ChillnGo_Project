/**
 * Profile images on Cloudinary.
 *
 * The browser uploads the file straight to Cloudinary with a signature from
 * this server, so image bytes never pass through our API (Vercel caps request
 * bodies at 4.5 MB) and the API secret never leaves the server.
 *
 * Each user has exactly one image per kind, at a fixed public id that every
 * new upload overwrites: chillngo/users/<userId>/avatar and .../cover.
 * Nothing is left behind when an image is replaced. The stored URL includes
 * the version number, so browsers and CDNs see a new URL after each change.
 */

import { v2 as cloudinary } from 'cloudinary'

import { env } from '../env.js'
import { HttpError } from './errors.js'

export const IMAGE_KINDS = ['avatar', 'cover'] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]

/**
 * Checked after upload. The web app already shrinks images to well under 5 MB
 * (web/src/lib/images.ts); this catches uploads made around it.
 */
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Same list as web/src/lib/images.ts. No GIF (animated, heavy), no HEIC (most
 * browsers cannot show it; iPhones send JPEG instead), no SVG (can carry
 * scripts). Cloudinary rejects any other format at upload time.
 */
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif'

/**
 * Applied by Cloudinary before it stores the file, so even an upload that
 * skipped the browser-side shrinking is stored at most this large.
 */
const STORED_LIMIT: Record<ImageKind, string> = {
  avatar: 'c_limit,w_1024,h_1024',
  cover: 'c_limit,w_2560,h_2560',
}

/** How each image is delivered: cropped to its slot, format and quality chosen per browser. */
const DELIVERY: Record<ImageKind, object[]> = {
  avatar: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }, { fetch_format: 'auto', quality: 'auto' }],
  cover: [{ width: 1800, height: 600, crop: 'fill', gravity: 'auto' }, { fetch_format: 'auto', quality: 'auto' }],
}

function account() {
  if (!env.cloudinary) {
    throw new HttpError(503, 'Máy chủ chưa cấu hình Cloudinary nên chưa đổi được ảnh.', 'UPLOADS_NOT_CONFIGURED')
  }
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  })
  return env.cloudinary
}

export function publicIdFor(userId: string, kind: ImageKind): string {
  return `chillngo/users/${userId}/${kind}`
}

/**
 * Everything the browser needs for one signed upload. `fields` must be sent
 * exactly as given, plus the file; changing any of them breaks the signature.
 */
export function signUpload(userId: string, kind: ImageKind) {
  const { cloudName, apiKey, apiSecret } = account()
  const params = {
    timestamp: Math.round(Date.now() / 1000),
    public_id: publicIdFor(userId, kind),
    overwrite: 'true',
    invalidate: 'true',
    allowed_formats: ALLOWED_FORMATS,
    transformation: STORED_LIMIT[kind],
  }
  const signature = cloudinary.utils.api_sign_request(params, apiSecret)

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    fields: { ...params, timestamp: String(params.timestamp), api_key: apiKey, signature },
  }
}

/**
 * Looks up the image the browser just uploaded and returns the URL to store.
 * The server reads the image from Cloudinary itself, so a client cannot make
 * a profile point at an arbitrary URL.
 */
export async function confirmUpload(userId: string, kind: ImageKind): Promise<string> {
  account()
  const publicId = publicIdFor(userId, kind)

  let resource: { public_id: string; version: number; bytes: number }
  try {
    resource = await cloudinary.api.resource(publicId)
  } catch {
    throw new HttpError(400, 'Không tìm thấy ảnh vừa tải lên. Vui lòng chọn ảnh và thử lại.', 'UPLOAD_MISSING')
  }

  if (resource.bytes > MAX_BYTES) {
    await cloudinary.uploader.destroy(publicId, { invalidate: true }).catch(() => undefined)
    throw new HttpError(413, 'Ảnh quá lớn. Vui lòng chọn ảnh khác.', 'UPLOAD_TOO_LARGE')
  }

  return cloudinary.url(resource.public_id, {
    version: resource.version,
    secure: true,
    transformation: DELIVERY[kind],
  })
}

/** Deletes a user's image of this kind. Missing image or no Cloudinary: nothing to do. */
export async function removeImage(userId: string, kind: ImageKind): Promise<void> {
  if (!env.cloudinary) return
  account()
  await cloudinary.uploader.destroy(publicIdFor(userId, kind), { invalidate: true }).catch((error: unknown) => {
    console.error(`Could not delete ${kind} for ${userId}:`, error)
  })
}
