/// Default travel photos, picked deterministically from a seed so the same
/// post, user or stop always gets the same picture. Same pools and hash as
/// web/src/lib/photos.ts, so a default cover looks the same on web and mobile.
library;

import 'text.dart';

enum PhotoTheme { mountain, sea, karst, nature, town, food, market, camp, trek, transit }

const Map<PhotoTheme, List<String>> _pools = {
  PhotoTheme.mountain: [
    '1506905925346-21bda4d32df4',
    '1501785888041-af3ef285b470',
    '1469474968028-56623f02e42e',
    '1470071459604-3b5ec3a7fe05',
    '1426604966848-d7adac402bff',
    '1476514525535-07fb3b4ae5f1',
    '1464822759023-fed622ff2c3b',
    '1454496522488-7a8e488e8606',
    '1483728642387-6c3bdd6c93e5',
    '1493246507139-91e8fad9978e',
    '1480497490787-505ec076689f',
    '1500534314209-a25ddb2bd429',
    '1439853949127-fa647821eba0',
    '1570366583862-f91883984fde',
    '1540611025311-01df3cef54b5',
  ],
  PhotoTheme.sea: [
    '1507525428034-b723cf961d3e',
    '1519046904884-53103b34b206',
    '1540541338287-41700207dee6',
    '1510414842594-a61c69b5ae57',
    '1506929562872-bb421503ef21',
    '1505228395891-9a51e7e86bf6',
    '1509233725247-49e657c54213',
    '1573790387438-4da905039392',
    '1570789210967-2cac24afeb00',
  ],
  PhotoTheme.karst: [
    '1528127269322-539801943592',
    '1504457047772-27faf1c00561',
    '1590050752117-238cb0fb12b1',
    '1552465011-b4e21bf6e79a',
    '1570789210967-2cac24afeb00',
  ],
  PhotoTheme.nature: [
    '1441974231531-c6227db76b6e',
    '1472214103451-9374bd1c798e',
    '1447752875215-b2761acb3c5d',
    '1433086966358-54859d0ed716',
    '1502082553048-f009c37129b9',
    '1476610182048-b716b8518aae',
    '1517760444937-f6397edcbbcd',
    '1465146344425-f00d5f5c8f07',
  ],
  PhotoTheme.town: [
    '1555921015-5532091f6026',
    '1533050487297-09b450131914',
    '1542931287-023b922fa89b',
    '1508009603885-50cf7c579365',
    '1580655653885-65763b2597d0',
    '1559592413-7cec4d0cae2b',
    '1512553353614-82a7370096dc',
    '1526481280693-3bfa7568e0f3',
    '1528181304800-259b08848526',
    '1583417319070-4a69db38a482',
    '1449824913935-59a10b8d2000',
  ],
  PhotoTheme.food: [
    '1414235077428-338989a2e8c0',
    '1504674900247-0877df9cc836',
    '1555396273-367ea4eb4db5',
    '1517248135467-4c7edcad34c4',
    '1528605248644-14dd04022da1',
    '1533777857889-4be7c70b33f7',
    '1541544537156-7627a7a4aa1c',
    '1551632436-cbf8dd35adfa',
  ],
  PhotoTheme.market: ['1488459716781-31db52582fe9', '1517457373958-b7bdd4587205', '1528605248644-14dd04022da1'],
  PhotoTheme.camp: [
    '1517824806704-9040b037703b',
    '1504280390367-361c6d9f38f4',
    '1496545672447-f699b503d270',
    '1478131143081-80f7f84ca84d',
    '1519681393784-d120267933ba',
    '1465101046530-73398c7f28ca',
  ],
  PhotoTheme.trek: [
    '1469474968028-56623f02e42e',
    '1501555088652-021faa106b9b',
    '1551632811-561732d1e306',
    '1506197603052-3cc9c3a201bd',
    '1544551763-46a013bb70d5',
    '1527631746610-bca00a040d60',
  ],
  PhotoTheme.transit: [
    '1436491865332-7a61a109cc05',
    '1544620347-c4fd4a3d5957',
    '1488646953014-85cb44e25828',
    '1504609773096-104ff2c73ba4',
    '1516546453174-5e1098a4b4af',
  ],
};

const List<(PhotoTheme, List<String>)> _keywords = [
  (PhotoTheme.market, ['chợ', 'phiên chợ', 'market']),
  (
    PhotoTheme.transit,
    [
      'bến xe',
      'thuê xe',
      'xe máy',
      'xe khách',
      'giường nằm',
      'sân bay',
      'máy bay',
      'bến tàu',
      'phà',
      'cano',
      'ca nô',
      'tàu hoả',
      'tàu hỏa',
      'nhà ga',
      'di chuyển',
      'đổ xăng',
    ],
  ),
  (PhotoTheme.food, ['quán', 'ăn', 'nhà hàng', 'cà phê', 'cafe', 'bún', 'phở', 'cơm', 'lẩu', 'nướng', 'bbq', 'hải sản', 'bánh', 'trà sữa', 'ẩm thực', 'bia']),
  (
    PhotoTheme.camp,
    ['homestay', 'khách sạn', 'resort', 'nhà nghỉ', 'bungalow', 'lều', 'cắm trại', 'camping', 'glamping', 'ngủ', 'lửa trại', 'ngắm sao', 'săn mây'],
  ),
  (PhotoTheme.trek, ['trek', 'leo', 'đi bộ', 'lặn', 'snorkel', 'kayak', 'chèo', 'zipline', 'chinh phục', 'cắm chốt']),
  (PhotoTheme.sea, ['biển', 'bãi', 'đảo', 'hòn', 'cảng', 'sunset', 'bể bơi', 'hồ bơi']),
  (PhotoTheme.karst, ['vịnh', 'hang', 'động', 'sông', 'bến thuyền', 'đò', 'thuyền']),
  (PhotoTheme.mountain, ['đèo', 'núi', 'đỉnh', 'cao nguyên', 'dốc', 'cổng trời', 'ruộng bậc thang', 'đồi', 'fansipan', 'mã pí lèng', 'thung lũng', 'mỏm']),
  (PhotoTheme.nature, ['thác', 'rừng', 'vườn', 'hồ', 'suối', 'đồi chè', 'hoa', 'công viên']),
  (PhotoTheme.town, ['phố', 'chùa', 'đền', 'nhà thờ', 'làng', 'cầu', 'bảo tàng', 'dinh', 'thành cổ', 'quảng trường', 'chợ đêm', 'check-in', 'trung tâm']),
];

/// The theme a place name suggests, matched on whole syllables.
PhotoTheme? themeFromText(String text) {
  final padded = ' ${words(text).join(' ')} ';
  for (final (theme, keywords) in _keywords) {
    if (keywords.any((k) => padded.contains(' $k '))) return theme;
  }
  return null;
}

/// FNV-1a 32-bit: stable across runs, spreads short seeds well.
int _hash(String seed) {
  var h = 0x811c9dc5;
  for (var i = 0; i < seed.length; i++) {
    h = (h ^ seed.codeUnitAt(i)) & 0xFFFFFFFF;
    h = (h * 0x01000193) & 0xFFFFFFFF;
  }
  return h;
}

PhotoTheme _pickTheme(String seed) => PhotoTheme.values[_hash('theme:$seed') % PhotoTheme.values.length];

String _unsplashUrl(String id, int w, int h) => 'https://images.unsplash.com/photo-$id?auto=format&fit=crop&w=$w&h=$h&q=75';

String travelPhoto(String seed, {int w = 900, int h = 700, PhotoTheme? theme}) {
  final pool = _pools[theme ?? _pickTheme(seed)]!;
  return _unsplashUrl(pool[_hash(seed) % pool.length], w, h);
}

enum LandingPhoto { saPa, riceTerraces, quyNhon, hoiAn }

const _landingIds = {
  LandingPhoto.saPa: '1506905925346-21bda4d32df4',
  LandingPhoto.riceTerraces: '1570366583862-f91883984fde',
  LandingPhoto.quyNhon: '1573790387438-4da905039392',
  LandingPhoto.hoiAn: '1508009603885-50cf7c579365',
};

String landingPhoto(LandingPhoto name, int w, int h) => _unsplashUrl(_landingIds[name]!, w, h);

const _scenic = [PhotoTheme.mountain, PhotoTheme.sea, PhotoTheme.karst, PhotoTheme.nature, PhotoTheme.town];

/// A post or itinerary cover (16:10).
String travelCover(String seed, [PhotoTheme? theme]) {
  final scenic = theme != null && _scenic.contains(theme) ? theme : _scenic[_hash('cover:$seed') % _scenic.length];
  return travelPhoto('cover:$seed', w: 1600, h: 1000, theme: scenic);
}

/// A profile banner.
String travelBanner(String seed) {
  final theme = _scenic[_hash('banner:$seed') % _scenic.length];
  return travelPhoto('banner:$seed', w: 1800, h: 600, theme: theme);
}

/// A default avatar.
String travelAvatar(String seed) {
  const themes = [PhotoTheme.trek, PhotoTheme.camp, PhotoTheme.food, PhotoTheme.sea];
  return travelPhoto('avatar:$seed', w: 240, h: 240, theme: themes[_hash('avatar:$seed') % 4]);
}

/// The automatic cover a journey gets when its author picked none.
String autoCover(String title) {
  final seed = title.length > 30 ? title.substring(0, 30) : title;
  return travelCover(seed.isEmpty ? 'chillngo' : seed, themeFromText(title));
}
