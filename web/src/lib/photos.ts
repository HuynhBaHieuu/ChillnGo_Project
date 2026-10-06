/**
 * Ảnh minh hoạ cho toàn bộ app.
 *
 * Dữ liệu demo không có ảnh thật, nhưng ảnh ngẫu nhiên (kiểu Lorem Picsum) làm
 * một mạng xã hội du lịch trông như một trang rao vặt: bài "Hà Giang Loop" lại
 * kèm ảnh chân dung studio hay một cái ghế.
 *
 * Ở đây mỗi seed được ánh xạ vào một bộ ảnh du lịch đã chọn sẵn — phong cảnh,
 * biển đảo, phố cổ, và các khoảnh khắc trong chuyến đi (cắm trại, ăn uống, trek,
 * di chuyển). Ánh xạ là thuần tuý theo seed nên cùng một seed luôn ra cùng một
 * ảnh: mock, ảnh bài viết và ảnh clone khớp nhau, và ảnh không nhảy mỗi lần
 * render.
 *
 * Nguồn: Unsplash (license cho phép dùng thương mại, không cần ghi công). CDN
 * của Unsplash tự resize và trả WebP qua `auto=format`, nên ảnh về đúng kích
 * thước cần hiển thị thay vì tải nguyên bản vài MB.
 */

/** Nhóm chủ đề ảnh. Mỗi điểm dừng trong lịch trình rơi vào đúng một nhóm. */
export type PhotoTheme =
  | 'mountain'
  | 'sea'
  | 'karst'
  | 'nature'
  | 'town'
  | 'food'
  | 'market'
  | 'camp'
  | 'trek'
  | 'transit'

/**
 * ID ảnh Unsplash theo chủ đề (phần sau `photo-` trong URL).
 *
 * Danh sách cố ý nghiêng về cảnh châu Á và thiên nhiên không quá đặc trưng, để
 * ảnh không "chửi nhau" với nội dung Việt Nam của dữ liệu mẫu.
 */
const POOLS: Record<PhotoTheme, readonly string[]> = {
  // Núi, đèo, cao nguyên, ruộng bậc thang.
  mountain: [
    '1506905925346-21bda4d32df4',
    '1501785888041-af3ef285b470',
    '1469474968028-56623f02e42e',
    '1470071459604-3b5ec3a7fe05',
    '1426604966848-d7adac402bff',
    '1476514525535-07fb3b4ae5f1',
    '1464822759023-fed622ff2c3b',
    '1454496522488-7a8e488e8606',
    '1483728642387-6c3bdd6c93e5',
    '1493246507139-91e8fad9978e',
    '1480497490787-505ec076689f',
    '1500534314209-a25ddb2bd429',
    '1439853949127-fa647821eba0',
    '1570366583862-f91883984fde',
    '1540611025311-01df3cef54b5',
  ],
  // Biển, bãi tắm, đảo.
  sea: [
    '1507525428034-b723cf961d3e',
    '1519046904884-53103b34b206',
    '1540541338287-41700207dee6',
    '1510414842594-a61c69b5ae57',
    '1506929562872-bb421503ef21',
    '1505228395891-9a51e7e86bf6',
    '1509233725247-49e657c54213',
    '1573790387438-4da905039392',
    '1570789210967-2cac24afeb00',
  ],
  // Vịnh núi đá vôi, sông nước — Hạ Long, Ninh Bình, miền Tây.
  karst: [
    '1528127269322-539801943592',
    '1504457047772-27faf1c00561',
    '1590050752117-238cb0fb12b1',
    '1552465011-b4e21bf6e79a',
    '1570789210967-2cac24afeb00',
  ],
  // Rừng, thác, đồi cỏ, hồ.
  nature: [
    '1441974231531-c6227db76b6e',
    '1472214103451-9374bd1c798e',
    '1447752875215-b2761acb3c5d',
    '1433086966358-54859d0ed716',
    '1502082553048-f009c37129b9',
    '1476610182048-b716b8518aae',
    '1517760444937-f6397edcbbcd',
    '1465146344425-f00d5f5c8f07',
  ],
  // Phố cổ, làng, chùa chiền, phố đêm.
  town: [
    '1555921015-5532091f6026',
    '1533050487297-09b450131914',
    '1542931287-023b922fa89b',
    '1508009603885-50cf7c579365',
    '1580655653885-65763b2597d0',
    '1559592413-7cec4d0cae2b',
    '1512553353614-82a7370096dc',
    '1526481280693-3bfa7568e0f3',
    '1528181304800-259b08848526',
    '1583417319070-4a69db38a482',
    '1449824913935-59a10b8d2000',
  ],
  // Quán xá, bữa ăn dọc đường.
  food: [
    '1414235077428-338989a2e8c0',
    '1504674900247-0877df9cc836',
    '1555396273-367ea4eb4db5',
    '1517248135467-4c7edcad34c4',
    '1528605248644-14dd04022da1',
    '1533777857889-4be7c70b33f7',
    '1541544537156-7627a7a4aa1c',
    '1551632436-cbf8dd35adfa',
  ],
  // Chợ phiên, hàng quán đông người.
  market: [
    '1488459716781-31db52582fe9',
    '1517457373958-b7bdd4587205',
    '1528605248644-14dd04022da1',
  ],
  // Lều trại, lửa trại, trời sao.
  camp: [
    '1517824806704-9040b037703b',
    '1504280390367-361c6d9f38f4',
    '1496545672447-f699b503d270',
    '1478131143081-80f7f84ca84d',
    '1519681393784-d120267933ba',
    '1465101046530-73398c7f28ca',
  ],
  // Trekking, lặn biển, người đang trên đường.
  trek: [
    '1469474968028-56623f02e42e',
    '1501555088652-021faa106b9b',
    '1551632811-561732d1e306',
    '1506197603052-3cc9c3a201bd',
    '1544551763-46a013bb70d5',
    '1527631746610-bca00a040d60',
  ],
  // Máy bay, xe đường dài, bản đồ và đồ nghề.
  transit: [
    '1436491865332-7a61a109cc05',
    '1544620347-c4fd4a3d5957',
    '1488646953014-85cb44e25828',
    '1504609773096-104ff2c73ba4',
    '1516546453174-5e1098a4b4af',
  ],
}

/** Thứ tự cố định để `pickTheme` chọn được chủ đề từ seed bất kỳ. */
const THEMES = Object.keys(POOLS) as PhotoTheme[]

/**
 * Chủ đề suy ra từ chữ trong tên điểm dừng.
 *
 * Duyệt theo thứ tự khai báo và lấy khớp đầu tiên, nên mục cụ thể phải đứng
 * trước mục chung: "chợ nổi" là `market` chứ không phải `sea`, dù có chữ "nổi".
 *
 * Từ khoá được so khớp trọn âm tiết (xem `themeFromText`), nên "hang" không
 * dính vào "ruộng bậc thang".
 */
const KEYWORDS: ReadonlyArray<readonly [PhotoTheme, readonly string[]]> = [
  ['market', ['chợ', 'phiên chợ', 'market']],
  [
    'transit',
    [
      'bến xe',
      'thuê xe',
      'xe máy',
      'xe khách',
      'giường nằm',
      'sân bay',
      'máy bay',
      'bến tàu',
      'phà',
      'cano',
      'ca nô',
      'tàu hoả',
      'tàu hỏa',
      'nhà ga',
      'di chuyển',
      'đổ xăng',
    ],
  ],
  [
    'food',
    [
      'quán',
      'ăn',
      'nhà hàng',
      'cà phê',
      'cafe',
      'bún',
      'phở',
      'cơm',
      'lẩu',
      'nướng',
      'bbq',
      'hải sản',
      'bánh',
      'trà sữa',
      'ẩm thực',
      'bia',
    ],
  ],
  [
    'camp',
    [
      'homestay',
      'khách sạn',
      'resort',
      'nhà nghỉ',
      'bungalow',
      'lều',
      'cắm trại',
      'camping',
      'glamping',
      'ngủ',
      'lửa trại',
      'ngắm sao',
      'săn mây',
    ],
  ],
  [
    'trek',
    ['trek', 'leo', 'đi bộ', 'lặn', 'snorkel', 'kayak', 'chèo', 'zipline', 'chinh phục', 'cắm chốt'],
  ],
  ['sea', ['biển', 'bãi', 'đảo', 'hòn', 'cảng', 'sunset', 'bể bơi', 'hồ bơi']],
  ['karst', ['vịnh', 'hang', 'động', 'sông', 'bến thuyền', 'đò', 'thuyền']],
  [
    'mountain',
    [
      'đèo',
      'núi',
      'đỉnh',
      'cao nguyên',
      'dốc',
      'cổng trời',
      'ruộng bậc thang',
      'đồi',
      'fansipan',
      'mã pí lèng',
      'thung lũng',
      'mỏm',
    ],
  ],
  ['nature', ['thác', 'rừng', 'vườn', 'hồ', 'suối', 'đồi chè', 'hoa', 'công viên']],
  [
    'town',
    [
      'phố',
      'chùa',
      'đền',
      'nhà thờ',
      'làng',
      'cầu',
      'bảo tàng',
      'dinh',
      'thành cổ',
      'quảng trường',
      'chợ đêm',
      'check-in',
      'trung tâm',
    ],
  ],
]

/**
 * Chủ đề khớp với tên một điểm dừng, hoặc `undefined` nếu không đoán được.
 *
 * So khớp trọn âm tiết: chuỗi được bỏ dấu câu và kẹp hai đầu bằng khoảng trắng,
 * rồi tìm `" từ khoá "`. Nếu dùng `includes` trần thì "ruộng bậc thang" sẽ khớp
 * "hang" và một thửa ruộng bậc thang biến thành ảnh hang động.
 */
export function themeFromText(text: string): PhotoTheme | undefined {
  const words = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `
  for (const [theme, keywords] of KEYWORDS) {
    if (keywords.some((k) => words.includes(` ${k} `))) return theme
  }
  return undefined
}

/**
 * Hash FNV-1a 32-bit.
 *
 * Cần một hàm băm phân tán đều cho chuỗi ngắn và cho kết quả giống nhau ở mọi
 * lần chạy — `Math.random` thì ảnh nhảy mỗi lần render, còn cộng mã ký tự lại
 * thì các seed chỉ khác nhau hậu tố số sẽ dồn vào cùng một ảnh.
 */
function hash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Chủ đề mặc định khi seed không nói gì về nội dung. */
function pickTheme(seed: string): PhotoTheme {
  return THEMES[hash(`theme:${seed}`) % THEMES.length]
}

export type PhotoOptions = {
  /** Chiều rộng ảnh cần hiển thị, px. */
  w?: number
  /** Chiều cao ảnh cần hiển thị, px. */
  h?: number
  /** Ép chủ đề; bỏ trống thì suy ra từ seed. */
  theme?: PhotoTheme
}

/**
 * URL ảnh du lịch cho một seed.
 *
 * `seed` là bất cứ chuỗi ổn định nào gắn với nội dung: id bài viết, tên điểm
 * dừng, tên file người dùng chọn.
 */
export function travelPhoto(seed: string, options: PhotoOptions = {}): string {
  const { w = 900, h = 700, theme = pickTheme(seed) } = options
  const pool = POOLS[theme]
  return unsplashUrl(pool[hash(seed) % pool.length], w, h)
}

/** Unsplash CDN URL, resized and re-encoded (WebP via `auto=format`) by them. */
function unsplashUrl(id: string, w: number, h: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=75`
}

/**
 * The landing page's fixed imagery.
 *
 * The rest of the app hashes a seed into a pool, which is right for content
 * that changes. The landing page is a composed piece — each photo was picked
 * for the headline it sits beside, so these are named, not drawn.
 */
const LANDING_IDS = {
  /** Peaks above a sea of cloud — the "săn mây" shot the hero is built on. */
  saPa: '1506905925346-21bda4d32df4',
  /** Terraced fields stepping down a valley, hamlets between them. */
  riceTerraces: '1570366583862-f91883984fde',
  /** Turquoise water against a rocky headland. */
  quyNhon: '1573790387438-4da905039392',
  /** Shopfront signs over a wet street at night. */
  hoiAn: '1508009603885-50cf7c579365',
  /** Limestone islands and boats on a still bay. */
  haLong: '1528127269322-539801943592',
  /** A road winding down a green valley under low cloud. */
  mountainRoad: '1470071459604-3b5ec3a7fe05',
  /** Waves running up a wide beach at sunset. */
  beach: '1507525428034-b723cf961d3e',
} as const

export type LandingPhoto = keyof typeof LANDING_IDS

/** A landing-page photo at the size it will actually be displayed. */
export function landingPhoto(name: LandingPhoto, w: number, h: number): string {
  return unsplashUrl(LANDING_IDS[name], w, h)
}

/** Các chủ đề đủ "rộng" để làm ảnh bìa — cảnh nơi đến, không phải cận cảnh. */
const SCENIC: readonly PhotoTheme[] = ['mountain', 'sea', 'karst', 'nature', 'town']

/**
 * Ảnh bìa bài viết / lịch trình (tỉ lệ 16:10).
 *
 * `theme` đoán từ tiêu đề chỉ được dùng nếu là cảnh: tiêu đề "Phú Quốc 5N4Đ —
 * lặn biển, Hòn Thơm và hải sản" khớp từ khoá đồ ăn, mà lấy ảnh nội thất nhà
 * hàng làm bìa cho một chuyến ra đảo thì hỏng.
 */
export function travelCover(seed: string, theme?: PhotoTheme): string {
  const scenic =
    theme && SCENIC.includes(theme) ? theme : SCENIC[hash(`cover:${seed}`) % SCENIC.length]
  return travelPhoto(`cover:${seed}`, { w: 1600, h: 1000, theme: scenic })
}

/** Ảnh bìa trang cá nhân — dải ngang rất rộng nên cần bản crop riêng. */
export function travelBanner(seed: string): string {
  const theme = SCENIC[hash(`banner:${seed}`) % SCENIC.length]
  return travelPhoto(`banner:${seed}`, { w: 1800, h: 600, theme })
}

/**
 * Ảnh đại diện.
 *
 * Vẫn là ảnh chuyến đi, nhưng chỉ lấy từ các nhóm có chủ thể rõ ở giữa khung —
 * crop vuông 240px của một dãy núi trải ngang thì nhìn như một vệt màu.
 */
export function travelAvatar(seed: string): string {
  const theme = (['trek', 'camp', 'food', 'sea'] as const)[hash(`avatar:${seed}`) % 4]
  return travelPhoto(`avatar:${seed}`, { w: 240, h: 240, theme })
}
