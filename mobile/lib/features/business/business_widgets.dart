/// Pieces shared by the business screens and Discover (web: features/business).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/images.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/billing_models.dart';
import '../../data/services/post_service.dart';
import '../../ui/premium_badge.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';

String businessTypeLabel(String type) => switch (type) {
  'hotel' => t('Khách sạn'),
  'restaurant' => t('Quán ăn'),
  'cafe' => t('Cà phê'),
  'tour' => t('Tour – trải nghiệm'),
  _ => t('Homestay'),
};

String businessStatusLabel(String? status) => switch (status) {
  'approved' => t('Đã duyệt'),
  'rejected' => t('Bị từ chối'),
  'hidden' => t('Đang bị ẩn'),
  _ => t('Chờ duyệt'),
};

/// Per night for a stay, per person otherwise.
String priceUnit(String type) => type == 'homestay' || type == 'hotel' ? t('/đêm') : t('/người');

String? priceRange(Business b) {
  final prices = [b.priceFrom, b.priceTo].whereType<int>().map(formatVnd).toList();
  return prices.isEmpty ? null : '${prices.join(' – ')} ${priceUnit(b.type)}';
}

/// The "Tài trợ" pill.
class SponsoredPill extends StatelessWidget {
  const SponsoredPill({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: const Color(0xCC000000), borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.megaphone, size: 11, color: premiumGold),
          const SizedBox(width: 4),
          Text(t('Tài trợ'), style: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 11, color: premiumGold)),
        ],
      ),
    );
  }
}

/// A business in the sponsored row: photo, type, name, place, price from.
class BusinessCard extends StatelessWidget {
  const BusinessCard({super.key, required this.business, this.width = 240});

  final Business business;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: AppCard(
        padding: EdgeInsets.zero,
        onTap: () => context.push('/b/${business.slug}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                AspectRatio(
                  aspectRatio: 4 / 3,
                  child: business.photos.isEmpty
                      ? Container(color: AppColors.well, child: const Icon(LucideIcons.store, color: AppColors.meta))
                      : NetImage(business.photos.first, radius: 0),
                ),
                const Positioned(left: 8, top: 8, child: SponsoredPill()),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(businessTypeLabel(business.type), style: AppText.meta.copyWith(fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(business.name, style: AppText.label, maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text(business.city.isNotEmpty ? business.city : business.address, style: AppText.meta.copyWith(fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (business.priceFrom != null) ...[
                    const SizedBox(height: 4),
                    Text('${t('Từ {price}', {'price': formatVndShort(business.priceFrom!)})}${priceUnit(business.type)}', style: AppText.label.copyWith(fontSize: 13)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One ad: photo, title, offer, text. [showBusiness] adds a link to its page.
class AdCard extends StatelessWidget {
  const AdCard({super.key, required this.ad, this.sponsored = false, this.trailing, this.width});

  final BusinessAd ad;
  final bool sponsored;
  final Widget? trailing;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final business = ad.business;
    final card = AppCard(
      padding: EdgeInsets.zero,
      onTap: business == null ? null : () => context.push('/b/${business.slug}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (ad.photos.isNotEmpty) AspectRatio(aspectRatio: 16 / 9, child: NetImage(ad.photos.first, radius: 0)),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (sponsored) ...[const SponsoredPill(), const SizedBox(width: 6)],
                    if (business != null) Flexible(child: Text(business.name, style: AppText.label.copyWith(fontSize: 12), overflow: TextOverflow.ellipsis)),
                    const Spacer(),
                    ?trailing,
                  ],
                ),
                const SizedBox(height: 6),
                Text(ad.title, style: AppText.h3),
                if (ad.offer.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  AppBadge(ad.offer, tone: BadgeTone.primary, icon: LucideIcons.tag),
                ],
                const SizedBox(height: 6),
                Text(ad.content, style: AppText.bodySmall, maxLines: width == null ? null : 4, overflow: width == null ? null : TextOverflow.ellipsis),
                if (ad.moderation != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    ad.moderation!.reason.isEmpty ? t('Đã bị ẩn do vi phạm') : '${t('Đã bị ẩn do vi phạm')}: ${ad.moderation!.reason}',
                    style: AppText.meta.copyWith(color: AppColors.destructive, fontSize: 12),
                  ),
                ],
                if (ad.createdAt.isNotEmpty) ...[const SizedBox(height: 6), Text(relativeTime(ad.createdAt), style: AppText.meta.copyWith(fontSize: 12))],
              ],
            ),
          ),
        ],
      ),
    );
    return width == null ? card : SizedBox(width: width, child: card);
  }
}

/// A row of photos with an "add" tile; each pick is uploaded right away.
class PhotoPickerRow extends StatefulWidget {
  const PhotoPickerRow({super.key, required this.photos, required this.max, required this.onChanged});

  final List<String> photos;
  final int max;
  final ValueChanged<List<String>> onChanged;

  @override
  State<PhotoPickerRow> createState() => _PhotoPickerRowState();
}

class _PhotoPickerRowState extends State<PhotoPickerRow> {
  var _uploading = false;

  Future<void> _add() async {
    final picked = await pickImages(limit: widget.max - widget.photos.length, maxSide: 1920);
    if (picked.isEmpty) return;
    setState(() => _uploading = true);
    final urls = [...widget.photos];
    for (final image in picked) {
      try {
        urls.add(await PostService.uploadJourneyImage(image));
      } catch (error) {
        if (mounted) toast(context, errorMessage(error), error: true);
      }
    }
    if (!mounted) return;
    setState(() => _uploading = false);
    widget.onChanged(urls);
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final url in widget.photos)
          Stack(
            children: [
              SizedBox(width: 84, height: 84, child: NetImage(url, radius: AppRadius.md)),
              Positioned(
                right: 2,
                top: 2,
                child: GestureDetector(
                  onTap: () => widget.onChanged(widget.photos.where((u) => u != url).toList()),
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(color: AppColors.scrim, shape: BoxShape.circle),
                    child: Icon(LucideIcons.x, size: 14, color: AppColors.white, semanticLabel: t('Xoá ảnh')),
                  ),
                ),
              ),
            ],
          ),
        if (widget.photos.length < widget.max)
          InkWell(
            onTap: _uploading ? null : _add,
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(border: Border.all(color: AppColors.borderStrong), borderRadius: BorderRadius.circular(AppRadius.md)),
              child: Center(
                child: _uploading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.imagePlus, size: 20, color: AppColors.meta),
                          const SizedBox(height: 4),
                          Text(t('Thêm ảnh'), style: AppText.meta.copyWith(fontSize: 11)),
                        ],
                      ),
              ),
            ),
          ),
      ],
    );
  }
}
