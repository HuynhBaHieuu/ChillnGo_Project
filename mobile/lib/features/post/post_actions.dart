/// Like and save, shown at once everywhere the journey appears (web:
/// useToggleLike / useToggleBookmark with optimistic cache updates).
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/post_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/sheets.dart';

/// Sends a signed-out user to sign in, returning to the current page. True when signed in.
bool requireSignIn(BuildContext context, WidgetRef ref) {
  if (ref.read(sessionProvider).signedIn) return true;
  final here = GoRouter.of(context).state.uri.toString();
  context.push('/login?next=${Uri.encodeComponent(here)}');
  return false;
}

Future<void> toggleLike(BuildContext context, WidgetRef ref, TripPost post) async {
  if (!requireSignIn(context, ref)) return;
  final viewerId = ref.read(viewerIdProvider)!;
  final overlays = ref.read(postOverlaysProvider.notifier);
  final before = postCounts(post, ref.read(postOverlaysProvider)[post.id]);
  final liked = !before.liked;
  HapticFeedback.lightImpact();
  overlays.patch(post.id, PostOverlay(liked: liked, likeCount: before.likeCount + (liked ? 1 : -1)));
  try {
    final result = await PostService.toggleLike(post.id, viewerId);
    overlays.patch(post.id, PostOverlay(liked: result.likedByMe, likeCount: result.likeCount));
  } catch (error) {
    overlays.patch(post.id, PostOverlay(liked: before.liked, likeCount: before.likeCount));
    if (context.mounted) toast(context, errorMessage(error), error: true);
  }
}

Future<void> toggleSave(BuildContext context, WidgetRef ref, TripPost post) async {
  if (!requireSignIn(context, ref)) return;
  final viewerId = ref.read(viewerIdProvider)!;
  final overlays = ref.read(postOverlaysProvider.notifier);
  final before = postCounts(post, ref.read(postOverlaysProvider)[post.id]);
  final saved = !before.saved;
  HapticFeedback.lightImpact();
  overlays.patch(post.id, PostOverlay(saved: saved, saveCount: before.saveCount + (saved ? 1 : -1)));
  try {
    final result = await PostService.toggleBookmark(post.id, viewerId);
    overlays.patch(post.id, PostOverlay(saved: result.bookmarkedByMe, saveCount: result.bookmarkCount));
    ref.invalidate(bookmarksProvider);
    if (context.mounted) toast(context, result.bookmarkedByMe ? 'Đã lưu hành trình.' : 'Đã bỏ lưu hành trình.');
  } catch (error) {
    overlays.patch(post.id, PostOverlay(saved: before.saved, saveCount: before.saveCount));
    if (context.mounted) toast(context, errorMessage(error), error: true);
  }
}
