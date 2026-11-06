/// Labels for the journey vocabulary (web/src/lib/format.ts).
library;

import '../core/i18n.dart';

Map<String, String> get budgetLabels => {'low': t('Tiết kiệm'), 'medium': t('Vừa phải'), 'high': t('Cao cấp')};

Map<String, String> get regionLabels => {
  'north': t('Miền Bắc'),
  'central': t('Miền Trung'),
  'south': t('Miền Nam'),
  'islands': t('Hải đảo'),
  'overseas': t('Nước ngoài'),
};

Map<String, String> get seasonLabels => {'spring': t('Mùa xuân'), 'summer': t('Mùa hè'), 'autumn': t('Mùa thu'), 'winter': t('Mùa đông')};

const budgetLevels = ['low', 'medium', 'high'];
const regions = ['north', 'central', 'south', 'islands', 'overseas'];
const seasons = ['spring', 'summer', 'autumn', 'winter'];

String budgetLabel(String key) => budgetLabels[key] ?? key;
String regionLabel(String key) => regionLabels[key] ?? key;
String seasonLabel(String key) => seasonLabels[key] ?? key;
