/**
 * The Markdown versions of the app's public pages, served by middleware.ts to
 * clients that send `Accept: text/markdown` (AI agents, mostly). The home page
 * text matches the plain-HTML summary in index.html and the landing page copy.
 *
 * Links are absolute, built from the request's origin, so preview deployments
 * point at themselves.
 */

type Page = (origin: string) => string

const links = (origin: string) => `## Liên kết

- [Khám phá hành trình](${origin}/discover): lọc theo vùng, mùa và ngân sách.
- [Bảng tin](${origin}/feed): hành trình và check-in mới nhất.
- [Đang phát trực tiếp](${origin}/live): livestream từ những người đang trên đường.
- [Đăng ký](${origin}/register) · [Đăng nhập](${origin}/login)

## Dành cho agent và nhà phát triển

- [llms.txt](${origin}/llms.txt): tóm tắt trang web cho mô hình ngôn ngữ.
- [OpenAPI](${origin}/openapi.json): mô tả đầy đủ API JSON tại \`${origin}/api\`.
`

const PAGES: Record<string, Page> = {
  '/': (origin) => `# ChillnGo — Mạng xã hội của những chuyến đi

> Những chuyến đi có thật, kể lại bởi chính người đã đi.

ChillnGo là nơi những chuyến đi có thật được kể lại trọn vẹn — từng ngày, từng điểm dừng, từng khoản chi. Thấy một hành trình hợp ý? Sao chép về làm của bạn chỉ với một chạm, rồi sửa theo cách bạn muốn đi.

Lịch trình hay nhất không nằm trong cẩm nang, mà nằm trong chuyến đi của ai đó vừa trở về. Lên kế hoạch mất ba tuần. Sao chép một chuyến đi có thật chỉ mất một chạm.

## Cách ChillnGo hoạt động

### 1. Khám phá hành trình thật

- Lọc theo vùng, mùa và ngân sách để ra đúng kiểu chuyến bạn muốn.
- Xem từng ngày: mỗi điểm dừng có ghi chú, ảnh và chi phí ước tính.

### 2. Sao chép về và sửa theo ý bạn

- Sao chép một chạm biến chuyến đi của người khác thành bản nháp của bạn.
- Kéo thả để đổi thứ tự ngày, ngày tháng tự cập nhật theo.
- Ghép nhiều chuyến: lấy những ngày hay nhất từ nhiều bài.

### 3. Đi xong, chia sẻ lại

- Đăng hành trình của bạn cho người đi sau tham khảo và sao chép tiếp.

${links(origin)}`,

  '/discover': (origin) => `# Khám phá hành trình — ChillnGo

Những hành trình nhiều ngày do chính người đã đi đăng lại: từng ngày, từng điểm dừng có toạ độ, ghi chú, ảnh và chi phí. Lọc theo vùng, mùa và ngân sách để ra đúng kiểu chuyến bạn muốn, rồi sao chép về làm lịch trình của bạn.

Danh sách được tải bằng JavaScript. Để đọc dữ liệu trực tiếp, dùng API: \`GET ${origin}/api/posts\` (xem [OpenAPI](${origin}/openapi.json)).

${links(origin)}`,

  '/feed': (origin) => `# Bảng tin — ChillnGo

Hành trình và check-in mới nhất từ cộng đồng ChillnGo, và từ những người bạn theo dõi khi đã đăng nhập.

Bảng tin được tải bằng JavaScript. Để đọc dữ liệu trực tiếp, dùng API: \`GET ${origin}/api/posts\` và \`GET ${origin}/api/checkins\` (xem [OpenAPI](${origin}/openapi.json)).

${links(origin)}`,

  '/live': (origin) => `# Đang phát trực tiếp — ChillnGo

Livestream từ những người đang trên đường, và các buổi phát đã ghi lại để xem lại.

Danh sách được tải bằng JavaScript. Để đọc dữ liệu trực tiếp, dùng API: \`GET ${origin}/api/livestreams\` (xem [OpenAPI](${origin}/openapi.json)).

${links(origin)}`,
}

/** The Markdown version of the page at `pathname`, or null when it has none. */
export function pageMarkdown(pathname: string, origin: string): string | null {
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PAGES[key]?.(origin) ?? null
}

/** The body of a 404, for agents: what happened and where to look instead. */
export function notFoundMarkdown(pathname: string, origin: string): string {
  return `# 404 — Page not found

There is no page at \`${pathname}\` on ChillnGo. Check the address, or start from one of these:

- [Home page](${origin}/): what ChillnGo is.
- [llms.txt](${origin}/llms.txt): a map of the site for language models.
- [OpenAPI description](${origin}/openapi.json): the JSON API at \`${origin}/api\`.

Không tìm thấy trang \`${pathname}\` trên ChillnGo.
`
}
