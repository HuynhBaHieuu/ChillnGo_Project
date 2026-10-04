/// Journey arithmetic shared by the editor, itineraries and maps.
library;

import '../data/models.dart';

/// Where a new stop sits until the author picks a place: never shown on a map.
const unpinnedLng = 106.0;
const unpinnedLat = 16.0;

bool isPinned(TripLocation location) => !(location.lng == unpinnedLng && location.lat == unpinnedLat);

int dayCostOf(TripDay day) => day.locations.fold(0, (sum, loc) => sum + loc.estCost);

int totalCostOf(List<TripDay> days) => days.fold(0, (sum, day) => sum + dayCostOf(day));

/// A copy of [items] with the item at [from] moved to [to].
List<T> moveItem<T>(List<T> items, int from, int to) {
  final next = [...items];
  final moved = next.removeAt(from);
  next.insert(to, moved);
  return next;
}

String _two(int n) => n.toString().padLeft(2, '0');

/// "YYYY-MM-DD" + n days, in UTC so time zones never shift the date.
String addDays(String date, int days) {
  final parsed = DateTime.tryParse('${date}T00:00:00.000Z') ?? DateTime.now().toUtc();
  final d = parsed.add(Duration(days: days));
  return '${d.year}-${_two(d.month)}-${_two(d.day)}';
}

/// "3 ngày · 5 địa điểm"
String journeyStats(List<TripDay> days) {
  final places = days.fold(0, (sum, day) => sum + day.locations.length);
  return '${days.length} ngày · $places địa điểm';
}

/// "Đà Nẵng → Hội An" from the first and last named stops.
String? journeyRoute(List<TripDay> days) {
  final names = [
    for (final day in days)
      for (final loc in day.locations)
        if (loc.name.trim().isNotEmpty) loc.name.trim(),
  ];
  if (names.length < 2) return null;
  return names.first == names.last ? names.first : '${names.first} → ${names.last}';
}
