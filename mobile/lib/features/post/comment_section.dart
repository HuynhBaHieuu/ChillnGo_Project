import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/post_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';

/// Comments under a journey, one level of replies (web: CommentSection).
class CommentSection extends ConsumerStatefulWidget {
  const CommentSection({super.key, required this.postId, required this.commentCount});

  final String postId;
  final int commentCount;

  @override
  ConsumerState<CommentSection> createState() => _CommentSectionState();
}

class _CommentSectionState extends ConsumerState<CommentSection> {
  final _draft = TextEditingController();
  final _replyDraft = TextEditingController();
  String? _replyTo;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _draft.dispose();
    _replyDraft.dispose();
    super.dispose();
  }

  Future<void> _send(String? parentId) async {
    final controller = parentId == null ? _draft : _replyDraft;
    final user = ref.read(sessionProvider).user;
    if (user == null || controller.text.trim().isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await PostService.addComment(postId: widget.postId, authorId: user.id, parentId: parentId, content: controller.text);
      controller.clear();
      final overlay = ref.read(postOverlaysProvider)[widget.postId];
      ref.read(postOverlaysProvider.notifier).patch(widget.postId, PostOverlay(commentCount: (overlay?.commentCount ?? widget.commentCount) + 1));
      ref.invalidate(commentsProvider(widget.postId));
      if (mounted) setState(() => _replyTo = null);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final threads = ref.watch(commentsProvider(widget.postId));
    final user = ref.watch(sessionProvider.select((s) => s.user));
    final count = ref.watch(postOverlaysProvider.select((m) => m[widget.postId]?.commentCount)) ?? widget.commentCount;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text.rich(
          TextSpan(
            style: AppText.h2,
            children: [
              const TextSpan(text: 'Bình luận '),
              TextSpan(
                text: formatCount(count),
                style: AppText.h2.copyWith(color: AppColors.meta),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (user != null)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppAvatar(url: user.avatarUrl, name: user.displayName, size: 36),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          AppTextField(
                            controller: _draft,
                            hint: 'Viết bình luận…',
                            maxLines: 5,
                            minLines: 1,
                            maxLength: 2000,
                            onChanged: (_) => setState(() {}),
                            textCapitalization: TextCapitalization.sentences,
                          ),
                          const SizedBox(height: 8),
                          AppButton(
                            label: 'Gửi bình luận',
                            icon: LucideIcons.send,
                            size: ButtonSize.sm,
                            loading: _sending && _replyTo == null,
                            onPressed: _draft.text.trim().isEmpty ? null : () => _send(null),
                          ),
                        ],
                      ),
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    TextLink(label: 'Đăng nhập', onPressed: () => context.push('/login?next=${Uri.encodeComponent('/posts/${widget.postId}')}')),
                    Text(' để tham gia bình luận.', style: AppText.meta),
                  ],
                ),
              if (_error != null) ...[const SizedBox(height: 8), ErrorText(_error)],
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (threads.isLoading && !threads.hasValue)
          for (var i = 0; i < 2; i++)
            const Padding(
              padding: EdgeInsets.only(bottom: 14),
              child: Row(
                children: [
                  Skeleton(width: 36, height: 36, radius: 18),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [Skeleton(width: 140, height: 12), SizedBox(height: 8), Skeleton(height: 14)],
                    ),
                  ),
                ],
              ),
            ),
        if (threads.hasError && !threads.hasValue)
          ErrorPanel(error: threads.error, onRetry: () => ref.invalidate(commentsProvider(widget.postId)), title: 'Không tải được bình luận'),
        if (threads.value?.isEmpty ?? false)
          Row(
            children: [
              const Icon(LucideIcons.messageCircle, size: 16, color: AppColors.meta),
              const SizedBox(width: 8),
              Expanded(child: Text('Chưa có bình luận nào. Hãy là người đầu tiên.', style: AppText.meta)),
            ],
          ),
        for (final thread in threads.value ?? const <CommentThread>[])
          _CommentItem(
            thread: thread,
            canReply: user != null,
            replying: _replyTo == thread.comment.id,
            replyDraft: _replyDraft,
            sending: _sending && _replyTo == thread.comment.id,
            onToggleReply: () => setState(() {
              _replyTo = _replyTo == thread.comment.id ? null : thread.comment.id;
              _replyDraft.clear();
            }),
            onSubmitReply: () => _send(thread.comment.id),
            onDraftChanged: () => setState(() {}),
          ),
      ],
    );
  }
}

class _CommentItem extends StatelessWidget {
  const _CommentItem({
    required this.thread,
    required this.canReply,
    this.replying = false,
    this.replyDraft,
    this.sending = false,
    this.onToggleReply,
    this.onSubmitReply,
    this.onDraftChanged,
    this.nested = false,
  });

  final CommentThread thread;
  final bool canReply;
  final bool replying;
  final TextEditingController? replyDraft;
  final bool sending;
  final VoidCallback? onToggleReply;
  final VoidCallback? onSubmitReply;
  final VoidCallback? onDraftChanged;
  final bool nested;

  @override
  Widget build(BuildContext context) {
    final author = thread.author;
    void openAuthor() {
      if (author.username != 'deleted') context.push('/users/${author.id}');
    }

    return Padding(
      padding: EdgeInsets.only(bottom: 14, left: nested ? 46 : 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: openAuthor,
                child: AppAvatar(url: author.avatarUrl, name: author.displayName, size: nested ? 28 : 36),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: author.displayName,
                            style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                          ),
                          TextSpan(text: '  ${relativeTime(thread.comment.createdAt)}', style: AppText.meta),
                        ],
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(thread.comment.content, style: AppText.bodySmall),
                    if (!nested && canReply)
                      GestureDetector(
                        onTap: onToggleReply,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(replying ? 'Huỷ' : 'Trả lời', style: AppText.meta.copyWith(fontWeight: FontWeight.w600)),
                        ),
                      ),
                    if (replying && replyDraft != null) ...[
                      const SizedBox(height: 8),
                      AppTextField(
                        controller: replyDraft,
                        hint: 'Trả lời ${author.displayName}…',
                        maxLines: 4,
                        minLines: 1,
                        maxLength: 2000,
                        autofocus: true,
                        onChanged: (_) => onDraftChanged?.call(),
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerRight,
                        child: AppButton(
                          label: 'Gửi trả lời',
                          size: ButtonSize.sm,
                          icon: LucideIcons.send,
                          loading: sending,
                          onPressed: replyDraft!.text.trim().isEmpty ? null : onSubmitReply,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (thread.replies.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final reply in thread.replies) _CommentItem(thread: reply, canReply: false, nested: true),
          ],
        ],
      ),
    );
  }
}
