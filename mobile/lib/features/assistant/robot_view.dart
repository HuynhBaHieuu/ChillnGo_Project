/// The web's assistant robot on the phone: the same model, moods and gestures,
/// run by the web's own code (web/src/features/assistant/RobotEmbed.tsx) in a
/// WebView. `node scripts/export-robot.mjs` builds it into assets/robot/.
library;

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Talks to the robot page: tells it the conversation, hears how far it has said the reply.
class RobotBridge {
  RobotBridge() {
    web
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..addJavaScriptChannel('RobotChannel', onMessageReceived: _heard);
    rootBundle.loadString('assets/robot/robot.html').then(web.loadHtmlString);
  }

  final web = WebViewController();

  /// Characters of the newest reply the robot has said: -1 all of it, null
  /// while the robot is not on screen (no 3D on this phone): show everything.
  final spoken = ValueNotifier<int?>(null);

  bool _ready = false;
  bool _gone = false;

  /// The last conversation sent before the robot was ready, sent once it is.
  String? _pending;

  /// After every change to the conversation (web: the assistant store).
  void follow(List<({bool mine, String text})> messages, {required bool busy, String? error}) {
    final list = [
      for (final m in messages) {'role': m.mine ? 'user' : 'assistant', 'content': m.text},
    ];
    _run('window.robot && window.robot.follow(${jsonEncode(list)}, $busy, ${jsonEncode(error)})');
  }

  /// The reader has a draft in the box: the robot listens.
  void typing(bool value) => _run('window.robot && window.robot.typing($value)');

  void _run(String js) {
    if (_ready) {
      web.runJavaScript(js);
    } else if (js.contains('.follow(')) {
      _pending = js;
    }
  }

  void _heard(JavaScriptMessage message) {
    final data = jsonDecode(message.message);
    if (_gone || data is! Map) return;
    if (data['ready'] == true) {
      _ready = true;
      spoken.value = -1;
      final pending = _pending;
      _pending = null;
      if (pending != null) web.runJavaScript(pending);
    }
    if (data['spoken'] is int) spoken.value = data['spoken'] as int;
  }

  void dispose() {
    _gone = true;
    spoken.dispose();
  }
}

/// The robot itself; touching it pets it, as the pointer does on the web.
class RobotView extends StatelessWidget {
  const RobotView({super.key, required this.bridge});

  final RobotBridge bridge;

  @override
  Widget build(BuildContext context) => WebViewWidget(controller: bridge.web);
}
