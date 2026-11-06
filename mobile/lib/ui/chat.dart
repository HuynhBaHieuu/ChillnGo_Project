/// The pieces of every chat in the app: AI clone, its draft, and the travel
/// assistant (web: ChatPanel's AssistantMessage / UserMessage and composer).
library;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/theme.dart';
import 'buttons.dart';
import 'fields.dart';

/// Yours in a bubble on the right; the AI's as plain text on the left.
class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.mine, this.text, this.child});

  final bool mine;
  final String? text;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final content = child ?? Text(text ?? '', style: AppText.body.copyWith(color: AppColors.cream));
    if (!mine) return Padding(padding: const EdgeInsets.only(bottom: 14, right: 24), child: content);
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14, left: 48),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.raised,
          borderRadius: BorderRadius.circular(AppRadius.xl),
          border: Border.all(color: AppColors.border),
        ),
        child: content,
      ),
    );
  }
}

/// "The AI is working on it": a spinner and a line.
class ChatPending extends StatelessWidget {
  const ChatPending(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Row(
      children: [
        const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.teal)),
        const SizedBox(width: 10),
        Flexible(child: Text(label, style: AppText.meta)),
      ],
    ),
  );
}

/// The message box: text field and a send (or stop) button.
class ChatComposer extends StatelessWidget {
  const ChatComposer({super.key, required this.controller, required this.onSend, this.hint, this.enabled = true, this.maxLength = 500, this.onStop});

  final TextEditingController controller;
  final VoidCallback onSend;
  final String? hint;
  final bool enabled;
  final int maxLength;

  /// Set while a reply streams in: the button stops it.
  final VoidCallback? onStop;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: AppTextField(
            controller: controller,
            hint: hint,
            enabled: enabled,
            maxLength: maxLength,
            minLines: 1,
            maxLines: 4,
            dense: true,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => onSend(),
          ),
        ),
        const SizedBox(width: 8),
        ListenableBuilder(
          listenable: controller,
          builder: (_, _) => onStop != null
              ? AppIconButton(icon: LucideIcons.square, label: 'Dừng trả lời', tone: IconTone.primary, size: 44, onPressed: onStop)
              : AppIconButton(
                  icon: LucideIcons.arrowUp,
                  label: 'Gửi',
                  tone: IconTone.primary,
                  size: 44,
                  onPressed: enabled && controller.text.trim().isNotEmpty ? onSend : null,
                ),
        ),
      ],
    );
  }
}
