import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../data/api.dart';
import '../../data/services/social_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/sheets.dart';
import '../post/post_actions.dart';

/// Follow or unfollow, flipping the moment it is pressed (web: FollowButton).
class FollowButton extends ConsumerStatefulWidget {
  const FollowButton({super.key, required this.userId, this.size = ButtonSize.md});

  final String userId;
  final ButtonSize size;

  @override
  ConsumerState<FollowButton> createState() => _FollowButtonState();
}

class _FollowButtonState extends ConsumerState<FollowButton> {
  bool _pending = false;

  Future<void> _toggle(bool current) async {
    if (!requireSignIn(context, ref)) return;
    final viewerId = ref.read(viewerIdProvider)!;
    final overlays = ref.read(followOverlaysProvider.notifier);
    HapticFeedback.selectionClick();
    overlays.set(widget.userId, !current);
    setState(() => _pending = true);
    try {
      final result = await SocialService.toggleFollow(widget.userId, viewerId);
      overlays.set(widget.userId, result.following, result.followerCount);
      // Lists that depend on who you follow (Newsfeed, "Đang theo dõi") reload.
      ref.invalidate(followingIdsProvider);
      ref.invalidate(isFollowingProvider(widget.userId));
    } catch (error) {
      overlays.set(widget.userId, current);
      if (mounted) toast(context, errorMessage(error), error: true);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewerId = ref.watch(viewerIdProvider);
    if (viewerId == widget.userId) return const SizedBox.shrink();
    final overlay = ref.watch(followOverlaysProvider.select((m) => m[widget.userId]));
    final server = viewerId == null ? null : ref.watch(isFollowingProvider(widget.userId));
    final following = overlay?.following ?? server?.value ?? false;
    final loading = viewerId != null && overlay == null && (server?.isLoading ?? false) && !(server?.hasValue ?? false);

    return AppButton(
      label: following ? 'Đang theo dõi' : 'Theo dõi',
      icon: following ? LucideIcons.check : LucideIcons.userPlus,
      variant: following ? ButtonVariant.secondary : ButtonVariant.primary,
      size: widget.size,
      loading: loading,
      onPressed: _pending ? null : () => _toggle(following),
    );
  }
}
