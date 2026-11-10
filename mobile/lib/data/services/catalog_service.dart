/// The AI catalog (server/src/routes/adminCatalog.ts; web: catalog.service.ts):
/// destinations, places and the preparation checklist. Needs an admin with
/// the Danh mục module. Saving replaces the whole record.
library;

import '../api.dart';
import '../json.dart';
import '../models.dart';

class CatalogMeta {
  const CatalogMeta({required this.categories, required this.placeTags, required this.checklistTags});

  /// key → Vietnamese label (translate with tx()).
  final Map<String, String> categories;
  final List<String> placeTags;
  final List<String> checklistTags;

  factory CatalogMeta.fromJson(Json json) => CatalogMeta(
    categories: {for (final c in listOf(json['categories'], (c) => mapOf(c))) str(c['key']): str(c['label'])},
    placeTags: stringList(json['placeTags']),
    checklistTags: stringList(json['checklistTags']),
  );
}

class CatalogFestival {
  const CatalogFestival(this.name, this.month);

  final String name;
  final int month;

  Json toJson() => {'name': name, 'month': month};
}

class CatalogDestination {
  const CatalogDestination({
    required this.id,
    required this.slug,
    required this.name,
    required this.region,
    required this.lat,
    required this.lng,
    required this.radiusKm,
    required this.rainyMonths,
    required this.peakMonths,
    required this.festivals,
    this.placeCount = 0,
  });

  final String id;
  final String slug;
  final String name;
  final String region;
  final double lat;
  final double lng;
  final double radiusKm;
  final List<int> rainyMonths;
  final List<int> peakMonths;
  final List<CatalogFestival> festivals;
  final int placeCount;

  factory CatalogDestination.fromJson(Json json) => CatalogDestination(
    id: str(json['_id']),
    slug: str(json['slug']),
    name: str(json['name']),
    region: str(json['region']),
    lat: doubleOf(json['lat']),
    lng: doubleOf(json['lng']),
    radiusKm: doubleOf(json['radiusKm']),
    rainyMonths: listOf(json['rainyMonths'], (m) => intOf(m)),
    peakMonths: listOf(json['peakMonths'], (m) => intOf(m)),
    festivals: listOf(json['festivals'], (f) => CatalogFestival(str(mapOf(f)['name']), intOf(mapOf(f)['month'], 1))),
    placeCount: intOf(json['placeCount']),
  );

  Json toJson() => {
    'slug': slug,
    'name': name,
    'region': region,
    'lat': lat,
    'lng': lng,
    'radiusKm': radiusKm,
    'rainyMonths': rainyMonths,
    'peakMonths': peakMonths,
    'festivals': [for (final f in festivals) f.toJson()],
  };
}

num? _numOrNull(Object? value) => value is num ? value : null;
bool? _boolOrNull(Object? value) => value is bool ? value : null;

class CatalogPlace {
  const CatalogPlace({
    required this.id,
    required this.destinationId,
    required this.name,
    this.address = '',
    this.lat,
    this.lng,
    this.category,
    this.avgCost,
    this.priceLevel,
    this.open,
    this.close,
    this.isOutdoor,
    this.requiresBooking,
    this.rating,
    this.photoUrl,
    this.tags = const [],
  });

  final String id;
  final String destinationId;
  final String name;
  final String address;
  final double? lat;
  final double? lng;
  final String? category;
  final int? avgCost;
  final int? priceLevel;
  final String? open;
  final String? close;
  final bool? isOutdoor;
  final bool? requiresBooking;
  final double? rating;
  final String? photoUrl;
  final List<String> tags;

  factory CatalogPlace.fromJson(Json json) {
    final hours = mapOrNull(json['openingHours']);
    return CatalogPlace(
      id: str(json['_id']),
      destinationId: str(json['destinationId']),
      name: str(json['name']),
      address: str(json['address']),
      lat: _numOrNull(json['lat'])?.toDouble(),
      lng: _numOrNull(json['lng'])?.toDouble(),
      category: strOrNull(json['category']),
      avgCost: _numOrNull(json['avgCost'])?.toInt(),
      priceLevel: _numOrNull(json['priceLevel'])?.toInt(),
      open: hours == null ? null : strOrNull(hours['open']),
      close: hours == null ? null : strOrNull(hours['close']),
      isOutdoor: _boolOrNull(json['isOutdoor']),
      requiresBooking: _boolOrNull(json['requiresBooking']),
      rating: _numOrNull(json['rating'])?.toDouble(),
      photoUrl: strOrNull(json['photoUrl']),
      tags: stringList(json['tags']),
    );
  }

  Json toJson() => {
    'destinationId': destinationId,
    'name': name,
    'address': address,
    'lat': lat,
    'lng': lng,
    'category': category,
    'avgCost': avgCost,
    'priceLevel': priceLevel,
    'openingHours': open != null && close != null ? {'open': open, 'close': close} : null,
    'isOutdoor': isOutdoor,
    'requiresBooking': requiresBooking,
    'rating': rating,
    'photoUrl': photoUrl,
    'tags': tags,
  };
}

class ChecklistItem {
  const ChecklistItem({required this.id, required this.text, required this.group, required this.tags, this.order = 0});

  final String id;
  final String text;
  final String group;
  final List<String> tags;
  final int order;

  factory ChecklistItem.fromJson(Json json) =>
      ChecklistItem(id: str(json['_id']), text: str(json['text']), group: str(json['group']), tags: stringList(json['tags']), order: intOf(json['order']));

  Json toJson() => {'text': text, 'group': group, 'tags': tags, 'order': order};
}

abstract final class CatalogService {
  static const _base = '/api/admin/catalog';

  static Future<CatalogMeta> getMeta() async => CatalogMeta.fromJson(await Api.get('$_base/meta'));

  static Future<List<CatalogDestination>> listDestinations() async =>
      listOf((await Api.get('$_base/destinations'))['items'], (d) => CatalogDestination.fromJson(mapOf(d)));

  static Future<void> saveDestination(String? id, CatalogDestination input) async {
    if (id == null) {
      await Api.post('$_base/destinations', body: input.toJson());
    } else {
      await Api.put('$_base/destinations/$id', body: input.toJson());
    }
  }

  static Future<void> deleteDestination(String id) => Api.delete('$_base/destinations/$id');

  static Future<AdminPage<CatalogPlace>> listPlaces({String? q, String? destinationId, String? category, int page = 1}) async {
    final data = await Api.get('$_base/places${queryString({'q': q, 'destinationId': destinationId, 'category': category, 'page': page})}');
    return AdminPage(
      items: listOf(data['items'], (p) => CatalogPlace.fromJson(mapOf(p))),
      total: intOf(data['total']),
      page: intOf(data['page'], 1),
      pageSize: intOf(data['pageSize'], 20),
    );
  }

  static Future<void> savePlace(String? id, CatalogPlace input) async {
    if (id == null) {
      await Api.post('$_base/places', body: input.toJson());
    } else {
      await Api.put('$_base/places/$id', body: input.toJson());
    }
  }

  static Future<void> deletePlace(String id) => Api.delete('$_base/places/$id');

  static Future<List<ChecklistItem>> listChecklist() async =>
      listOf((await Api.get('$_base/checklist'))['items'], (i) => ChecklistItem.fromJson(mapOf(i)));

  static Future<void> saveChecklistItem(String? id, ChecklistItem input) async {
    if (id == null) {
      await Api.post('$_base/checklist', body: input.toJson());
    } else {
      await Api.put('$_base/checklist/$id', body: input.toJson());
    }
  }

  static Future<void> deleteChecklistItem(String id) => Api.delete('$_base/checklist/$id');
}
