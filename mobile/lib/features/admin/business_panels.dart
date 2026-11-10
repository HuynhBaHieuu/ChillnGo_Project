/// Doanh nghiệp (the business review queue) and Doanh thu (PayOS orders and
/// revenue) in the admin console (web: BusinessesPanel.tsx, RevenuePanel.tsx).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/billing_models.dart';
import '../../data/models.dart';
import '../../data/services/billing_service.dart';
import '../../data/services/business_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../billing/checkout.dart' show orderStatusLabel;
import '../business/business_widgets.dart';
import 'admin_common.dart';

const _statuses = ['pending', 'approved', 'rejected', 'hidden'];

/// Which decisions apply in each status (the API checks the same).
const _actions = {
  'pending': ['approve', 'reject'],
  'approved': ['hide'],
  'rejected': ['approve'],
  'hidden': ['restore'],
};

String _actionLabel(String action) => switch (action) {
  'approve' => t('Duyệt'),
  'reject' => t('Từ chối'),
  'hide' => t('Ẩn cơ sở'),
  _ => t('Hiển thị lại'),
};

class BusinessesPanel extends ConsumerStatefulWidget {
  const BusinessesPanel({super.key});

  @override
  ConsumerState<BusinessesPanel> createState() => _BusinessesPanelState();
}

class _BusinessesPanelState extends ConsumerState<BusinessesPanel> {
  String _status = 'pending';
  int _page = 1;
  AdminPage<Business>? _data;
  Object? _error;
  bool _loading = true;
  int _request = 0;
  String? _busy;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final page = await BusinessService.adminList(status: _status, page: _page);
      if (!mounted || request != _request) return;
      setState(() {
        _data = page;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _decide(Business business, String action) async {
    var reason = '';
    if (action == 'reject' || action == 'hide') {
      final controller = TextEditingController();
      final ok = await confirmAction(
        context,
        title: '${_actionLabel(action)}: ${business.name}',
        description: t('Chủ cơ sở sẽ nhận được thông báo kèm lý do này.'),
        content: AppTextField(controller: controller, label: t('Lý do'), maxLines: 3, maxLength: 500),
        confirmLabel: _actionLabel(action),
        destructive: true,
        onConfirm: () async {
          if (controller.text.trim().isEmpty) throw ApiError(t('Hãy ghi lý do để chủ cơ sở biết cần sửa gì.'), status: 400);
          await BusinessService.review(business.id, action, reason: controller.text);
        },
      );
      controller.dispose();
      if (!ok) return;
      reason = 'done';
    }
    setState(() => _busy = business.id);
    try {
      if (reason.isEmpty) await BusinessService.review(business.id, action);
      ref.read(adminNoticeProvider.notifier).show(Notice(t('Đã cập nhật: {action}.', {'action': _actionLabel(action)})));
      await _load();
    } catch (error) {
      ref.read(adminNoticeProvider.notifier).show(Notice(errorMessage(error), error: true));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentTabs<String>(
          value: _status,
          items: [for (final s in _statuses) (value: s, label: businessStatusLabel(s), count: null)],
          onChanged: (value) {
            setState(() {
              _status = value;
              _page = 1;
            });
            _load();
          },
        ),
        const SizedBox(height: 14),
        if (_loading && data == null)
          const LoadingView()
        else if (_error != null && data == null)
          ErrorPanel(error: _error, onRetry: _load)
        else if (data == null || data.items.isEmpty)
          Text(t('Không có cơ sở nào ở mục này.'), style: AppText.meta)
        else ...[
          for (final business in data.items) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (business.photos.isNotEmpty) ...[
                    SizedBox(height: 120, width: double.infinity, child: NetImage(business.photos.first, radius: AppRadius.md)),
                    const SizedBox(height: 10),
                  ],
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(business.name, style: AppText.label),
                      AppBadge(businessTypeLabel(business.type), tone: BadgeTone.outline),
                      if (business.sponsored) const SponsoredPill(),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(business.address, style: AppText.meta),
                  Text(business.phone, style: AppText.meta),
                  if (business.ownerLabel != null) Text(t('Chủ cơ sở: {name}', {'name': business.ownerLabel}), style: AppText.meta.copyWith(fontSize: 12)),
                  Text(t('Gửi lúc {time}', {'time': formatDateTime(business.createdAt)}), style: AppText.meta.copyWith(fontSize: 12)),
                  if (business.description.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(business.description, style: AppText.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                  ],
                  if (business.statusReason.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(t('Lý do: {reason}', {'reason': business.statusReason}), style: AppText.meta.copyWith(color: AppColors.destructive, fontSize: 12)),
                  ],
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (business.status == 'approved')
                        AppButton(label: t('Xem trang'), size: ButtonSize.sm, variant: ButtonVariant.ghost, onPressed: () => context.push('/b/${business.slug}')),
                      for (final action in _actions[business.status ?? 'pending'] ?? const <String>[])
                        AppButton(
                          label: _actionLabel(action),
                          size: ButtonSize.sm,
                          loading: _busy == business.id,
                          variant: action == 'approve' || action == 'restore' ? ButtonVariant.primary : ButtonVariant.outline,
                          onPressed: _busy == null ? () => _decide(business, action) : null,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          Pagination(
            page: data.page,
            pageCount: data.pageCount,
            onPage: (page) {
              setState(() => _page = page);
              _load();
            },
          ),
        ],
      ],
    );
  }
}

/* ---------------------------------------------------------------- revenue */

const _orderFilters = ['all', 'paid', 'pending', 'cancelled', 'expired'];

class RevenuePanel extends StatefulWidget {
  const RevenuePanel({super.key});

  @override
  State<RevenuePanel> createState() => _RevenuePanelState();
}

class _RevenuePanelState extends State<RevenuePanel> {
  String _status = 'paid';
  int _page = 1;
  ({AdminPage<Order> page, RevenueSummary summary})? _data;
  Object? _error;
  bool _loading = true;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final data = await BillingService.adminOrders(status: _status == 'all' ? null : _status, page: _page);
      if (!mounted || request != _request) return;
      setState(() {
        _data = data;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    if (_loading && data == null) return const LoadingView();
    if (_error != null && data == null) return ErrorPanel(error: _error, onRetry: _load);
    if (data == null) return const SizedBox.shrink();
    final s = data.summary;

    Widget tile(String label, String value, [String? hint]) => Expanded(
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppText.meta.copyWith(fontSize: 12)),
            const SizedBox(height: 6),
            FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: AppText.h2)),
            if (hint != null) Text(hint, style: AppText.meta.copyWith(fontSize: 11)),
          ],
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            tile(t('Tổng doanh thu'), formatVnd(s.revenue), t('{n} đơn đã thanh toán', {'n': s.paidOrders})),
            const SizedBox(width: 10),
            tile(t('Doanh thu 30 ngày'), formatVnd(s.revenue30), t('{n} đơn đã thanh toán', {'n': s.paidOrders30})),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            tile(t('Thành viên Premium'), formatNumber(s.premiumMembers)),
            const SizedBox(width: 10),
            tile(t('Cơ sở đang được đề xuất'), formatNumber(s.promotedBusinesses)),
          ],
        ),
        const SizedBox(height: 18),
        Text(t('Theo gói'), style: AppText.label),
        const SizedBox(height: 6),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Column(
            children: [
              for (final row in s.byProduct)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Expanded(child: Text(tx(row.name), style: AppText.bodySmall)),
                      Text('${t('{n} đơn', {'n': row.count})} · ${formatVnd(row.revenue)}', style: AppText.label.copyWith(fontSize: 13)),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        SegmentTabs<String>(
          value: _status,
          items: [for (final f in _orderFilters) (value: f, label: f == 'all' ? t('Tất cả') : orderStatusLabel(f), count: null)],
          onChanged: (value) {
            setState(() {
              _status = value;
              _page = 1;
            });
            _load();
          },
        ),
        const SizedBox(height: 10),
        if (data.page.items.isEmpty)
          Text(t('Chưa có đơn hàng nào.'), style: AppText.meta)
        else
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(
              children: [
                for (final order in data.page.items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(tx(order.productName), style: AppText.label.copyWith(fontSize: 13)),
                              Text('#${order.orderCode} · ${order.buyerName ?? '—'}', style: AppText.meta.copyWith(fontSize: 11.5)),
                              Text(formatDateTime(order.paidAt ?? order.createdAt), style: AppText.meta.copyWith(fontSize: 11.5)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(formatVnd(order.amount), style: AppText.label.copyWith(fontSize: 13)),
                            Text(orderStatusLabel(order.status), style: AppText.meta.copyWith(fontSize: 11.5, color: order.status == 'paid' ? AppColors.success : AppColors.meta)),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        Pagination(
          page: data.page.page,
          pageCount: data.page.pageCount,
          onPage: (page) {
            setState(() => _page = page);
            _load();
          },
        ),
      ],
    );
  }
}
