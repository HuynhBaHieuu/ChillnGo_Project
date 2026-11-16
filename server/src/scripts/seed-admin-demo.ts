/**
 * Demo data for the admin console, so every screen has something to show in a
 * presentation:
 *
 *   npm run seed:admin-demo            create or refresh it
 *   npm run seed:admin-demo -- --clean remove all of it again
 *   npm run seed:admin-demo -- --check check it against the schemas, write nothing
 *
 * What it makes, all marked as demo (emails demo.*@chillngo.vn, usernames
 * demo_*, slugs demo-*, links under example.com):
 *
 *   Tổng quan    22 accounts signed up over the last 30 days, some unverified,
 *                Google-linked or locked; ended livestreams; AI use today
 *   Người dùng   two locked accounts with reasons, three Premium members
 *   Quản trị viên two admins: demo.kiemduyet (content, reports, users, stats)
 *                and demo.kinhdoanh (businesses, news, revenue, stats)
 *   Nội dung     reports waiting on a journey, a comment, a check-in and an
 *                account; a journey auto-hidden after five reports; one hidden
 *                by a moderator; one dismissed
 *   Doanh nghiệp two pending, two approved (one with "Đề xuất"), one rejected
 *   Tin tức      a paused demo source with news waiting for review
 *   Doanh thu    paid Premium and "Đề xuất" orders, plus pending/expired/cancelled
 *   Nhật ký      what the two demo admins "did"
 *
 * Danh mục comes from `npm run seed:places`. Every record has a fixed id, so
 * running it again updates in place instead of adding copies, and dates are
 * relative to today. Every demo account has the same password
 * (DEMO_PASSWORD, default "Chillngo@123").
 */

import { createHash } from 'node:crypto'

import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import type { Model } from 'mongoose'

import { connectDb } from '../db.js'
import { ADMIN_MODULES } from '../lib/permissions.js'
import type { AdminModule } from '../lib/permissions.js'
import { PRODUCTS } from '../lib/plans.js'
import type { ProductId } from '../lib/plans.js'
import { passwordSchema } from '../lib/schemas.js'
import { AiUsage } from '../models/AiUsage.js'
import { AuditLog } from '../models/AuditLog.js'
import { Business } from '../models/Business.js'
import { CheckIn } from '../models/CheckIn.js'
import { Livestream } from '../models/Livestream.js'
import { NewsItem, NewsSource } from '../models/News.js'
import { Order } from '../models/Order.js'
import { PostComment } from '../models/PostInteraction.js'
import { Report } from '../models/Report.js'
import { TripPost } from '../models/TripPost.js'
import { User } from '../models/User.js'

const PASSWORD = process.env.DEMO_PASSWORD?.trim() || 'Chillngo@123'
const CLEAN = process.argv.includes('--clean')
/** Validate every record against its schema without touching the database. */
const CHECK = process.argv.includes('--check')

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
/** `days` ago, at `hour` o'clock (Vietnam time, roughly). */
const ago = (days: number, hour = 10) => {
  const d = new Date(NOW - days * DAY)
  d.setUTCHours(hour - 7, (days * 17) % 60, 0, 0)
  return d.getTime() > NOW ? new Date(NOW - 60_000) : d
}
const inDays = (days: number) => new Date(NOW + days * DAY)
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

/** The same ObjectId for the same name, every run. */
const oid = (name: string) => createHash('md5').update(`chillngo-admin-demo:${name}`).digest('hex').slice(0, 24)
const pic = (seed: string, w = 1200, h = 800) => `https://picsum.photos/seed/chillngo-${seed}/${w}/${h}`

/* ------------------------------------------------------------- accounts */

interface DemoUser {
  key: string
  name: string
  signedUp: number
  role?: 'user' | 'admin'
  permissions?: AdminModule[]
  unverified?: boolean
  google?: boolean
  locked?: string
  location?: string
}

const USERS: DemoUser[] = [
  { key: 'kiemduyet', name: 'Kiểm duyệt viên (demo)', signedUp: 29, role: 'admin', permissions: ['content', 'reports', 'users', 'stats'] },
  { key: 'kinhdoanh', name: 'Quản lý kinh doanh (demo)', signedUp: 29, role: 'admin', permissions: ['businesses', 'news', 'revenue', 'stats'] },
  { key: 'linh', name: 'Nguyễn Thuỳ Linh', signedUp: 28, location: 'Hà Nội', google: true },
  { key: 'khang', name: 'Trần Minh Khang', signedUp: 27, location: 'TP. Hồ Chí Minh' },
  { key: 'thao', name: 'Lê Phương Thảo', signedUp: 25, location: 'Đà Nẵng', google: true },
  { key: 'duc', name: 'Phạm Anh Đức', signedUp: 22, location: 'Huế' },
  { key: 'mai', name: 'Võ Ngọc Mai', signedUp: 21, location: 'Cần Thơ' },
  { key: 'huy', name: 'Đặng Quốc Huy', signedUp: 19, location: 'Hải Phòng' },
  { key: 'an', name: 'Bùi Thanh An', signedUp: 17, location: 'Đà Lạt', google: true },
  { key: 'vy', name: 'Hồ Tường Vy', signedUp: 15, location: 'Nha Trang' },
  { key: 'nam', name: 'Ngô Hoàng Nam', signedUp: 14, location: 'Hà Giang' },
  { key: 'trang', name: 'Dương Huyền Trang', signedUp: 12, location: 'Hội An' },
  { key: 'son', name: 'Lý Trường Sơn', signedUp: 11, location: 'Quy Nhơn' },
  { key: 'ha', name: 'Mai Thu Hà', signedUp: 9, location: 'Vũng Tàu', unverified: true },
  { key: 'tuan', name: 'Tạ Minh Tuấn', signedUp: 8, location: 'Phú Quốc' },
  { key: 'ngan', name: 'Châu Kim Ngân', signedUp: 6, location: 'Sa Pa', unverified: true },
  { key: 'bao', name: 'Quách Gia Bảo', signedUp: 5, location: 'Ninh Bình' },
  { key: 'yen', name: 'Trịnh Hải Yến', signedUp: 3, location: 'Hạ Long' },
  { key: 'phuc', name: 'Kiều Hữu Phúc', signedUp: 2, location: 'Côn Đảo', unverified: true },
  { key: 'quynh', name: 'Lâm Như Quỳnh', signedUp: 1, location: 'Mộc Châu' },
  { key: 'shopsale', name: 'Shop Voucher Giá Rẻ', signedUp: 16, locked: 'Đăng quảng cáo bán voucher lặp lại nhiều lần.' },
  { key: 'luadao', name: 'Tour Siêu Rẻ 99K', signedUp: 10, locked: 'Lừa đảo: nhận cọc tour rồi chặn liên lạc.' },
]

const userId = (key: string) => oid(`user:${key}`)
const userName = (key: string) => USERS.find((u) => u.key === key)!.name
const email = (key: string) => `demo.${key}@chillngo.vn`

/** Premium bought by these accounts (orders below). */
const PREMIUM: { key: string; product: ProductId; paid: number }[] = [
  { key: 'linh', product: 'premium_year', paid: 26 },
  { key: 'thao', product: 'premium_month', paid: 20 },
  { key: 'an', product: 'premium_month', paid: 13 },
  { key: 'vy', product: 'premium_month', paid: 9 },
  { key: 'trang', product: 'premium_year', paid: 4 },
  { key: 'bao', product: 'premium_month', paid: 2 },
  { key: 'khang', product: 'premium_month', paid: 40 }, // ran out
]

function premiumUntil(key: string): Date | null {
  const order = PREMIUM.find((p) => p.key === key)
  if (!order) return null
  const until = new Date(ago(order.paid).getTime() + PRODUCTS[order.product].days * DAY)
  return until.getTime() > NOW ? until : null
}

/* ------------------------------------------------------------- journeys */

interface Stop {
  name: string
  address: string
  lat: number
  lng: number
  cost: number
  note: string
}

interface DemoJourney {
  key: string
  author: string
  title: string
  summary: string
  region: 'north' | 'central' | 'south' | 'islands'
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  budget: 'low' | 'medium' | 'high'
  published: number
  tags: string[]
  days: { title: string; stops: Stop[] }[]
}

const JOURNEYS: DemoJourney[] = [
  {
    key: 'hagiang',
    author: 'nam',
    title: 'Hà Giang Loop 3 ngày 2 đêm tự lái',
    summary: 'Cung đường Mã Pí Lèng, sông Nho Quế và phố cổ Đồng Văn, đi xe máy tự lái.',
    region: 'north',
    season: 'autumn',
    budget: 'low',
    published: 13,
    tags: ['Hà Giang', 'phượt', 'xe máy'],
    days: [
      { title: 'TP. Hà Giang → Yên Minh', stops: [{ name: 'Cột cờ Lũng Cú', address: 'Lũng Cú, Đồng Văn', lat: 23.3637, lng: 105.3166, cost: 25000, note: 'Leo 389 bậc, nên đi sáng sớm.' }] },
      { title: 'Đồng Văn → Mèo Vạc', stops: [{ name: 'Đèo Mã Pí Lèng', address: 'Mèo Vạc, Hà Giang', lat: 23.2476, lng: 105.4153, cost: 0, note: 'Dừng ở điểm ngắm sông Nho Quế.' }] },
    ],
  },
  {
    key: 'phuquoc',
    author: 'tuan',
    title: 'Phú Quốc 4 ngày cho gia đình có trẻ nhỏ',
    summary: 'Bãi Sao, cáp treo Hòn Thơm và chợ đêm, lịch nhẹ nhàng cho bé.',
    region: 'islands',
    season: 'winter',
    budget: 'medium',
    published: 10,
    tags: ['Phú Quốc', 'gia đình', 'biển'],
    days: [
      { title: 'Nam đảo', stops: [{ name: 'Bãi Sao', address: 'An Thới, Phú Quốc', lat: 10.0573, lng: 104.0367, cost: 0, note: 'Nước trong, bé chơi được.' }] },
      { title: 'Cáp treo Hòn Thơm', stops: [{ name: 'Ga cáp treo An Thới', address: 'An Thới, Phú Quốc', lat: 10.0255, lng: 104.0099, cost: 650000, note: 'Mua vé online rẻ hơn.' }] },
    ],
  },
  {
    key: 'sapa',
    author: 'ngan',
    title: 'Sa Pa mùa lúa chín, 2 ngày',
    summary: 'Bản Cát Cát, Fansipan và ruộng bậc thang Mường Hoa.',
    region: 'north',
    season: 'autumn',
    budget: 'medium',
    published: 6,
    tags: ['Sa Pa', 'núi', 'lúa chín'],
    days: [{ title: 'Bản Cát Cát', stops: [{ name: 'Bản Cát Cát', address: 'San Sả Hồ, Sa Pa', lat: 22.3271, lng: 103.8317, cost: 150000, note: 'Thuê đồ dân tộc chụp ảnh.' }] }],
  },
  {
    key: 'spam',
    author: 'shopsale',
    title: 'SALE SỐC voucher khách sạn 90% inbox ngay',
    summary: 'Inbox để nhận mã giảm giá 90% mọi khách sạn, số lượng có hạn!!!',
    region: 'south',
    season: 'summer',
    budget: 'low',
    published: 4,
    tags: ['khuyến mãi'],
    days: [{ title: 'Liên hệ', stops: [{ name: 'Inbox Zalo', address: 'Online', lat: 10.7769, lng: 106.7009, cost: 0, note: 'Chuyển khoản trước để giữ mã.' }] }],
  },
  {
    key: 'fake',
    author: 'luadao',
    title: 'Tour Côn Đảo 99K bao ăn ở 3 ngày',
    summary: 'Giá rẻ nhất thị trường, đặt cọc 50% để giữ chỗ.',
    region: 'islands',
    season: 'summer',
    budget: 'low',
    published: 8,
    tags: ['Côn Đảo', 'tour'],
    days: [{ title: 'Ngày 1', stops: [{ name: 'Côn Đảo', address: 'Côn Sơn, Bà Rịa - Vũng Tàu', lat: 8.6833, lng: 106.6, cost: 99000, note: 'Cọc trước qua tài khoản cá nhân.' }] }],
  },
  {
    key: 'offtopic',
    author: 'huy',
    title: 'Review quán nhậu ven biển Đồ Sơn',
    summary: 'Hải sản tươi, nhưng có vài lời lẽ không phù hợp trong bài.',
    region: 'north',
    season: 'summer',
    budget: 'low',
    published: 9,
    tags: ['Hải Phòng', 'ăn uống'],
    days: [{ title: 'Đồ Sơn', stops: [{ name: 'Bãi tắm Đồ Sơn', address: 'Đồ Sơn, Hải Phòng', lat: 20.7136, lng: 106.7911, cost: 300000, note: 'Ăn tối ở dãy quán ven biển.' }] }],
  },
  {
    key: 'dalat',
    author: 'an',
    title: 'Đà Lạt 2 ngày săn mây',
    summary: 'Đồi chè Cầu Đất lúc bình minh và các quán cà phê view thung lũng.',
    region: 'central',
    season: 'winter',
    budget: 'medium',
    published: 3,
    tags: ['Đà Lạt', 'săn mây', 'cà phê'],
    days: [{ title: 'Săn mây', stops: [{ name: 'Đồi chè Cầu Đất', address: 'Xuân Trường, Đà Lạt', lat: 11.8786, lng: 108.5592, cost: 50000, note: 'Có mặt trước 5h30.' }] }],
  },
]

const postId = (key: string) => oid(`post:${key}`)

function journeyDoc(j: DemoJourney) {
  const id = postId(j.key)
  const start = dateOnly(ago(j.published + 20))
  const startTime = new Date(`${start}T00:00:00Z`).getTime()
  const days = j.days.map((day, i) => ({
    _id: `${id}_d${i + 1}`,
    dayNumber: i + 1,
    date: dateOnly(new Date(startTime + i * DAY)),
    title: day.title,
    photos: [],
    locations: day.stops.map((s, k) => ({
      _id: `${id}_d${i + 1}_l${k + 1}`,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      note: s.note,
      estCost: s.cost,
      photoUrl: null,
    })),
  }))
  const cover = pic(`post-${j.key}`)
  return {
    _id: id,
    authorId: userId(j.author),
    title: j.title,
    summary: j.summary,
    coverUrl: cover,
    coverImages: [cover],
    region: j.region,
    season: j.season,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    days,
    tags: j.tags,
    budgetLevel: j.budget,
    totalEstCost: j.days.reduce((sum, d) => sum + d.stops.reduce((s, x) => s + x.cost, 0), 0),
    likeCount: (j.published * 7) % 40,
    status: 'published',
    publishedAt: ago(j.published),
    deletedAt: null,
    createdAt: ago(j.published + 1),
    updatedAt: ago(j.published),
  }
}

/* ------------------------------------------------------------ moderation */

const SPAM_COMMENT = oid('comment:spam')
const CHECKIN_AD = oid('checkin:ad')

/**
 * Reports, by what they are about. `hiddenBy`: the journey is hidden now,
 * automatically ("system") or by the demo moderator.
 */
const REPORT_GROUPS: {
  key: string
  targetType: 'post' | 'comment' | 'checkin' | 'user'
  targetId: string
  owner: string
  snapshot: { title: string; text: string; imageUrl: string; postId: string | null }
  reports: { by: string; reason: 'spam' | 'inappropriate' | 'scam' | 'misinformation' | 'harassment' | 'other'; note?: string; at: number }[]
  status: 'pending' | 'resolved' | 'dismissed'
  action?: 'hide'
  resolvedAt?: number
  resolutionNote?: string
}[] = [
  {
    key: 'spam-post',
    targetType: 'post',
    targetId: postId('spam'),
    owner: 'shopsale',
    snapshot: { title: 'SALE SỐC voucher khách sạn 90% inbox ngay', text: 'Inbox để nhận mã giảm giá 90% mọi khách sạn, số lượng có hạn!!!', imageUrl: pic('post-spam'), postId: postId('spam') },
    reports: [
      { by: 'linh', reason: 'spam', note: 'Quảng cáo, không phải hành trình.', at: 3 },
      { by: 'thao', reason: 'scam', note: 'Đòi chuyển khoản trước.', at: 2 },
      { by: 'mai', reason: 'spam', at: 1 },
    ],
    status: 'pending',
  },
  {
    key: 'spam-comment',
    targetType: 'comment',
    targetId: SPAM_COMMENT,
    owner: 'shopsale',
    snapshot: { title: 'Hà Giang Loop 3 ngày 2 đêm tự lái', text: 'Ai cần voucher khách sạn giảm 90% ib mình nhé, uy tín 100%!!!', imageUrl: '', postId: postId('hagiang') },
    reports: [
      { by: 'nam', reason: 'spam', note: 'Spam dưới bài của mình.', at: 2 },
      { by: 'son', reason: 'spam', at: 1 },
    ],
    status: 'pending',
  },
  {
    key: 'checkin-ad',
    targetType: 'checkin',
    targetId: CHECKIN_AD,
    owner: 'huy',
    snapshot: { title: 'Bãi tắm Đồ Sơn', text: 'Nhậu xỉn quá trời, ai không uống là đồ ***', imageUrl: pic('checkin-ad', 800, 800), postId: null },
    reports: [{ by: 'trang', reason: 'inappropriate', note: 'Lời lẽ thô tục.', at: 1 }],
    status: 'pending',
  },
  {
    key: 'scam-user',
    targetType: 'user',
    targetId: userId('luadao'),
    owner: 'luadao',
    snapshot: { title: 'Tour Siêu Rẻ 99K (@demo_luadao)', text: 'Nhận đặt tour giá rẻ, cọc trước 50%.', imageUrl: '', postId: null },
    reports: [
      { by: 'khang', reason: 'scam', note: 'Đã cọc 500k rồi bị chặn liên lạc.', at: 7 },
      { by: 'vy', reason: 'scam', at: 6 },
    ],
    status: 'resolved',
    action: undefined,
    resolvedAt: 5,
    resolutionNote: 'Đã khoá tài khoản lừa đảo.',
  },
  {
    key: 'auto-hidden',
    targetType: 'post',
    targetId: postId('fake'),
    owner: 'luadao',
    snapshot: { title: 'Tour Côn Đảo 99K bao ăn ở 3 ngày', text: 'Giá rẻ nhất thị trường, đặt cọc 50% để giữ chỗ.', imageUrl: pic('post-fake'), postId: postId('fake') },
    reports: [
      { by: 'linh', reason: 'scam', at: 1 },
      { by: 'khang', reason: 'misinformation', note: 'Giá phi thực tế.', at: 1 },
      { by: 'thao', reason: 'scam', at: 1 },
      { by: 'duc', reason: 'scam', at: 0 },
      { by: 'mai', reason: 'misinformation', at: 0 },
    ],
    status: 'pending',
  },
  {
    key: 'mod-hidden',
    targetType: 'post',
    targetId: postId('offtopic'),
    owner: 'huy',
    snapshot: { title: 'Review quán nhậu ven biển Đồ Sơn', text: 'Hải sản tươi, nhưng có vài lời lẽ không phù hợp trong bài.', imageUrl: pic('post-offtopic'), postId: postId('offtopic') },
    reports: [
      { by: 'yen', reason: 'inappropriate', at: 5 },
      { by: 'quynh', reason: 'harassment', note: 'Có câu xúc phạm người bán.', at: 4 },
    ],
    status: 'resolved',
    action: 'hide',
    resolvedAt: 3,
    resolutionNote: 'Ẩn cho tới khi tác giả sửa lời lẽ.',
  },
  {
    key: 'dismissed',
    targetType: 'post',
    targetId: postId('dalat'),
    owner: 'an',
    snapshot: { title: 'Đà Lạt 2 ngày săn mây', text: 'Đồi chè Cầu Đất lúc bình minh và các quán cà phê view thung lũng.', imageUrl: pic('post-dalat'), postId: postId('dalat') },
    reports: [{ by: 'phuc', reason: 'other', note: 'Ảnh hơi mờ.', at: 2 }],
    status: 'dismissed',
    resolvedAt: 1,
    resolutionNote: 'Không vi phạm.',
  },
]

/* --------------------------------------------------------------- business */

const BUSINESSES = [
  { key: 'may', owner: 'an', name: 'Mây Homestay Đà Lạt', type: 'homestay', city: 'Đà Lạt', address: '12 Đường Hoa Hồng, P.4, Đà Lạt', lat: 11.9338, lng: 108.4392, price: [450000, 900000], status: 'approved', created: 20, promoted: true },
  { key: 'gacpho', owner: 'trang', name: 'Cà phê Gác Phố Hội An', type: 'cafe', city: 'Hội An', address: '45 Nguyễn Thái Học, Minh An, Hội An', lat: 15.8771, lng: 108.3266, price: [35000, 70000], status: 'approved', created: 15, promoted: false },
  { key: 'bienxanh', owner: 'vy', name: 'Khách sạn Biển Xanh Nha Trang', type: 'hotel', city: 'Nha Trang', address: '88 Trần Phú, Lộc Thọ, Nha Trang', lat: 12.2388, lng: 109.1967, price: [700000, 1500000], status: 'pending', created: 2, promoted: false },
  { key: 'loop', owner: 'nam', name: 'Hà Giang Loop Tour 3N2Đ', type: 'tour', city: 'Hà Giang', address: '20 Nguyễn Trãi, TP. Hà Giang', lat: 22.8233, lng: 104.9836, price: [2500000, 3500000], status: 'pending', created: 1, promoted: false },
  { key: 'buncha', owner: 'huy', name: 'Bún chả Cô Lan', type: 'restaurant', city: 'Hải Phòng', address: '7 Lạch Tray, Ngô Quyền, Hải Phòng', lat: 20.8449, lng: 106.6881, price: [40000, 60000], status: 'rejected', created: 6, promoted: false, reason: 'Ảnh chưa đúng cơ sở và số điện thoại không liên lạc được. Vui lòng cập nhật rồi gửi lại.' },
] as const

const businessId = (key: string) => oid(`business:${key}`)

/* ------------------------------------------------------------------ build */

async function build() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const users = USERS.map((u) => ({
    _id: userId(u.key),
    username: `demo_${u.key}`,
    displayName: u.name,
    email: email(u.key),
    passwordHash,
    avatarUrl: pic(`avatar-${u.key}`, 200, 200),
    bio: u.role === 'admin' ? 'Tài khoản quản trị dùng để demo.' : 'Tài khoản demo của ChillnGo.',
    location: u.location ?? 'Việt Nam',
    role: u.role ?? 'user',
    adminPermissions: u.permissions ?? [],
    status: u.locked ? 'locked' : 'active',
    lockedReason: u.locked ?? '',
    lockedAt: u.locked ? ago(5) : null,
    emailVerified: !u.unverified,
    ...(u.google ? { googleId: `demo-google-${u.key}` } : {}),
    lastLoginAt: u.unverified ? null : ago(u.signedUp % 4, 20),
    postCount: JOURNEYS.filter((j) => j.author === u.key).length,
    premiumUntil: premiumUntil(u.key),
    createdAt: ago(u.signedUp, 9 + (u.signedUp % 10)),
    updatedAt: ago(Math.max(0, u.signedUp - 1)),
  }))

  const posts = JOURNEYS.map(journeyDoc)
  const hidden = (by: string, reason: string, at: number) => ({ hidden: true, action: 'hide', reason, by, at: ago(at) })
  for (const p of posts) {
    if (p._id === postId('fake')) Object.assign(p, { moderation: hidden('system', 'Tự động ẩn tạm sau 5 báo cáo, chờ kiểm duyệt.', 0) })
    if (p._id === postId('offtopic')) Object.assign(p, { moderation: hidden(userId('kiemduyet'), 'Ẩn cho tới khi tác giả sửa lời lẽ.', 3) })
  }

  const comments = [
    { _id: oid('comment:1'), postId: postId('hagiang'), authorId: userId('khang'), content: 'Lịch này hợp lý quá, tháng 10 mình đi theo luôn!', createdAt: ago(11), updatedAt: ago(11) },
    { _id: oid('comment:2'), postId: postId('phuquoc'), authorId: userId('mai'), content: 'Cáp treo Hòn Thơm cho bé dưới 1m có miễn phí không bạn?', createdAt: ago(8), updatedAt: ago(8) },
    { _id: SPAM_COMMENT, postId: postId('hagiang'), authorId: userId('shopsale'), content: 'Ai cần voucher khách sạn giảm 90% ib mình nhé, uy tín 100%!!!', createdAt: ago(3), updatedAt: ago(3) },
  ]

  const checkins = [
    { _id: oid('checkin:1'), authorId: userId('linh'), caption: 'Hoàng hôn ở Hồ Tây đẹp quá', feeling: 'happy', location: { name: 'Hồ Tây', address: 'Tây Hồ, Hà Nội', lat: 21.0583, lng: 105.8194 }, photos: [{ publicId: 'demo/checkin-1', url: pic('checkin-1', 800, 800), width: 800, height: 800 }], createdAt: ago(4), updatedAt: ago(4) },
    { _id: oid('checkin:2'), authorId: userId('son'), caption: 'Eo Gió Quy Nhơn lộng gió', feeling: 'relaxed', location: { name: 'Eo Gió', address: 'Nhơn Lý, Quy Nhơn', lat: 13.8792, lng: 109.2956 }, photos: [{ publicId: 'demo/checkin-2', url: pic('checkin-2', 800, 800), width: 800, height: 800 }], createdAt: ago(2), updatedAt: ago(2) },
    { _id: CHECKIN_AD, authorId: userId('huy'), caption: 'Nhậu xỉn quá trời, ai không uống là đồ ***', feeling: null, location: { name: 'Bãi tắm Đồ Sơn', address: 'Đồ Sơn, Hải Phòng', lat: 20.7136, lng: 106.7911 }, photos: [{ publicId: 'demo/checkin-ad', url: pic('checkin-ad', 800, 800), width: 800, height: 800 }], createdAt: ago(1), updatedAt: ago(1) },
  ]

  const reports = REPORT_GROUPS.flatMap((g) =>
    g.reports.map((r) => ({
      _id: oid(`report:${g.key}:${r.by}`),
      reporterId: userId(r.by),
      targetType: g.targetType,
      targetId: g.targetId,
      targetOwnerId: userId(g.owner),
      reason: r.reason,
      note: r.note ?? '',
      snapshot: g.snapshot,
      status: g.status,
      action: g.status === 'resolved' ? (g.action ?? (g.targetType === 'user' ? 'lock' : 'hide')) : 'none',
      resolvedBy: g.status === 'pending' ? null : userId('kiemduyet'),
      resolvedAt: g.resolvedAt === undefined ? null : ago(g.resolvedAt),
      resolutionNote: g.resolutionNote ?? '',
      createdAt: ago(r.at, 8 + r.by.length),
      updatedAt: ago(r.at),
    })),
  )

  const businesses = BUSINESSES.map((b) => ({
    _id: businessId(b.key),
    ownerId: userId(b.owner),
    slug: `demo-${b.key}`,
    name: b.name,
    type: b.type,
    description: `${b.name}: trang doanh nghiệp mẫu để demo trang quản trị.`,
    address: b.address,
    city: b.city,
    lat: b.lat,
    lng: b.lng,
    phone: '0900000000',
    photos: [pic(`business-${b.key}`), pic(`business-${b.key}-2`)],
    priceFrom: b.price[0],
    priceTo: b.price[1],
    openingHours: b.type === 'cafe' ? '07:00 - 22:00' : '',
    status: b.status,
    statusReason: 'reason' in b ? b.reason : '',
    reviewedBy: b.status === 'pending' ? null : userId('kinhdoanh'),
    reviewedAt: b.status === 'pending' ? null : ago(b.created - 1),
    promotedUntil: b.promoted ? inDays(18) : null,
    createdAt: ago(b.created),
    updatedAt: ago(Math.max(0, b.created - 1)),
  }))

  let code = 990_000_000
  const order = (key: string, product: ProductId, status: 'paid' | 'pending' | 'expired' | 'cancelled', at: number, business?: string) => {
    const created = ago(at, 14)
    return {
      _id: oid(`order:${key}`),
      orderCode: ++code,
      userId: userId(key.split(':')[0]),
      product,
      businessId: business ? businessId(business) : null,
      amount: PRODUCTS[product].amount,
      days: PRODUCTS[product].days,
      status,
      checkoutUrl: '',
      paymentLinkId: '',
      reference: status === 'paid' ? `DEMO${code}` : '',
      expiresAt: status === 'pending' ? inDays(1) : new Date(created.getTime() + 15 * 60_000),
      paidAt: status === 'paid' ? new Date(created.getTime() + 3 * 60_000) : null,
      grantedUntil: status === 'paid' ? new Date(created.getTime() + PRODUCTS[product].days * DAY) : null,
      createdAt: created,
      updatedAt: created,
    }
  }
  const orders = [
    ...PREMIUM.map((p) => order(p.key, p.product, 'paid', p.paid)),
    order('an:boost', 'business_boost_month', 'paid', 12, 'may'),
    order('trang:boost', 'business_boost_month', 'paid', 27, 'gacpho'),
    order('duc', 'premium_month', 'pending', 0),
    order('son', 'premium_year', 'expired', 6),
    order('yen', 'premium_month', 'cancelled', 3),
  ]

  const sourceId = oid('news:source')
  const newsSources = [
    {
      _id: sourceId,
      name: '[Demo] Tin du lịch mẫu',
      type: 'rss',
      url: 'https://example.com/chillngo-demo/rss.xml',
      includeKeywords: [],
      excludeKeywords: ['quảng cáo'],
      enabled: false,
      autoPublish: false,
      intervalMinutes: 60,
      lastRunAt: ago(0, 8),
      lastStatus: 'ok',
      lastNewCount: 4,
      createdBy: userId('kinhdoanh'),
      createdAt: ago(10),
      updatedAt: ago(0, 8),
    },
  ]
  const NEWS = [
    { key: 'lua', status: 'pending', region: 'north', title: 'Mùa lúa chín Mù Cang Chải đẹp nhất vào cuối tháng 9', summary: 'Ruộng bậc thang Mù Cang Chải vào mùa vàng từ giữa tháng 9 tới đầu tháng 10. Du khách nên đi ngày thường để tránh đông.' },
    { key: 'hoian', status: 'pending', region: 'central', title: 'Hội An thử nghiệm phố đi bộ mở rộng dịp cuối tuần', summary: 'Khu phố cổ mở rộng giờ đi bộ vào tối thứ Sáu đến Chủ nhật, kèm hoạt động thả đèn hoa đăng trên sông Hoài.' },
    { key: 'phuquoc', status: 'pending', region: 'islands', title: 'Phú Quốc mở thêm tuyến tàu cao tốc nối Rạch Giá', summary: 'Tuyến tàu mới rút ngắn thời gian di chuyển còn khoảng hai giờ rưỡi, chạy hai chuyến mỗi ngày trong mùa cao điểm.' },
    { key: 'dalat', status: 'pending', region: 'central', title: 'Đà Lạt vào mùa hoa dã quỳ, nhiều cung đường nhuộm vàng', summary: 'Hoa dã quỳ nở rộ dọc đèo Prenn và quanh hồ Tuyền Lâm từ tháng 11, là điểm chụp ảnh được nhiều người tìm đến.' },
    { key: 'ads', status: 'rejected', region: 'south', title: 'Quảng cáo: mua 1 tặng 1 vé máy bay giá rẻ', summary: 'Không phải tin du lịch.' },
  ]
  const newsItems = NEWS.map((n, i) => ({
    _id: oid(`news:item:${n.key}`),
    sourceId,
    sourceName: '[Demo] Tin du lịch mẫu',
    sourceType: 'rss',
    url: `https://example.com/chillngo-demo/tin-${n.key}`,
    title: n.title,
    headline: n.title,
    excerpt: n.summary,
    summary: n.summary,
    content: [n.summary, 'Đây là tin mẫu để demo trang quản trị Tin tức, không phải bài báo thật.'],
    imageUrl: pic(`news-${n.key}`),
    images: [pic(`news-${n.key}`)],
    writtenAt: ago(0, 9),
    kind: 'article',
    author: 'ChillnGo Demo',
    publishedAt: ago(i % 3, 7 + i),
    status: n.status,
    statusReason: n.status === 'rejected' ? 'Quảng cáo, không phải tin du lịch.' : '',
    regions: [n.region],
    aiStatus: 'done',
    reviewedBy: n.status === 'rejected' ? userId('kinhdoanh') : null,
    reviewedAt: n.status === 'rejected' ? ago(0, 9) : null,
    createdAt: ago(i % 3, 8),
    updatedAt: ago(0, 9),
  }))

  const livestreams = [
    { key: 'sapa', host: 'ngan', title: 'Live săn mây đỉnh Fansipan', at: 4, minutes: 42, peak: 37 },
    { key: 'hoian', host: 'trang', title: 'Dạo phố cổ Hội An đêm rằm', at: 9, minutes: 65, peak: 58 },
    { key: 'phuquoc', host: 'tuan', title: 'Ngắm hoàng hôn Sunset Town', at: 15, minutes: 30, peak: 21 },
    { key: 'hagiang', host: 'nam', title: 'Đổ đèo Mã Pí Lèng trực tiếp', at: 23, minutes: 55, peak: 44 },
  ].map((l) => ({
    _id: oid(`live:${l.key}`),
    hostId: userId(l.host),
    title: l.title,
    audience: 'public',
    status: 'ended',
    roomName: `live_demo_${l.key}`,
    startedAt: ago(l.at, 19),
    endedAt: new Date(ago(l.at, 19).getTime() + l.minutes * 60_000),
    endedReason: 'host',
    hostSeenAt: ago(l.at, 20),
    viewerCount: 0,
    peakViewers: l.peak,
    uniqueViewers: l.peak + 9,
    commentCount: l.peak * 2,
    createdAt: ago(l.at, 19),
    updatedAt: ago(l.at, 20),
  }))

  const vnToday = new Date(NOW + 7 * 3600_000).toISOString().slice(0, 10)
  const aiUsage = ['linh', 'khang', 'an', 'trang', 'bao', 'yen'].map((key, i) => ({
    _id: oid(`ai:${key}`),
    userId: userId(key),
    day: vnToday,
    count: [6, 3, 9, 2, 4, 1][i],
    createdAt: new Date(NOW - i * 3600_000),
  }))

  const actor = (key: string) => ({ actorId: userId(key), actorName: `${userName(key)} (@demo_${key})`, actorRole: 'admin', ip: '127.0.0.1' })
  const audits = [
    { key: 'lock-shop', ...actor('kiemduyet'), action: 'user.lock', targetType: 'user', targetId: userId('shopsale'), targetLabel: `${userName('shopsale')} (@demo_shopsale)`, details: { reason: USERS.find((u) => u.key === 'shopsale')!.locked }, at: 5 },
    { key: 'lock-scam', ...actor('kiemduyet'), action: 'user.lock', targetType: 'user', targetId: userId('luadao'), targetLabel: `${userName('luadao')} (@demo_luadao)`, details: { reason: USERS.find((u) => u.key === 'luadao')!.locked, via: 'report' }, at: 5 },
    { key: 'report-lock', ...actor('kiemduyet'), action: 'report.lock', targetType: 'user', targetId: userId('luadao'), targetLabel: 'Tour Siêu Rẻ 99K (@demo_luadao)', details: { reports: 2, note: 'Đã khoá tài khoản lừa đảo.' }, at: 5 },
    { key: 'report-hide', ...actor('kiemduyet'), action: 'report.hide', targetType: 'post', targetId: postId('offtopic'), targetLabel: 'Review quán nhậu ven biển Đồ Sơn', details: { reports: 2, note: 'Ẩn cho tới khi tác giả sửa lời lẽ.' }, at: 3 },
    { key: 'report-dismiss', ...actor('kiemduyet'), action: 'report.dismiss', targetType: 'post', targetId: postId('dalat'), targetLabel: 'Đà Lạt 2 ngày săn mây', details: { reports: 1, note: 'Không vi phạm.' }, at: 1 },
    { key: 'unhide', ...actor('kiemduyet'), action: 'content.unhide', targetType: 'post', targetId: postId('sapa'), targetLabel: 'Sa Pa mùa lúa chín, 2 ngày', details: { previousAction: 'hide' }, at: 6 },
    { key: 'catalog', ...actor('kinhdoanh'), action: 'catalog.place.update', targetType: 'place', targetId: '', targetLabel: 'Biệt thự Hằng Nga', details: {}, at: 7 },
    { key: 'biz-approve-may', ...actor('kinhdoanh'), action: 'business.approve', targetType: 'business', targetId: businessId('may'), targetLabel: 'Mây Homestay Đà Lạt', details: { reason: '' }, at: 19 },
    { key: 'biz-approve-gacpho', ...actor('kinhdoanh'), action: 'business.approve', targetType: 'business', targetId: businessId('gacpho'), targetLabel: 'Cà phê Gác Phố Hội An', details: { reason: '' }, at: 14 },
    { key: 'biz-reject', ...actor('kinhdoanh'), action: 'business.reject', targetType: 'business', targetId: businessId('buncha'), targetLabel: 'Bún chả Cô Lan', details: { reason: BUSINESSES[4].reason }, at: 5 },
  ].map(({ key, at, ...log }) => ({ _id: oid(`audit:${key}`), ...log, createdAt: ago(at, 15) }))

  return { users, posts, comments, checkins, reports, businesses, orders, newsSources, newsItems, livestreams, aiUsage, audits }
}

/* ------------------------------------------------------------------- run */

type Doc = { _id: string; createdAt?: Date }

function setsOf(data: Awaited<ReturnType<typeof build>>): [string, Model<any>, Doc[]][] {
  return [
    ['accounts', User, data.users],
    ['journeys', TripPost, data.posts],
    ['comments', PostComment, data.comments],
    ['check-ins', CheckIn, data.checkins],
    ['reports', Report, data.reports],
    ['businesses', Business, data.businesses],
    ['orders', Order, data.orders],
    ['news sources', NewsSource, data.newsSources],
    ['news items', NewsItem, data.newsItems],
    ['livestreams', Livestream, data.livestreams],
    ['AI use today', AiUsage, data.aiUsage],
    ['audit log', AuditLog, data.audits],
  ]
}

async function upsertAll(name: string, model: Model<any>, docs: Doc[]) {
  for (const { _id, ...fields } of docs) {
    await model.updateOne({ _id }, { $set: fields }, { upsert: true, timestamps: false, strict: false })
  }
  console.log(`  ${name}: ${docs.length}`)
}

async function main() {
  const checked = passwordSchema.safeParse(PASSWORD)
  if (!checked.success) throw new Error(`DEMO_PASSWORD: ${checked.error.issues[0]?.message}`)
  if (!ADMIN_MODULES.includes('businesses')) throw new Error('This seed expects the businesses / news / revenue modules.')

  if (CHECK) {
    const data = await build()
    let problems = 0
    for (const [name, model, docs] of setsOf(data)) {
      for (const doc of docs) {
        const error = await new model(doc).validate().then(
          () => null,
          (e: Error) => e,
        )
        if (error) {
          problems++
          console.log(`  ${name} ${doc._id}: ${error.message}`)
        }
      }
      console.log(`  ${name}: ${docs.length} checked`)
    }
    if (problems > 0) throw new Error(`${problems} demo records do not match their schema.`)
    console.log('Every demo record matches its schema. Nothing was written.')
    return
  }

  await connectDb()
  const data = await build()

  // Never take over a real account that happens to use a demo email or username.
  const taken = await User.find({
    $or: [{ email: { $in: data.users.map((u) => u.email) } }, { username: { $in: data.users.map((u) => u.username) } }],
    _id: { $nin: data.users.map((u) => u._id) },
  })
    .select('email')
    .lean()
  if (taken.length > 0) throw new Error(`Not a demo account, left alone: ${taken.map((u) => u.email).join(', ')}`)

  const sets = setsOf(data)

  if (CLEAN) {
    for (const [name, model, docs] of sets) {
      const { deletedCount } = await model.deleteMany({ _id: { $in: docs.map((d) => d._id) } })
      console.log(`  ${name}: removed ${deletedCount}`)
    }
    console.log('Admin demo data removed.')
    return
  }

  for (const [name, model, docs] of sets) await upsertAll(name, model, docs)
  console.log(`
Admin demo data ready. Password for every demo account: ${PASSWORD}
  demo.kiemduyet@chillngo.vn   Admin: content, reports, users, stats
  demo.kinhdoanh@chillngo.vn   Admin: businesses, news, revenue, stats
  demo.linh@chillngo.vn …      regular users (two of them locked)
Remove it again with: npm run seed:admin-demo -- --clean`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void mongoose.disconnect())
