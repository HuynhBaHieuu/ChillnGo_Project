/**
 * How to use the ChillnGo website, for the AI assistant (routes/assistant.ts)
 * to look up with its `site_guide` tool instead of guessing.
 *
 * Written from the web app as it is: page names, button labels and limits are
 * the ones on screen (web/src). Change a flow or a label there, change it here.
 * `not_available` lists what the site does not do, so the assistant can say so.
 */

export const GUIDE_TOPICS = [
  'overview',
  'account',
  'create_journey',
  'drafts',
  'edit_delete_journey',
  'discover',
  'clone_itinerary',
  'interact',
  'checkin',
  'livestream',
  'profile',
  'activity',
  'assistant',
  'not_available',
] as const

export type GuideTopic = (typeof GUIDE_TOPICS)[number]

/** One line per topic, shown to the model so it can pick the right one. */
export const GUIDE_INDEX: Record<GuideTopic, string> = {
  overview: 'ChillnGo là gì, các trang chính và thanh điều hướng',
  account: 'đăng ký, xác nhận email, đăng nhập (email hoặc Google), quy tắc mật khẩu, đăng xuất',
  create_journey: 'đăng một hành trình (bài viết) mới: ngày, điểm dừng, chi phí, bản đồ, đăng',
  drafts: 'lưu nháp, tìm lại bản nháp, viết tiếp, đăng, nhân bản',
  edit_delete_journey: 'sửa hoặc xoá hành trình, mục Đã xoá gần đây, khôi phục',
  discover: 'tìm kiếm và lọc hành trình ở trang Khám phá, khám phá theo sở thích',
  clone_itinerary: 'sao chép hành trình về làm lịch trình của mình, sao chép bằng AI (điều chỉnh theo ngày đi, số người, ngân sách; gộp nhiều hành trình; tối ưu tuyến; Plan B; checklist chuẩn bị), đổi thứ tự ngày, ghép ngày, trạng thái',
  interact: 'thích, bình luận, lưu bài, theo dõi người khác, Newsfeed, thông báo',
  checkin: 'đăng check-in: ảnh, cảm xúc, địa điểm',
  livestream: 'phát trực tiếp, xem trực tiếp, xem lại',
  profile: 'trang cá nhân và chỉnh sửa hồ sơ',
  activity: 'trang Hoạt động của bạn: tương tác, ảnh và video, bản nháp, lịch sử, đã xoá, đã lưu',
  assistant: 'trợ lý AI làm được gì và không làm được gì',
  not_available: 'những tính năng ChillnGo chưa có',
}

const GUIDE: Record<GuideTopic, string> = {
  overview: [
    'ChillnGo là mạng xã hội du lịch: mọi người kể lại chuyến đi thành hành trình theo từng ngày, từng điểm dừng kèm chi phí, và người khác có thể sao chép về làm lịch trình của mình.',
    'Thanh điều hướng trên cùng: Khám phá (tìm hành trình), Newsfeed (bài mới từ người bạn theo dõi), Đang live (phát trực tiếp), Hành trình của tôi (bài bạn đăng và lịch trình đã sao chép), Về ChillnGo (trang giới thiệu).',
    'Góc phải: chuông Thông báo và ảnh đại diện (mở menu Tài khoản: Đăng bài mới, Hoạt động của bạn, Chỉnh sửa hồ sơ, Đăng xuất).',
    'Trên điện thoại có thanh dưới cùng: Home (Newsfeed), Discover (Khám phá), nút + (đăng hành trình), Bookmarks (đã lưu), Profile (trang cá nhân).',
    'Nhiều trang xem được khi chưa đăng nhập (Khám phá, Newsfeed, bài viết, trang cá nhân); đăng bài, sao chép, check-in, livestream và trợ lý AI cần đăng nhập.',
  ].join('\n'),

  account: [
    'Đăng ký: bấm "Bắt đầu ngay" → nhập Tên hiển thị, Tên người dùng (3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới), email, Mật khẩu và Xác nhận mật khẩu → ChillnGo gửi email xác nhận → mở email và bấm "Xác nhận email". Chưa xác nhận thì chưa đăng nhập được; ở trang Đăng nhập có nút gửi lại email xác nhận.',
    'Mật khẩu: ít nhất 6 ký tự, có ít nhất 1 chữ viết hoa và 1 ký tự đặc biệt (ví dụ ! @ # $ %).',
    'Cũng có thể đăng ký/đăng nhập bằng Google (nút Google ở trang Đăng nhập và Đăng ký).',
    'Đăng nhập: bấm "Đăng nhập", nhập email và mật khẩu.',
    'Đăng xuất: bấm ảnh đại diện ở góc phải → "Đăng xuất".',
    'Trang web chưa có chức năng tự đổi mật khẩu hay "quên mật khẩu" trong giao diện người dùng.',
  ].join('\n'),

  create_journey: [
    'Mở trình soạn: bấm "Đăng bài mới" trên thanh điều hướng (hoặc trong menu ảnh đại diện), hoặc ô "Bạn vừa đi đâu?" ở Newsfeed, hoặc nút + trên điện thoại. Cần đăng nhập.',
    '1. Thông tin chung: nhập Tiêu đề (tối đa 150 ký tự), Tóm tắt (tối đa 1000 ký tự), thêm Ảnh bìa (tối đa 10 ảnh; ảnh đầu là ảnh bìa; không chọn thì dùng ảnh tự động).',
    '2. Lịch trình: bấm "Thêm ngày", trong mỗi ngày bấm "Thêm điểm dừng". Mỗi điểm dừng có Tên địa điểm (gõ rồi chọn gợi ý), Địa chỉ (gõ địa chỉ, dán link Google Maps/toạ độ, hoặc "Chọn trên bản đồ"), Chi phí (₫), Ghi chú và ảnh. Giữa hai điểm dừng chọn phương tiện: Ô tô/xe máy, Đi bộ, Xe buýt/xe khách, Máy bay, Tàu/phà/ca nô.',
    '3. Phân loại: chọn Khu vực (Miền Bắc, Miền Trung, Miền Nam, Hải đảo, Nước ngoài), Mùa, Mức chi tiêu (Tiết kiệm, Vừa phải, Cao cấp) và thêm Thẻ (gõ rồi nhấn Enter, tối đa 20 thẻ).',
    '4. "Tổng chi phí ước tính" tự cộng từ chi phí các điểm dừng. "Bản đồ tuyến" hiện đường đi giữa các điểm đã ghim.',
    '5. Bấm "Đăng hành trình" để đăng (cần có Tiêu đề và Tóm tắt), hoặc "Lưu nháp" để làm tiếp sau.',
    'Giới hạn: tối đa 60 ngày, mỗi ngày tối đa 30 điểm dừng.',
    'Sau khi đăng, hành trình hiện trên trang cá nhân của bạn, trong Newsfeed của người theo dõi và ở trang Khám phá.',
  ].join('\n'),

  drafts: [
    'Lưu nháp: trong trình soạn hành trình bấm "Lưu nháp". Bản nháp lưu vào tài khoản nên mở lại được trên thiết bị khác; chưa cần đủ Tiêu đề hay Tóm tắt.',
    'Tìm lại bản nháp: bấm ảnh đại diện → "Hoạt động của bạn" → mục "Hành trình". Hoặc vào "Hành trình của tôi" → tab "Tôi đăng" (bản nháp có nhãn "Nháp", bấm "Viết tiếp").',
    'Với mỗi bản nháp (trong Hoạt động của bạn → Hành trình): "Tiếp tục chỉnh sửa", "Xem trước", "Đăng", "Nhân bản" (tạo một bản sao nháp), "Xoá bản nháp".',
    'Muốn đăng, bản nháp cần có Tiêu đề và Tóm tắt; thiếu thì bấm "Tiếp tục chỉnh sửa" để bổ sung.',
    'Bản nháp đã xoá nằm trong "Đã xoá gần đây" 30 ngày và khôi phục được.',
  ].join('\n'),

  edit_delete_journey: [
    'Sửa: mở hành trình của bạn → bấm "Chỉnh sửa" → sửa rồi bấm "Lưu thay đổi". Chỉ tác giả mới sửa được.',
    'Xoá: bấm ảnh đại diện → "Hoạt động của bạn" → "Ảnh và video" → mở tuỳ chọn (dấu ba chấm) của hành trình → "Xoá". Bản nháp thì xoá ở mục "Hành trình" → "Xoá bản nháp".',
    'Hành trình đã xoá được giữ trong "Hoạt động của bạn" → "Đã xoá gần đây" 30 ngày: bấm "Khôi phục" để lấy lại, hoặc "Xoá" để xoá vĩnh viễn (kèm cả ảnh, không hoàn tác được). Quá 30 ngày sẽ tự xoá vĩnh viễn.',
  ].join('\n'),

  discover: [
    'Trang Khám phá: ô tìm kiếm "Bạn muốn đi đâu?" nhận tên điểm đến, tên hành trình hoặc thẻ; khi gõ có gợi ý, bấm "Tìm kiếm" để xem kết quả.',
    'Lọc theo Khu vực: Tất cả, Miền Bắc, Miền Trung, Miền Nam, Hải đảo, Nước ngoài. Bấm "Xóa bộ lọc" để bỏ lọc.',
    'Kéo xuống có các mục gợi ý: hành trình theo mùa, hành trình được yêu thích, điểm đến nổi bật, và "Khám phá theo sở thích" (bấm một sở thích để xem các hành trình gắn thẻ đó, có cả mục "Đi vừa túi tiền").',
    'Bấm vào một thẻ hành trình để mở chi tiết: Lịch trình từng ngày, Bản đồ tuyến, Thời gian, Tổng chi phí ước tính, Mức chi tiêu; mỗi điểm dừng có nút "Chỉ đường".',
    'Các lượt tìm được lưu ở Hoạt động của bạn → Lịch sử tìm kiếm (chỉ mình bạn thấy, xoá được).',
  ].join('\n'),

  clone_itinerary: [
    'Sao chép: mở một hành trình bạn thích → bấm "Dùng làm lịch trình của tôi" → đặt Tên lịch trình và Ngày khởi hành (các ngày được đánh lại từ ngày này) → xác nhận. Cần đăng nhập.',
    'Xem lại: "Hành trình của tôi" trên thanh điều hướng → tab "Đã sao chép" (tab "Tôi đăng" là bài bạn tự đăng).',
    'Trong một lịch trình đã sao chép: kéo thẻ để đổi thứ tự ngày (ngày và số thứ tự tự đánh lại), xoá ngày, bấm "Ghép từ bài khác" để chọn thêm ngày từ hành trình khác (nối vào cuối), và xem Tổng chi phí, Số ngày, Số điểm dừng tính lại tức thì.',
    'Sao chép bằng AI: trên một số hành trình có nút "Sao chép bằng AI" (cạnh "Dùng làm lịch trình của tôi") → mở khung chat, AI hỏi lần lượt Ngày khởi hành, Số ngày, Số người (có trẻ em / người lớn tuổi không), Ngân sách cả nhóm, Điểm xuất phát, Sở thích và Nhịp độ (Thong thả, Vừa phải, Dày đặc). Trả lời bằng nút gợi ý hoặc gõ tự nhiên, ví dụ "3 ngày, 4 người có trẻ em, 5 triệu"; gõ "bỏ qua" để bỏ một câu. Cột "Thông tin chuyến đi" bên phải cho thấy mục nào đã có. Bấm "Tạo bản nháp" lúc nào cũng được, mục chưa trả lời dùng mặc định (mất khoảng nửa phút đến một phút). Chỉ bước tạo bản nháp mới tốn lượt AI. AI chỉ dùng địa điểm, giá và giờ mở cửa có trong dữ liệu ChillnGo; chỗ thiếu dữ liệu ghi "chưa có dữ liệu".',
    'Trang bản nháp AI: mỗi điểm có nhãn Giữ nguyên, Thay thế, Thêm mới hoặc Đã bỏ kèm lý do; bấm "Chấp nhận" hoặc "Hoàn tác" từng thay đổi (hoàn tác một điểm bị thay sẽ trả lại điểm gốc), "Khôi phục" điểm đã bỏ, hoặc "Chấp nhận tất cả". Phía trên là tổng chi phí so với ngân sách và các cảnh báo trùng giờ. Ô "Chỉnh bằng lời" bên phải nhận yêu cầu như "bỏ chợ đêm, thêm quán cà phê sáng ngày 2". Bấm "Lưu vào lịch trình của tôi" để lưu vào tab "Đã sao chép". Mỗi lần tạo bản nháp hoặc mỗi tin nhắn dùng một lượt AI (có giới hạn lượt mỗi ngày); bản nháp tự xoá sau 24 giờ.',
    'Gộp hành trình bằng AI: trong khung chat "Sao chép bằng AI", câu hỏi cuối liệt kê các hành trình khác cùng nơi (chọn tối đa 2) rồi bấm "Xong" và "Gộp và tạo bản nháp". Chỉ gộp được hành trình cùng một điểm đến.',
    'Trên trang bản nháp AI còn có: dòng mùa mưa, mùa cao điểm, lễ hội (khi ChillnGo có dữ liệu mùa của điểm đến); cảnh báo đến nơi ngoài giờ mở cửa, không đủ thời gian đi lại giữa hai điểm (ước tính), ngày quá dài so với nhịp độ; nút "Tối ưu tuyến" ở mỗi ngày (sắp lại thứ tự cho đường ngắn hơn, giữ nguyên bữa ăn); dòng "Plan B" dưới mỗi điểm (nơi cùng loại gần nhất đang mở cửa, mùa mưa thì ưu tiên trong nhà); và thẻ "Chuẩn bị cho chuyến đi" với nút "Tạo checklist" (đồ cần mang, chỗ cần đặt trước).',
    'Lịch trình tạo bằng AI có nhãn "Điều chỉnh bằng AI" và dòng "Phỏng theo hành trình của @tác giả"; hành trình gốc hiện số lượt sao chép. Plan B và checklist được lưu cùng lịch trình.',
    'Trạng thái lịch trình: Đang lên kế hoạch, Đã chốt, Đã đi.',
    'Lịch trình đã sao chép là riêng tư: chỉ chủ tài khoản xem được (tab "Lịch trình đã sao chép" trên trang cá nhân của mình).',
  ].join('\n'),

  interact: [
    'Trên một hành trình: bấm trái tim để thích, "Bình luận" để viết hoặc trả lời bình luận, biểu tượng dấu trang ("Lưu bài viết") để lưu xem sau, "Dùng làm lịch trình của tôi" để sao chép.',
    'Bài đã lưu: trang cá nhân của bạn → tab "Đã lưu", hoặc Hoạt động của bạn → "Đã lưu" (chỉ mình bạn thấy).',
    'Theo dõi: mở trang cá nhân của một người → "Theo dõi" (bấm lại "Đang theo dõi" để bỏ).',
    'Newsfeed: hành trình và check-in mới nhất từ bạn và những người bạn theo dõi (chưa đăng nhập thì xem bài mới nhất của mọi người).',
    'Thông báo (chuông ở góc phải): có người thích, bình luận, theo dõi, lưu hoặc sao chép bài của bạn, và khi người bạn theo dõi bắt đầu phát trực tiếp.',
  ].join('\n'),

  checkin: [
    'Ở Newsfeed, trong ô đăng bài bấm nút "Ảnh" hoặc "Check-in" để mở hộp thoại check-in. Cần đăng nhập.',
    'Thêm tối đa 4 ảnh, viết vài dòng ("Bạn thấy nơi này thế nào?"), chọn Cảm xúc / Hoạt động, và chọn Địa điểm (dùng "Vị trí hiện tại" hoặc tìm theo tên). Địa điểm không bắt buộc; cần ít nhất ảnh, cảm xúc hoặc vài dòng chia sẻ.',
    'Bấm "Đăng check-in". Check-in hiện trong Newsfeed và trong Hoạt động của bạn → Ảnh và video.',
    'Xoá check-in: mở tuỳ chọn trên thẻ check-in → "Xoá check-in"; nó nằm trong Đã xoá gần đây 30 ngày.',
  ].join('\n'),

  livestream: [
    'Phát trực tiếp: ở Newsfeed bấm "Phát trực tiếp" trong ô đăng bài, hoặc vào trang "Đang live" → "Phát trực tiếp". Cho phép trình duyệt dùng camera và micro (không có camera thì phát chỉ âm thanh).',
    'Trong hộp thoại: nhập Tiêu đề, Mô tả (không bắt buộc), chọn "Ai được xem" (Công khai: mọi người đã đăng nhập; Người theo dõi; Chỉ mình tôi: để phát thử), bật "Lưu lại buổi phát" nếu muốn có bản xem lại → "Bắt đầu livestream". Mỗi lúc chỉ phát được một buổi.',
    'Người theo dõi bạn nhận thông báo khi bạn bắt đầu phát. Khi kết thúc có trang tổng kết (thời lượng, người xem, bình luận, cảm xúc).',
    'Xem: trang "Đang live" có các tab Đề xuất, Đang theo dõi, Khám phá và phần "Xem lại" cho các buổi đã lưu. Xem livestream cần đăng nhập; người xem có thể bình luận và thả cảm xúc.',
    'Các buổi bạn đã phát: Hoạt động của bạn → Ảnh và video → Trực tiếp.',
  ].join('\n'),

  profile: [
    'Trang cá nhân: bấm ảnh đại diện của mình (hoặc của người khác). Có số Người theo dõi, Đang theo dõi và các tab Bài viết, Đã lưu, Lịch trình đã sao chép (hai tab sau chỉ chủ tài khoản thấy nội dung riêng tư).',
    'Chỉnh sửa hồ sơ: bấm ảnh đại diện ở góc phải → "Chỉnh sửa hồ sơ" (hoặc nút "Chỉnh sửa hồ sơ" trên trang cá nhân của bạn). Đổi được Ảnh đại diện, Ảnh bìa (tối đa 15 MB mỗi ảnh), Tên hiển thị, Tên người dùng, Giới thiệu, Nơi sống → lưu.',
    'Các thay đổi hồ sơ được ghi lại ở Hoạt động của bạn → Lịch sử tài khoản.',
  ].join('\n'),

  activity: [
    'Mở: bấm ảnh đại diện ở góc phải → "Hoạt động của bạn". Các mục:',
    '- Lượt tương tác: hành trình bạn đã thích và bình luận bạn đã viết.',
    '- Ảnh và video: hành trình bạn đăng, check-in ảnh, bản ghi livestream và các buổi phát của bạn.',
    '- Hành trình: các bản nháp chưa đăng.',
    '- Lịch sử tìm kiếm: những gì bạn đã tìm (xoá từng mục hoặc "Xoá tất cả").',
    '- Lịch sử tài khoản: các thay đổi trên tài khoản.',
    '- Đã xoá gần đây: nội dung đã xoá, khôi phục trong 30 ngày.',
    '- Đã lưu: hành trình bạn đã lưu.',
  ].join('\n'),

  assistant: [
    'Trợ lý AI (nút robot ở góc phải dưới, cần đăng nhập) tư vấn du lịch và hướng dẫn dùng ChillnGo. Nút này tạm ẩn ở trang chi tiết một hành trình và trang xem livestream; quay lại trang khác là thấy, cuộc trò chuyện vẫn còn.',
    'Khi trợ lý nhắc tới một hành trình trên ChillnGo, bên cạnh tên có đường dẫn "Xem hành trình" để mở nó.',
    'Trợ lý tra được dữ liệu thật: các hành trình đã đăng công khai (lịch trình từng ngày, điểm dừng, chi phí ước tính, phương tiện, quãng đường) và các hành trình của chính bạn, kể cả bản nháp.',
    'Trợ lý không xem được: bản nháp của người khác, lượt thích, bình luận, bài đã lưu, lịch trình đã sao chép, tin nhắn hay thông tin riêng tư của tài khoản. Trợ lý không tự đăng, sửa hay xoá gì thay bạn.',
    'Cuộc trò chuyện không được lưu trên máy chủ: tải lại trang là bắt đầu lại. Mỗi phút hỏi được tối đa 10 câu.',
  ].join('\n'),

  not_available: [
    'ChillnGo hiện CHƯA có: đặt vé máy bay/tàu xe, đặt phòng khách sạn, thanh toán hay mua tour; nhắn tin riêng giữa người dùng; tin (story); chia sẻ lại bài (repost); đánh giá/chấm điểm địa điểm; lưu riêng từng địa điểm (chỉ lưu được cả hành trình); đổi mật khẩu hoặc quên mật khẩu trong giao diện; ứng dụng ngoại tuyến; đổi ngôn ngữ giao diện.',
    'Hành trình không lưu giờ khởi hành hay giờ đến cụ thể: chỉ có ngày, thứ tự điểm dừng, phương tiện, và quãng đường/thời gian di chuyển ước tính giữa các điểm khi có.',
    'Chi phí trong hành trình là ước tính do tác giả tự nhập, không phải giá niêm yết.',
  ].join('\n'),
}

export function siteGuide(topic: GuideTopic): string {
  return GUIDE[topic]
}
