import type { Messages } from '../types'

/** The travel assistant chat, and errors raised in src/services. */
export const assistant = {
  'ChillnGo có hành trình đi biển nào?': {
    en: 'What beach trips does ChillnGo have?',
    zh: 'ChillnGo 上有哪些海边行程？',
    ja: 'ChillnGoには海の旅程がありますか？',
    ko: 'ChillnGo에 바다 여행 일정이 있나요?',
  },
  'So sánh chi phí các hành trình 3 ngày': {
    en: 'Compare the costs of 3-day journeys',
    zh: '比较 3 天行程的花费',
    ja: '3日間の旅程の費用を比較して',
    ko: '3일 일정의 비용을 비교해 줘',
  },
  'Làm sao lưu nháp rồi đăng một hành trình?': {
    en: 'How do I save a draft and then post a journey?',
    zh: '如何保存草稿并发布行程？',
    ja: '下書きを保存してから旅程を投稿するには？',
    ko: '초안을 저장한 뒤 여정을 올리려면 어떻게 하나요?',
  },
  'Trợ lý chưa trả lời được câu này. Bạn thử hỏi cách khác nhé.': {
    en: "The assistant couldn't answer that. Try asking another way.",
    zh: '助手暂时无法回答这个问题，换个方式问问吧。',
    ja: 'アシスタントはこの質問に答えられませんでした。別の聞き方を試してください。',
    ko: '도우미가 이 질문에 답하지 못했어요. 다르게 물어봐 주세요.',
  },
  'Đóng trợ lý du lịch': { en: 'Close travel assistant', zh: '关闭旅行助手', ja: '旅行アシスタントを閉じる', ko: '여행 도우미 닫기' },
  'Trợ lý du lịch AI': { en: 'AI travel assistant', zh: 'AI 旅行助手', ja: 'AI旅行アシスタント', ko: 'AI 여행 도우미' },
  'Trợ lý du lịch': { en: 'Travel assistant', zh: '旅行助手', ja: '旅行アシスタント', ko: '여행 도우미' },
  'Hỏi về hành trình trên ChillnGo, cách lên lịch trình, hay cách dùng trang web. Câu trả lời do AI tạo nên có thể chưa chính xác.': {
    en: 'Ask about journeys on ChillnGo, planning an itinerary or using the site. Answers are AI-generated and may not be accurate.',
    zh: '可以询问 ChillnGo 上的行程、如何规划行程或如何使用本站。回答由 AI 生成，可能不完全准确。',
    ja: 'ChillnGoの旅程、旅程の立て方、サイトの使い方について質問できます。回答はAIが生成するため、正確でない場合があります。',
    ko: 'ChillnGo의 여정, 일정 짜는 법, 사이트 사용법을 물어보세요. 답변은 AI가 생성해 정확하지 않을 수 있어요.',
  },
  'Thử hỏi:': { en: 'Try asking:', zh: '试着问：', ja: '質問の例：', ko: '이렇게 물어보세요:' },
  'Đang soạn câu trả lời…': { en: 'Writing a reply…', zh: '正在撰写回答…', ja: '回答を作成中…', ko: '답변을 작성하는 중…' },
  'Hỏi về chuyến đi của bạn…': { en: 'Ask about your trip…', zh: '问问你的旅行…', ja: '旅について質問…', ko: '여행에 대해 물어보세요…' },
  'Câu hỏi cho trợ lý': { en: 'Question for the assistant', zh: '向助手提问', ja: 'アシスタントへの質問', ko: '도우미에게 질문' },
  'Dừng trả lời': { en: 'Stop answering', zh: '停止回答', ja: '回答を停止', ko: '답변 중지' },
  'Gửi câu hỏi': { en: 'Send question', zh: '发送问题', ja: '質問を送信', ko: '질문 보내기' },
  'Bắt đầu cuộc trò chuyện mới': { en: 'Start a new conversation', zh: '开始新的对话', ja: '新しい会話を始める', ko: '새 대화 시작하기' },

  /* src/services */
  'Không tìm thấy bài viết {id}': { en: 'Post {id} not found', zh: '未找到帖子 {id}', ja: '投稿 {id} が見つかりません', ko: '게시물 {id}을(를) 찾을 수 없어요' },
  'Không tìm thấy người dùng {id}': { en: 'User {id} not found', zh: '未找到用户 {id}', ja: 'ユーザー {id} が見つかりません', ko: '사용자 {id}을(를) 찾을 수 없어요' },
  'Tài khoản đã xoá': { en: 'Deleted account', zh: '已删除的账户', ja: '削除されたアカウント', ko: '삭제된 계정' },
  'Không nhận được địa chỉ ảnh sau khi tải lên.': {
    en: "Didn't get the photo's address after uploading.",
    zh: '上传后未获得图片地址。',
    ja: 'アップロード後に画像のURLを取得できませんでした。',
    ko: '업로드 후 사진 주소를 받지 못했어요.',
  },
  'Bình luận này không thể ẩn.': { en: "This comment can't be hidden.", zh: '此评论无法隐藏。', ja: 'このコメントは非表示にできません。', ko: '이 댓글은 숨길 수 없어요.' },
} satisfies Messages
