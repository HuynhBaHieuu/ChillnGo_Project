import type { Messages } from '../types'

/**
 * Trip tags people use most. Tags are free text, shown through `tx()`: these
 * translate, any other tag shows as typed.
 */
export const tags = {
  'biển': { en: 'beach', zh: '海边', ja: '海', ko: '바다' },
  'núi': { en: 'mountains', zh: '山', ja: '山', ko: '산' },
  'ẩm thực': { en: 'food', zh: '美食', ja: 'グルメ', ko: '맛집' },
  trekking: { en: 'trekking', zh: '徒步', ja: 'トレッキング', ko: '트레킹' },
  'săn mây': { en: 'cloud hunting', zh: '追云海', ja: '雲海ハンティング', ko: '운해 사냥' },
  'tiết kiệm': { en: 'budget', zh: '省钱', ja: '節約', ko: '알뜰' },
  'xe máy': { en: 'motorbike', zh: '摩托车', ja: 'バイク', ko: '오토바이' },
  'văn hóa': { en: 'culture', zh: '文化', ja: '文化', ko: '문화' },
  chill: { en: 'chill', zh: '放松', ja: 'まったり', ko: '힐링' },
  'cà phê': { en: 'coffee', zh: '咖啡', ja: 'カフェ', ko: '카페' },
  solo: { en: 'solo', zh: '独自旅行', ja: 'ひとり旅', ko: '혼행' },
  'lặn biển': { en: 'diving', zh: '潜水', ja: 'ダイビング', ko: '다이빙' },
  resort: { en: 'resort', zh: '度假村', ja: 'リゾート', ko: '리조트' },
  'phố cổ': { en: 'old town', zh: '古镇', ja: '旧市街', ko: '구시가지' },
  'gia đình': { en: 'family', zh: '家庭', ja: '家族', ko: '가족' },
  'thiên nhiên': { en: 'nature', zh: '自然', ja: '自然', ko: '자연' },
  'chèo thuyền': { en: 'boating', zh: '划船', ja: 'ボート', ko: '보트' },
  'di sản': { en: 'heritage', zh: '遗产', ja: '遺産', ko: '유산' },
  'road trip': { en: 'road trip', zh: '公路旅行', ja: 'ロードトリップ', ko: '로드 트립' },
  'nhóm bạn': { en: 'friends', zh: '朋友结伴', ja: '友達と', ko: '친구들과' },
  hoa: { en: 'flowers', zh: '赏花', ja: '花', ko: '꽃' },
  'cắm trại': { en: 'camping', zh: '露营', ja: 'キャンプ', ko: '캠핑' },
  kayak: { en: 'kayak', zh: '皮划艇', ja: 'カヤック', ko: '카약' },
  'văn hoá': { en: 'culture', zh: '文化', ja: '文化', ko: '문화' },
} satisfies Messages
