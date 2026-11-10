/// /business: "Doanh nghiệp của tôi". Register a business page, see where its
/// review stands, edit it, write ads, and buy the "Đề xuất" package (web:
/// features/business/MyBusinessPage.tsx).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/billing_models.dart';
import '../../data/services/business_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/navigation.dart';
import '../../ui/premium_badge.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../billing/checkout.dart';
import '../billing/premium_screen.dart' show plansProvider;
import 'business_widgets.dart';

final myBusinessProvider = FutureProvider.autoDispose<({Business? business, List<BusinessAd> ads})>((ref) => BusinessService.mine());

class MyBusinessScreen extends ConsumerWidget {
  const MyBusinessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = ref.watch(myBusinessProvider);
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: Text(t('Doanh nghiệp của tôi'))),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myBusinessProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 40),
          children: [
            Text(
              t('Homestay, khách sạn, quán ăn, quán cà phê hay tour: mở trang cơ sở miễn phí, đăng bài quảng cáo và mua gói Đề xuất để xuất hiện ở trang Khám phá.'),
              style: AppText.meta,
            ),
            const SizedBox(height: 16),
            switch (mine) {
              AsyncData(:final value) when value.business == null => _BusinessForm(business: null, onSaved: () => ref.invalidate(myBusinessProvider)),
              AsyncData(:final value) => _Dashboard(business: value.business!, ads: value.ads),
              AsyncError(:final error) => ErrorPanel(error: error, onRetry: () => ref.invalidate(myBusinessProvider)),
              _ => const LoadingView(),
            },
          ],
        ),
      ),
    );
  }
}

class _Dashboard extends ConsumerStatefulWidget {
  const _Dashboard({required this.business, required this.ads});

  final Business business;
  final List<BusinessAd> ads;

  @override
  ConsumerState<_Dashboard> createState() => _DashboardState();
}

class _DashboardState extends ConsumerState<_Dashboard> {
  var _editing = false;
  var _buying = false;

  void _refresh() => ref.invalidate(myBusinessProvider);

  Future<void> _buyBoost(Product product) async {
    setState(() => _buying = true);
    await buyProduct(context, ref, product.id, businessId: widget.business.id);
    if (!mounted) return;
    setState(() => _buying = false);
    _refresh();
  }

  Future<void> _editAd(BusinessAd? ad) async {
    final saved = await showAppSheet<bool>(context, title: ad == null ? t('Viết bài mới') : t('Sửa'), tall: true, builder: (_) => _AdForm(ad: ad));
    if (saved == true) _refresh();
  }

  Future<void> _deleteAd(BusinessAd ad) async {
    final deleted = await confirmAction(
      context,
      title: t('Xoá bài quảng cáo này?'),
      confirmLabel: t('Xoá'),
      destructive: true,
      onConfirm: () => BusinessService.deleteAd(ad.id),
    );
    if (deleted) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final business = widget.business;
    final status = business.status ?? 'pending';
    final plans = ref.watch(plansProvider).value;
    final boost = plans?.products.where((p) => p.kind == 'boost').firstOrNull;

    final statusText = switch (status) {
      'approved' => t('Trang cơ sở đang hiển thị công khai.'),
      'rejected' => t('Hồ sơ chưa được duyệt. Hãy sửa theo góp ý rồi gửi lại.'),
      'hidden' => t('Trang cơ sở đang bị quản trị viên ẩn.'),
      _ => t('Hồ sơ đang chờ quản trị viên duyệt. Bạn vẫn có thể soạn bài quảng cáo trong lúc chờ.'),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          accent: status == 'approved' ? AppColors.success : (status == 'pending' ? AppColors.meta : AppColors.destructive),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppBadge(businessStatusLabel(status), tone: status == 'approved' ? BadgeTone.success : (status == 'pending' ? BadgeTone.neutral : BadgeTone.danger)),
              const SizedBox(height: 8),
              Text(statusText, style: AppText.bodySmall),
              if (business.statusReason.isNotEmpty && (status == 'rejected' || status == 'hidden')) ...[
                const SizedBox(height: 4),
                Text(t('Lý do: {reason}', {'reason': business.statusReason}), style: AppText.label.copyWith(fontSize: 13)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (_editing)
          AppCard(
            child: _BusinessForm(
              business: business,
              onSaved: () {
                setState(() => _editing = false);
                _refresh();
              },
              onCancel: () => setState(() => _editing = false),
            ),
          )
        else
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(business.name, style: AppText.h2),
                const SizedBox(height: 4),
                Text(businessTypeLabel(business.type), style: AppText.meta),
                const SizedBox(height: 10),
                Text(business.address, style: AppText.bodySmall),
                Text(business.phone, style: AppText.bodySmall),
                if (priceRange(business) case final range?) Text(range, style: AppText.bodySmall),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (status == 'approved')
                      AppButton(
                        label: t('Xem trang công khai'),
                        icon: LucideIcons.externalLink,
                        size: ButtonSize.sm,
                        variant: ButtonVariant.outline,
                        onPressed: () => context.push('/b/${business.slug}'),
                      ),
                    if (status != 'hidden')
                      AppButton(
                        label: t('Sửa thông tin'),
                        icon: LucideIcons.penLine,
                        size: ButtonSize.sm,
                        variant: ButtonVariant.outline,
                        onPressed: () => setState(() => _editing = true),
                      ),
                  ],
                ),
              ],
            ),
          ),
        const SizedBox(height: 14),
        AppCard(
          accent: premiumGold,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(LucideIcons.megaphone, size: 18, color: premiumGold),
                  const SizedBox(width: 8),
                  Text(t('Gói Đề xuất'), style: AppText.h3),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                t('Trong thời gian còn gói, thẻ cơ sở và các bài quảng cáo của bạn hiện ở mục "Gợi ý nổi bật" trên trang Khám phá, có nhãn Tài trợ.'),
                style: AppText.meta,
              ),
              const SizedBox(height: 8),
              Text(
                business.promoted ? t('Đang được đề xuất đến {date}.', {'date': formatShortDate(business.promotedUntil!)}) : t('Chưa có gói Đề xuất.'),
                style: AppText.label,
              ),
              if (boost != null) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: Text('${formatVnd(boost.amount)} · ${tx(boost.name)}', style: AppText.bodySmall)),
                    AppButton(
                      label: business.promoted ? t('Gia hạn') : t('Mua gói'),
                      size: ButtonSize.sm,
                      loading: _buying,
                      onPressed: status == 'approved' && plans!.paymentsEnabled && !_buying ? () => _buyBoost(boost) : null,
                    ),
                  ],
                ),
              ],
              if (status != 'approved') ...[
                const SizedBox(height: 6),
                Text(t('Cơ sở cần được duyệt trước khi mua gói Đề xuất.'), style: AppText.meta.copyWith(fontSize: 12)),
              ],
              if (plans != null && !plans.paymentsEnabled) ...[
                const SizedBox(height: 6),
                Text(t('Máy chủ chưa cấu hình cổng thanh toán PayOS nên chưa mua được gói.'), style: AppText.meta.copyWith(fontSize: 12, color: AppColors.destructive)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 22),
        SectionHeader(
          title: t('Bài quảng cáo'),
          action: status == 'hidden' ? null : AppButton(label: t('Viết bài mới'), icon: LucideIcons.plus, size: ButtonSize.sm, onPressed: () => _editAd(null)),
        ),
        const SizedBox(height: 8),
        if (widget.ads.isEmpty)
          Text(t('Chưa có bài quảng cáo nào.'), style: AppText.meta)
        else
          for (final ad in widget.ads) ...[
            AdCard(
              ad: ad,
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(icon: const Icon(LucideIcons.penLine, size: 18), tooltip: t('Sửa'), onPressed: () => _editAd(ad)),
                  IconButton(icon: const Icon(LucideIcons.trash2, size: 18, color: AppColors.destructive), tooltip: t('Xoá'), onPressed: () => _deleteAd(ad)),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ forms */

class _BusinessForm extends StatefulWidget {
  const _BusinessForm({required this.business, required this.onSaved, this.onCancel});

  final Business? business;
  final VoidCallback onSaved;
  final VoidCallback? onCancel;

  @override
  State<_BusinessForm> createState() => _BusinessFormState();
}

class _BusinessFormState extends State<_BusinessForm> {
  late final _name = TextEditingController(text: widget.business?.name ?? '');
  late final _address = TextEditingController(text: widget.business?.address ?? '');
  late final _city = TextEditingController(text: widget.business?.city ?? '');
  late final _phone = TextEditingController(text: widget.business?.phone ?? '');
  late final _website = TextEditingController(text: widget.business?.website ?? '');
  late final _from = TextEditingController(text: widget.business?.priceFrom?.toString() ?? '');
  late final _to = TextEditingController(text: widget.business?.priceTo?.toString() ?? '');
  late final _hours = TextEditingController(text: widget.business?.openingHours ?? '');
  late final _description = TextEditingController(text: widget.business?.description ?? '');
  late String _type = widget.business?.type ?? 'homestay';
  late List<String> _photos = [...?widget.business?.photos];
  var _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _address, _city, _phone, _website, _from, _to, _hours, _description]) {
      c.dispose();
    }
    super.dispose();
  }

  int? _price(TextEditingController c) {
    final digits = c.text.replaceAll(RegExp(r'\D'), '');
    return digits.isEmpty ? null : int.parse(digits);
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final input = Business.input(
      name: _name.text,
      type: _type,
      description: _description.text,
      address: _address.text,
      city: _city.text,
      lat: widget.business?.lat,
      lng: widget.business?.lng,
      phone: _phone.text,
      website: _website.text,
      photos: _photos,
      priceFrom: _price(_from),
      priceTo: _price(_to),
      openingHours: _hours.text,
    );
    try {
      if (widget.business == null) {
        await BusinessService.register(input);
      } else {
        await BusinessService.update(input);
      }
      if (mounted) widget.onSaved();
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final creating = widget.business == null;
    const gap = SizedBox(height: 12);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (creating) ...[
          Text(t('Đăng ký cơ sở kinh doanh'), style: AppText.h2),
          const SizedBox(height: 4),
          Text(t('Quản trị viên sẽ xem xét trước khi trang của bạn hiển thị công khai. Mỗi tài khoản đăng ký được một cơ sở.'), style: AppText.meta),
          const SizedBox(height: 16),
        ],
        AppTextField(controller: _name, label: t('Tên cơ sở'), maxLength: 80),
        gap,
        SelectField<String>(
          label: t('Loại hình'),
          value: _type,
          options: [for (final type in businessTypes) SelectOption(type, businessTypeLabel(type))],
          onChanged: (value) => setState(() => _type = value),
        ),
        gap,
        AppTextField(controller: _address, label: t('Địa chỉ'), maxLength: 200),
        gap,
        AppTextField(controller: _city, label: t('Tỉnh/thành'), hint: 'Đà Lạt', maxLength: 60),
        gap,
        AppTextField(controller: _phone, label: t('Số điện thoại'), keyboardType: TextInputType.phone, maxLength: 15),
        gap,
        Row(
          children: [
            Expanded(child: AppTextField(controller: _from, label: t('Giá từ (VND)'), keyboardType: TextInputType.number)),
            const SizedBox(width: 10),
            Expanded(child: AppTextField(controller: _to, label: t('Giá đến (VND)'), keyboardType: TextInputType.number)),
          ],
        ),
        gap,
        AppTextField(controller: _hours, label: t('Giờ mở cửa'), hint: '07:00 – 22:00', maxLength: 100),
        gap,
        AppTextField(controller: _website, label: t('Website hoặc fanpage'), hint: 'https://', keyboardType: TextInputType.url, maxLength: 300),
        gap,
        AppTextField(controller: _description, label: t('Giới thiệu'), maxLines: 6, minLines: 3, maxLength: 2000),
        gap,
        Text(t('Ảnh cơ sở'), style: AppText.label),
        const SizedBox(height: 8),
        PhotoPickerRow(photos: _photos, max: 8, onChanged: (photos) => setState(() => _photos = photos)),
        if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error!)],
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: creating
                    ? t('Gửi duyệt')
                    : (widget.business?.status == 'rejected' ? t('Lưu và gửi duyệt lại') : t('Lưu thay đổi')),
                loading: _saving,
                fullWidth: true,
                onPressed: _saving ? null : _save,
              ),
            ),
            if (widget.onCancel != null) ...[
              const SizedBox(width: 10),
              AppButton(label: t('Huỷ'), variant: ButtonVariant.ghost, onPressed: widget.onCancel),
            ],
          ],
        ),
      ],
    );
  }
}

class _AdForm extends StatefulWidget {
  const _AdForm({required this.ad});

  final BusinessAd? ad;

  @override
  State<_AdForm> createState() => _AdFormState();
}

class _AdFormState extends State<_AdForm> {
  late final _title = TextEditingController(text: widget.ad?.title ?? '');
  late final _offer = TextEditingController(text: widget.ad?.offer ?? '');
  late final _content = TextEditingController(text: widget.ad?.content ?? '');
  late List<String> _photos = [...?widget.ad?.photos];
  var _saving = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _offer.dispose();
    _content.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final input = BusinessService.adInput(title: _title.text, content: _content.text, photos: _photos, offer: _offer.text);
    try {
      if (widget.ad == null) {
        await BusinessService.createAd(input);
      } else {
        await BusinessService.updateAd(widget.ad!.id, input);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        AppTextField(controller: _title, label: t('Tiêu đề'), maxLength: 120),
        const SizedBox(height: 12),
        AppTextField(controller: _offer, label: t('Ưu đãi (không bắt buộc)'), hint: t('Ví dụ: Giảm 20% cho khách đặt trước 7 ngày'), maxLength: 80),
        const SizedBox(height: 12),
        AppTextField(controller: _content, label: t('Nội dung'), maxLines: 8, minLines: 4, maxLength: 3000),
        const SizedBox(height: 12),
        Text(t('Ảnh'), style: AppText.label),
        const SizedBox(height: 8),
        PhotoPickerRow(photos: _photos, max: 6, onChanged: (photos) => setState(() => _photos = photos)),
        if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error!)],
        const SizedBox(height: 16),
        AppButton(
          label: widget.ad == null ? t('Đăng bài quảng cáo') : t('Lưu thay đổi'),
          loading: _saving,
          fullWidth: true,
          onPressed: _saving ? null : _save,
        ),
      ],
    );
  }
}
