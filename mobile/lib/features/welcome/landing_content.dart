import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/photos.dart';
import '../../core/text.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/services/discovery_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';

const _statement = [
  'ChillnGo là mạng xã hội của những chuyến đi có thật.',
  'Mỗi hành trình được kể lại từng ngày, từng điểm dừng, từng khoản chi.',
  'Thấy hợp ý? Clone về làm của bạn chỉ với một chạm.',
];

const _features = [
  (title: 'Khám phá hành trình', desc: 'Lịch trình thật, lọc theo vùng, mùa và ngân sách.', icon: LucideIcons.compass),
  (title: 'Xem từng ngày', desc: 'Mỗi điểm dừng có ghi chú, ảnh và chi phí ước tính.', icon: LucideIcons.calendarRange),
  (title: 'Clone một chạm', desc: 'Biến chuyến đi của người khác thành bản nháp của bạn.', icon: LucideIcons.copy),
  (title: 'Sắp xếp lại ngày', desc: 'Đổi thứ tự ngày, ngày tháng tự cập nhật theo.', icon: LucideIcons.arrowUpDown),
  (title: 'Ghép nhiều chuyến', desc: 'Lấy những ngày hay nhất từ nhiều bài, gộp vào một lịch trình.', icon: LucideIcons.gitMerge),
  (title: 'Chia sẻ lại', desc: 'Đi xong, đăng hành trình của bạn cho người đi sau.', icon: LucideIcons.share2),
];

/// The web home page (web/src/app/landing/home) for a phone: the hero, the
/// statement, the numbers, how it works, the most-saved trips and the places.
class LandingContent extends ConsumerWidget {
  const LandingContent({super.key, required this.onExplore, this.welcome = false});

  /// "Khám phá ngay".
  final VoidCallback onExplore;

  /// First launch: the hero offers sign-in and sign-up too.
  final bool welcome;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(sessionProvider.select((s) => s.signedIn));
    final stats = ref.watch(landingStatsProvider).value;
    final posts = ref.watch(discoverProvider(const DiscoverFilters())).value ?? const <TripPost>[];
    final rows = ref.watch(destinationRowsProvider).value ?? const <DestinationRow>[];
    final moments = ref.watch(momentPhotosProvider).value ?? const <MomentPhoto>[];
    final size = MediaQuery.sizeOf(context);
    final top = MediaQuery.paddingOf(context).top;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // Hero
        SizedBox(
          height: size.height * 0.86,
          child: Stack(
            fit: StackFit.expand,
            children: [
              NetImage(landingPhoto(LandingPhoto.saPa, 1200, 1800), placeholderColor: AppColors.canopy),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x66000000), Color(0x33000000), Color(0xF2000000)],
                    stops: [0, 0.45, 1],
                  ),
                ),
              ),
              if (welcome)
                Positioned(
                  left: kGutter,
                  right: kGutter,
                  top: top + 14,
                  child: const Text(
                    'ChillnGo',
                    style: TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w900, fontSize: 22, color: AppColors.cream),
                  ),
                ),
              Positioned(
                left: kGutter,
                right: kGutter,
                bottom: 28,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        style: const TextStyle(
                          fontFamily: AppFonts.display,
                          fontWeight: FontWeight.w900,
                          fontSize: 44,
                          height: 1.0,
                          color: AppColors.cream,
                          letterSpacing: -1.2,
                        ),
                        children: [
                          const TextSpan(text: 'Review & '),
                          TextSpan(
                            text: 'Clone\n',
                            style: TextStyle(color: AppColors.cream.withValues(alpha: 0.8)),
                          ),
                          TextSpan(
                            text: 'Your Journey',
                            style: TextStyle(color: AppColors.cream.withValues(alpha: 0.8)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'ChillnGo là nơi những chuyến đi có thật được kể lại đầy đủ: từng ngày, từng điểm dừng, từng khoản chi. Thấy một hành trình hợp ý? Clone nó về làm của mình chỉ với một chạm, rồi sửa theo cách bạn muốn đi. Không còn phải dựng lịch trình từ con số không.',
                      style: AppText.body.copyWith(color: AppColors.cream),
                    ),
                    const SizedBox(height: 22),
                    AppButton(
                      label: 'Khám phá ngay',
                      size: ButtonSize.lg,
                      icon: LucideIcons.arrowRight,
                      iconRight: true,
                      fullWidth: true,
                      onPressed: onExplore,
                    ),
                    if (welcome && !signedIn) ...[
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: AppButton(label: 'Đăng nhập', variant: ButtonVariant.secondary, onPressed: () => context.push('/login')),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: AppButton(label: 'Tạo tài khoản', variant: ButtonVariant.outline, onPressed: () => context.push('/register')),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),

        // Statement
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 36, kGutter, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final line in _statement) ...[Text(line, style: AppText.h2.copyWith(height: 1.35)), const SizedBox(height: 14)],
            ],
          ),
        ),

        // Numbers
        if (stats != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 18, kGutter, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('ĐƯỢC KỂ LẠI TỪ NHỮNG CHUYẾN ĐI THẬT', style: AppText.caps.copyWith(letterSpacing: 3), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final circle = ((constraints.maxWidth - 16) / 2).clamp(0.0, 170.0);
                    return Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 16,
                      runSpacing: 16,
                      children: [
                        for (final item in [
                          (stats.tripCount, 'hành trình'),
                          (stats.cloneCount, 'lượt clone'),
                          (stats.bookmarkCount, 'lượt lưu'),
                          (stats.stopCount, 'điểm dừng'),
                        ])
                          Container(
                            width: circle,
                            height: circle,
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.borderStrong),
                            ),
                            alignment: Alignment.center,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(formatNumber(item.$1), style: AppText.hero.copyWith(color: AppColors.primary)),
                                Text(item.$2, style: AppText.meta),
                              ],
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),

        // How it works
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 40, kGutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('CÁCH CHILLNGO HOẠT ĐỘNG', style: AppText.caps.copyWith(letterSpacing: 3)),
              const SizedBox(height: 14),
              for (var i = 0; i < _features.length; i++)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    border: i > 0 ? const Border(top: BorderSide(color: AppColors.border)) : null,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${i + 1}'.padLeft(2, '0'), style: AppText.h3.copyWith(color: AppColors.primary)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(_features[i].icon, size: 18, color: AppColors.sage),
                                const SizedBox(width: 8),
                                Expanded(child: Text(_features[i].title, style: AppText.h3)),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(_features[i].desc, style: AppText.meta),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),

        // Most saved
        if (posts.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 40, kGutter, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Hành trình nổi bật', style: AppText.meta, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text('Được lưu nhiều nhất', style: AppText.h1, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text('Những lịch trình cộng đồng tin dùng. Mở ra xem từng ngày, rồi clone về làm của bạn.', style: AppText.meta, textAlign: TextAlign.center),
                const SizedBox(height: 18),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final width = (constraints.maxWidth - 12) / 2;
                    return Wrap(
                      spacing: 12,
                      runSpacing: 18,
                      children: [
                        for (final post in posts.take(4))
                          SizedBox(
                            width: width,
                            child: GestureDetector(
                              onTap: () => context.push('/posts/${post.id}'),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(AppRadius.md),
                                    child: AspectRatio(
                                      aspectRatio: 5 / 7,
                                      child: NetImage(post.coverUrl, placeholderColor: AppColors.canopy),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text('${regionLabel(post.region)} · ${tripLengthLabel(post.days.length)}', style: AppText.meta),
                                  Text(shortTitle(post.title), maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.h3.copyWith(fontSize: 15)),
                                ],
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                Center(
                  child: AppButton(label: 'Xem tất cả', variant: ButtonVariant.outline, icon: LucideIcons.arrowRight, iconRight: true, onPressed: onExplore),
                ),
              ],
            ),
          ),

        // Places
        if (rows.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 44, kGutter, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Điểm đến', style: AppText.meta, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text('Mỗi toạ độ là một chuyến đi có thật.', style: AppText.h1, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(
                  '${rows.length} điểm dừng từ những hành trình trên ChillnGo, từ cao nguyên đá Hà Giang tới bãi cát Phú Quốc.',
                  style: AppText.meta,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),
                for (final row in rows.take(8))
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.border)),
                    ),
                    child: InkWell(
                      onTap: () => context.push('/posts/${row.postId}'),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(row.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.label),
                                Text(row.tripTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                              ],
                            ),
                          ),
                          Text(
                            '${row.lat.abs().toStringAsFixed(4)}° ${row.lat >= 0 ? 'N' : 'S'}\n${row.lng.abs().toStringAsFixed(4)}° ${row.lng >= 0 ? 'E' : 'W'}',
                            textAlign: TextAlign.right,
                            style: AppText.meta.copyWith(fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (moments.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 150,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: moments.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 10),
                      itemBuilder: (context, i) => GestureDetector(
                        onTap: () => context.push('/posts/${moments[i].postId}'),
                        child: NetImage(moments[i].url, width: 120, height: 150, radius: AppRadius.md, placeholderColor: AppColors.canopy),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),

        // Footer
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 48, kGutter, 40),
          child: Column(
            children: [
              Text('ChillnGo', style: AppText.hero.copyWith(fontSize: 54, color: AppColors.cream.withValues(alpha: 0.12))),
              const SizedBox(height: 14),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 18,
                runSpacing: 6,
                children: [
                  TextLink(label: 'Khám phá', color: AppColors.meta, onPressed: () => context.go('/discover')),
                  TextLink(label: 'Newsfeed', color: AppColors.meta, onPressed: () => context.go('/feed')),
                  TextLink(label: 'Hành trình của tôi', color: AppColors.meta, onPressed: () => context.push('/itineraries')),
                  TextLink(label: 'Đăng bài mới', color: AppColors.meta, onPressed: () => context.push('/posts/new')),
                ],
              ),
              const SizedBox(height: 20),
              AppButton(
                label: signedIn ? 'Đăng hành trình' : 'Bắt đầu ngay',
                size: ButtonSize.lg,
                onPressed: () => context.push(signedIn ? '/posts/new' : '/register'),
              ),
              const SizedBox(height: 16),
              Text('Chia sẻ hành trình thật. Clone lịch trình chỉ với một chạm.', style: AppText.meta, textAlign: TextAlign.center),
              const SizedBox(height: 10),
              Text('© 2026 ChillnGo', style: AppText.meta.copyWith(fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }
}
