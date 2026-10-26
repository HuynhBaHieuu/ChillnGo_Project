import { landingPhoto } from '@/lib/photos'

/**
 * Video của trang chủ — sửa file này để đổi hoặc thêm video, không cần đụng
 * vào code giao diện.
 *
 * `src` nhận một trong hai:
 *   - link .mp4 trên mạng (Mixkit, Pexels… mở video, copy link file .mp4)
 *   - file của bạn: chép vào `web/public/videos/` rồi ghi '/videos/ten-file.mp4'
 * Nên dùng mp4 720p hoặc 1080p, vài chục MB trở xuống cho trang tải nhanh.
 *
 * Footage mặc định: Mixkit (free licence, không cần ghi công).
 */

/** Video nền ở phần đầu trang (tắt tiếng). Nhiều video → phát lần lượt, hết thì quay lại video đầu. */
export const HERO_VIDEOS: { src: string; poster?: string }[] = [
  // Người lái xe máy trên đường núi vắng.
  { src: 'https://assets.mixkit.co/videos/39912/39912-720.mp4', poster: landingPhoto('mountainRoad', 1920, 1080) },
  // Thêm video: { src: '/videos/ha-giang.mp4' },
]

/**
 * Lấy một video Mixkit theo số id: số ở cuối link trang video, ví dụ
 * mixkit.co/free-stock-video/scenic-view-of-ha-long-bay-in-vietnam-44915/ → 44915.
 * Video Việt Nam: mixkit.co/free-stock-video/vietnam/
 */
const mixkit = (id: number) => ({
  src: `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`,
  preview: `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`,
})

/**
 * Phim mở ra khi bấm "Xem phim". Nhiều phim → trong hộp phim có nút để chọn phim.
 * `preview` là ảnh hiện lên khi rê chuột vào nút (lấy của phim đầu tiên).
 */
export const FILMS: { title: string; src: string; preview: string }[] = [
  { title: 'Vịnh Hạ Long', ...mixkit(44915) },
  { title: 'Hồ Gươm về đêm', ...mixkit(27694) },
  { title: 'Xuôi dòng', ...mixkit(27664) },
  { title: 'Hoàng hôn trên vịnh', ...mixkit(20198) },
  // Thêm phim Mixkit: { title: 'Tên phim', ...mixkit(12345) },
  // Thêm file của bạn: { title: 'Hà Giang', src: '/videos/ha-giang.mp4', preview: '/videos/ha-giang.jpg' },
]
