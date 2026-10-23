import type { Messages } from '../types'

/** Home page and 404. */
export const landing = {
  'Những chuyến đi có thật, kể lại bởi chính người đã đi': {
    en: 'Real trips, told by the people who took them',
    zh: '真实的旅程，由亲历者亲自讲述',
    ja: '実際に旅した人が語る、本物の旅',
    ko: '직접 다녀온 사람이 들려주는 진짜 여행',
  },
  'Việt Nam': { en: 'Vietnam', zh: '越南', ja: 'ベトナム', ko: '베트남' },
  'Phim ChillnGo': { en: 'ChillnGo film', zh: 'ChillnGo 短片', ja: 'ChillnGo ムービー', ko: 'ChillnGo 영상' },
  'Xem phim': { en: 'Watch the film', zh: '观看短片', ja: 'ムービーを見る', ko: '영상 보기' },

  'Cách ChillnGo hoạt động': { en: 'How ChillnGo works', zh: 'ChillnGo 如何运作', ja: 'ChillnGoの使い方', ko: 'ChillnGo 이용 방법' },
  Clone: { en: 'Clone', zh: '复制', ja: 'クローン', ko: '복제' },
  'Chia sẻ': { en: 'Share', zh: '分享', ja: 'シェア', ko: '공유' },
  'Khám phá hành trình thật': { en: 'Discover real journeys', zh: '探索真实行程', ja: '本物の旅程を探す', ko: '진짜 여정 탐색하기' },
  'Lọc theo vùng, mùa và ngân sách': {
    en: 'Filter by region, season and budget',
    zh: '按地区、季节和预算筛选',
    ja: '地域・季節・予算で絞り込み',
    ko: '지역, 계절, 예산으로 필터링',
  },
  ' để ra đúng kiểu chuyến bạn muốn.': {
    en: ' to find exactly the kind of trip you want.',
    zh: '，找到你想要的那种旅行。',
    ja: '、行きたい旅のスタイルが見つかります。',
    ko: '해서 원하는 스타일의 여행을 찾아보세요.',
  },
  'Xem từng ngày:': { en: 'See every day:', zh: '逐日查看：', ja: '日ごとに確認：', ko: '하루하루 보기:' },
  ' mỗi điểm dừng có ghi chú, ảnh và chi phí ước tính.': {
    en: ' each stop comes with notes, photos and an estimated cost.',
    zh: '每个站点都附有笔记、照片和预估花费。',
    ja: '各スポットにメモ・写真・予算の目安付き。',
    ko: ' 각 장소마다 메모, 사진, 예상 비용이 있어요.',
  },
  'Clone về và sửa theo ý bạn': {
    en: 'Clone it and make it yours',
    zh: '一键复制，随心修改',
    ja: 'クローンして自分好みに',
    ko: '복제해서 내 마음대로 수정',
  },
  'Clone một chạm': { en: 'One-tap clone', zh: '一键复制', ja: 'ワンタップでクローン', ko: '원탭 복제' },
  ' biến chuyến đi của người khác thành bản nháp của bạn.': {
    en: " turns someone else's trip into your own draft.",
    zh: '，把别人的旅程变成你的草稿。',
    ja: 'で、他の人の旅をあなたの下書きに。',
    ko: '로 다른 사람의 여행을 내 초안으로 만들어요.',
  },
  'Kéo thả để đổi thứ tự ngày,': { en: 'Drag and drop to reorder days,', zh: '拖放调整日程顺序，', ja: 'ドラッグで日程を並べ替え、', ko: '드래그해서 일정 순서를 바꾸면' },
  ' ngày tháng tự cập nhật theo.': {
    en: ' and the dates update themselves.',
    zh: '日期自动更新。',
    ja: '日付も自動で更新。',
    ko: ' 날짜가 자동으로 바뀌어요.',
  },
  'Ghép nhiều chuyến:': { en: 'Merge trips:', zh: '合并多个行程：', ja: '複数の旅を統合：', ko: '여러 여행 합치기:' },
  ' lấy những ngày hay nhất từ nhiều bài.': {
    en: ' take the best days from several posts.',
    zh: '从多篇帖子中挑选最精彩的日子。',
    ja: '複数の投稿からベストな日を集めて。',
    ko: ' 여러 게시물에서 최고의 날만 골라요.',
  },
  'Đi xong, chia sẻ lại': { en: 'Back home? Share it', zh: '旅行归来，分享出去', ja: '旅を終えたらシェア', ko: '다녀왔다면 공유하기' },
  'Đăng hành trình của bạn': { en: 'Post your journey', zh: '发布你的行程', ja: 'あなたの旅程を投稿', ko: '내 여정을 올려' },
  ' cho người đi sau tham khảo và clone tiếp.': {
    en: ' so the next traveller can learn from it and clone it.',
    zh: '，供后来者参考和复制。',
    ja: 'して、次の旅人の参考やクローンに。',
    ko: ' 다음 여행자가 참고하고 복제할 수 있게 해요.',
  },

  'Điểm dừng': { en: 'Stops', zh: '站点', ja: 'スポット', ko: '경유지' },
  'Toạ độ có thật': { en: 'Real coordinates', zh: '真实坐标', ja: '本物の座標', ko: '실제 좌표' },
  '{n} điểm dừng được ghim toạ độ bởi chính người đã đến, từ {from} tới {to}. Cuộn để đi một vòng.': {
    en: '{n} stops pinned by the people who went there, from {from} to {to}. Scroll to take the tour.',
    zh: '{n} 个站点由亲自到访的人标注坐标，从{from}到{to}。滚动页面，走一圈吧。',
    ja: '実際に訪れた人がピン留めした {n} か所のスポット、{from}から{to}まで。スクロールして一周しよう。',
    ko: '직접 다녀온 사람들이 좌표를 찍은 {n}곳, {from}부터 {to}까지. 스크롤해서 한 바퀴 둘러보세요.',
  },
  '{n} điểm dừng được ghim toạ độ bởi chính người đã đến. Cuộn để đi một vòng.': {
    en: '{n} stops pinned by the people who went there. Scroll to take the tour.',
    zh: '{n} 个站点由亲自到访的人标注坐标。滚动页面，走一圈吧。',
    ja: '実際に訪れた人がピン留めした {n} か所のスポット。スクロールして一周しよう。',
    ko: '직접 다녀온 사람들이 좌표를 찍은 {n}곳. 스크롤해서 한 바퀴 둘러보세요.',
  },
  'Một điểm dừng trong {trip}. Mở hành trình để xem giờ giấc, chi phí và ghi chú của người đã đi.': {
    en: 'A stop on {trip}. Open the journey for the times, costs and notes from the person who went.',
    zh: '{trip} 中的一个站点。打开行程，查看亲历者记录的时间、花费和笔记。',
    ja: '{trip} のスポットのひとつ。旅程を開くと、旅した人の時間・費用・メモが見られます。',
    ko: '{trip}의 한 경유지. 여정을 열어 다녀온 사람의 시간, 비용, 메모를 확인하세요.',
  },
  'Lên kế hoạch mất ba tuần. Clone một chuyến đi có thật chỉ mất một chạm.': {
    en: 'Planning takes three weeks. Cloning a real trip takes one tap.',
    zh: '做攻略要三周，复制一段真实旅程只需一键。',
    ja: '計画には3週間。本物の旅をクローンするならワンタップ。',
    ko: '계획은 3주가 걸리지만, 진짜 여행 복제는 한 번의 탭이면 충분해요.',
  },
  'Cộng đồng ChillnGo': { en: 'The ChillnGo community', zh: 'ChillnGo 社区', ja: 'ChillnGo コミュニティ', ko: 'ChillnGo 커뮤니티' },
  'Bắc — Nam': { en: 'North — South', zh: '北 — 南', ja: '北 — 南', ko: '북 — 남' },

  'Mạng xã hội của những chuyến đi': {
    en: 'The social network for trips',
    zh: '属于旅行的社交网络',
    ja: '旅のためのSNS',
    ko: '여행을 위한 소셜 네트워크',
  },
  'ChillnGo là nơi những chuyến đi có thật được kể lại trọn vẹn — từng ngày, từng điểm dừng, từng khoản chi. Thấy một hành trình hợp ý? Clone về làm của bạn chỉ với một chạm, rồi sửa theo cách bạn muốn đi.': {
    en: 'ChillnGo is where real trips are told in full — every day, every stop, every expense. Found a journey you like? Clone it as your own with one tap, then tweak it the way you want to travel.',
    zh: 'ChillnGo 完整记录每一段真实旅程——每一天、每个站点、每一笔花费。看到心仪的行程？一键复制成你自己的，再按你的方式修改。',
    ja: 'ChillnGoは、本物の旅をまるごと伝える場所。1日ごと、スポットごと、出費ごとに。気に入った旅程があれば、ワンタップで自分のものにクローンして、好きなようにアレンジしよう。',
    ko: 'ChillnGo는 진짜 여행을 하루하루, 경유지마다, 지출 하나까지 온전히 기록하는 곳이에요. 마음에 드는 여정이 있나요? 한 번의 탭으로 복제해 내 여정으로 만들고, 원하는 대로 수정하세요.',
  },
  'Con số thật': { en: 'Real numbers', zh: '真实数据', ja: 'リアルな数字', ko: '진짜 숫자' },
  'Không có lịch trình dựng sẵn, chỉ có người đã đi và kể lại. Đến nay cộng đồng đã chia sẻ {trips} hành trình với {stops} điểm dừng có toạ độ, được clone {clones} lần và lưu lại {bookmarks} lần.': {
    en: 'No ready-made itineraries, only people who went and told the story. So far the community has shared {trips} journeys with {stops} mapped stops, cloned {clones} times and saved {bookmarks} times.',
    zh: '没有现成的模板行程，只有亲历者的分享。迄今社区已分享 {trips} 段行程、{stops} 个带坐标的站点，被复制 {clones} 次，收藏 {bookmarks} 次。',
    ja: '既製の旅程はなく、実際に旅した人の記録だけ。これまでにコミュニティは {trips} 件の旅程と座標付きの {stops} か所のスポットを共有し、{clones} 回クローン、{bookmarks} 回保存されました。',
    ko: '미리 만들어진 일정은 없고, 직접 다녀온 사람들의 이야기만 있어요. 지금까지 커뮤니티는 {trips}개의 여정과 좌표가 있는 {stops}곳의 경유지를 공유했고, {clones}번 복제되고 {bookmarks}번 저장되었어요.',
  },

  'Hành trình': { en: 'Journeys', zh: '行程', ja: '旅程', ko: '여정' },
  'Lịch trình hay nhất không nằm trong cẩm nang, mà nằm trong chuyến đi của ai đó vừa trở về. Chúng tôi làm ChillnGo để những chuyến đi ấy được kể lại đủ chi tiết, và người đi sau chỉ cần một chạm để bắt đầu.': {
    en: "The best itinerary isn't in a guidebook — it's in the trip someone just came back from. We built ChillnGo so those trips get told in enough detail that the next traveller needs just one tap to begin.",
    zh: '最好的行程不在旅游指南里，而在刚旅行归来的人的经历中。我们打造 ChillnGo，让这些旅程被足够详细地讲述，后来者只需一键即可出发。',
    ja: '最高の旅程はガイドブックではなく、旅から帰ってきたばかりの誰かの中にある。そんな旅を十分詳しく伝え、次の旅人がワンタップで始められるように、私たちはChillnGoを作りました。',
    ko: '최고의 일정은 가이드북이 아니라 방금 여행에서 돌아온 누군가의 여정 속에 있어요. 그런 여행이 충분히 자세하게 기록되고, 다음 여행자는 한 번의 탭으로 시작할 수 있도록 ChillnGo를 만들었습니다.',
  },
  'Đội ngũ ChillnGo': { en: 'The ChillnGo team', zh: 'ChillnGo 团队', ja: 'ChillnGo チーム', ko: 'ChillnGo 팀' },
  'Những người làm ra ChillnGo': { en: 'The people behind ChillnGo', zh: 'ChillnGo 的创造者', ja: 'ChillnGoをつくる人たち', ko: 'ChillnGo를 만드는 사람들' },

  'Chuyến tiếp theo bắt đầu từ đây': {
    en: 'Your next trip starts here',
    zh: '下一段旅程从这里开始',
    ja: '次の旅はここから',
    ko: '다음 여행은 여기서 시작돼요',
  },
  'Đăng hành trình': { en: 'Post a journey', zh: '发布行程', ja: '旅程を投稿', ko: '여정 올리기' },
  'Liên kết cuối trang': { en: 'Footer links', zh: '页脚链接', ja: 'フッターリンク', ko: '하단 링크' },
  'Về đầu trang': { en: 'Back to top', zh: '回到顶部', ja: 'ページトップへ', ko: '맨 위로' },
  'Được lưu nhiều nhất': { en: 'Most saved', zh: '收藏最多', ja: '保存数ランキング', ko: '가장 많이 저장된' },
  'Xem tất cả': { en: 'See all', zh: '查看全部', ja: 'すべて見る', ko: '모두 보기' },

  'Lạc đường rồi': { en: "You're lost", zh: '迷路了', ja: '道に迷いました', ko: '길을 잃었어요' },
  'Trang bạn tìm không tồn tại. Nhưng lạc đường đôi khi cũng là một phần của chuyến đi.': {
    en: "The page you're looking for doesn't exist. But getting lost is sometimes part of the trip.",
    zh: '你要找的页面不存在。不过，迷路有时也是旅行的一部分。',
    ja: 'お探しのページは存在しません。でも、道に迷うのも旅の一部かもしれません。',
    ko: '찾으시는 페이지가 없어요. 하지만 길을 잃는 것도 때로는 여행의 일부죠.',
  },
  'Về trang Khám phá': { en: 'Go to Discover', zh: '前往探索页', ja: '探すページへ', ko: '탐색 페이지로' },
} satisfies Messages
