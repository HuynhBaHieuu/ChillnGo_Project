/**
 * Feelings and activities for check-ins. Keys mirror
 * server/src/lib/feelings.ts, which is what the API accepts.
 *
 * Shown as "Minh <lead> <what>": "đang cảm thấy thư giãn", "đang ngắm hoàng hôn".
 */

export type FeelingKind = 'feeling' | 'activity'

export interface FeelingOption {
  key: string
  kind: FeelingKind
  emoji: string
  /** Short label for the picker; lowercased, it is also the end of the sentence. */
  label: string
}

export const FEELING_OPTIONS: FeelingOption[] = [
  { key: 'happy', kind: 'feeling', emoji: '😊', label: 'Vui vẻ' },
  { key: 'relaxed', kind: 'feeling', emoji: '😌', label: 'Thư giãn' },
  { key: 'excited', kind: 'feeling', emoji: '🤩', label: 'Hào hứng' },
  { key: 'tired_but_happy', kind: 'feeling', emoji: '😮‍💨', label: 'Mệt nhưng vui' },
  { key: 'peaceful', kind: 'feeling', emoji: '🍃', label: 'Bình yên' },
  { key: 'grateful', kind: 'feeling', emoji: '🥰', label: 'Biết ơn' },
  { key: 'amazed', kind: 'feeling', emoji: '😍', label: 'Choáng ngợp' },
  { key: 'nostalgic', kind: 'feeling', emoji: '🥹', label: 'Hoài niệm' },
  { key: 'adventurous', kind: 'feeling', emoji: '🤠', label: 'Muốn phiêu lưu' },
  { key: 'romantic', kind: 'feeling', emoji: '💕', label: 'Lãng mạn' },

  { key: 'eating', kind: 'activity', emoji: '🍜', label: 'Ăn uống' },
  { key: 'drinking_coffee', kind: 'activity', emoji: '☕', label: 'Uống cà phê' },
  { key: 'watching_sunset', kind: 'activity', emoji: '🌅', label: 'Ngắm hoàng hôn' },
  { key: 'swimming', kind: 'activity', emoji: '🏊', label: 'Tắm biển' },
  { key: 'trekking', kind: 'activity', emoji: '🥾', label: 'Leo núi' },
  { key: 'camping', kind: 'activity', emoji: '🏕️', label: 'Cắm trại' },
  { key: 'road_trip', kind: 'activity', emoji: '🏍️', label: 'Đi phượt' },
  { key: 'exploring', kind: 'activity', emoji: '🧭', label: 'Khám phá' },
  { key: 'taking_photos', kind: 'activity', emoji: '📸', label: 'Chụp ảnh' },
  { key: 'shopping', kind: 'activity', emoji: '🛍️', label: 'Mua sắm' },
]

const BY_KEY = new Map(FEELING_OPTIONS.map((f) => [f.key, f]))

/** "đang cảm thấy" + "thư giãn", or "đang" + "ngắm hoàng hôn". */
export function feelingSentence(option: FeelingOption): { lead: string; what: string } {
  return { lead: option.kind === 'feeling' ? 'đang cảm thấy' : 'đang', what: option.label.toLowerCase() }
}

export function feelingOption(key: string | null | undefined): FeelingOption | null {
  return key ? (BY_KEY.get(key) ?? null) : null
}
