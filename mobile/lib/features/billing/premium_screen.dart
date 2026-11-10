/// /premium: what Free and Premium give, buying Premium through PayOS, and
/// the order history (web: features/billing/PremiumPage.tsx).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/billing_models.dart';
import '../../data/services/billing_service.dart';
import '../../ui/buttons.dart';
import '../../ui/navigation.dart';
import '../../ui/premium_badge.dart';
import '../../ui/surfaces.dart';
import 'checkout.dart';

final plansProvider = FutureProvider.autoDispose<Plans>((ref) => BillingService.getPlans());
final myOrdersProvider = FutureProvider.autoDispose<List<Order>>((ref) => BillingService.myOrders());

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  String? _buying;

  Future<void> _buy(Product product) async {
    setState(() => _buying = product.id);
    await buyProduct(context, ref, product.id);
    if (!mounted) return;
    setState(() => _buying = null);
    ref.invalidate(plansProvider);
    ref.invalidate(myOrdersProvider);
  }

  @override
  Widget build(BuildContext context) {
    final plans = ref.watch(plansProvider);
    final orders = ref.watch(myOrdersProvider);

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: Text(t('ChillnGo Premium'))),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(plansProvider);
          ref.invalidate(myOrdersProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 40),
          children: [
            Text(
              t('Nhiều lượt AI hơn để lên lịch trình, livestream sắc nét hơn và giữ video xem lại lâu hơn. Thanh toán một lần bằng VietQR, không tự động gia hạn.'),
              style: AppText.meta,
            ),
            const SizedBox(height: 18),
            switch (plans) {
              AsyncData(:final value) => _Body(plans: value, buying: _buying, onBuy: _buy),
              AsyncError(:final error) => ErrorPanel(error: error, onRetry: () => ref.invalidate(plansProvider)),
              _ => const LoadingView(),
            },
            const SizedBox(height: 28),
            SectionHeader(title: t('Lịch sử đơn hàng'), icon: LucideIcons.receipt),
            const SizedBox(height: 6),
            switch (orders) {
              AsyncData(:final value) when value.isEmpty => Text(t('Bạn chưa có đơn hàng nào.'), style: AppText.meta),
              AsyncData(:final value) => AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Column(children: [for (final order in value) OrderTile(order: order)]),
              ),
              AsyncError(:final error) => Text(errorMessage(error), style: AppText.meta.copyWith(color: AppColors.destructive)),
              _ => const LoadingView(),
            },
          ],
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.plans, required this.buying, required this.onBuy});

  final Plans plans;
  final String? buying;
  final ValueChanged<Product> onBuy;

  @override
  Widget build(BuildContext context) {
    final products = plans.products.where((p) => p.kind == 'premium').toList();
    final monthly = products.where((p) => p.days == 30).firstOrNull?.amount;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (plans.isPremium && plans.premiumUntil != null) ...[
          AppCard(
            child: Row(
              children: [
                const PremiumBadge(show: true, size: 16),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    t('Bạn đang là thành viên Premium đến {date}. Mua thêm sẽ được cộng dồn số ngày.', {'date': formatShortDate(plans.premiumUntil!)}),
                    style: AppText.bodySmall,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],
        _PlanCard(title: t('Miễn phí'), benefits: plans.free, premium: false),
        const SizedBox(height: 12),
        _PlanCard(title: t('Premium'), benefits: plans.premium, premium: true),
        const SizedBox(height: 24),
        Text(t('Chọn gói Premium'), style: AppText.h2),
        const SizedBox(height: 10),
        if (!plans.paymentsEnabled) ...[
          Text(t('Máy chủ chưa cấu hình cổng thanh toán PayOS nên chưa mua được gói.'), style: AppText.meta.copyWith(color: AppColors.destructive)),
          const SizedBox(height: 10),
        ],
        for (final product in products) ...[
          AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tx(product.name), style: AppText.label),
                      const SizedBox(height: 4),
                      Text(formatVnd(product.amount), style: AppText.h2),
                      if (monthly != null && product.days >= 365) ...[
                        const SizedBox(height: 4),
                        AppBadge(
                          t('Tiết kiệm {n}%', {'n': ((1 - product.amount / (monthly * product.days / 30)) * 100).round()}),
                          tone: BadgeTone.success,
                        ),
                      ],
                    ],
                  ),
                ),
                AppButton(
                  label: t('Thanh toán'),
                  loading: buying == product.id,
                  onPressed: plans.paymentsEnabled && buying == null ? () => onBuy(product) : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        Text(
          t('Bấm Thanh toán để mở trang PayOS, quét mã VietQR bằng ứng dụng ngân hàng. Gói được kích hoạt ngay khi PayOS xác nhận đã nhận tiền.'),
          style: AppText.meta.copyWith(fontSize: 12),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.title, required this.benefits, required this.premium});

  final String title;
  final PlanBenefits benefits;
  final bool premium;

  @override
  Widget build(BuildContext context) {
    Widget row(String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppText.meta)),
          Text(value, style: AppText.label),
        ],
      ),
    );
    return AppCard(
      surface: premium ? Surface.featured : Surface.card,
      accent: premium ? premiumGold : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (premium) ...[const PremiumBadge(show: true, size: 14), const SizedBox(width: 8)],
              Text(title, style: AppText.h3),
            ],
          ),
          const SizedBox(height: 8),
          row(t('Lượt AI mỗi ngày'), '${benefits.aiDailyLimit}'),
          row(t('Chất lượng livestream'), benefits.liveQuality),
          row(t('Giữ video xem lại'), t('{n} ngày', {'n': benefits.replayDays})),
          row(t('Huy hiệu Premium cạnh tên'), premium ? t('Có') : t('Không')),
        ],
      ),
    );
  }
}
