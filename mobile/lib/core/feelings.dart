/// Feelings and activities for check-ins. Keys mirror server/src/lib/feelings.ts.
library;

class FeelingOption {
  const FeelingOption(this.key, this.isFeeling, this.emoji, this.label);

  final String key;

  /// A feeling ("đang cảm thấy …") or an activity ("đang …").
  final bool isFeeling;
  final String emoji;
  final String label;

  String get lead => isFeeling ? 'đang cảm thấy' : 'đang';
  String get what => label.toLowerCase();
}

const feelingOptions = <FeelingOption>[
  FeelingOption('happy', true, '😊', 'Vui vẻ'),
  FeelingOption('relaxed', true, '😌', 'Thư giãn'),
  FeelingOption('excited', true, '🤩', 'Hào hứng'),
  FeelingOption('tired_but_happy', true, '😮‍💨', 'Mệt nhưng vui'),
  FeelingOption('peaceful', true, '🍃', 'Bình yên'),
  FeelingOption('grateful', true, '🥰', 'Biết ơn'),
  FeelingOption('amazed', true, '😍', 'Choáng ngợp'),
  FeelingOption('nostalgic', true, '🥹', 'Hoài niệm'),
  FeelingOption('adventurous', true, '🤠', 'Muốn phiêu lưu'),
  FeelingOption('romantic', true, '💕', 'Lãng mạn'),
  FeelingOption('eating', false, '🍜', 'Ăn uống'),
  FeelingOption('drinking_coffee', false, '☕', 'Uống cà phê'),
  FeelingOption('watching_sunset', false, '🌅', 'Ngắm hoàng hôn'),
  FeelingOption('swimming', false, '🏊', 'Tắm biển'),
  FeelingOption('trekking', false, '🥾', 'Leo núi'),
  FeelingOption('camping', false, '🏕️', 'Cắm trại'),
  FeelingOption('road_trip', false, '🏍️', 'Đi phượt'),
  FeelingOption('exploring', false, '🧭', 'Khám phá'),
  FeelingOption('taking_photos', false, '📸', 'Chụp ảnh'),
  FeelingOption('shopping', false, '🛍️', 'Mua sắm'),
];

FeelingOption? feelingOption(String? key) {
  if (key == null) return null;
  for (final option in feelingOptions) {
    if (option.key == key) return option;
  }
  return null;
}
