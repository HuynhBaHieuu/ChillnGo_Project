/**
 * The signed-in user's own profile (server/src/routes/users.ts), with image
 * uploads going straight from the browser to Cloudinary.
 */

import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import type { SignedUpload } from '@/lib/cloudinaryUpload'
import { checkImageFile as checkImage, prepareImageForUpload } from '@/lib/images'

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

/** Explains why a file cannot be used, or returns null when it can. */
export const checkImageFile = checkImage

/**
 * Uploads one image to Cloudinary. The image is first shrunk in the browser
 * (see lib/images.ts); the server signs the request, so the file never passes
 * through our API. `onProgress` gets 0–100.
 */
export async function uploadImage(kind: ImageKind, original: File, onProgress?: (percent: number) => void): Promise<void> {
  const file = await prepareImageForUpload(original, MAX_SIDE[kind])

  const signature = await http<SignedUpload>('/api/users/me/upload-signature', {
    method: 'POST',
    body: { kind },
  })
  await uploadToCloudinary(signature, file, onProgress)
}

export async function updateProfile(update: ProfileUpdate): Promise<User> {
  const { user } = await http<{ user: User }>('/api/users/me', { method: 'PATCH', body: update })
  return user
}
