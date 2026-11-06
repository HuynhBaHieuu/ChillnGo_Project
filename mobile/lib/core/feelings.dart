/// Feelings and activities for check-ins. Keys mirror server/src/lib/feelings.ts.
library;

import '../core/i18n.dart';

class FeelingOption {
  const FeelingOption(this.key, this.isFeeling, this.emoji, this.label);

  final String key;

  /// A feeling ("đang cảm thấy …") or an activity ("đang …").
  final bool isFeeling;
  final String emoji;
  final String label;

  String get lead => isFeeling ? t('đang cảm thấy') : t('đang');
  String get what => label.toLowerCase();
}

List<FeelingOption> get feelingOptions => <FeelingOption>[
  FeelingOption('happy', true, '😊', t('Vui vẻ')),
  FeelingOption('relaxed', true, '😌', t('Thư giãn')),
  FeelingOption('excited', true, '🤩', t('Hào hứng')),
  FeelingOption('tired_but_happy', true, '😮‍💨', t('Mệt nhưng vui')),
  FeelingOption('peaceful', true, '🍃', t('Bình yên')),
  FeelingOption('grateful', true, '🥰', t('Biết ơn')),
  FeelingOption('amazed', true, '😍', t('Choáng ngợp')),
  FeelingOption('nostalgic', true, '🥹', t('Hoài niệm')),
  FeelingOption('adventurous', true, '🤠', t('Muốn phiêu lưu')),
  FeelingOption('romantic', true, '💕', t('Lãng mạn')),
  FeelingOption('eating', false, '🍜', t('Ăn uống')),
  FeelingOption('drinking_coffee', false, '☕', t('Uống cà phê')),
  FeelingOption('watching_sunset', false, '🌅', t('Ngắm hoàng hôn')),
  FeelingOption('swimming', false, '🏊', t('Tắm biển')),
  FeelingOption('trekking', false, '🥾', t('Leo núi')),
  FeelingOption('camping', false, '🏕️', t('Cắm trại')),
  FeelingOption('road_trip', false, '🏍️', t('Đi phượt')),
  FeelingOption('exploring', false, '🧭', t('Khám phá')),
  FeelingOption('taking_photos', false, '📸', t('Chụp ảnh')),
  FeelingOption('shopping', false, '🛍️', t('Mua sắm')),
];

FeelingOption? feelingOption(String? key) {
  if (key == null) return null;
  for (final option in feelingOptions) {
    if (option.key == key) return option;
  }
  return null;
}
