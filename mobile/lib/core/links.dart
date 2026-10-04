/// Opening outside links and sharing app pages.
library;

import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'env.dart';

/// Opens a map or web address: in the matching app when one handles it, otherwise in the browser.
Future<void> openExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  try {
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) await launchUrl(uri, mode: LaunchMode.platformDefault);
  } catch (_) {
    // Nothing on this phone can open it.
  }
}

/// The address to share for an app path ("/posts/123"): the web app's page
/// when WEB_URL is set (anyone can open it), the app link otherwise.
String publicUrl(String path) {
  final web = Env.webUrl;
  return web != null ? '$web$path' : 'chillngo://app$path';
}

/// The phone's share sheet, with a title and the link.
Future<void> sharePath(String path, String title) async {
  final url = publicUrl(path);
  try {
    await SharePlus.instance.share(ShareParams(text: '$title\n$url', subject: title, title: title));
  } catch (_) {
    // Share sheet unavailable.
  }
}
