import 'package:chillngo/core/news_layout.dart';
import 'package:flutter_test/flutter_test.dart';

List<String> _kinds(List<String> content, List<String> images) =>
    newsLayout(content, images).blocks.map((b) => b.text ?? '[${b.image}]').toList();

void main() {
  test('the first picture is the cover and the next sit between paragraphs', () {
    final layout = newsLayout(['a', 'b', 'c'], ['cover', 'x', 'y']);
    expect(layout.cover, 'cover');
    expect(_kinds(['a', 'b', 'c'], ['cover', 'x', 'y']), ['a', '[x]', 'b', '[y]', 'c']);
    expect(layout.gallery, isEmpty);
  });

  test('a few pictures are spread evenly and the post never ends on one', () {
    expect(_kinds(['a', 'b', 'c', 'd', 'e', 'f'], ['cover', 'x', 'y']), ['a', 'b', '[x]', 'c', 'd', '[y]', 'e', 'f']);
    expect(_kinds(['a', 'b'], ['cover', 'x']), ['a', '[x]', 'b']);
  });

  test('pictures that do not fit between paragraphs go to the gallery', () {
    expect(newsLayout(['a', 'b'], ['cover', 'x', 'y', 'z']).gallery, ['y', 'z']);
    expect(newsLayout(['only'], ['cover', 'x']).gallery, ['x']);
  });

  test('no pictures or no text is fine', () {
    final plain = newsLayout(['a'], []);
    expect(plain.cover, isNull);
    expect(plain.blocks.single.text, 'a');
    final bare = newsLayout([], ['cover', 'x']);
    expect(bare.blocks, isEmpty);
    expect(bare.gallery, ['x']);
  });
}
