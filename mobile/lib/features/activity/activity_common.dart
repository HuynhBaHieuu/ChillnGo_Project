/// Data and shared pieces for Your Activity (web: features/activity). Always
/// the signed-in user's own.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/activity_service.dart';
import '../../data/services/checkin_service.dart';
import '../../data/services/post_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/surfaces.dart';

String _me(Ref ref) => ref.watch(viewerIdProvider) ?? '';

final likedJourneysProvider = FutureProvider.autoDispose<List<TripPost>>((ref) => ActivityService.listLikedJourneys(_me(ref)));

final journeyCommentsProvider = FutureProvider.autoDispose<List<JourneyCommentActivity>>((ref) => ActivityService.listJourneyComments(_me(ref)));

final liveCommentsActivityProvider = FutureProvider.autoDispose<List<LiveCommentActivity>>((ref) {
  _me(ref);
  return ActivityService.listLiveComments();
});

final myCheckInsProvider = FutureProvider.autoDispose<List<CheckIn>>((ref) => CheckInService.list([_me(ref)]));

final myPublishedJourneysProvider = FutureProvider.autoDispose<List<TripPost>>((ref) {
  _me(ref);
  return PostService.listMyPublishedJourneys();
});

final draftJourneysProvider = FutureProvider.autoDispose<List<TripPost>>((ref) {
  _me(ref);
  return PostService.listDraftJourneys();
});

final searchHistoryProvider = FutureProvider.autoDispose<List<SearchEntry>>((ref) {
  _me(ref);
  return ActivityService.listSearchHistory();
});

final accountHistoryProvider = FutureProvider.autoDispose<List<AccountEvent>>((ref) {
  _me(ref);
  return ActivityService.listAccountHistory();
});

final deletedJourneysProvider = FutureProvider.autoDispose<List<TripPost>>((ref) {
  _me(ref);
  return PostService.listDeletedJourneys();
});

final deletedCheckInsProvider = FutureProvider.autoDispose<List<CheckIn>>((ref) {
  _me(ref);
  return CheckInService.listDeleted();
});

/// After anything that changes the user's content: every activity list and
/// every place a journey or check-in shows reloads.
void invalidateActivity(WidgetRef ref) {
  ref.invalidate(likedJourneysProvider);
  ref.invalidate(journeyCommentsProvider);
  ref.invalidate(liveCommentsActivityProvider);
  ref.invalidate(myCheckInsProvider);
  ref.invalidate(myPublishedJourneysProvider);
  ref.invalidate(draftJourneysProvider);
  ref.invalidate(searchHistoryProvider);
  ref.invalidate(accountHistoryProvider);
  ref.invalidate(deletedJourneysProvider);
  ref.invalidate(deletedCheckInsProvider);
  ref.invalidate(myJourneysProvider);
  ref.invalidate(checkinsProvider);
  invalidateJourneys(ref);
}

/// The sections of Your Activity, in the web's order (web: ActivityPage).
const activitySections = [
  (slug: 'interactions', label: 'Lượt tương tác', hint: 'Lượt thích, bình luận, chia sẻ lại, phản hồi tin và đánh giá', icon: LucideIcons.heart),
  (slug: 'media', label: 'Ảnh và video', hint: 'Bài viết, video, tin và phát trực tiếp', icon: LucideIcons.images),
  (slug: 'journeys', label: 'Hành trình', hint: 'Hành trình nháp chưa đăng', icon: LucideIcons.map),
  (slug: 'search-history', label: 'Lịch sử tìm kiếm', hint: 'Những gì bạn đã tìm', icon: LucideIcons.search),
  (slug: 'account-history', label: 'Lịch sử tài khoản', hint: 'Các thay đổi trên tài khoản', icon: LucideIcons.clock),
  (slug: 'recently-deleted', label: 'Đã xoá gần đây', hint: 'Khôi phục trong 30 ngày', icon: LucideIcons.trash),
  (slug: 'saved', label: 'Đã lưu', hint: 'Hành trình bạn đã lưu', icon: LucideIcons.bookmark),
];

class SectionIntro extends StatelessWidget {
  const SectionIntro({super.key, required this.title, required this.description, this.action});

  final String title;
  final String description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: AppText.h1),
        const SizedBox(height: 8),
        Text(description, style: AppText.meta),
        if (action != null) ...[const SizedBox(height: 12), Align(alignment: Alignment.centerLeft, child: action)],
      ],
    );
  }
}

class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.rows = 4, this.media = false});

  final int rows;
  final bool media;

  @override
  Widget build(BuildContext context) {
    if (media) {
      return LayoutBuilder(
        builder: (context, constraints) {
          final w = (constraints.maxWidth - 12) / 2;
          return Wrap(spacing: 12, runSpacing: 12, children: [for (var i = 0; i < rows; i++) Skeleton(width: w, height: 160)]);
        },
      );
    }
    return Column(
      children: [
        for (var i = 0; i < rows; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0x99111111), borderRadius: BorderRadius.circular(14)),
            child: const Row(
              children: [
                Skeleton(width: 56, height: 56, radius: 10),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FractionallySizedBox(widthFactor: 0.7, child: Skeleton(height: 14)),
                      SizedBox(height: 8),
                      FractionallySizedBox(widthFactor: 0.4, child: Skeleton(height: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A part of Your Activity whose feature ChillnGo does not have yet: said plainly.
class NotAvailable extends StatelessWidget {
  const NotAvailable({super.key, required this.icon, required this.feature, required this.description});

  final IconData icon;
  final String feature;
  final String description;

  @override
  Widget build(BuildContext context) => EmptyState(icon: icon, title: 'ChillnGo chưa có $feature', description: description);
}

/// A small square (or round) picture for a list row.
class ActivityThumb extends StatelessWidget {
  const ActivityThumb({super.key, this.url, this.size = 56, this.round = false, this.child, this.blur = false});

  final String? url;
  final double size;
  final bool round;
  final Widget? child;
  final bool blur;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(round ? size / 2 : 10),
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: AppColors.well, child: url == null || url!.isEmpty ? null : NetImage(url)),
            ?child,
          ],
        ),
      ),
    );
  }
}

/// One row in an activity list.
class ActivityRow extends StatelessWidget {
  const ActivityRow({super.key, required this.children, this.onTap});

  final List<Widget> children;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(children: children),
      ),
    );
  }
}
