import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/assistant_reply.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../ui/buttons.dart';
import '../../ui/chat.dart';
import '../../ui/navigation.dart';
import '../../ui/surfaces.dart';
import '../../core/i18n.dart';

List<String> get _suggestions => [t('ChillnGo có hành trình đi biển nào?'), t('So sánh chi phí các hành trình 3 ngày'), t('Làm sao lưu nháp rồi đăng một hành trình?')];

/// Odd, so the history sent still starts with a question. The server takes 20.
const _sentHistory = 19;

/// /assistant: the AI travel assistant (server/src/routes/assistant.ts; web:
/// AssistantButton, without its robot). The reply streams in as it is written.
class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

/// The conversation, kept while the app runs (web: assistant.store.ts). Replies are
/// kept as the model wrote them, tags and all: it sees them again and keeps writing them.
final _conversation = <({bool mine, String text})>[];

/// Whose conversation it is: another account starts over.
String? _owner;

class _AssistantScreenState extends State<AssistantScreen> {
  List<({bool mine, String text})> get _messages => _conversation;
  final _text = TextEditingController();
  CancelToken? _inFlight;
  String? _error;

  @override
  void initState() {
    super.initState();
    final me = Api.readViewerId();
    if (me != _owner) {
      _conversation.clear();
      _owner = me;
    }
  }

  @override
  void dispose() {
    // Left before any of the answer came: the unanswered question goes.
    if (_inFlight != null && _messages.last.text.isEmpty) _messages.removeRange(_messages.length - 2, _messages.length);
    _inFlight?.cancel();
    _text.dispose();
    super.dispose();
  }

  Future<void> _ask(String question) async {
    final text = question.trim();
    if (text.isEmpty || _inFlight != null) return;
    final cancel = CancelToken();
    final history = [..._messages, (mine: true, text: text)];
    setState(() {
      _messages
        ..add((mine: true, text: text))
        ..add((mine: false, text: ''));
      _inFlight = cancel;
      _error = null;
      _text.clear();
    });
    final body = {
      'messages': [
        for (final m in history.skip((history.length - _sentHistory).clamp(0, history.length))) {'role': m.mine ? 'user' : 'assistant', 'content': m.text},
      ],
    };
    try {
      await for (final piece in Api.postStream('/api/assistant/chat', body: body, cancel: cancel)) {
        if (!mounted) return;
        setState(() => _messages.last = (mine: false, text: _messages.last.text + piece));
      }
      if (mounted && parseAssistantReply(_messages.last.text).text.trim().isEmpty && !cancel.isCancelled) {
        _drop(text, t('Trợ lý chưa trả lời được câu này. Bạn thử hỏi cách khác nhé.'));
      }
    } catch (error) {
      if (mounted) _drop(text, errorMessage(error));
    } finally {
      if (mounted) setState(() => _inFlight = null);
    }
  }

  /// Drops an unanswered question with its empty reply, so the history keeps alternating, and gives the text back.
  void _drop(String question, String error) => setState(() {
    _messages.removeRange(_messages.length - 2, _messages.length);
    _error = error;
    if (_text.text.isEmpty) _text.text = question;
  });

  @override
  Widget build(BuildContext context) {
    final busy = _inFlight != null;
    return Scaffold(
      appBar: AppBar(
        leading: const BackOrHome(),
        title: Text(t('Trợ lý du lịch')),
        actions: [
          if (_messages.isNotEmpty && !busy)
            AppIconButton(icon: LucideIcons.squarePen, label: t('Bắt đầu cuộc trò chuyện mới'), onPressed: () => setState(() {
                _messages.clear();
                _error = null;
              }),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? ListView(
                    padding: const EdgeInsets.all(kGutter),
                    children: [
                      Text(t('Hỏi về hành trình trên ChillnGo, cách lên lịch trình, hay cách dùng ứng dụng. Câu trả lời do AI tạo nên có thể chưa chính xác.'), style: AppText.meta),
                      const SizedBox(height: 18),
                      Text(t('Thử hỏi:'), style: AppText.label),
                      for (final s in _suggestions) ...[
                        const SizedBox(height: 8),
                        AppCard(surface: Surface.well, onTap: () => _ask(s), child: Text(s, style: AppText.body)),
                      ],
                    ],
                  )
                : ListView(
                    // Newest at the bottom, in view, as the reply arrives.
                    reverse: true,
                    padding: const EdgeInsets.all(kGutter),
                    children: [
                      for (final m in _messages.reversed)
                        m.mine
                            ? ChatBubble(mine: true, text: m.text)
                            : m.text.isEmpty
                            ? ChatPending(t('Đang soạn câu trả lời…'))
                            : ChatBubble(mine: false, child: _Reply(m.text)),
                    ],
                  ),
          ),
          DecoratedBox(
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: AppText.bodySmall.copyWith(color: AppColors.destructive))),
                    ChatComposer(
                      controller: _text,
                      hint: t('Hỏi về chuyến đi của bạn…'),
                      maxLength: 4000,
                      onSend: () => _ask(_text.text),
                      onStop: busy ? () => _inFlight?.cancel() : null,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A reply's text, with a "Xem hành trình" link right after each journey it names.
class _Reply extends StatelessWidget {
  const _Reply(this.raw);

  final String raw;

  @override
  Widget build(BuildContext context) {
    final reply = parseAssistantReply(raw);
    var from = 0;
    return Text.rich(
      TextSpan(
        children: [
          for (final link in reply.links) ...[
            TextSpan(text: reply.text.substring(from, from = link.at)),
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: AppChip(label: t('Xem hành trình'), icon: LucideIcons.arrowUpRight, onTap: () => context.push('/posts/${link.id}')),
              ),
            ),
          ],
          TextSpan(text: reply.text.substring(from)),
        ],
      ),
      style: AppText.body.copyWith(color: AppColors.cream),
    );
  }
}
