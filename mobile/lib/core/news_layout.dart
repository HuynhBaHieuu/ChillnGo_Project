/// How a news post is laid out (web/src/lib/newsLayout.ts): the first picture
/// is the cover, the next ones sit between paragraphs (spread evenly, never
/// after the last one), and what is left goes to a gallery under the text.
library;

/// One piece of the post body: a paragraph ([text]) or a picture ([image]).
class NewsBlock {
  const NewsBlock.text(String this.text) : image = null;
  const NewsBlock.image(String this.image) : text = null;

  final String? text;
  final String? image;
}

class NewsLayout {
  const NewsLayout({required this.cover, required this.blocks, required this.gallery});

  final String? cover;
  final List<NewsBlock> blocks;
  final List<String> gallery;
}

NewsLayout newsLayout(List<String> content, List<String> images) {
  final cover = images.isEmpty ? null : images.first;
  final rest = images.skip(1).toList();
  final gaps = content.isEmpty ? 0 : content.length - 1;
  final inline = rest.take(gaps).toList();
  final blocks = <NewsBlock>[];
  for (var index = 0; index < content.length; index++) {
    blocks.add(NewsBlock.text(content[index]));
    for (var k = 0; k < inline.length; k++) {
      // The k-th picture comes after this many paragraphs.
      if (((k + 1) * content.length) ~/ (inline.length + 1) == index + 1) blocks.add(NewsBlock.image(inline[k]));
    }
  }
  return NewsLayout(cover: cover, blocks: blocks, gallery: rest.skip(inline.length).toList());
}
