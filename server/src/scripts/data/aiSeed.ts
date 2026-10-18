/**
 * Demo data for AI clone (scripts/seed-places.ts).
 *
 * DEMO DATA, NOT VERIFIED: positions are approximate, and prices (VND per
 * person), opening hours and ratings are illustrative. Check them before real
 * use. Some facts are null on purpose, so "chưa có dữ liệu" shows up.
 */

import type { PlaceCategory } from '../../models/Place.js'

export interface SeedPlace {
  name: string
  address: string
  lat: number
  lng: number
  category: PlaceCategory | null
  avgCost: number | null
  priceLevel?: number
  /** "07:00-17:00"; null when unknown. */
  hours: string | null
  isOutdoor: boolean | null
  requiresBooking: boolean | null
  rating: number | null
}

export interface SeedDestination {
  slug: string
  name: string
  region: string
  lat: number
  lng: number
  radiusKm: number
  rainyMonths: number[]
  peakMonths: number[]
  festivals: { name: string; month: number }[]
  places: SeedPlace[]
}

type Row = [string, string, number, number, PlaceCategory | null, number | null, string | null, boolean | null, boolean | null, number | null]

const place = ([name, address, lat, lng, category, avgCost, hours, isOutdoor, requiresBooking, rating]: Row): SeedPlace => ({
  name,
  address,
  lat,
  lng,
  category,
  avgCost,
  hours,
  isOutdoor,
  requiresBooking,
  rating,
})

const ALL_DAY = '00:00-23:59'

export const DESTINATIONS: SeedDestination[] = [
  {
    slug: 'da-lat',
    name: 'Đà Lạt',
    region: 'central',
    lat: 11.9404,
    lng: 108.4583,
    radiusKm: 25,
    rainyMonths: [5, 6, 7, 8, 9, 10],
    peakMonths: [12, 1, 2, 6, 7],
    festivals: [{ name: 'Festival Hoa Đà Lạt', month: 12 }],
    places: (
      [
        ['Hồ Xuân Hương', 'Trung tâm TP. Đà Lạt', 11.9419, 108.4446, 'nature', 0, ALL_DAY, true, false, 4.5],
        ['Quảng trường Lâm Viên', 'Đường Trần Quốc Toản, P.10', 11.9393, 108.4447, 'sightseeing', 0, ALL_DAY, true, false, 4.4],
        ['Chợ Đà Lạt', 'Đường Nguyễn Thị Minh Khai, P.1', 11.9431, 108.437, 'shopping', null, '06:00-22:00', false, false, 4.2],
        ['Chợ đêm Đà Lạt', 'Đường Nguyễn Thị Minh Khai, P.1', 11.9425, 108.4365, 'food', 100000, '17:00-23:00', true, false, 4.1],
        ['Ga Đà Lạt', '1 Quang Trung, P.9', 11.9418, 108.4547, 'culture', 10000, '06:00-17:30', true, false, 4.3],
        ['Thiền viện Trúc Lâm', 'Hồ Tuyền Lâm, P.3', 11.9029, 108.4364, 'culture', 0, '06:30-17:00', true, false, 4.6],
        ['Hồ Tuyền Lâm', 'P.3 và P.4', 11.8968, 108.435, 'nature', 0, ALL_DAY, true, false, 4.5],
        ['Thác Datanla', 'Đèo Prenn, QL20', 11.9006, 108.4492, 'activity', 200000, '07:00-17:00', true, false, 4.4],
        ['Đồi chè Cầu Đất', 'Xuân Trường, TP. Đà Lạt', 11.8476, 108.5671, 'nature', 0, '07:00-17:00', true, false, 4.6],
        ['Đỉnh Langbiang', 'Lạc Dương', 12.0466, 108.4405, 'activity', 150000, '07:00-17:00', true, false, 4.4],
        ['Làng Cù Lần', 'Đạ Sar, Lạc Dương', 12.0179, 108.5005, 'activity', 50000, '07:30-17:00', true, false, 4.2],
        ['Thung lũng Tình Yêu', '5-7 Mai Anh Đào, P.8', 11.9785, 108.4497, 'sightseeing', 250000, '07:00-17:00', true, false, 4.0],
        ['Vườn hoa thành phố', 'Trần Nhân Tông, P.8', 11.9497, 108.4489, 'nature', 50000, '07:00-18:00', true, false, 4.2],
        ['Dinh Bảo Đại', 'Triệu Việt Vương, P.4', 11.9306, 108.4294, 'culture', 30000, '07:00-17:00', false, false, 4.2],
        ['Nhà thờ Con Gà', '15 Trần Phú, P.3', 11.9363, 108.4382, 'culture', 0, null, false, false, 4.5],
        ['Biệt thự Hằng Nga', '3 Huỳnh Thúc Kháng, P.4', 11.9351, 108.4307, 'sightseeing', 80000, '08:30-19:00', false, false, 4.3],
        ['Cáp treo Đà Lạt', 'Đèo Prenn, P.3', 11.9174, 108.4366, 'activity', 150000, '07:30-17:00', true, false, 4.4],
        ['Đường hầm điêu khắc đất sét', 'Hồ Tuyền Lâm, P.4', 11.8885, 108.4308, 'sightseeing', 80000, '07:00-17:00', null, false, 4.5],
        ['Đồi thông Hai Mộ – Hồ Than Thở', 'Hồ Xuân Hương nối dài, P.12', 11.9568, 108.4795, 'sightseeing', 50000, '07:00-17:00', true, false, 3.9],
        ['Vườn dâu tây Đất Lành', 'Đường Mai Anh Đào, P.8', 11.9768, 108.46, 'activity', 70000, '07:00-17:30', true, false, null],
        ['Chùa Linh Phước', '120 Tự Phước, Trại Mát', 11.9446, 108.4993, 'culture', 0, '06:00-18:00', false, false, 4.6],
        ['Bảo tàng Lâm Đồng', '4 Hùng Vương, P.10', 11.933, 108.453, 'culture', 20000, '07:30-16:30', false, false, 4.1],
        ['Hồ Vô Cực', 'Tà Nung, TP. Đà Lạt', 11.9064, 108.3655, 'nature', null, '06:00-18:00', true, false, null],
        ['Quán cà phê Tùng', '6 Khu Hoà Bình, P.1', 11.9433, 108.4373, 'cafe', 40000, '07:00-22:00', false, false, 4.3],
        ['Cà phê Là Việt', '200 Nguyễn Công Trứ, P.8', 11.9575, 108.4418, 'cafe', 60000, '07:00-22:00', false, false, 4.6],
        ['Mê Linh Coffee Garden', 'Tổ 20, Tà Nung', 11.9216, 108.3785, 'cafe', 60000, '07:00-18:00', true, false, 4.4],
        ['Bánh mì xíu mại Hoàng Diệu', '26 Hoàng Diệu, P.5', 11.9452, 108.4421, 'food', 30000, '06:00-11:00', false, false, 4.4],
        ['Bánh căn Nhà Chung', '1 Nhà Chung, P.3', 11.9396, 108.434, 'food', 50000, '06:30-18:00', false, false, 4.4],
        ['Nem nướng Bà Hùng', '328 Phan Đình Phùng, P.2', 11.9455, 108.434, 'food', 60000, '09:00-21:00', false, false, 4.2],
        ['Lẩu gà lá é Tao Ngộ', '5 Đường 3/4, P.3', 11.9387, 108.459, 'food', 150000, '10:00-22:00', false, true, 4.3],
        ['Kem bơ Thanh Thảo', '76 Nguyễn Văn Trỗi, P.2', 11.9431, 108.4375, 'food', 30000, '08:00-22:00', false, false, null],
      ] as Row[]
    ).map(place),
  },
  {
    slug: 'hoi-an',
    name: 'Hội An',
    region: 'central',
    lat: 15.877,
    lng: 108.326,
    radiusKm: 45,
    rainyMonths: [9, 10, 11, 12],
    peakMonths: [2, 3, 4, 5, 6, 7, 8],
    festivals: [{ name: 'Trung thu phố cổ', month: 9 }],
    places: (
      [
        ['Phố cổ Hội An', 'Phường Minh An', 15.8775, 108.328, 'sightseeing', 120000, ALL_DAY, true, false, 4.7],
        ['Chùa Cầu', 'Nguyễn Thị Minh Khai, Minh An', 15.8771, 108.3262, 'culture', null, '07:00-21:30', true, false, 4.3],
        ['Nhà cổ Tấn Ký', '101 Nguyễn Thái Học, Minh An', 15.8768, 108.3281, 'culture', null, '08:00-18:00', false, false, 4.2],
        ['Hội quán Phúc Kiến', '46 Trần Phú, Minh An', 15.8781, 108.3305, 'culture', null, '07:00-17:30', false, false, 4.5],
        ['Chùa Ông', '24 Trần Phú, Minh An', 15.8786, 108.3316, 'culture', null, '08:00-17:00', false, false, 4.3],
        ['Bảo tàng Văn hoá Sa Huỳnh', '149 Trần Phú, Minh An', 15.877, 108.3254, 'culture', null, '07:00-21:00', false, false, null],
        ['Chợ Hội An', 'Trần Quý Cáp, Minh An', 15.877, 108.331, 'shopping', null, '06:00-18:00', false, false, 4.1],
        ['Chợ đêm Nguyễn Hoàng', 'Nguyễn Hoàng, An Hội', 15.8758, 108.3264, 'food', 80000, '17:00-22:00', true, false, 4.0],
        ['Thả đèn hoa đăng sông Hoài', 'Bến sông Hoài, Minh An', 15.8763, 108.3275, 'activity', 50000, '18:00-22:00', true, false, 4.6],
        ['Ký ức Hội An', 'Công viên Ấn tượng Hội An, Cồn Hến', 15.8735, 108.322, 'culture', 600000, '18:00-21:00', true, true, 4.6],
        ['Làng gốm Thanh Hà', 'Phường Thanh Hà', 15.8806, 108.3053, 'culture', 35000, '08:00-17:30', false, false, 4.1],
        ['Làng rau Trà Quế', 'Cẩm Hà', 15.9021, 108.3395, 'activity', 50000, '07:00-17:00', true, false, 4.3],
        ['Rừng dừa Bảy Mẫu', 'Cẩm Thanh', 15.874, 108.37, 'activity', 100000, '07:00-17:00', true, false, 4.5],
        ['Cánh đồng lúa Cẩm Thanh', 'Cẩm Thanh', 15.881, 108.35, 'nature', null, '06:00-18:00', true, false, null],
        ['Bãi biển An Bàng', 'Cẩm An', 15.9131, 108.3402, 'nature', 0, ALL_DAY, true, false, 4.5],
        ['Bãi biển Cửa Đại', 'Cẩm An', 15.8999, 108.3633, 'nature', 0, ALL_DAY, true, false, 4.2],
        ['Bãi biển Hà My', 'Điện Dương', 15.9265, 108.33, 'nature', 0, ALL_DAY, true, false, null],
        ['Cù Lao Chàm', 'Tân Hiệp (đi ca nô từ Cửa Đại)', 15.955, 108.515, 'activity', 600000, '07:30-16:00', true, true, 4.4],
        ['Thánh địa Mỹ Sơn', 'Duy Phú, Duy Xuyên', 15.764, 108.124, 'culture', 150000, '06:00-17:00', true, false, 4.5],
        ['VinWonders Nam Hội An', 'Bình Minh, Thăng Bình', 15.7911, 108.4469, 'activity', 600000, '09:00-19:00', true, false, 4.4],
        ['Lớp học nấu ăn ở Cẩm Thanh', 'Cẩm Thanh', 15.8665, 108.3557, 'activity', 800000, '08:00-13:00', false, true, 4.6],
        ['Bánh mì Phượng', '2B Phan Châu Trinh, Minh An', 15.88, 108.3318, 'food', 35000, '06:30-21:30', false, false, 4.4],
        ['Bánh mì Madam Khánh', '115 Trần Cao Vân, Minh An', 15.879, 108.3291, 'food', 30000, '07:00-19:00', false, false, 4.5],
        ['Cơm gà Bà Buội', '22 Phan Châu Trinh, Minh An', 15.8787, 108.3296, 'food', 50000, '10:00-21:00', false, false, 4.2],
        ['Cao lầu Thanh', '26 Thái Phiên, Minh An', 15.8789, 108.3283, 'food', 40000, '07:00-20:00', false, false, null],
        ['Nhà hàng Bale Well', '45/51 Trần Hưng Đạo, Minh An', 15.8796, 108.3299, 'food', 120000, '10:00-22:00', false, false, 4.5],
        ['Morning Glory Restaurant', '106 Nguyễn Thái Học, Minh An', 15.8768, 108.3268, 'food', 200000, '10:00-22:00', false, true, 4.4],
        ['Mót Hội An', '150 Trần Phú, Minh An', 15.8774, 108.3297, 'cafe', 25000, '07:00-22:00', true, false, 4.5],
        ['Reaching Out Tea House', '131 Trần Phú, Minh An', 15.8773, 108.329, 'cafe', 80000, '08:30-21:00', false, false, 4.8],
        ['Faifo Coffee', '130 Trần Phú, Minh An', 15.8771, 108.3297, 'cafe', 60000, '07:00-21:30', false, false, 4.4],
      ] as Row[]
    ).map(place),
  },
]

/** Place.tags by place name: the kinds of trip a visit makes, which the checklist reads. */
export const PLACE_TAGS: Record<string, string[]> = {
  'Đỉnh Langbiang': ['mountain'],
  'Đồi chè Cầu Đất': ['mountain'],
  'Làng Cù Lần': ['mountain'],
  'Thiền viện Trúc Lâm': ['temple'],
  'Chùa Linh Phước': ['temple'],
  'Nhà thờ Con Gà': ['temple'],
  'Thác Datanla': ['water'],
  'Hồ Tuyền Lâm': ['water'],
  'Hồ Vô Cực': ['water'],
  'Bãi biển An Bàng': ['beach'],
  'Bãi biển Cửa Đại': ['beach'],
  'Bãi biển Hà My': ['beach'],
  'Cù Lao Chàm': ['beach', 'water'],
  'Rừng dừa Bảy Mẫu': ['water'],
  'Thả đèn hoa đăng sông Hoài': ['water'],
  'Chùa Cầu': ['temple'],
  'Chùa Ông': ['temple'],
  'Hội quán Phúc Kiến': ['temple'],
  'Thánh địa Mỹ Sơn': ['temple'],
}

/**
 * Preparation checklist templates (models/ChecklistTemplate.ts), in order. Tags:
 * all, a place category, a Place tag, outdoor, rainy, peak, kids, elderly.
 */
export const CHECKLIST: { group: string; text: string; tags: string[] }[] = [
  { group: 'Giấy tờ', text: 'CCCD hoặc hộ chiếu', tags: ['all'] },
  { group: 'Giấy tờ', text: 'Tiền mặt và thẻ ngân hàng', tags: ['all'] },
  { group: 'Giấy tờ', text: 'Vé xe, vé máy bay và xác nhận đặt phòng', tags: ['all'] },
  { group: 'Quần áo', text: 'Giày đi bộ êm chân', tags: ['all'] },
  { group: 'Quần áo', text: 'Áo khoác', tags: ['mountain'] },
  { group: 'Quần áo', text: 'Đồ bơi và khăn tắm', tags: ['beach'] },
  { group: 'Quần áo', text: 'Mũ rộng vành và kính râm', tags: ['beach', 'outdoor'] },
  { group: 'Quần áo', text: 'Trang phục kín đáo khi vào chùa, nơi thờ tự', tags: ['temple'] },
  { group: 'Quần áo', text: 'Dép chống trơn', tags: ['rainy', 'water'] },
  { group: 'Đồ dùng', text: 'Sạc dự phòng và cáp sạc', tags: ['all'] },
  { group: 'Đồ dùng', text: 'Ô gấp hoặc áo mưa', tags: ['rainy'] },
  { group: 'Đồ dùng', text: 'Túi chống nước cho điện thoại', tags: ['rainy', 'water', 'beach'] },
  { group: 'Đồ dùng', text: 'Chai nước cá nhân', tags: ['outdoor'] },
  { group: 'Đồ dùng', text: 'Đèn pin nhỏ', tags: ['mountain'] },
  { group: 'Đồ dùng', text: 'Xe đẩy hoặc địu em bé', tags: ['kids'] },
  { group: 'Đồ dùng', text: 'Ghế gấp nhỏ để nghỉ chân', tags: ['elderly'] },
  { group: 'Sức khoẻ', text: 'Thuốc cá nhân thường dùng', tags: ['all'] },
  { group: 'Sức khoẻ', text: 'Kem chống nắng', tags: ['outdoor', 'beach'] },
  { group: 'Sức khoẻ', text: 'Thuốc chống côn trùng', tags: ['nature'] },
  { group: 'Sức khoẻ', text: 'Thuốc hạ sốt và men tiêu hoá cho trẻ', tags: ['kids'] },
  { group: 'Sức khoẻ', text: 'Đồ ăn vặt cho bé', tags: ['kids'] },
  { group: 'Sức khoẻ', text: 'Thuốc huyết áp và thuốc thường dùng của người lớn tuổi', tags: ['elderly'] },
  { group: 'Lưu ý', text: 'Đặt phòng và vé sớm vì đang mùa cao điểm', tags: ['peak'] },
  { group: 'Lưu ý', text: 'Chừa thời gian nghỉ giữa các điểm cho người lớn tuổi', tags: ['elderly'] },
]

/** A stop of a sample journey: a place above by name, or a stop of the author's own (no Place). */
export type SeedStop =
  | { place: string; estCost: number; note: string }
  | { own: { name: string; address: string; lat: number; lng: number }; estCost: number; note: string }

export interface SeedJourney {
  key: string
  destination: string
  authorId: string
  title: string
  summary: string
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  startDate: string
  budgetLevel: 'low' | 'medium' | 'high'
  tags: string[]
  likeCount: number
  cloneCount: number
  days: { title: string; stops: SeedStop[] }[]
}

export const JOURNEYS: SeedJourney[] = [
  {
    key: 'da-lat-3n2d',
    destination: 'da-lat',
    authorId: 'u_004',
    title: 'Đà Lạt 3N2Đ: hồ, đồi chè và chợ đêm',
    summary: 'Ba ngày ở Đà Lạt cho người lần đầu: sáng dạo hồ, chiều lên đồi chè, tối ăn chợ đêm. Đi hai người, giá là chi phí thực tế của tụi mình.',
    season: 'winter',
    startDate: '2025-12-12',
    budgetLevel: 'medium',
    tags: ['Đà Lạt', 'chill', 'cà phê', 'ẩm thực'],
    likeCount: 412,
    cloneCount: 96,
    days: [
      {
        title: 'Trung tâm và hồ Xuân Hương',
        stops: [
          { place: 'Bánh mì xíu mại Hoàng Diệu', estCost: 60000, note: 'Ăn sáng sớm, đi trễ là hết xíu mại.' },
          { place: 'Hồ Xuân Hương', estCost: 0, note: 'Đi bộ một vòng hồ buổi sáng.' },
          { place: 'Ga Đà Lạt', estCost: 20000, note: 'Chụp ảnh nhà ga cổ.' },
          { place: 'Quán cà phê Tùng', estCost: 80000, note: 'Quán cũ, nhạc xưa.' },
          { place: 'Chợ đêm Đà Lạt', estCost: 200000, note: 'Ăn tối: bánh tráng nướng, sữa đậu nành.' },
        ],
      },
      {
        title: 'Hồ Tuyền Lâm và thác Datanla',
        stops: [
          { place: 'Thiền viện Trúc Lâm', estCost: 0, note: 'Đi sớm cho vắng.' },
          { place: 'Hồ Tuyền Lâm', estCost: 0, note: 'Ngồi ven hồ nghỉ chân.' },
          { place: 'Thác Datanla', estCost: 400000, note: 'Máng trượt hơi đông vào cuối tuần.' },
          { place: 'Lẩu gà lá é Tao Ngộ', estCost: 300000, note: 'Nên gọi đặt bàn trước.' },
          { place: 'Quảng trường Lâm Viên', estCost: 0, note: 'Dạo tối, ngắm nụ hoa atiso.' },
        ],
      },
      {
        title: 'Đồi chè Cầu Đất',
        stops: [
          { place: 'Đồi chè Cầu Đất', estCost: 0, note: 'Đi từ 5 giờ sáng để săn mây.' },
          { place: 'Chùa Linh Phước', estCost: 0, note: 'Ghé trên đường về.' },
          { place: 'Chợ Đà Lạt', estCost: 300000, note: 'Mua mứt, atiso làm quà.' },
        ],
      },
    ],
  },
  {
    key: 'da-lat-san-may',
    destination: 'da-lat',
    authorId: 'u_005',
    title: 'Săn mây Đà Lạt 2N1Đ cho nhóm bạn',
    summary: 'Hai ngày chạy xe máy cùng nhóm bạn: leo Langbiang, ghé làng Cù Lần, sáng sớm săn mây đồi chè Cầu Đất.',
    season: 'spring',
    startDate: '2026-03-07',
    budgetLevel: 'low',
    tags: ['Đà Lạt', 'săn mây', 'nhóm bạn', 'tiết kiệm'],
    likeCount: 238,
    cloneCount: 51,
    days: [
      {
        title: 'Langbiang và Cù Lần',
        stops: [
          { place: 'Đỉnh Langbiang', estCost: 600000, note: 'Thuê xe jeep lên đỉnh cho cả nhóm.' },
          { place: 'Làng Cù Lần', estCost: 200000, note: 'Chụp ảnh, ăn trưa trong làng.' },
          {
            own: { name: 'Homestay của nhóm', address: 'Phường 8, TP. Đà Lạt', lat: 11.9612, lng: 108.4511 },
            estCost: 800000,
            note: 'Thuê nguyên căn cho bốn người.',
          },
          { place: 'Nem nướng Bà Hùng', estCost: 240000, note: 'Ăn tối.' },
          { place: 'Chợ đêm Đà Lạt', estCost: 150000, note: 'Dạo chợ, ăn vặt.' },
        ],
      },
      {
        title: 'Săn mây Cầu Đất',
        stops: [
          { place: 'Đồi chè Cầu Đất', estCost: 0, note: 'Xuất phát từ 4 giờ rưỡi.' },
          { place: 'Cà phê Là Việt', estCost: 240000, note: 'Cà phê sau khi săn mây.' },
          { place: 'Bánh căn Nhà Chung', estCost: 200000, note: 'Ăn trưa trước khi về.' },
        ],
      },
    ],
  },
  {
    key: 'hoi-an-3n2d',
    destination: 'hoi-an',
    authorId: 'u_002',
    title: 'Hội An 3N2Đ: phố cổ, rừng dừa và biển An Bàng',
    summary: 'Ba ngày ở Hội An cho người mê ăn và thích đi chậm: phố cổ buổi tối, rừng dừa buổi sáng, biển buổi chiều.',
    season: 'spring',
    startDate: '2026-04-10',
    budgetLevel: 'medium',
    tags: ['Hội An', 'phố cổ', 'ẩm thực', 'biển'],
    likeCount: 356,
    cloneCount: 88,
    days: [
      {
        title: 'Phố cổ',
        stops: [
          { place: 'Bánh mì Phượng', estCost: 70000, note: 'Ăn sáng.' },
          { place: 'Chùa Cầu', estCost: 240000, note: 'Mua vé tham quan phố cổ ở đây.' },
          { place: 'Nhà cổ Tấn Ký', estCost: 0, note: 'Dùng vé tham quan.' },
          { place: 'Hội quán Phúc Kiến', estCost: 0, note: 'Dùng vé tham quan.' },
          { place: 'Cơm gà Bà Buội', estCost: 100000, note: 'Ăn trưa.' },
          { place: 'Thả đèn hoa đăng sông Hoài', estCost: 150000, note: 'Đi thuyền thả đèn lúc chạng vạng.' },
          { place: 'Chợ đêm Nguyễn Hoàng', estCost: 160000, note: 'Ăn vặt buổi tối.' },
        ],
      },
      {
        title: 'Rừng dừa và biển',
        stops: [
          { place: 'Rừng dừa Bảy Mẫu', estCost: 300000, note: 'Đi thúng chai.' },
          { place: 'Làng rau Trà Quế', estCost: 100000, note: 'Đạp xe qua làng rau.' },
          { place: 'Bãi biển An Bàng', estCost: 100000, note: 'Thuê ghế nằm chiều.' },
          { place: 'Nhà hàng Bale Well', estCost: 240000, note: 'Bánh xèo cuốn, ăn no.' },
        ],
      },
      {
        title: 'Mỹ Sơn',
        stops: [
          { place: 'Thánh địa Mỹ Sơn', estCost: 300000, note: 'Đi sớm tránh nắng.' },
          { place: 'Mót Hội An', estCost: 50000, note: 'Nước mát sau chuyến đi.' },
          { place: 'Chợ Hội An', estCost: 200000, note: 'Mua quà.' },
        ],
      },
    ],
  },
  {
    key: 'hoi-an-gia-dinh',
    destination: 'hoi-an',
    authorId: 'u_003',
    title: 'Hội An 2 ngày cho gia đình có trẻ nhỏ',
    summary: 'Lịch nhẹ nhàng cho gia đình có hai bé: ít đi bộ, nhiều chỗ nghỉ, tối xem show.',
    season: 'summer',
    startDate: '2026-06-20',
    budgetLevel: 'high',
    tags: ['Hội An', 'gia đình', 'trẻ em'],
    likeCount: 129,
    cloneCount: 22,
    days: [
      {
        title: 'Phố cổ và làng gốm',
        stops: [
          { place: 'Phố cổ Hội An', estCost: 480000, note: 'Vé tham quan cho cả nhà.' },
          { place: 'Bánh mì Madam Khánh', estCost: 120000, note: 'Ăn trưa nhẹ.' },
          { place: 'Làng gốm Thanh Hà', estCost: 140000, note: 'Các bé được tự nặn gốm.' },
          { place: 'Morning Glory Restaurant', estCost: 800000, note: 'Đặt bàn trước.' },
          { place: 'Ký ức Hội An', estCost: 2400000, note: 'Show buổi tối, đặt vé trước.' },
        ],
      },
      {
        title: 'Biển và công viên',
        stops: [
          { place: 'Bãi biển An Bàng', estCost: 0, note: 'Tắm biển buổi sáng.' },
          { place: 'VinWonders Nam Hội An', estCost: 2400000, note: 'Cả ngày ở công viên.' },
        ],
      },
    ],
  },
]
