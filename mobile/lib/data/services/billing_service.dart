/// Buying Premium and the business "Đề xuất" package through PayOS
/// (server/src/routes/billing.ts; web: billing.service.ts).
///
/// The app opens PayOS's checkout page in a WebView and watches for its way
/// back to /billing/result, then asks the API about the order until it is paid.
library;

import '../api.dart';
import '../billing_models.dart';
import '../json.dart';
import '../models.dart';

abstract final class BillingService {
  static Future<Plans> getPlans() async => Plans.fromJson(await Api.get('/api/billing/plans'));

  /// POST /api/billing/checkout: a pending order with its PayOS checkout link.
  static Future<Order> checkout(String product, {String? businessId}) async {
    final data = await Api.post('/api/billing/checkout', body: {'product': product, 'businessId': ?businessId});
    return Order.fromJson(mapOf(data['order']));
  }

  static Future<List<Order>> myOrders() async {
    final data = await Api.get('/api/billing/orders');
    return listOf(data['items'], (o) => Order.fromJson(mapOf(o)));
  }

  /// A pending one is checked with PayOS first, so this works without the webhook.
  static Future<Order> getOrder(int orderCode) async {
    final data = await Api.get('/api/billing/orders/$orderCode');
    return Order.fromJson(mapOf(data['order']));
  }

  /// GET /api/admin/orders: every order and the revenue summary.
  static Future<({AdminPage<Order> page, RevenueSummary summary})> adminOrders({String? status, int page = 1}) async {
    final data = await Api.get('/api/admin/orders${queryString({'status': status, 'page': page > 1 ? page : null})}');
    return (
      page: AdminPage(
        items: listOf(data['items'], (o) => Order.fromJson(mapOf(o))),
        total: intOf(data['total']),
        page: intOf(data['page'], 1),
        pageSize: intOf(data['pageSize'], 20),
      ),
      summary: RevenueSummary.fromJson(mapOf(data['summary'])),
    );
  }
}
