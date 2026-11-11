import 'package:chillngo/core/feed_mix.dart';
import 'package:flutter_test/flutter_test.dart';

String kinds(List<Object> list) => list.map((e) => e is int ? 'P' : 'N').join();

void main() {
  group('interleave', () {
    test('puts one news item after every three posts', () {
      expect(kinds(interleave([1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c'])), 'PPPNPPPNPN');
    });

    test('shows only news when there are no posts', () {
      expect(kinds(interleave(<int>[], ['a', 'b'])), 'NN');
    });

    test('shows only posts when there is no news', () {
      expect(kinds(interleave([1, 2, 3, 4], <String>[])), 'PPPP');
    });
  });
}
