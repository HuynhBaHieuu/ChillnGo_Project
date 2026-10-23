import type { Messages } from '../types'

/** Shared helpers in src/lib and src/services: labels, units and client-side errors. */
export const lib = {
  /* format.ts */
  '{days}N{nights}Đ': { en: '{days}D{nights}N', zh: '{days}天{nights}晚', ja: '{nights}泊{days}日', ko: '{nights}박 {days}일' },
  'Tiết kiệm': { en: 'Budget', zh: '经济', ja: 'お手頃', ko: '알뜰' },
  'Vừa phải': { en: 'Moderate', zh: '适中', ja: 'ほどほど', ko: '보통' },
  'Cao cấp': { en: 'Luxury', zh: '高端', ja: '高級', ko: '고급' },
  'Miền Bắc': { en: 'North', zh: '北部', ja: '北部', ko: '북부' },
  'Miền Trung': { en: 'Central', zh: '中部', ja: '中部', ko: '중부' },
  'Miền Nam': { en: 'South', zh: '南部', ja: '南部', ko: '남부' },
  'Hải đảo': { en: 'Islands', zh: '海岛', ja: '島しょ', ko: '섬' },
  'Nước ngoài': { en: 'Abroad', zh: '海外', ja: '海外', ko: '해외' },
  'Mùa xuân': { en: 'Spring', zh: '春季', ja: '春', ko: '봄' },
  'Mùa hè': { en: 'Summer', zh: '夏季', ja: '夏', ko: '여름' },
  'Mùa thu': { en: 'Autumn', zh: '秋季', ja: '秋', ko: '가을' },
  'Mùa đông': { en: 'Winter', zh: '冬季', ja: '冬', ko: '겨울' },

  /* feelings.ts */
  'Vui vẻ': { en: 'Happy', zh: '开心', ja: '楽しい', ko: '즐거움' },
  'Thư giãn': { en: 'Relaxed', zh: '放松', ja: 'リラックス', ko: '편안함' },
  'Hào hứng': { en: 'Excited', zh: '兴奋', ja: 'ワクワク', ko: '신남' },
  'Mệt nhưng vui': { en: 'Tired but happy', zh: '累但开心', ja: '疲れたけど楽しい', ko: '피곤하지만 즐거움' },
  'Bình yên': { en: 'Peaceful', zh: '平静', ja: '穏やか', ko: '평온함' },
  'Biết ơn': { en: 'Grateful', zh: '感恩', ja: '感謝', ko: '감사함' },
  'Choáng ngợp': { en: 'Amazed', zh: '震撼', ja: '感動', ko: '벅참' },
  'Hoài niệm': { en: 'Nostalgic', zh: '怀旧', ja: '懐かしい', ko: '그리움' },
  'Muốn phiêu lưu': { en: 'Adventurous', zh: '想冒险', ja: '冒険したい', ko: '모험하고 싶음' },
  'Lãng mạn': { en: 'Romantic', zh: '浪漫', ja: 'ロマンチック', ko: '로맨틱함' },
  'Ăn uống': { en: 'Eating out', zh: '吃吃喝喝', ja: '食事', ko: '식사 중' },
  'Uống cà phê': { en: 'Having coffee', zh: '喝咖啡', ja: 'コーヒータイム', ko: '커피 마시는 중' },
  'Ngắm hoàng hôn': { en: 'Watching the sunset', zh: '看日落', ja: '夕日を眺め中', ko: '노을 감상 중' },
  'Tắm biển': { en: 'Swimming in the sea', zh: '海边游泳', ja: '海水浴', ko: '해수욕 중' },
  'Leo núi': { en: 'Trekking', zh: '爬山', ja: '登山', ko: '등산 중' },
  'Cắm trại': { en: 'Camping', zh: '露营', ja: 'キャンプ', ko: '캠핑 중' },
  'Đi phượt': { en: 'On a road trip', zh: '自驾游', ja: 'ツーリング', ko: '로드 트립 중' },
  'Chụp ảnh': { en: 'Taking photos', zh: '拍照', ja: '写真撮影', ko: '사진 찍는 중' },
  'Mua sắm': { en: 'Shopping', zh: '购物', ja: 'ショッピング', ko: '쇼핑 중' },
  'đang cảm thấy': { en: 'is feeling', zh: '感觉', ja: 'の気分：', ko: '지금 기분:' },
  'đang': { en: 'is', zh: '正在', ja: 'は今', ko: '지금' },

  /* geo.ts, mapsLink.ts */
  'Không tìm được địa điểm lúc này. Vui lòng thử lại.': {
    en: "Couldn't search for places right now. Please try again.",
    zh: '暂时无法搜索地点，请重试。',
    ja: '現在場所を検索できません。もう一度お試しください。',
    ko: '지금은 장소를 찾을 수 없습니다. 다시 시도해 주세요.',
  },
  'Trình duyệt này không hỗ trợ lấy vị trí. Hãy tìm địa điểm bằng tên.': {
    en: "This browser can't share your location. Search for the place by name.",
    zh: '此浏览器不支持获取位置，请按名称搜索地点。',
    ja: 'このブラウザは位置情報に対応していません。名前で場所を検索してください。',
    ko: '이 브라우저는 위치 정보를 지원하지 않습니다. 이름으로 장소를 검색해 주세요.',
  },
  'Bạn chưa cho phép ChillnGo dùng vị trí. Hãy bật quyền vị trí cho trang này trong trình duyệt, hoặc tìm địa điểm bằng tên.': {
    en: "You haven't let ChillnGo use your location. Allow location for this site in your browser, or search for the place by name.",
    zh: '你尚未允许 ChillnGo 使用位置。请在浏览器中为本站开启位置权限，或按名称搜索地点。',
    ja: 'ChillnGoに位置情報の使用が許可されていません。ブラウザでこのサイトの位置情報を許可するか、名前で場所を検索してください。',
    ko: 'ChillnGo의 위치 사용을 허용하지 않았습니다. 브라우저에서 이 사이트의 위치 권한을 켜거나, 이름으로 장소를 검색해 주세요.',
  },
  'Không xác định được vị trí của thiết bị. Hãy tìm địa điểm bằng tên.': {
    en: "Couldn't determine your device's location. Search for the place by name.",
    zh: '无法确定设备位置，请按名称搜索地点。',
    ja: '端末の位置を特定できません。名前で場所を検索してください。',
    ko: '기기 위치를 확인할 수 없습니다. 이름으로 장소를 검색해 주세요.',
  },
  'Lấy vị trí quá lâu. Vui lòng thử lại.': {
    en: 'Getting your location took too long. Please try again.',
    zh: '获取位置超时，请重试。',
    ja: '位置情報の取得に時間がかかりすぎました。もう一度お試しください。',
    ko: '위치를 가져오는 데 너무 오래 걸렸습니다. 다시 시도해 주세요.',
  },
  'Không lấy được vị trí.': { en: "Couldn't get your location.", zh: '无法获取位置。', ja: '位置情報を取得できません。', ko: '위치를 가져올 수 없습니다.' },
  'Không tìm thấy địa chỉ này. Hãy thử dán link Google Maps hoặc chọn trên bản đồ.': {
    en: "Couldn't find this address. Try pasting a Google Maps link or picking it on the map.",
    zh: '找不到该地址。请尝试粘贴 Google 地图链接或在地图上选择。',
    ja: 'この住所が見つかりません。Googleマップのリンクを貼るか、地図上で選んでください。',
    ko: '이 주소를 찾을 수 없습니다. Google 지도 링크를 붙여 넣거나 지도에서 선택해 주세요.',
  },
  'Không nhận ra link hay toạ độ này.': {
    en: "Didn't recognise this link or these coordinates.",
    zh: '无法识别该链接或坐标。',
    ja: 'このリンクまたは座標を認識できません。',
    ko: '이 링크나 좌표를 인식할 수 없습니다.',
  },
  'Link Google Maps này không có vị trí. Hãy mở địa điểm trên Google Maps rồi bấm Chia sẻ → Sao chép đường liên kết.': {
    en: 'This Google Maps link has no location. Open the place in Google Maps, then tap Share → Copy link.',
    zh: '该 Google 地图链接不含位置。请在 Google 地图中打开地点，然后点“分享”→“复制链接”。',
    ja: 'このGoogleマップのリンクには位置情報がありません。Googleマップで場所を開き、「共有」→「リンクをコピー」を押してください。',
    ko: '이 Google 지도 링크에는 위치가 없습니다. Google 지도에서 장소를 연 뒤 공유 → 링크 복사를 눌러 주세요.',
  },

  /* travel.ts */
  'Ô tô, xe máy': { en: 'Car, motorbike', zh: '汽车、摩托车', ja: '車・バイク', ko: '자동차, 오토바이' },
  'Đi bộ': { en: 'Walking', zh: '步行', ja: '徒歩', ko: '도보' },
  'Xe buýt, xe khách': { en: 'Bus, coach', zh: '公交、长途客车', ja: 'バス・長距離バス', ko: '버스, 고속버스' },
  'Máy bay': { en: 'Plane', zh: '飞机', ja: '飛行機', ko: '비행기' },
  'Tàu, phà, ca nô': { en: 'Boat, ferry, speedboat', zh: '船、渡轮、快艇', ja: '船・フェリー・ボート', ko: '배, 페리, 보트' },
  '{n} phút': { en: ['{n} min', '{n} min'], zh: '{n} 分钟', ja: '{n}分', ko: '{n}분' },
  '{h} giờ {n} phút': { en: '{h} h {n} min', zh: '{h} 小时 {n} 分钟', ja: '{h}時間{n}分', ko: '{h}시간 {n}분' },
  '{n} giờ': { en: '{n} h', zh: '{n} 小时', ja: '{n}時間', ko: '{n}시간' },

  /* roles.ts */
  'Người dùng': { en: 'Users', zh: '用户', ja: 'ユーザー', ko: '사용자' },
  'Người dùng#role': { en: 'User', zh: '用户', ja: 'ユーザー', ko: '사용자' },
  Admin: { en: 'Admin', zh: '管理员', ja: '管理者', ko: '관리자' },
  'Super Admin': { en: 'Super Admin', zh: '超级管理员', ja: 'スーパー管理者', ko: '슈퍼 관리자' },
  'Khoá, mở khoá và đặt lại mật khẩu cho người dùng thường': {
    en: 'Lock, unlock and reset passwords for regular users',
    zh: '锁定、解锁普通用户并重置其密码',
    ja: '一般ユーザーのロック・解除・パスワードリセット',
    ko: '일반 사용자 잠금, 해제 및 비밀번호 재설정',
  },
  'Kiểm duyệt nội dung': { en: 'Content moderation', zh: '内容审核', ja: 'コンテンツ審査', ko: '콘텐츠 검토' },
  'Duyệt, ẩn, xoá bài đăng, lịch trình và bình luận': {
    en: 'Review, hide and delete posts, itineraries and comments',
    zh: '审核、隐藏、删除帖子、行程和评论',
    ja: '投稿・旅程・コメントの審査、非表示、削除',
    ko: '게시물, 일정, 댓글 검토·숨김·삭제',
  },
  'Báo cáo vi phạm': { en: 'Reports', zh: '违规举报', ja: '違反報告', ko: '신고' },
  'Xử lý báo cáo spam và nội dung không phù hợp': {
    en: 'Handle reports of spam and inappropriate content',
    zh: '处理垃圾信息和不当内容举报',
    ja: 'スパムや不適切なコンテンツの報告に対応',
    ko: '스팸 및 부적절한 콘텐츠 신고 처리',
  },
  'Danh mục': { en: 'Categories', zh: '分类', ja: 'カテゴリー', ko: '카테고리' },
  'Quản lý địa điểm và tag': { en: 'Manage places and tags', zh: '管理地点和标签', ja: '場所とタグの管理', ko: '장소와 태그 관리' },
  'Thống kê': { en: 'Statistics', zh: '统计', ja: '統計', ko: '통계' },
  'Xem số liệu người dùng trong phạm vi được cấp': {
    en: 'View user figures within the granted scope',
    zh: '在授权范围内查看用户数据',
    ja: '許可された範囲でユーザーの数値を表示',
    ko: '허용된 범위 내에서 사용자 통계 보기',
  },

  /* password.ts */
  'Ít nhất 6 ký tự': { en: 'At least 6 characters', zh: '至少 6 个字符', ja: '6文字以上', ko: '6자 이상' },
  'Ít nhất 1 chữ viết hoa (A–Z)': { en: 'At least 1 uppercase letter (A–Z)', zh: '至少 1 个大写字母（A–Z）', ja: '大文字を1文字以上（A–Z）', ko: '대문자 1개 이상 (A–Z)' },
  'Ít nhất 1 ký tự đặc biệt (! @ # $ % …)': {
    en: 'At least 1 special character (! @ # $ % …)',
    zh: '至少 1 个特殊字符（! @ # $ % …）',
    ja: '記号を1文字以上（! @ # $ % …）',
    ko: '특수문자 1개 이상 (! @ # $ % …)',
  },

  /* images.ts, cloudinaryUpload.ts */
  'Định dạng ảnh không được hỗ trợ. Vui lòng chọn ảnh {formats}.': {
    en: 'Unsupported image format. Please choose a {formats} image.',
    zh: '不支持该图片格式。请选择 {formats} 格式的图片。',
    ja: 'この画像形式には対応していません。{formats} の画像を選んでください。',
    ko: '지원하지 않는 이미지 형식입니다. {formats} 이미지를 선택해 주세요.',
  },
  'Ảnh quá lớn. Vui lòng chọn ảnh dưới 15 MB.': {
    en: 'The photo is too large. Please choose one under 15 MB.',
    zh: '图片过大，请选择小于 15 MB 的图片。',
    ja: '画像が大きすぎます。15 MB未満の画像を選んでください。',
    ko: '사진이 너무 큽니다. 15MB 미만의 사진을 선택해 주세요.',
  },
  'Không đọc được ảnh này. Vui lòng chọn ảnh khác.': {
    en: "Couldn't read this photo. Please choose another.",
    zh: '无法读取该图片，请选择其他图片。',
    ja: 'この画像を読み込めません。別の画像を選んでください。',
    ko: '이 사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.',
  },
  'Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác.': {
    en: 'The photo is still too large after compression. Please choose another.',
    zh: '压缩后图片仍然过大，请选择其他图片。',
    ja: '圧縮後も画像が大きすぎます。別の画像を選んでください。',
    ko: '압축 후에도 사진이 너무 큽니다. 다른 사진을 선택해 주세요.',
  },
  'Không tải được ảnh lên: {detail}.': { en: "Couldn't upload the photo: {detail}.", zh: '图片上传失败：{detail}。', ja: '画像をアップロードできません：{detail}。', ko: '사진을 올리지 못했습니다: {detail}.' },
  'Không tải được ảnh lên.': { en: "Couldn't upload the photo.", zh: '图片上传失败。', ja: '画像をアップロードできません。', ko: '사진을 올리지 못했습니다.' },
  'Không kết nối được tới máy chủ ảnh. Vui lòng thử lại.': {
    en: "Couldn't reach the image server. Please try again.",
    zh: '无法连接图片服务器，请重试。',
    ja: '画像サーバーに接続できません。もう一度お試しください。',
    ko: '이미지 서버에 연결할 수 없습니다. 다시 시도해 주세요.',
  },

  /* services/http.ts */
  'Không kết nối được máy chủ. Vui lòng thử lại sau.': {
    en: "Couldn't reach the server. Please try again later.",
    zh: '无法连接服务器，请稍后重试。',
    ja: 'サーバーに接続できません。しばらくしてからお試しください。',
    ko: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  },
  'Máy chủ trả về lỗi {status}': { en: 'The server returned error {status}', zh: '服务器返回错误 {status}', ja: 'サーバーがエラー {status} を返しました', ko: '서버가 오류 {status}을(를) 반환했습니다' },
} satisfies Messages
