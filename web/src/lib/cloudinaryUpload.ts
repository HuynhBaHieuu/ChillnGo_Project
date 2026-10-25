import { t } from '@/i18n'
import { ApiError } from '@/services/client'

/** What Cloudinary answers after an upload (the fields this app reads). */
export interface UploadedImage {
  public_id?: string
  secure_url?: string
  width?: number
  height?: number
}

/** A signed upload as returned by our API: post `fields` plus the file to `uploadUrl`. */
export interface SignedUpload {
  uploadUrl: string
  fields: Record<string, string>
}

/**
 * Sends one file straight to Cloudinary. XMLHttpRequest rather than fetch,
 * because only XHR reports upload progress. `onProgress` gets 0–100.
 */
export function uploadToCloudinary(
  { uploadUrl, fields }: SignedUpload,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('file', file)

  return new Promise<UploadedImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadedImage)
        } catch {
          resolve({})
        }
        return
      }
      let detail = ''
      try {
        detail = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? ''
      } catch {
        // not JSON
      }
      reject(new ApiError(detail ? t('Không tải được ảnh lên: {detail}.', { detail }) : t('Không tải được ảnh lên.'), xhr.status))
    }
    xhr.onerror = () => reject(new ApiError(t('Không kết nối được tới máy chủ ảnh. Vui lòng thử lại.'), 0))
    xhr.send(form)
  })
}
