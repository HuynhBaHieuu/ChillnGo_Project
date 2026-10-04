import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/social_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/surfaces.dart';
import '../../ui/navigation.dart';

const _icons = {
  'like': LucideIcons.heart,
  'comment': LucideIcons.messageCircle,
  'follow': LucideIcons.userPlus,
  'clone': LucideIcons.copy,
  'bookmark': LucideIcons.bookmark,
  'system': LucideIcons.bell,
  'live': LucideIcons.radio,
};

/// Where a notification leads: the stream, the post, or the person who followed you.
String? _targetOf(AppNotification n) {
  if (n.livestreamId != null) return '/live/${n.livestreamId}';
  if (n.postId != null) return '/posts/${n.postId}';
  if (n.type == 'follow' && n.actorId != null) return '/users/${n.actorId}';
  return null;
}

/// Thông báo (web: NotificationBell's menu, as a screen). Opening it marks everything read.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _marked = false;

  /// Seen once the screen is shown, as opening the web menu marks them read.
  void _markRead(List<AppNotification> list) {
    if (_marked || !list.any((n) => !n.read)) return;
    _marked = true;
    final viewerId = ref.read(viewerIdProvider);
    if (viewerId == null) return;
    SocialService.markAllNotificationsRead(viewerId)
        .then((_) {
          if (mounted) ref.invalidate(notificationsProvider);
        })
        .catchError((Object _) {
          _marked = false;
        });
  }

  @override
  Widget build(BuildContext context) {
    final notifications = ref.watch(notificationsProvider);
    final list = notifications.value ?? const <AppNotification>[];
    final unread = list.where((n) => !n.read).length;
    if (notifications.hasValue) WidgetsBinding.instance.addPostFrameCallback((_) => _markRead(list));

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Thông báo')),
      body: notifications.isLoading && !notifications.hasValue
          ? ListView(
              padding: const EdgeInsets.all(kGutter),
              children: [
                for (var i = 0; i < 4; i++)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: Row(
                      children: [
                        Skeleton(width: 40, height: 40, radius: 20),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [Skeleton(height: 14), SizedBox(height: 6), Skeleton(width: 90, height: 12)],
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            )
          : notifications.hasError && !notifications.hasValue
          ? Padding(
              padding: const EdgeInsets.all(kGutter),
              child: ErrorPanel(error: notifications.error, onRetry: () => ref.invalidate(notificationsProvider)),
            )
          : RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(notificationsProvider);
                await ref.read(notificationsProvider.future).catchError((_) => <AppNotification>[]);
              },
              color: AppColors.primary,
              backgroundColor: AppColors.surface,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 40),
                children: [
                  if (unread > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text('$unread thông báo mới', style: AppText.meta),
                    ),
                  if (list.isEmpty)
                    const EmptyState(
                      icon: LucideIcons.bell,
                      title: 'Chưa có thông báo nào',
                      description: 'Khi có người theo dõi bạn hoặc người bạn theo dõi phát trực tiếp, thông báo sẽ hiện ở đây.',
                    ),
                  for (final n in list) _NotificationRow(notification: n),
                ],
              ),
            ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.notification});

  final AppNotification notification;

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final icon = _icons[n.type] ?? LucideIcons.bell;
    final target = _targetOf(n);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: n.read ? Colors.transparent : const Color(0x0DFFFFFF),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: target == null ? null : () => context.push(target),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    n.actor != null
                        ? AppAvatar(url: n.actor!.avatarUrl, name: n.actor!.displayName, size: 44)
                        : Container(
                            width: 44,
                            height: 44,
                            decoration: const BoxDecoration(color: AppColors.raised, shape: BoxShape.circle),
                            child: Icon(icon, size: 18, color: AppColors.cream),
                          ),
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          color: n.type == 'live' ? AppColors.live : AppColors.moss,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.ground, width: 2),
                        ),
                        child: Icon(icon, size: 11, color: AppColors.white),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            if (n.actor != null)
                              TextSpan(
                                text: '${n.actor!.displayName} ',
                                style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                              ),
                            TextSpan(text: n.message, style: AppText.bodySmall),
                          ],
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(relativeTime(n.createdAt), style: AppText.meta),
                    ],
                  ),
                ),
                if (!n.read)
                  Container(
                    width: 9,
                    height: 9,
                    decoration: const BoxDecoration(color: AppColors.social, shape: BoxShape.circle),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
