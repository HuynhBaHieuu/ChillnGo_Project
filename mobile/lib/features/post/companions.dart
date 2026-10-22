import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/post_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';

/// As server/src/lib/companions.ts allows.
const _maxCompanions = 10;

/// "Đi cùng": the friends who came along (web: CompanionsRow). The author also
/// sees pending invites and can take anyone off; a companion can leave.
class CompanionsRow extends ConsumerWidget {
  const CompanionsRow({super.key, required this.post, required this.viewerId});

  final TripPost post;
  final String? viewerId;

  Future<void> _remove(BuildContext context, WidgetRef ref, TripCompanion companion) async {
    final leaving = companion.userId == viewerId;
    final removed = await confirmAction(
      context,
      title: leaving ? 'Rời hành trình?' : 'Gỡ ${companion.user?.displayName ?? 'người này'}?',
      description: leaving ? 'Hành trình sẽ không còn hiện trên trang cá nhân của bạn.' : 'Họ sẽ không còn hiện là người đi cùng.',
      confirmLabel: leaving ? 'Rời' : 'Gỡ',
      destructive: true,
      onConfirm: () => PostService.removeCompanion(post.id, companion.userId),
    );
    if (removed) invalidateJourneys(ref);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAuthor = viewerId == post.authorId;
    // An invitee's own pending invite is the banner's to show.
    final shown = (post.companions ?? const <TripCompanion>[]).where((c) => c.status == 'accepted' || isAuthor).toList();
    if (shown.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('Đi cùng', style: AppText.meta),
          for (final c in shown)
            Opacity(
              opacity: c.status == 'pending' ? 0.6 : 1,
              child: Container(
                padding: const EdgeInsets.fromLTRB(4, 4, 4, 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: () => context.push('/users/${c.userId}'),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AppAvatar(url: c.user?.avatarUrl, name: c.user?.displayName ?? '?', size: 24),
                          const SizedBox(width: 6),
                          Text(c.user?.displayName ?? '', style: AppText.meta),
                          if (c.status == 'pending') Text(' · đang chờ', style: AppText.meta),
                        ],
                      ),
                    ),
                    if (isAuthor || c.userId == viewerId)
                      InkWell(
                        onTap: () => _remove(context, ref, c),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Icon(LucideIcons.x, size: 14, semanticLabel: c.userId == viewerId ? 'Rời hành trình' : 'Gỡ'),
                        ),
                      )
                    else
                      const SizedBox(width: 6),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Shown to someone the author invited, until they answer (web: InviteBanner).
class InviteBanner extends ConsumerStatefulWidget {
  const InviteBanner({super.key, required this.post, required this.viewerId});

  final TripPost post;
  final String? viewerId;

  @override
  ConsumerState<InviteBanner> createState() => _InviteBannerState();
}

class _InviteBannerState extends ConsumerState<InviteBanner> {
  bool _pending = false;

  Future<void> _answer(bool accept) async {
    setState(() => _pending = true);
    try {
      await PostService.respondToInvite(widget.post.id, accept);
      invalidateJourneys(ref);
      if (!mounted) return;
      toast(context, accept ? 'Bạn đã nhận lời đi cùng.' : 'Đã từ chối lời mời.');
      // Declining a draft takes it out of your sight.
      if (!accept && widget.post.status != 'published') context.go('/feed');
    } catch (error) {
      if (mounted) toast(context, errorMessage(error), error: true);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final invited = widget.post.companions?.any((c) => c.userId == widget.viewerId && c.status == 'pending') ?? false;
    if (!invited) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${widget.post.author?.displayName ?? 'Tác giả'} mời bạn đi cùng hành trình này.', style: AppText.body),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(label: 'Từ chối', variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: _pending ? null : () => _answer(false)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(label: 'Đi cùng', size: ButtonSize.sm, loading: _pending, onPressed: () => _answer(true)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Pick friends to invite along (web: InviteFriendsDialog).
Future<void> showInviteSheet(BuildContext context, TripPost post) {
  final left = _maxCompanions - (post.companions?.length ?? 0);
  return showAppSheet<void>(
    context,
    title: 'Mời bạn đi cùng',
    description: 'Bạn bè là những người bạn theo dõi và cũng theo dõi bạn. Còn mời được $left người.',
    tall: true,
    builder: (_) => _InviteForm(post: post, left: left, parentContext: context),
  );
}

class _InviteForm extends ConsumerStatefulWidget {
  const _InviteForm({required this.post, required this.left, required this.parentContext});

  final TripPost post;
  final int left;
  final BuildContext parentContext;

  @override
  ConsumerState<_InviteForm> createState() => _InviteFormState();
}

class _InviteFormState extends ConsumerState<_InviteForm> {
  final _query = TextEditingController();
  final _picked = <String>{};
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _invite() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await PostService.inviteCompanions(widget.post.id, _picked.toList());
      invalidateJourneys(ref);
      if (!mounted) return;
      Navigator.of(context).pop();
      final parent = widget.parentContext;
      if (parent.mounted) toast(parent, 'Đã gửi lời mời.');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friends = ref.watch(friendsProvider);
    final taken = {for (final c in widget.post.companions ?? const <TripCompanion>[]) c.userId};
    final needle = _query.text.trim().toLowerCase();
    final candidates = (friends.value ?? const <User>[])
        .where((f) => !taken.contains(f.id))
        .where((f) => needle.isEmpty || f.displayName.toLowerCase().contains(needle) || f.username.toLowerCase().contains(needle))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(controller: _query, hint: 'Tìm bạn bè', icon: LucideIcons.search, onChanged: (_) => setState(() {})),
        const SizedBox(height: 12),
        if (friends.isLoading)
          const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
        else if (friends.hasError)
          ErrorText(errorMessage(friends.error))
        else if (candidates.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(needle.isEmpty ? 'Chưa có bạn bè nào để mời.' : 'Không tìm thấy ai.', textAlign: TextAlign.center, style: AppText.meta),
          ),
        for (final friend in candidates)
          InkWell(
            borderRadius: BorderRadius.circular(AppRadius.md),
            onTap: () => setState(() => _picked.contains(friend.id) ? _picked.remove(friend.id) : _picked.add(friend.id)),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Checkbox(
                    value: _picked.contains(friend.id),
                    onChanged: (v) => setState(() => v == true ? _picked.add(friend.id) : _picked.remove(friend.id)),
                  ),
                  AppAvatar(url: friend.avatarUrl, name: friend.displayName, size: 36),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(friend.displayName, style: AppText.label, overflow: TextOverflow.ellipsis),
                        Text('@${friend.username}', style: AppText.meta, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (_picked.length > widget.left) ...[const SizedBox(height: 10), ErrorText('Chỉ còn mời được ${widget.left} người.')],
        if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
        const SizedBox(height: 18),
        AppButton(
          label: _picked.isEmpty ? 'Gửi lời mời' : 'Gửi lời mời (${_picked.length})',
          icon: LucideIcons.userPlus,
          loading: _pending,
          onPressed: _picked.isEmpty || _picked.length > widget.left ? null : _invite,
        ),
      ],
    );
  }
}
