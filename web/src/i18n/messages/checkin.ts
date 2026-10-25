import type { Messages } from '../types'

/** Check-ins and the route maps. */
export const checkin = {
  /* CheckInCard: "Minh đang cảm thấy 😌 thư giãn tại 📍 Hội An" */
  'tại': { en: 'at', zh: '在', ja: '@', ko: '·' },
  'đã check-in tại': { en: 'checked in at', zh: '打卡了', ja: 'がチェックイン：', ko: '님이 체크인:' },
  'đã chia sẻ ảnh': { en: 'shared photos', zh: '分享了照片', ja: 'が写真をシェアしました', ko: '님이 사진을 공유했어요' },
  'đã chia sẻ': { en: 'shared', zh: '分享了动态', ja: 'がシェアしました', ko: '님이 공유했어요' },
  'Xoá check-in': { en: 'Delete check-in', zh: '删除打卡', ja: 'チェックインを削除', ko: '체크인 삭제' },
  'Check-in sẽ được chuyển vào mục Đã xoá gần đây (Hoạt động của bạn) và có thể khôi phục trong 30 ngày.': {
    en: 'The check-in will move to Recently deleted (Your activity), where it can be restored within 30 days.',
    zh: '打卡将移至“最近删除”（你的动态），30 天内可恢复。',
    ja: 'チェックインは「最近削除した項目」（アクティビティ）に移動し、30日以内なら復元できます。',
    ko: '체크인은 최근 삭제됨(내 활동)으로 이동하며, 30일 이내에 복원할 수 있어요.',
  },

  /* CheckInDialog */
  'Mỗi check-in tối đa {n} ảnh.': { en: ['Each check-in can have up to {n} photo.', 'Each check-in can have up to {n} photos.'], zh: '每次打卡最多 {n} 张照片。', ja: '1回のチェックインにつき写真は最大{n}枚です。', ko: '체크인마다 사진은 최대 {n}장이에요.' },
  'Chia sẻ nơi bạn đang đến và cảm xúc lúc này, {name}.': {
    en: "Share where you are and how you feel right now, {name}.",
    zh: '{name}，分享你现在所在的地方和此刻的心情吧。',
    ja: '{name}さん、今いる場所と今の気分をシェアしよう。',
    ko: '{name}님, 지금 있는 곳과 기분을 공유해 보세요.',
  },
  'Bỏ ảnh {n}': { en: 'Remove photo {n}', zh: '移除照片 {n}', ja: '写真 {n} を外す', ko: '사진 {n} 제거' },
  '{formats}, tối đa 15 MB mỗi ảnh. Ảnh được tự nén trước khi tải lên.': {
    en: '{formats}, up to 15 MB each. Photos are compressed automatically before upload.',
    zh: '{formats}，每张最大 15 MB。图片上传前会自动压缩。',
    ja: '{formats}、1枚あたり最大15 MB。画像はアップロード前に自動で圧縮されます。',
    ko: '{formats}, 장당 최대 15MB. 사진은 올리기 전에 자동 압축돼요.',
  },
  'Chọn ảnh check-in': { en: 'Choose check-in photos', zh: '选择打卡照片', ja: 'チェックインの写真を選ぶ', ko: '체크인 사진 선택' },
  'Bạn thấy nơi này thế nào?': { en: 'How do you find this place?', zh: '你觉得这里怎么样？', ja: 'この場所はどう？', ko: '이곳은 어떤가요?' },
  'Đăng check-in': { en: 'Post check-in', zh: '发布打卡', ja: 'チェックインを投稿', ko: '체크인 올리기' },
  'Thêm ảnh, cảm xúc hoặc vài dòng chia sẻ để đăng.': {
    en: 'Add a photo, a feeling or a few words to post.',
    zh: '添加照片、心情或几句话即可发布。',
    ja: '写真、気分、またはひとことを追加すると投稿できます。',
    ko: '사진, 기분 또는 몇 줄의 글을 추가하면 올릴 수 있어요.',
  },
  'Cảm xúc': { en: 'Feeling', zh: '心情', ja: '気分', ko: '기분' },
  'Hoạt động#activity': { en: 'Activity', zh: '活动', ja: 'アクティビティ', ko: '활동' },
  'Cảm xúc / Hoạt động': { en: 'Feeling / Activity', zh: '心情 / 活动', ja: '気分 / アクティビティ', ko: '기분 / 활동' },
  'Bỏ chọn': { en: 'Clear', zh: '取消选择', ja: '選択を解除', ko: '선택 해제' },
  'Loại': { en: 'Type', zh: '类型', ja: '種類', ko: '유형' },
  'Vị trí hiện tại': { en: 'Current location', zh: '当前位置', ja: '現在地', ko: '현재 위치' },
  'Địa điểm#place': { en: 'Place', zh: '地点', ja: '場所', ko: '장소' },
  'Đổi': { en: 'Change', zh: '更换', ja: '変更', ko: '변경' },
  'Dùng vị trí hiện tại': { en: 'Use current location', zh: '使用当前位置', ja: '現在地を使う', ko: '현재 위치 사용' },
  'Hoặc tìm theo tên địa điểm': { en: 'Or search by place name', zh: '或按地点名称搜索', ja: 'または場所の名前で検索', ko: '또는 장소 이름으로 검색' },
  'Không tìm thấy địa điểm phù hợp.': { en: 'No matching places found.', zh: '没有找到合适的地点。', ja: '該当する場所が見つかりません。', ko: '맞는 장소를 찾지 못했어요.' },
  'Không bắt buộc. Check-in vẫn đăng được khi không có địa điểm.': {
    en: 'Optional. You can post a check-in without a place.',
    zh: '可选。没有地点也可以发布打卡。',
    ja: '任意です。場所がなくてもチェックインを投稿できます。',
    ko: '선택 사항이에요. 장소 없이도 체크인을 올릴 수 있어요.',
  },

  /* Maps */
  'Điểm dừng#one': { en: 'Stop', zh: '站点', ja: 'スポット', ko: '경유지' },
  'Ngày {day}, điểm {order}: {name}. Xem đường đi ngày {day}': {
    en: 'Day {day}, stop {order}: {name}. Show the route for day {day}',
    zh: '第 {day} 天，站点 {order}：{name}。查看第 {day} 天的路线',
    ja: '{day}日目、スポット {order}：{name}。{day}日目のルートを表示',
    ko: '{day}일차, 경유지 {order}: {name}. {day}일차 경로 보기',
  },
  'Chọn ngày để xem đường đi': { en: 'Pick a day to see the route', zh: '选择一天查看路线', ja: '日を選んでルートを表示', ko: '날짜를 선택해 경로 보기' },
  'Chọn một ngày hoặc một điểm để xem đường đi': {
    en: 'Pick a day or a stop to see the route',
    zh: '选择一天或一个站点查看路线',
    ja: '日またはスポットを選んでルートを表示',
    ko: '날짜나 경유지를 선택해 경로를 보세요',
  },
  '{mode}: xem thời gian': { en: '{mode}: show travel time', zh: '{mode}：查看用时', ja: '{mode}：所要時間を見る', ko: '{mode}: 소요 시간 보기' },
  'khoảng {time} (ước tính)': { en: 'about {time} (estimated)', zh: '约 {time}（估算）', ja: '約{time}（目安）', ko: '약 {time} (추정)' },
  'Chưa có dữ liệu thời gian': { en: 'No travel time yet', zh: '暂无用时数据', ja: '所要時間のデータなし', ko: '소요 시간 데이터 없음' },
  'Bản đồ hành trình': { en: 'Journey map', zh: '行程地图', ja: '旅程マップ', ko: '여정 지도' },
  'Chưa có dữ liệu bản đồ': { en: 'No map data yet', zh: '暂无地图数据', ja: '地図データがありません', ko: '지도 데이터가 없어요' },
  'Đang tải bản đồ…': { en: 'Loading map…', zh: '正在加载地图…', ja: '地図を読み込み中…', ko: '지도를 불러오는 중…' },
  'Bản đồ tương tác cần {token}. Đây là bản phác thảo tuyến đường từ dữ liệu mock.': {
    en: 'The interactive map needs {token}. This is a sketch of the route from mock data.',
    zh: '交互式地图需要 {token}。这是根据模拟数据绘制的路线草图。',
    ja: 'インタラクティブマップには {token} が必要です。これはモックデータから描いたルートの概略です。',
    ko: '인터랙티브 지도에는 {token}이(가) 필요해요. 이것은 목업 데이터로 그린 경로 스케치예요.',
  },
} satisfies Messages
