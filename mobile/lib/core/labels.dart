/// Labels for the journey vocabulary (web/src/lib/format.ts).
library;

const budgetLabels = {'low': 'Tiết kiệm', 'medium': 'Vừa phải', 'high': 'Cao cấp'};

const regionLabels = {'north': 'Miền Bắc', 'central': 'Miền Trung', 'south': 'Miền Nam', 'islands': 'Hải đảo', 'overseas': 'Nước ngoài'};

const seasonLabels = {'spring': 'Mùa xuân', 'summer': 'Mùa hè', 'autumn': 'Mùa thu', 'winter': 'Mùa đông'};

const budgetLevels = ['low', 'medium', 'high'];
const regions = ['north', 'central', 'south', 'islands', 'overseas'];
const seasons = ['spring', 'summer', 'autumn', 'winter'];

String budgetLabel(String key) => budgetLabels[key] ?? key;
String regionLabel(String key) => regionLabels[key] ?? key;
String seasonLabel(String key) => seasonLabels[key] ?? key;
