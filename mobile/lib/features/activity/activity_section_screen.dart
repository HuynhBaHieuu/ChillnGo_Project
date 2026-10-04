import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../data/server_posts.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../common/not_found_screen.dart';
import 'activity_common.dart';
import 'sections/deleted_saved_sections.dart';
import 'sections/history_sections.dart';
import 'sections/interactions_section.dart';
import 'sections/journeys_section.dart';
import 'sections/media_section.dart';
import '../../ui/navigation.dart';

/// /activity/:section: one part of Your Activity (?tab= opens a tab, as on the web).
class ActivitySectionScreen extends ConsumerWidget {
  const ActivitySectionScreen({super.key, required this.section, this.initialTab});

  final String section;
  final String? initialTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = activitySections.where((s) => s.slug == section).firstOrNull;
    if (meta == null) return const NotFoundScreen();

    final body = switch (section) {
      'interactions' => InteractionsSection(initialTab: initialTab),
      'media' => MediaSection(initialTab: initialTab),
      'journeys' => const JourneysSection(),
      'search-history' => const SearchHistorySection(),
      'account-history' => const AccountHistorySection(),
      'recently-deleted' => RecentlyDeletedSection(initialTab: initialTab),
      _ => SavedSection(initialTab: initialTab),
    };

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: Text(meta.label)),
      body: RefreshIndicator(
        onRefresh: () async {
          invalidateServerPosts();
          invalidateActivity(ref);
          ref.invalidate(bookmarksProvider(ref.read(viewerIdProvider) ?? ''));
          await Future<void>.delayed(const Duration(milliseconds: 400));
        },
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: ListView(padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 40), children: [body]),
      ),
    );
  }
}
