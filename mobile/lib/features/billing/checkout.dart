/// Paying an order on PayOS's page inside the app, then waiting for the API
/// to confirm it (web: useCheckout + BillingResultPage).
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/billing_models.dart';
import '../../data/services/auth_service.dart';
import '../../data/services/billing_service.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/sheets.dart';

/// Makes the order, opens PayOS, and once the buyer is back waits for the
/// payment. Returns the order as it ended, or null when nothing was started.
Future<Order?> buyProduct(BuildContext context, WidgetRef ref, String product, {String? businessId}) async {
  Order order;
  try {
    order = await BillingService.checkout(product, businessId: businessId);
  } catch (error) {
    if (context.mounted) toast(context, errorMessage(error), error: true);
    return null;
  }
  if (!context.mounted) return null;
  await Navigator.of(context).push(
    MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => _CheckoutPage(url: order.checkoutUrl)),
  );
  if (!context.mounted) return null;
  final result = await Navigator.of(context).push<Order>(
    MaterialPageRoute(fullscreenDialog: true, builder: (_) => PaymentResultPage(orderCode: order.orderCode)),
  );
  if (result?.status == 'paid') {
    // The badge, the AI allowance and the "Đề xuất" status come from the account.
    try {
      await ref.read(sessionProvider.notifier).setUser(await AuthService.currentUser());
    } catch (_) {}
  }
  return result;
}

/// PayOS's checkout page. Closes itself when PayOS sends the buyer back to
/// /billing/result (paid or cancelled); bank app links open outside.
class _CheckoutPage extends StatefulWidget {
  const _CheckoutPage({required this.url});

  final String url;

  @override
  State<_CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<_CheckoutPage> {
  late final WebViewController _web;
  var _loading = true;
  var _closed = false;

  void _close() {
    if (_closed || !mounted) return;
    _closed = true;
    Navigator.of(context).pop();
  }

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;
            if (uri.path.endsWith('/billing/result')) {
              _close();
              return NavigationDecision.prevent;
            }
            if (uri.scheme != 'http' && uri.scheme != 'https') {
              // "Mở ứng dụng ngân hàng" links (intent://, bank schemes).
              unawaited(openExternal(request.url));
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(LucideIcons.x), tooltip: t('Đóng'), onPressed: _close),
        title: Text(t('Thanh toán')),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _web),
          if (_loading) const Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
        ],
      ),
    );
  }
}

/// Asks the API about the order until it is paid, cancelled or expired, for
/// at most three minutes. Pops with the order as it ended.
class PaymentResultPage extends StatefulWidget {
  const PaymentResultPage({super.key, required this.orderCode});

  final int orderCode;

  @override
  State<PaymentResultPage> createState() => _PaymentResultPageState();
}

class _PaymentResultPageState extends State<PaymentResultPage> {
  static const _pollFor = Duration(minutes: 3);
  Order? _order;
  Object? _error;
  Timer? _timer;
  var _timedOut = false;
  late final DateTime _started = DateTime.now();

  @override
  void initState() {
    super.initState();
    _poll();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    try {
      final order = await BillingService.getOrder(widget.orderCode);
      if (!mounted) return;
      setState(() {
        _order = order;
        _error = null;
      });
      if (order.status != 'pending') return;
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    }
    if (DateTime.now().difference(_started) > _pollFor) {
      setState(() => _timedOut = true);
      return;
    }
    _timer = Timer(const Duration(milliseconds: 2500), _poll);
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final waiting = order == null ? _error == null : order.status == 'pending' && !_timedOut;
    final paid = order?.status == 'paid';

    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false, title: Text(t('Thanh toán'))),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(kGutter * 1.5),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (waiting) ...[
                const SizedBox(width: 36, height: 36, child: CircularProgressIndicator(strokeWidth: 2.5)),
                const SizedBox(height: 18),
                Text(t('Đang xác nhận thanh toán…'), style: AppText.h2, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(t('Vui lòng không đóng trang. Việc này thường chỉ mất vài giây.'), style: AppText.meta, textAlign: TextAlign.center),
              ] else if (paid) ...[
                const Icon(LucideIcons.circleCheck, size: 52, color: AppColors.success),
                const SizedBox(height: 16),
                Text(t('Thanh toán thành công'), style: AppText.h2, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                Text(t('{product} · {amount}', {'product': tx(order!.productName), 'amount': formatVnd(order.amount)}), style: AppText.meta),
                if (order.grantedUntil != null) ...[
                  const SizedBox(height: 4),
                  Text(t('Có hiệu lực đến {date}.', {'date': formatShortDate(order.grantedUntil!)}), style: AppText.body),
                ],
              ] else ...[
                const Icon(LucideIcons.circleX, size: 52, color: AppColors.destructive),
                const SizedBox(height: 16),
                Text(
                  order?.status == 'pending' ? t('Chưa nhận được thanh toán') : t('Thanh toán chưa hoàn tất'),
                  style: AppText.h2,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _error != null && order == null
                      ? errorMessage(_error)
                      : order?.status == 'pending'
                      ? t('Nếu bạn đã chuyển khoản, gói sẽ tự kích hoạt khi PayOS xác nhận. Bạn có thể xem lại trong Lịch sử đơn hàng.')
                      : t('Đơn hàng đã bị huỷ hoặc hết hạn. Bạn chưa bị trừ tiền.'),
                  style: AppText.meta,
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 24),
              AppButton(
                label: t('Đóng'),
                variant: waiting ? ButtonVariant.ghost : ButtonVariant.primary,
                onPressed: () => Navigator.of(context).pop(order),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Orders, newest first (Premium screen and business screen).
class OrderTile extends StatelessWidget {
  const OrderTile({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tx(order.productName), style: AppText.label),
                const SizedBox(height: 2),
                Text('#${order.orderCode} · ${formatShortDate(order.createdAt)}', style: AppText.meta.copyWith(fontSize: 12)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatVnd(order.amount), style: AppText.label),
              const SizedBox(height: 2),
              Text(orderStatusLabel(order.status), style: AppText.meta.copyWith(fontSize: 12, color: order.status == 'paid' ? AppColors.success : AppColors.meta)),
            ],
          ),
        ],
      ),
    );
  }
}

String orderStatusLabel(String status) => switch (status) {
  'paid' => t('Đã thanh toán'),
  'cancelled' => t('Đã huỷ'),
  'expired' => t('Hết hạn'),
  _ => t('Chờ thanh toán'),
};
