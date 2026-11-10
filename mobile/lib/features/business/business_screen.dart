/// /b/:slug: a business page, its details and ads; public once an admin
/// approved it (web: features/business/BusinessPage.tsx). Also the
/// "Gợi ý nổi bật" row on Discover.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n.dart';
import '../../core/links.dart';
import '../../core/geo.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/billing_models.dart';
import '../../data/services/business_service.dart';
import '../../ui/navigation.dart';
import '../../ui/photo_viewer.dart';
import '../../ui/surfaces.dart';
import '../report/report_sheet.dart';
import 'business_widgets.dart';

final businessPageProvider = FutureProvider.autoDispose.family<({Business business, List<BusinessAd> ads}), String>(
  (ref, slug) => BusinessService.bySlug(slug),
);

final sponsoredProvider = FutureProvider.autoDispose<({List<Business> businesses, List<BusinessAd> ads})>((ref) => BusinessService.sponsored());

class BusinessScreen extends ConsumerWidget {
  const BusinessScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(businessPageProvider(slug));
    final business = page.value?.business;
    return Scaffold(
      appBar: AppBar(
        leading: const BackOrHome(),
        title: Text(business?.name ?? ''),
        actions: [
          if (business != null)
            ReportButton(
              targetType: 'business',
              targetId: business.id,
              ownerId: business.ownerId,
              label: t('Thêm thao tác cho {name}', {'name': business.name}),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: switch (page) {
        AsyncData(:final value) => _Body(business: value.business, ads: value.ads),
        AsyncError(:final error) when error is ApiError && error.status == 404 => Padding(
          padding: const EdgeInsets.all(kGutter),
          child: Center(child: EmptyState(icon: LucideIcons.store, title: t('Không tìm thấy cơ sở kinh doanh.'))),
        ),
        AsyncError(:final error) => Padding(
          padding: const EdgeInsets.all(kGutter),
          child: ErrorPanel(error: error, onRetry: () => ref.invalidate(businessPageProvider(slug))),
        ),
        _ => const LoadingView(),
      },
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.business, required this.ads});

  final Business business;
  final List<BusinessAd> ads;

  @override
  Widget build(BuildContext context) {
    Widget row(IconData icon, String text, {VoidCallback? onTap}) => InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: AppColors.meta),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: AppText.bodySmall.copyWith(decoration: onTap == null ? null : TextDecoration.underline))),
          ],
        ),
      ),
    );
    final where = business.lat != null && business.lng != null ? '${business.lat},${business.lng}' : '${business.name}, ${business.address}';

    return ListView(
      padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 40),
      children: [
        if (business.photos.isNotEmpty)
          SizedBox(
            height: 200,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: business.photos.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => GestureDetector(
                onTap: () => showPhotoViewer(context, business.photos, i),
                child: SizedBox(width: business.photos.length == 1 ? MediaQuery.of(context).size.width - kGutter * 2 : 280, child: NetImage(business.photos[i], radius: AppRadius.lg)),
              ),
            ),
          ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            AppBadge(businessTypeLabel(business.type), tone: BadgeTone.outline),
            if (business.sponsored) const SponsoredPill(),
            if (business.status != null && business.status != 'approved') AppBadge(businessStatusLabel(business.status), tone: BadgeTone.danger),
          ],
        ),
        const SizedBox(height: 8),
        Text(business.name, style: AppText.h1),
        if (business.city.isNotEmpty) Text(business.city, style: AppText.meta),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            children: [
              row(LucideIcons.mapPin, business.address, onTap: () => openExternal(googleMapsSearchUrl(where))),
              row(LucideIcons.phone, business.phone, onTap: () => openExternal('tel:${business.phone.replaceAll(RegExp(r'[^\d+]'), '')}')),
              if (business.openingHours.isNotEmpty) row(LucideIcons.clock, business.openingHours),
              if (priceRange(business) case final range?) row(LucideIcons.wallet, range),
              if (business.website.isNotEmpty)
                row(LucideIcons.globe, business.website.replaceFirst(RegExp(r'^https?://'), ''), onTap: () => openExternal(business.website)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(t('Giới thiệu'), style: AppText.h3),
        const SizedBox(height: 6),
        Text(business.description.isEmpty ? t('Cơ sở chưa viết giới thiệu.') : business.description, style: AppText.body),
        const SizedBox(height: 22),
        SectionHeader(title: t('Bài quảng cáo')),
        const SizedBox(height: 8),
        if (ads.isEmpty)
          Text(t('Chưa có bài quảng cáo nào.'), style: AppText.meta)
        else
          for (final ad in ads) ...[
            AdCard(
              ad: ad,
              trailing: ReportButton(
                targetType: 'businessPost',
                targetId: ad.id,
                ownerId: business.ownerId,
                label: t('Thêm thao tác cho {name}', {'name': ad.title}),
                size: 30,
              ),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

/// "Gợi ý nổi bật" on Discover. Nothing when no business is sponsored.
class SponsoredRow extends ConsumerWidget {
  const SponsoredRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(sponsoredProvider).value;
    if (data == null || (data.businesses.isEmpty && data.ads.isEmpty)) return const SizedBox.shrink();
    final items = <Widget>[
      for (final business in data.businesses) BusinessCard(business: business),
      for (final ad in data.ads) AdCard(ad: ad, sponsored: true, width: 260),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(kGutter, 0, 0, 32),
      child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(title: t('Gợi ý nổi bật'), subtitle: t('Homestay, quán ăn và trải nghiệm đang được tài trợ trên ChillnGo'), icon: LucideIcons.megaphone),
        const SizedBox(height: 10),
        SizedBox(
          height: 340,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (_, i) => Align(alignment: Alignment.topLeft, child: items[i]),
          ),
        ),
      ],
      ),
    );
  }
}
