import { t } from '@/i18n'
/**
 * Camera/microphone helpers shared by the setup dialog and the live room.
 * Kept free of livekit-client so the Newsfeed does not download it.
 */

export interface DevicePick {
  /** null: no camera, audio only. */
  videoDeviceId: string | null
  audioDeviceId: string | null
}

/** Turns browser media errors into something a person can act on. */
export function mediaErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return t('Bạn đã chặn quyền camera hoặc micro. Hãy cho phép trong cài đặt trình duyệt rồi thử lại.')
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t('Không tìm thấy camera hoặc micro.')
  if (name === 'NotReadableError') return t('Camera hoặc micro đang được ứng dụng khác sử dụng.')
  return t('Không mở được camera hoặc micro.')
}
