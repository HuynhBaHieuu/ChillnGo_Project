/// Reads the travel assistant's replies (web/src/features/assistant/replyTags.ts).
/// The model writes `<<…>>` tags into them for the web's robot; the app has no
/// robot, so every tag goes except `<<j:id>>` after a journey's title, which
/// becomes a link to it. Bold markup goes too, and list stars become bullets.
library;

/// A tag, an inline HTML tag, or Markdown bold.
final _mark = RegExp(r'<<([^<>\n]{0,60})>>|</?(?:b|strong|i|em|u)>|\*\*', caseSensitive: false);

/// The start of a mark still arriving at the end of a streamed reply.
final _partial = RegExp(r'<(<[^<>\n]{0,40}>?|/?[a-z]{0,6})?$|\*$', caseSensitive: false);

final _journey = RegExp(r'^\s*j\s*:\s*([a-f0-9]{24})\s*$');

/// The text to show, and each journey it names: its id and where in the text its title ends.
({String text, List<({int at, String id})> links}) parseAssistantReply(String raw) {
  final source = raw.replaceFirst(_partial, '');
  final text = StringBuffer();
  final links = <({int at, String id})>[];
  var last = 0;
  for (final m in _mark.allMatches(source)) {
    text.write(source.substring(last, m.start));
    last = m.end;
    if (m[1] == null) continue;
    // A tag between two spaces (or at the start) leaves one.
    final sofar = text.toString();
    if (sofar.isEmpty || sofar.endsWith(' ') || sofar.endsWith('\n')) {
      while (last < source.length && (source[last] == ' ' || source[last] == '\t')) {
        last++;
      }
    }
    final id = _journey.firstMatch(m[1]!.toLowerCase())?[1];
    if (id != null && !links.any((l) => l.id == id)) links.add((at: sofar.trimRight().length, id: id));
  }
  text.write(source.substring(last));
  return (text: text.toString().replaceAllMapped(RegExp(r'^(\s*)[*-] ', multiLine: true), (m) => '${m[1]}• '), links: links);
}
