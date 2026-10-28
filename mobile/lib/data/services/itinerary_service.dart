/// Cloned itineraries (demo data, as on the web; web/src/services/itinerary.service.ts).
library;

import '../../core/itinerary.dart';
import '../api.dart';
import '../mock_db.dart';
import '../models.dart';

MockDb get _db => MockDb.instance;

List<TripDay> _rekeyDays(List<TripDay> days, String itineraryId, String startDate) {
  return [
    for (var i = 0; i < days.length; i++)
      days[i].copy()
        ..id = '${itineraryId}_d${i + 1}'
        ..dayNumber = i + 1
        ..date = addDays(startDate, i)
        ..locations = [for (var j = 0; j < days[i].locations.length; j++) days[i].locations[j].copy()..id = '${itineraryId}_d${i + 1}_l${j + 1}'],
  ];
}

ClonedItinerary _own(String id, [String? ownerId]) {
  final itinerary = assertFound(_db.clonedItineraries.where((it) => it.id == id).firstOrNull, 'Không tìm thấy lịch trình này. Có thể nó đã bị xoá.');
  if (ownerId != null && itinerary.ownerId != ownerId) throw ApiError('Không tìm thấy lịch trình này.', status: 404);
  return itinerary;
}

void _renumber(ClonedItinerary itinerary) {
  for (var i = 0; i < itinerary.days.length; i++) {
    itinerary.days[i]
      ..dayNumber = i + 1
      ..date = addDays(itinerary.startDate, i);
  }
  itinerary.totalEstCost = totalCostOf(itinerary.days);
  itinerary.updatedAt = nowIso();
}

abstract final class ItineraryService {
  static Future<List<ClonedItinerary>> getMyItineraries(String ownerId) async {
    await mockDelay();
    final mine = _db.clonedItineraries.where((it) => it.ownerId == ownerId).toList()..sort((a, b) => byNewest(a.updatedAt, b.updatedAt));
    return mine.map((it) => it.copy()).toList();
  }

  /// One of [ownerId]'s itineraries; someone else's is "not found".
  static Future<ClonedItinerary> getItineraryById(String id, {String? ownerId}) async {
    await mockDelay();
    return _own(id, ownerId).copy();
  }

  /// Copies every day of a post into a new itinerary owned by the viewer.
  static Future<ClonedItinerary> clonePost({required String postId, required String ownerId, String? title, String? startDate}) async {
    await mockDelay();
    final post = assertFound(_db.postById(postId), 'Không tìm thấy hành trình này.');
    if (post.days.isEmpty) throw ApiError('Hành trình này chưa có ngày nào để sao chép.', status: 400);

    final id = nextId('ci');
    final start = (startDate == null || startDate.isEmpty) ? post.startDate : startDate;
    final days = _rekeyDays(post.days, id, start);
    final name = title?.trim() ?? '';

    final itinerary = ClonedItinerary(
      id: id,
      ownerId: ownerId,
      sourcePostIds: [post.id],
      title: name.isNotEmpty ? name : '${post.title} (bản của tôi)',
      note: 'Sao chép từ bài viết "${post.title}".',
      coverUrl: post.coverUrl,
      startDate: start,
      days: days,
      totalEstCost: totalCostOf(days),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    );
    _db.clonedItineraries.insert(0, itinerary);
    post.cloneCount += 1;
    return itinerary.copy();
  }

  /// Persists a new day order: renumbers, re-dates and re-totals.
  static Future<ClonedItinerary> reorderDays(String id, List<String> orderedDayIds) async {
    await mockDelay();
    final itinerary = _own(id);
    final byId = {for (final d in itinerary.days) d.id: d};
    final reordered = [for (final dayId in orderedDayIds) ?byId[dayId]];
    for (final day in itinerary.days) {
      if (!orderedDayIds.contains(day.id)) reordered.add(day);
    }
    itinerary.days = reordered;
    _renumber(itinerary);
    return itinerary.copy();
  }

  /// Appends selected days from other posts, renumbered and re-keyed.
  static Future<ClonedItinerary> mergeInto(String itineraryId, List<({String postId, List<String> dayIds})> selections) async {
    await mockDelay();
    final itinerary = _own(itineraryId);
    final incoming = <TripDay>[];
    for (final selection in selections) {
      final post = _db.postById(selection.postId);
      if (post == null) continue;
      for (final dayId in selection.dayIds) {
        final day = post.days.where((d) => d.id == dayId).firstOrNull;
        if (day != null) incoming.add(day);
      }
      if (!itinerary.sourcePostIds.contains(post.id)) itinerary.sourcePostIds.add(post.id);
    }
    itinerary.days = _rekeyDays([...itinerary.days, ...incoming], itinerary.id, itinerary.startDate);
    itinerary.totalEstCost = totalCostOf(itinerary.days);
    itinerary.updatedAt = nowIso();
    return itinerary.copy();
  }

  static Future<ClonedItinerary> removeDay(String id, String dayId) async {
    await mockDelay();
    final itinerary = _own(id);
    if (itinerary.days.length <= 1) throw ApiError('Lịch trình cần ít nhất một ngày.', status: 400);
    itinerary.days = itinerary.days.where((d) => d.id != dayId).toList();
    _renumber(itinerary);
    return itinerary.copy();
  }
}
