import 'package:chillngo/core/format.dart';
import 'package:chillngo/core/itinerary.dart';
import 'package:chillngo/core/maps_link.dart';
import 'package:chillngo/core/password.dart';
import 'package:chillngo/core/photos.dart';
import 'package:chillngo/core/text.dart';
import 'package:chillngo/core/travel.dart';
import 'package:chillngo/data/models.dart';
import 'package:chillngo/features/auth/verify_email_screen.dart';
import 'package:chillngo/features/discover/interests.dart';
import 'package:chillngo/features/map/legs.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('text', () {
    test('foldText drops Vietnamese marks', () {
      expect(foldText('Hà Giang'), 'ha giang');
      expect(foldText('Đà Lạt'), 'da lat');
      expect(foldText('PHỐ CỔ HỘI AN'), 'pho co hoi an');
    });

    test('words splits on punctuation', () {
      expect(words('Đèo Mã Pí Lèng, Hà Giang!'), ['đèo', 'mã', 'pí', 'lèng', 'hà', 'giang']);
    });
  });

  group('format', () {
    test('money', () {
      expect(formatVnd(1910000), '1.910.000 ₫');
      expect(formatVndShort(1910000), '1,9tr');
      expect(formatVndShort(12500000), '13tr');
      expect(formatVndShort(450000), '450k');
      expect(formatCount(1284), '1,3k');
      expect(groupThousands(-1234567), '-1.234.567');
    });

    test('trip length', () {
      expect(tripLengthLabel(4), '4N3Đ');
      expect(tripLengthLabel(1), '1N0Đ');
    });

    test('dates', () {
      expect(addDays('2025-10-30', 3), '2025-11-02');
      expect(toDateOnly(DateTime(2025, 3, 4)), '2025-03-04');
      expect(clockDuration(3725), '1:02:05');
      expect(clockDuration(754), '12:34');
    });
  });

  group('password rules (server/src/lib/schemas.ts)', () {
    test('needs length, an upper-case letter and a special character', () {
      expect(passwordMeetsRules('abc'), isFalse);
      expect(passwordMeetsRules('abcdef'), isFalse);
      expect(passwordMeetsRules('Abcdef'), isFalse);
      expect(passwordMeetsRules('Abcdef!'), isTrue);
      // A Vietnamese letter is a letter, not a special character.
      expect(passwordMeetsRules('Abcdeệ'), isFalse);
    });

    test('username', () {
      expect(usernameProblem('ab'), isNotNull);
      expect(usernameProblem('chill.n_go'), isNull);
      expect(usernameProblem('Hà'), isNotNull);
    });
  });

  group('photos match the web', () {
    test('deterministic per seed', () {
      expect(travelAvatar('minh'), travelAvatar('minh'));
      expect(autoCover('Hà Giang Loop').startsWith('https://images.unsplash.com/photo-'), isTrue);
    });

    test('themes from place words', () {
      expect(themeFromText('Chợ đêm Đà Lạt'), PhotoTheme.market);
      expect(themeFromText('Bãi biển Mỹ Khê'), PhotoTheme.sea);
    });
  });

  group('maps', () {
    test('coordinates', () {
      final c = parseCoordinates('15.8801, 108.3380');
      expect(c?.lat, closeTo(15.8801, 1e-9));
      expect(c?.lng, closeTo(108.338, 1e-9));
      expect(parseCoordinates('hello'), isNull);
      expect(parseCoordinates('95, 10'), isNull);
    });

    test('Google Maps links', () {
      expect(isGoogleMapsUrl('https://maps.app.goo.gl/abc'), isTrue);
      expect(isGoogleMapsUrl('https://www.google.com/maps/place/Hoi+An'), isTrue);
      expect(isGoogleMapsUrl('https://example.com'), isFalse);
      final info = readGoogleMapsUrl('https://www.google.com/maps/place/Ph%E1%BB%91+c%E1%BB%95/@15.877,108.326,15z/data=!3d15.8771!4d108.3262');
      expect(info.lat, closeTo(15.8771, 1e-9));
      expect(info.lng, closeTo(108.3262, 1e-9));
      expect(info.name, 'Phố cổ');
    });

    test('polyline6', () {
      // Two points: (38.5, -120.2) and (40.7, -120.95) at precision 5, the Google sample.
      final points = decodePolyline('_p~iF~ps|U_ulLnnqC', 5);
      expect(points.length, 2);
      expect(points[0].latitude, closeTo(38.5, 1e-6));
      expect(points[0].longitude, closeTo(-120.2, 1e-6));
      expect(points[1].latitude, closeTo(40.7, 1e-6));
    });

    test('leg keys and modes', () {
      expect(legKey(105.8, 21.0, 106.0, 20.9, TravelMode.walking), 'walking:105.80000,21.00000;106.00000,20.90000');
      expect(modeOf('water'), TravelMode.ferry);
      expect(modeOf(null), TravelMode.driving);
      expect(formatTravelDuration(2700), '45 phút');
      expect(formatTravelDuration(7800, estimate: true), '2 giờ 10 phút');
    });

    test('flights are drawn as dashed arcs', () {
      final days = [
        TripDay(
          id: 'd1',
          dayNumber: 1,
          locations: [
            TripLocation(id: 'a', name: 'Nội Bài', lng: 105.8, lat: 21.2),
            TripLocation(id: 'b', name: 'Tân Sơn Nhất', lng: 106.65, lat: 10.81, travelMode: 'flight'),
          ],
        ),
      ];
      final segments = segmentsOf(stopsOfDays(days));
      expect(segments, hasLength(1));
      final drawn = drawSegment(segments.first);
      expect(drawn.dashed, isTrue);
      expect(drawn.points.length, greaterThan(10));
      expect(drawn.estimated, isTrue);
    });
  });

  group('verification links', () {
    test('token from a pasted link', () {
      expect(tokenFrom('https://chillngo.vn/verify-email?token=abcDEF123_-xyz7890'), 'abcDEF123_-xyz7890');
      expect(tokenFrom('abcDEF123_-xyz7890'), 'abcDEF123_-xyz7890');
      expect(tokenFrom('short'), isNull);
    });
  });

  group('discover', () {
    test('suggestions match the start of words, accent-insensitive', () {
      final post = TripPost(id: 'p1', authorId: 'u1', title: 'Hà Giang Loop 4N3Đ', tags: ['núi']);
      final groups = buildSuggestions([post], 'ha', 'all', const []);
      expect(groups.first.label, 'Hành trình');
      expect(buildSuggestions([post], 'oop', 'all', const []).first.label, isNull);
    });
  });
}
