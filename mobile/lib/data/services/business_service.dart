/// Business pages and their ads (server/src/routes/businesses.ts; web:
/// business.service.ts), and the admin review queue.
library;

import '../api.dart';
import '../billing_models.dart';
import '../json.dart';
import '../models.dart';

abstract final class BusinessService {
  /// "Gợi ý nổi bật" on Discover.
  static Future<({List<Business> businesses, List<BusinessAd> ads})> sponsored() async {
    final data = await Api.get('/api/businesses/sponsored', auth: false);
    return (
      businesses: listOf(data['businesses'], (b) => Business.fromJson(mapOf(b))),
      ads: listOf(data['posts'], (p) => BusinessAd.fromJson(mapOf(p))),
    );
  }

  /// Your business (any status) and its ads; business is null before you register.
  static Future<({Business? business, List<BusinessAd> ads})> mine() async {
    final data = await Api.get('/api/businesses/me');
    final business = mapOrNull(data['business']);
    return (business: business == null ? null : Business.fromJson(business), ads: listOf(data['posts'], (p) => BusinessAd.fromJson(mapOf(p))));
  }

  static Future<({Business business, List<BusinessAd> ads})> bySlug(String slug) async {
    final data = await Api.get('/api/businesses/${Uri.encodeComponent(slug)}');
    return (business: Business.fromJson(mapOf(data['business'])), ads: listOf(data['posts'], (p) => BusinessAd.fromJson(mapOf(p))));
  }

  static Future<Business> register(Json input) async => Business.fromJson(mapOf((await Api.post('/api/businesses', body: input))['business']));

  static Future<Business> update(Json input) async => Business.fromJson(mapOf((await Api.patch('/api/businesses/me', body: input))['business']));

  static Json adInput({required String title, required String content, required List<String> photos, required String offer}) =>
      {'title': title.trim(), 'content': content.trim(), 'photos': photos, 'offer': offer.trim()};

  static Future<void> createAd(Json input) async => Api.post('/api/businesses/me/posts', body: input);

  static Future<void> updateAd(String id, Json input) async => Api.patch('/api/businesses/me/posts/$id', body: input);

  static Future<void> deleteAd(String id) async => Api.delete('/api/businesses/me/posts/$id');

  /* ---------------------------------------------------------------- admin */

  static Future<AdminPage<Business>> adminList({String status = 'pending', String? q, int page = 1}) async {
    final data = await Api.get('/api/admin/businesses${queryString({'status': status, 'q': q, 'page': page > 1 ? page : null})}');
    return AdminPage(
      items: listOf(data['items'], (b) => Business.fromJson(mapOf(b))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  /// approve | reject | hide | restore; reject and hide need a reason.
  static Future<void> review(String id, String action, {String reason = ''}) async {
    await Api.post('/api/admin/businesses/$id/review', body: {'action': action, 'reason': reason.trim()});
  }
}
