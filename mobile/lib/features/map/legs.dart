/// A trip's stops and the legs between them, each drawn the way it was
/// travelled (web/src/features/map/geometry.ts and legs.ts):
///
/// - driving, walking, transit: the real road route from Mapbox Directions.
///   Saved journeys carry it (`legRoute`); a leg without it is fetched once.
/// - flight: the great circle between the airports, bowed a little, dashed.
/// - ferry: a gentle curve between the piers, dashed.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

import '../../core/env.dart';
import '../../core/itinerary.dart';
import '../../core/travel.dart';
import '../../data/api.dart';
import '../../data/json.dart';
import '../../data/models.dart';

/// One stop of a trip, placed on the map with its day and its place in that day.
class MapStop {
  const MapStop({
    required this.id,
    required this.lng,
    required this.lat,
    required this.name,
    required this.day,
    required this.order,
    required this.mode,
    this.legRoute,
  });

  final String id;
  final double lng;
  final double lat;
  final String name;

  /// 1-based day number.
  final int day;

  /// 1-based position among the day's stops that are on the map.
  final int order;
  final TravelMode mode;
  final LegRoute? legRoute;

  LatLng get point => LatLng(lat, lng);
}

/// Every stop that has a real position, day by day, in itinerary order.
List<MapStop> stopsOfDays(List<TripDay> days) {
  final stops = <MapStop>[];
  for (var d = 0; d < days.length; d++) {
    final pinned = days[d].locations.where(isPinned).toList();
    for (var i = 0; i < pinned.length; i++) {
      final loc = pinned[i];
      stops.add(
        MapStop(id: loc.id, lng: loc.lng, lat: loc.lat, name: loc.name, day: d + 1, order: i + 1, mode: modeOf(loc.travelMode), legRoute: loc.legRoute),
      );
    }
  }
  return stops;
}

class Segment {
  const Segment({required this.from, required this.to, required this.mode, required this.key, this.cached});

  final MapStop from;
  final MapStop to;
  final TravelMode mode;
  final String key;
  final LegRoute? cached;
}

/// Each pair of consecutive stops (all from one day), with how the second was reached.
List<Segment> segmentsOf(List<MapStop> stops) {
  return [
    for (var i = 1; i < stops.length; i++)
      () {
        final from = stops[i - 1];
        final to = stops[i];
        final key = legKey(from.lng, from.lat, to.lng, to.lat, to.mode);
        return Segment(from: from, to: to, mode: to.mode, key: key, cached: to.legRoute?.key == key ? to.legRoute : null);
      }(),
  ];
}

class DrawnSegment {
  const DrawnSegment({
    required this.mode,
    required this.points,
    required this.dashed,
    this.icon,
    this.heading = 0,
    this.duration,
    this.estimated = false,
    this.distance,
  });

  final TravelMode mode;
  final List<LatLng> points;
  final bool dashed;

  /// The plane or boat at the middle.
  final LatLng? icon;

  /// Degrees clockwise from north.
  final double heading;
  final double? duration;
  final bool estimated;
  final double? distance;
}

DrawnSegment drawSegment(Segment seg) {
  final a = (seg.from.lng, seg.from.lat);
  final b = (seg.to.lng, seg.to.lat);
  switch (seg.mode) {
    case TravelMode.flight:
      return _arc(seg, TravelMode.flight, _bow(_greatCircle(a, b, 64), 0.15));
    case TravelMode.ferry:
      return _arc(seg, TravelMode.ferry, _bow(_straight(a, b, 32), 0.08));
    default:
      final route = seg.cached ?? _routes[seg.key];
      return DrawnSegment(
        mode: seg.mode,
        points: route != null ? decodePolyline(route.polyline) : [seg.from.point, seg.to.point],
        dashed: false,
        duration: route?.duration,
        distance: route?.distance,
      );
  }
}

typedef _Xy = (double, double);

const _rad = math.pi / 180;

DrawnSegment _arc(Segment seg, TravelMode mode, List<_Xy> merc) {
  final i = (merc.length - 1) ~/ 2;
  final p = merc[i];
  final q = i + 1 < merc.length ? merc[i + 1] : merc[i];
  final mid = _unproject(((p.$1 + q.$1) / 2, (p.$2 + q.$2) / 2));
  return DrawnSegment(
    mode: mode,
    points: [for (final m in merc) _toLatLng(_unproject(m))],
    dashed: true,
    icon: _toLatLng(mid),
    heading: math.atan2(q.$1 - p.$1, q.$2 - p.$2) / _rad,
    duration: estimatedSeconds(mode, seg.from.lat, seg.from.lng, seg.to.lat, seg.to.lng),
    estimated: true,
  );
}

LatLng _toLatLng(_Xy lngLat) => LatLng(lngLat.$2.clamp(-90, 90).toDouble(), lngLat.$1);

_Xy _project(_Xy lngLat) => (lngLat.$1 * _rad, math.log(math.tan(math.pi / 4 + (lngLat.$2 * _rad) / 2)));

_Xy _unproject(_Xy xy) => (xy.$1 / _rad, (2 * math.atan(math.exp(xy.$2)) - math.pi / 2) / _rad);

List<_Xy> _greatCircle(_Xy a, _Xy b, int steps) {
  final l1 = a.$1 * _rad, p1 = a.$2 * _rad;
  final l2 = b.$1 * _rad, p2 = b.$2 * _rad;
  final d = 2 * math.asin(math.sqrt(math.pow(math.sin((p2 - p1) / 2), 2) + math.cos(p1) * math.cos(p2) * math.pow(math.sin((l2 - l1) / 2), 2)));
  if (d == 0) return [a, b];
  final points = <_Xy>[];
  for (var i = 0; i <= steps; i++) {
    final f = i / steps;
    final aa = math.sin((1 - f) * d) / math.sin(d);
    final bb = math.sin(f * d) / math.sin(d);
    final x = aa * math.cos(p1) * math.cos(l1) + bb * math.cos(p2) * math.cos(l2);
    final y = aa * math.cos(p1) * math.sin(l1) + bb * math.cos(p2) * math.sin(l2);
    final z = aa * math.sin(p1) + bb * math.sin(p2);
    var lng = math.atan2(y, x) / _rad;
    if (points.isNotEmpty) lng += 360 * ((points.last.$1 - lng) / 360).round();
    points.add((lng, math.atan2(z, math.sqrt(x * x + y * y)) / _rad));
  }
  return points;
}

List<_Xy> _straight(_Xy a, _Xy b, int steps) {
  final pa = _project(a);
  final pb = _project(b);
  return [for (var i = 0; i <= steps; i++) _unproject((pa.$1 + (pb.$1 - pa.$1) * i / steps, pa.$2 + (pb.$2 - pa.$2) * i / steps))];
}

/// Bows a path sideways (towards the north), in Mercator; returns Mercator points.
List<_Xy> _bow(List<_Xy> path, double amount) {
  final merc = path.map(_project).toList();
  final start = merc.first;
  final end = merc.last;
  final dx = end.$1 - start.$1;
  final dy = end.$2 - start.$2;
  final length = math.sqrt(dx * dx + dy * dy);
  if (length == 0) return merc;
  var nx = -dy / length;
  var ny = dx / length;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return [
    for (var i = 0; i < merc.length; i++)
      () {
        final lift = math.sin(math.pi * i / (merc.length - 1)) * amount * length;
        return (merc[i].$1 + nx * lift, merc[i].$2 + ny * lift);
      }(),
  ];
}

/// Google's encoded polyline format, at polyline6 precision.
List<LatLng> decodePolyline(String encoded, [int precision = 6]) {
  final factor = math.pow(10, precision).toDouble();
  final points = <LatLng>[];
  var index = 0;
  var lat = 0;
  var lng = 0;

  int next() {
    var result = 0;
    var shift = 0;
    int byte;
    do {
      if (index >= encoded.length) return 0;
      byte = encoded.codeUnitAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return (result & 1) != 0 ? ~(result >> 1) : result >> 1;
  }

  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.add(LatLng((lat / factor).clamp(-90, 90).toDouble(), lng / factor));
  }
  return points;
}

/* ------------------------------------------------------------- Road routes */

final _routes = <String, LegRoute>{};
final _pending = <String, Future<LegRoute?>>{};

bool hasRoute(String key) => _routes.containsKey(key);

Future<LegRoute?> fetchRoute(String key) {
  final known = _routes[key];
  if (known != null) return Future.value(known);
  final inFlight = _pending[key];
  if (inFlight != null) return inFlight;
  final token = Env.mapboxToken;
  if (token == null) return Future.value(null);

  final separator = key.indexOf(':');
  final profile = key.substring(0, separator);
  final coordinates = key.substring(separator + 1);
  final url = 'https://api.mapbox.com/directions/v5/mapbox/$profile/$coordinates?geometries=polyline6&overview=full&access_token=$token';

  final request = Api.getExternal(url)
      .then((data) {
        if (data == null || str(data['code']) != 'Ok') return null;
        final routes = listOf(data['routes'], mapOf);
        if (routes.isEmpty) return null;
        final best = routes.first;
        final route = LegRoute(key: key, polyline: str(best['geometry']), duration: doubleOf(best['duration']), distance: doubleOf(best['distance']));
        _routes[key] = route;
        return route;
      })
      .whenComplete(() => _pending.remove(key));
  _pending[key] = request;
  return request;
}

/// The days with each road leg's route attached, for saving: a route still
/// matching its leg is kept, a changed leg is fetched afresh, and flights,
/// boats and day starts carry none.
Future<List<TripDay>> withLegRoutes(List<TripDay> days) async {
  final out = <TripDay>[];
  for (final day in days) {
    final copy = day.copy();
    TripLocation? previous;
    for (final loc in copy.locations) {
      if (!isPinned(loc)) {
        loc.legRoute = null;
        continue;
      }
      final from = previous;
      previous = loc;
      final mode = modeOf(loc.travelMode);
      if (from == null || !isRoadMode(mode)) {
        loc.legRoute = null;
        continue;
      }
      final key = legKey(from.lng, from.lat, loc.lng, loc.lat, mode);
      if (loc.legRoute?.key == key) continue;
      loc.legRoute = await fetchRoute(key).timeout(const Duration(seconds: 12), onTimeout: () => null);
    }
    out.add(copy);
  }
  return out;
}
