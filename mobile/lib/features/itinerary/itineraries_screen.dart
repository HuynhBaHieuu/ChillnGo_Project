import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/photos.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/server_posts.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import '../../ui/navigation.dart';

const itineraryStatusLabels = {'planning': 'Đang lên kế hoạch', 'confirmed': 'Đã chốt', 'completed': 'Đã đi'};

/// Hành trình của tôi (web: ItinerariesPage).
class ItinerariesScreen extends ConsumerStatefulWidget {
  const ItinerariesScreen({super.key, this.initialTab});

  final String? initialTab;

  @override
  ConsumerState<ItinerariesScreen> createState() => _ItinerariesScreenState();
}

class _ItinerariesScreenState extends ConsumerState<ItinerariesScreen> {
  late String _tab = widget.initialTab == 'cloned' ? 'cloned' : 'mine';

  @override
  Widget build(BuildContext context) {
    final journeys = ref.watch(myJourneysProvider);
    final itineraries = ref.watch(myItinerariesProvider);

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Hành trình của tôi')),
      body: RefreshIndicator(
        onRefresh: () async {
          invalidateServerPosts();
          ref.invalidate(myJourneysProvider);
          ref.invalidate(myItinerariesProvider);
          await ref.read(myJourneysProvider.future).catchError((_) => <TripPost>[]);
        },
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 40),
          children: [
            Text(
              'Hành trình bạn tự đăng và những lịch trình bạn đã sao chép. Sửa thứ tự ngày, ghép thêm ngày từ bài viết khác, và theo dõi tổng chi phí theo thời gian thực.',
              style: AppText.meta,
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                AppButton(label: 'Đăng hành trình', icon: LucideIcons.plus, size: ButtonSize.sm, onPressed: () => context.push('/posts/new')),
                AppButton(
                  label: 'Tìm hành trình mới',
                  icon: LucideIcons.compass,
                  variant: ButtonVariant.outline,
                  size: ButtonSize.sm,
                  onPressed: () => context.go('/discover'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SegmentTabs<String>(
              items: const [(value: 'mine', label: 'Tôi đăng', count: null), (value: 'cloned', label: 'Đã sao chép', count: null)],
              value: _tab,
              onChanged: (t) => setState(() => _tab = t),
            ),
            const SizedBox(height: 16),
            if (_tab == 'mine')
              ...switch (journeys) {
                AsyncValue(:final value?) when value.isEmpty => [
                  EmptyState(
                    icon: LucideIcons.squarePen,
                    title: 'Bạn chưa đăng hành trình nào',
                    description: 'Kể lại chuyến đi của bạn theo từng ngày, từng điểm dừng và chi phí thật. Người khác có thể sao chép về làm lịch trình của họ.',
                    action: AppButton(label: 'Đăng hành trình đầu tiên', icon: LucideIcons.plus, onPressed: () => context.push('/posts/new')),
                  ),
                ],
                AsyncValue(:final value?) => [
                  for (final journey in value) ...[_MyJourneyCard(journey: journey), const SizedBox(height: 14)],
                ],
                AsyncValue(:final error?) => [ErrorPanel(error: error, onRetry: () => ref.invalidate(myJourneysProvider))],
                _ => [const Skeleton(height: 220, radius: AppRadius.lg)],
              }
            else
              ...switch (itineraries) {
                AsyncValue(:final value?) when value.isEmpty => [
                  EmptyState(
                    icon: LucideIcons.map,
                    title: 'Chưa có lịch trình nào',
                    description: 'Khi bạn thấy một hành trình hợp ý, bấm “Dùng làm lịch trình” để sao chép nó về đây rồi sửa theo cách bạn muốn đi.',
                    action: AppButton(label: 'Khám phá hành trình', onPressed: () => context.go('/discover')),
                  ),
                ],
                AsyncValue(:final value?) => [
                  for (final itinerary in value) ...[_ItineraryCard(itinerary: itinerary), const SizedBox(height: 14)],
                ],
                AsyncValue(:final error?) => [ErrorPanel(error: error, onRetry: () => ref.invalidate(myItinerariesProvider))],
                _ => [const Skeleton(height: 220, radius: AppRadius.lg)],
              },
          ],
        ),
      ),
    );
  }
}

class _ItineraryCard extends StatelessWidget {
  const _ItineraryCard({required this.itinerary});

  final ClonedItinerary itinerary;

  @override
  Widget build(BuildContext context) {
    Widget row(String label, Widget value) => Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppText.meta)),
          value,
        ],
      ),
    );
    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/itineraries/${itinerary.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: NetImage(itinerary.coverUrl, placeholderColor: AppColors.canopy),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    AppBadge(itineraryStatusLabels[itinerary.status] ?? itinerary.status, tone: BadgeTone.outline),
                    const Spacer(),
                    Text(tripLengthLabel(itinerary.days.length), style: AppText.meta),
                  ],
                ),
                const SizedBox(height: 8),
                Text(itinerary.title, style: AppText.h3),
                if (itinerary.note.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(itinerary.note, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.meta),
                ],
                row('Khởi hành', Text(formatShortDate(itinerary.startDate), style: AppText.bodySmall)),
                row(
                  'Tổng chi phí',
                  Text(
                    formatVnd(itinerary.totalEstCost),
                    style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Cập nhật ${relativeTime(itinerary.updatedAt)}${itinerary.sourcePostIds.length > 1 ? ' · ghép từ ${itinerary.sourcePostIds.length} bài' : ''}',
                  style: AppText.meta,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MyJourneyCard extends StatelessWidget {
  const _MyJourneyCard({required this.journey});

  final TripPost journey;

  @override
  Widget build(BuildContext context) {
    final draft = journey.status == 'draft';
    final title = journey.title.trim().isEmpty ? 'Hành trình chưa đặt tên' : journey.title.trim();
    final cover = journey.coverUrl.isNotEmpty ? journey.coverUrl : autoCover(journey.title);
    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push(draft ? '/posts/${journey.id}/edit' : '/posts/${journey.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(cover, placeholderColor: AppColors.canopy),
                Positioned(
                  left: 10,
                  top: 10,
                  child: AppBadge(draft ? 'Nháp' : 'Đã đăng', tone: draft ? BadgeTone.overlay : BadgeTone.primary, uppercase: true),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Text(tripLengthLabel(journey.days.length), style: AppText.meta),
                    const Spacer(),
                    Text(formatVnd(journey.totalEstCost), style: AppText.meta),
                  ],
                ),
                const SizedBox(height: 6),
                Text(title, style: AppText.h3),
                if (journey.summary.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(journey.summary, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.meta),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: Text('${draft ? 'Sửa lần cuối' : 'Cập nhật'} ${relativeTime(journey.updatedAt)}', style: AppText.meta)),
                    Text(
                      draft ? 'Viết tiếp' : 'Xem bài',
                      style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
