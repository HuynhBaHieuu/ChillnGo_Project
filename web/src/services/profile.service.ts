/**
 * The signed-in user's own profile (server/src/routes/users.ts), with image
 * uploads going straight from the browser to Cloudinary.
 */

import { checkImageFile as checkImage, prepareImageForUpload } from '@/lib/images'

import { ApiError } from './client'
import { http } from './http'
import type { User } from './types'

export type ImageKind = 'avatar' | 'cover'

/** Longest side sent to Cloudinary. Delivery is 400px (avatar) and 1800px (cover); this leaves room for sharp screens. */
const MAX_SIDE: Record<ImageKind, number> = { avatar: 1024, cover: 2560 }

export interface ProfileUpdate {
  displayName?: string
  username?: string
  bio?: string
  location?: string
  /** "uploaded" after uploadImage() succeeded; "remove" to go back to the default photo. */
  avatar?: 'uploaded' | 'remove'
  cover?: 'uploaded' | 'remove'
}

interface UploadSignature {
  uploadUrl: string
  fields: Record<string, string>
}

/** Explains why a file cannot be used, or returns null when it can. */
export const checkImageFile = checkImage

/**
 * Uploads one image to Cloudinary. The image is first shrunk in the browser
 * (see lib/images.ts); the server signs the request, so the file never passes
 * through our API. `onProgress` gets 0–100.
 */
export async function uploadImage(kind: ImageKind, original: File, onProgress?: (percent: number) => void): Promise<void> {
  const file = await prepareImageForUpload(original, MAX_SIDE[kind])

  const { uploadUrl, fields } = await http<UploadSignature>('/api/users/me/upload-signature', {
    method: 'POST',
    body: { kind },
  })

  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('file', file)

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      let detail = ''
      try {
        detail = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? ''
      } catch {
        // not JSON
      }
      reject(new ApiError(`Không tải được ảnh lên${detail ? `: ${detail}` : ''}.`, xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('Không kết nối được tới máy chủ ảnh. Vui lòng thử lại.', 0))
    xhr.send(form)
  })
}

export async function updateProfile(update: ProfileUpdate): Promise<User> {
  const { user } = await http<{ user: User }>('/api/users/me', { method: 'PATCH', body: update })
  return user
}
