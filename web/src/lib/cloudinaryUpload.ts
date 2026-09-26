import { ApiError } from '@/services/client'

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
): Promise<void> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('file', file)

  return new Promise<void>((resolve, reject) => {
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
