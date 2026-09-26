/**
 * Photo check-ins (server/src/routes/checkins.ts). Photos go straight from the
 * browser to Cloudinary, shrunk first, before the check-in itself is posted.
 */

import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import type { SignedUpload } from '@/lib/cloudinaryUpload'
import type { Place } from '@/lib/geo'
import { prepareImageForUpload } from '@/lib/images'
import { travelAvatar } from '@/lib/photos'

import { http } from './http'

export const MAX_CHECKIN_PHOTOS = 4
/** Longest side sent; photos are shown at most 1600px wide. */
const MAX_SIDE = 2048

export interface CheckIn {
  _id: string
  caption: string
  /** A key from lib/feelings.ts, or null. */
  feeling: string | null
  photos: { url: string; width: number; height: number }[]
  location: Place | null
  createdAt: string
  author: { _id: string; username: string; displayName: string; avatarUrl: string }
}

function withDefaultAvatar(checkin: CheckIn): CheckIn {
  const { author } = checkin
  return author.avatarUrl ? checkin : { ...checkin, author: { ...author, avatarUrl: travelAvatar(author.username) } }
}

/** Newest first. `authors` limits to those accounts (the Newsfeed); omitted, everyone's. */
export async function listCheckIns(authors?: string[]): Promise<CheckIn[]> {
  const query = authors ? `?authors=${encodeURIComponent(authors.join(','))}` : ''
  const { items } = await http<{ items: CheckIn[] }>(`/api/checkins${query}`, { auth: false })
  return items.map(withDefaultAvatar)
}

export interface NewCheckIn {
  files: File[]
  caption: string
  feeling: string | null
  location: Place | null
}

/**
 * Uploads the photos one by one (if any), then posts the check-in.
 * `onProgress` gets 0–100 over all photos.
 */
export async function createCheckIn(input: NewCheckIn, onProgress?: (percent: number) => void): Promise<CheckIn> {
  const photoIds: string[] = []
  for (const [index, original] of input.files.entries()) {
    const file = await prepareImageForUpload(original, MAX_SIDE)
    const signature = await http<SignedUpload & { publicId: string }>('/api/checkins/upload-signature', {
      method: 'POST',
    })
    await uploadToCloudinary(signature, file, (p) =>
      onProgress?.(Math.round(((index + p / 100) / input.files.length) * 100)),
    )
    photoIds.push(signature.publicId)
  }

  const { checkin } = await http<{ checkin: CheckIn }>('/api/checkins', {
    method: 'POST',
    body: { caption: input.caption.trim(), photos: photoIds, feeling: input.feeling, location: input.location },
  })
  return withDefaultAvatar(checkin)
}

export function deleteCheckIn(id: string): Promise<{ ok: true }> {
  return http(`/api/checkins/${id}`, { method: 'DELETE' })
}
