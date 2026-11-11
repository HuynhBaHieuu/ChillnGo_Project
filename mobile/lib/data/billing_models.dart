/// Premium, PayOS orders and business pages, as the API sends them
/// (server/src/routes/billing.ts, businesses.ts; web/src/services/types.ts).
library;

import 'json.dart';
import 'models.dart';

class Product {
  const Product({required this.id, required this.kind, required this.name, required this.days, required this.amount});

  /// premium_month | premium_year | business_boost_month
  final String id;

  /// premium | boost
  final String kind;
  final String name;
  final int days;

  /// VND.
  final int amount;

  factory Product.fromJson(Json json) => Product(
    id: str(json['id']),
    kind: str(json['kind']),
    name: str(json['name']),
    days: intOf(json['days']),
    amount: intOf(json['amount']),
  );
}

class PlanBenefits {
  const PlanBenefits({required this.aiDailyLimit, required this.liveQuality, required this.replayDays});

  final int aiDailyLimit;
  final String liveQuality;
  final int replayDays;

  factory PlanBenefits.fromJson(Json json) => PlanBenefits(
    aiDailyLimit: intOf(json['aiDailyLimit']),
    liveQuality: str(json['liveQuality']),
    replayDays: intOf(json['replayDays']),
  );
}

/// GET /api/billing/plans
class Plans {
  const Plans({required this.paymentsEnabled, required this.products, required this.free, required this.premium, this.isPremium = false, this.premiumUntil});

  final bool paymentsEnabled;
  final List<Product> products;
  final PlanBenefits free;
  final PlanBenefits premium;
  final bool isPremium;
  final String? premiumUntil;

  factory Plans.fromJson(Json json) {
    final benefits = mapOf(json['benefits']);
    final current = mapOrNull(json['current']);
    return Plans(
      paymentsEnabled: boolOf(json['paymentsEnabled']),
      products: listOf(json['products'], (p) => Product.fromJson(mapOf(p))),
      free: PlanBenefits.fromJson(mapOf(benefits['free'])),
      premium: PlanBenefits.fromJson(mapOf(benefits['premium'])),
      isPremium: boolOf(current?['isPremium']),
      premiumUntil: strOrNull(current?['premiumUntil']),
    );
  }
}

class Order {
  const Order({
    required this.id,
    required this.orderCode,
    required this.product,
    required this.productName,
    required this.amount,
    required this.days,
    required this.status,
    required this.checkoutUrl,
    required this.createdAt,
    this.businessId,
    this.paidAt,
    this.grantedUntil,
    this.buyerName,
  });

  final String id;
  final int orderCode;
  final String product;
  final String productName;
  final String? businessId;
  final int amount;
  final int days;

  /// pending | paid | cancelled | expired
  final String status;

  /// The PayOS page, while the order can still be paid.
  final String checkoutUrl;
  final String createdAt;
  final String? paidAt;
  final String? grantedUntil;

  /// Admin list only: "Name (@username)".
  final String? buyerName;

  factory Order.fromJson(Json json) {
    final buyer = mapOrNull(json['buyer']);
    return Order(
      id: str(json['_id']),
      orderCode: intOf(json['orderCode']),
      product: str(json['product']),
      productName: str(json['productName']),
      businessId: strOrNull(json['businessId']),
      amount: intOf(json['amount']),
      days: intOf(json['days']),
      status: str(json['status'], 'pending'),
      checkoutUrl: str(json['checkoutUrl']),
      createdAt: str(json['createdAt']),
      paidAt: strOrNull(json['paidAt']),
      grantedUntil: strOrNull(json['grantedUntil']),
      buyerName: buyer == null ? null : '${str(buyer['displayName'])} (@${str(buyer['username'])})',
    );
  }
}

class RevenueSummary {
  const RevenueSummary({
    required this.revenue,
    required this.paidOrders,
    required this.revenue30,
    required this.paidOrders30,
    required this.byProduct,
    required this.premiumMembers,
    required this.promotedBusinesses,
  });

  final int revenue;
  final int paidOrders;
  final int revenue30;
  final int paidOrders30;
  final List<({String name, int revenue, int count})> byProduct;
  final int premiumMembers;
  final int promotedBusinesses;

  factory RevenueSummary.fromJson(Json json) => RevenueSummary(
    revenue: intOf(json['revenue']),
    paidOrders: intOf(json['paidOrders']),
    revenue30: intOf(json['revenue30']),
    paidOrders30: intOf(json['paidOrders30']),
    byProduct: listOf(json['byProduct'], (r) {
      final row = mapOf(r);
      return (name: str(row['name']), revenue: intOf(row['revenue']), count: intOf(row['count']));
    }),
    premiumMembers: intOf(json['premiumMembers']),
    promotedBusinesses: intOf(json['promotedBusinesses']),
  );
}

/* ------------------------------------------------------------ businesses */

const businessTypes = ['homestay', 'hotel', 'restaurant', 'cafe', 'tour'];

class Business {
  Business({
    required this.id,
    required this.ownerId,
    required this.slug,
    required this.name,
    required this.type,
    this.description = '',
    this.address = '',
    this.city = '',
    this.lat,
    this.lng,
    this.phone = '',
    this.website = '',
    this.photos = const [],
    this.priceFrom,
    this.priceTo,
    this.openingHours = '',
    this.sponsored = false,
    this.createdAt = '',
    this.status,
    this.statusReason = '',
    this.promotedUntil,
    this.moderation,
    this.ownerLabel,
  });

  final String id;
  final String ownerId;
  final String slug;
  final String name;

  /// homestay | hotel | restaurant | cafe | tour
  final String type;
  final String description;
  final String address;
  final String city;
  final double? lat;
  final double? lng;
  final String phone;
  final String website;
  final List<String> photos;
  final int? priceFrom;
  final int? priceTo;
  final String openingHours;

  /// In "Gợi ý nổi bật" now.
  final bool sponsored;
  final String createdAt;

  /// Owner and admin only: pending | approved | rejected | hidden.
  final String? status;
  final String statusReason;
  final String? promotedUntil;
  final ModerationInfo? moderation;

  /// Admin list only: "Name (@username) · email".
  final String? ownerLabel;

  factory Business.fromJson(Json json) {
    final owner = mapOrNull(json['owner']);
    num? number(Object? v) => v is num ? v : null;
    return Business(
      id: str(json['_id']),
      ownerId: str(json['ownerId']),
      slug: str(json['slug']),
      name: str(json['name']),
      type: str(json['type'], 'homestay'),
      description: str(json['description']),
      address: str(json['address']),
      city: str(json['city']),
      lat: number(json['lat'])?.toDouble(),
      lng: number(json['lng'])?.toDouble(),
      phone: str(json['phone']),
      website: str(json['website']),
      photos: stringList(json['photos']),
      priceFrom: number(json['priceFrom'])?.toInt(),
      priceTo: number(json['priceTo'])?.toInt(),
      openingHours: str(json['openingHours']),
      sponsored: boolOf(json['sponsored']),
      createdAt: str(json['createdAt']),
      status: strOrNull(json['status']),
      statusReason: str(json['statusReason']),
      promotedUntil: strOrNull(json['promotedUntil']),
      moderation: ModerationInfo.fromJson(json['moderation']),
      ownerLabel: owner == null ? null : '${str(owner['displayName'])} (@${str(owner['username'])}) · ${str(owner['email'])}',
    );
  }

  /// What PATCH /api/businesses/me and POST /api/businesses take.
  static Json input({
    required String name,
    required String type,
    required String description,
    required String address,
    required String city,
    required double? lat,
    required double? lng,
    required String phone,
    required String website,
    required List<String> photos,
    required int? priceFrom,
    required int? priceTo,
    required String openingHours,
  }) => {
    'name': name.trim(),
    'type': type,
    'description': description.trim(),
    'address': address.trim(),
    'city': city.trim(),
    'lat': lat,
    'lng': lng,
    'phone': phone.trim(),
    'website': website.trim(),
    'photos': photos,
    'priceFrom': priceFrom,
    'priceTo': priceTo,
    'openingHours': openingHours.trim(),
  };

  bool get promoted => promotedUntil != null && DateTime.tryParse(promotedUntil!)?.isAfter(DateTime.now()) == true;
}

class BusinessAd {
  const BusinessAd({
    required this.id,
    required this.businessId,
    required this.title,
    required this.content,
    this.photos = const [],
    this.offer = '',
    this.createdAt = '',
    this.moderation,
    this.business,
  });

  final String id;
  final String businessId;
  final String title;
  final String content;
  final List<String> photos;
  final String offer;
  final String createdAt;
  final ModerationInfo? moderation;

  /// Sponsored list only: the business it belongs to.
  final Business? business;

  factory BusinessAd.fromJson(Json json) {
    final business = mapOrNull(json['business']);
    return BusinessAd(
      id: str(json['_id']),
      businessId: str(json['businessId']),
      title: str(json['title']),
      content: str(json['content']),
      photos: stringList(json['photos']),
      offer: str(json['offer']),
      createdAt: str(json['createdAt']),
      moderation: ModerationInfo.fromJson(json['moderation']),
      business: business == null ? null : Business.fromJson(business),
    );
  }
}
