import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/activity_service.dart';
import '../../state/session.dart';
import '../../ui/surfaces.dart';
import 'interests.dart';

const _regionTabs = [
  (value: 'all', label: 'Tất cả', icon: LucideIcons.globe, heading: 'Bạn muốn đi đâu?', placeholder: 'Điểm đến, hành trình, thẻ…'),
  (value: 'north', label: 'Miền Bắc', icon: LucideIcons.mountain, heading: 'Lên núi săn mây', placeholder: 'Hà Giang, Sa Pa, Ninh Bình…'),
  (value: 'central', label: 'Miền Trung', icon: LucideIcons.landmark, heading: 'Về miền di sản', placeholder: 'Huế, Hội An, Đà Lạt…'),
  (value: 'south', label: 'Miền Nam', icon: LucideIcons.treePalm, heading: 'Xuôi về phương Nam', placeholder: 'Sài Gòn, Cần Thơ, Vũng Tàu…'),
  (value: 'islands', label: 'Hải đảo', icon: LucideIcons.sailboat, heading: 'Ra đảo thôi', placeholder: 'Phú Quốc, Côn Đảo, Cát Bà…'),
  (value: 'overseas', label: 'Nước ngoài', icon: LucideIcons.plane, heading: 'Đi xa hơn một chút', placeholder: 'Bangkok, Seoul, Tokyo…'),
];

/// Recent journey searches of the signed-in user (from Search History).
final _recentSearchesProvider = FutureProvider.autoDispose<List<String>>((ref) async {
  if (ref.watch(viewerIdProvider) == null) return const [];
  final entries = await ActivityService.listSearchHistory();
  return entries.where((e) => e.type == 'journey').map((e) => e.query).toSet().toList();
});

/// "Bạn muốn đi đâu?": the title, region tabs and the search box with live
/// suggestions (web: DiscoverHero).
class SearchHero extends ConsumerStatefulWidget {
  const SearchHero({
    super.key,
    required this.posts,
    required this.query,
    required this.region,
    required this.onSearch,
    required this.onRegionChange,
    required this.onPickTag,
    this.onOpenChange,
  });

  /// Every published trip, most saved first.
  final List<TripPost> posts;
  final String query;
  final String region;
  final ValueChanged<String> onSearch;
  final ValueChanged<String> onRegionChange;
  final ValueChanged<String> onPickTag;

  /// The suggestions are open: the screen hides its other content.
  final ValueChanged<bool>? onOpenChange;

  @override
  ConsumerState<SearchHero> createState() => _SearchHeroState();
}

class _SearchHeroState extends ConsumerState<SearchHero> {
  late final TextEditingController _text = TextEditingController(text: widget.query);
  final FocusNode _focus = FocusNode();
  bool _open = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (_focus.hasFocus && !_open) _setOpen(true);
    });
  }

  @override
  void didUpdateWidget(SearchHero oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.query != widget.query && _text.text != widget.query) _text.text = widget.query;
  }

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _setOpen(bool open) {
    setState(() => _open = open);
    widget.onOpenChange?.call(open);
  }

  void _close() {
    _setOpen(false);
    _focus.unfocus();
  }

  void _submit(String text) {
    final value = text.trim();
    final cut = value.length > 120 ? value.substring(0, 120) : value;
    _text.text = cut;
    widget.onSearch(cut);
    ActivityService.recordSearch('journey', cut);
    _close();
  }

  void _choose(Suggestion option) {
    switch (option) {
      case RecentSuggestion(:final query):
      case AllSuggestion(:final query):
        _submit(query);
      case TripSuggestion(:final post):
      case StopSuggestion(:final post):
        _close();
        context.push('/posts/${post.id}');
      case TagSuggestion(:final tag):
        _text.clear();
        _close();
        widget.onPickTag(tag);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tab = _regionTabs.firstWhere((t) => t.value == widget.region, orElse: () => _regionTabs.first);
    final recent = _open ? (ref.watch(_recentSearchesProvider).value ?? const <String>[]) : const <String>[];
    final groups = _open ? buildSuggestions(widget.posts, _text.text, widget.region, recent) : const <SuggestionGroup>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter),
          child: Text(tab.heading, style: AppText.hero, textAlign: TextAlign.center),
        ),
        const SizedBox(height: 14),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: kGutter),
          child: Row(
            children: [
              for (final t in _regionTabs)
                Semantics(
                  selected: widget.region == t.value,
                  button: true,
                  child: InkWell(
                    onTap: () => widget.onRegionChange(t.value),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: widget.region == t.value ? AppColors.cream : Colors.transparent, width: 2)),
                      ),
                      child: Row(
                        children: [
                          Icon(t.icon, size: 18, color: widget.region == t.value ? AppColors.cream : AppColors.meta),
                          const SizedBox(width: 6),
                          Text(t.label, style: AppText.label.copyWith(color: widget.region == t.value ? AppColors.cream : AppColors.meta)),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: kGutter),
          child: Container(
            height: 52,
            padding: const EdgeInsets.only(left: 16, right: 6),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: _open ? const Color(0x990099FF) : const Color(0x1AFFFFFF)),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.search, size: 20, color: AppColors.meta),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _text,
                    focusNode: _focus,
                    maxLength: 120,
                    onChanged: (_) => setState(() {}),
                    onSubmitted: _submit,
                    textInputAction: TextInputAction.search,
                    autocorrect: false,
                    style: AppText.body.copyWith(fontSize: 16, color: AppColors.body),
                    decoration: InputDecoration(
                      hintText: tab.placeholder,
                      hintStyle: AppText.body.copyWith(fontSize: 16, color: const Color(0xB3999999)),
                      border: InputBorder.none,
                      counterText: '',
                      isCollapsed: true,
                    ),
                  ),
                ),
                if (_open)
                  IconButton(
                    tooltip: 'Đóng gợi ý',
                    icon: const Icon(LucideIcons.x, size: 20, color: AppColors.meta),
                    onPressed: _close,
                  )
                else if (_text.text.isNotEmpty)
                  IconButton(
                    tooltip: 'Xoá tìm kiếm',
                    icon: const Icon(LucideIcons.x, size: 20, color: AppColors.meta),
                    onPressed: () => _submit(''),
                  ),
              ],
            ),
          ),
        ),
        if (_open && groups.isNotEmpty) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kGutter),
            child: AppCard(
              surface: Surface.featured,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final group in groups) ...[
                    if (group.label != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
                        child: Text(group.label!, style: AppText.meta.copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                    for (final option in group.items) _SuggestionRow(option: option, onTap: () => _choose(option)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _SuggestionRow extends StatelessWidget {
  const _SuggestionRow({required this.option, required this.onTap});

  final Suggestion option;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    Widget icon(IconData data) => Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(color: AppColors.well, borderRadius: BorderRadius.circular(10)),
      child: Icon(data, size: 18, color: AppColors.meta),
    );

    final (Widget media, String title, String? subtitle) = switch (option) {
      RecentSuggestion(:final query) => (icon(LucideIcons.clock), query, null),
      TripSuggestion(:final post) => (
        NetImage(post.coverUrl, width: 44, height: 44, radius: 10),
        post.title,
        '${regionLabel(post.region)} · ${tripLengthLabel(post.days.length)}',
      ),
      StopSuggestion(:final post, :final name) => (icon(LucideIcons.mapPin), name, 'Trong hành trình: ${post.title}'),
      TagSuggestion(:final tag, :final count) => (icon(LucideIcons.hash), tag, '$count hành trình'),
      AllSuggestion(:final query) => (icon(LucideIcons.search), 'Xem tất cả kết quả cho “$query”', null),
    };

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(
          children: [
            media,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                  ),
                  if (subtitle != null) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                ],
              ),
            ),
            if (option is AllSuggestion) const Icon(LucideIcons.arrowRight, size: 16, color: AppColors.meta),
          ],
        ),
      ),
    );
  }
}
