/// Travel modes: how a leg between two stops was travelled (web/src/lib/travel.ts).
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../data/models.dart';

const modeLabels = {
  TravelMode.driving: 'Ô tô, xe máy',
  TravelMode.walking: 'Đi bộ',
  TravelMode.transit: 'Xe buýt, xe khách',
  TravelMode.flight: 'Máy bay',
  TravelMode.ferry: 'Tàu, phà, ca nô',
};

/// The icon for each travel mode, shared by the editor's picker and the map.
const modeIcons = <TravelMode, IconData>{
  TravelMode.driving: LucideIcons.car,
  TravelMode.walking: LucideIcons.footprints,
  TravelMode.transit: LucideIcons.bus,
  TravelMode.flight: LucideIcons.plane,
  TravelMode.ferry: LucideIcons.ship,
};

bool isRoadMode(TravelMode mode) => mode == TravelMode.driving || mode == TravelMode.walking || mode == TravelMode.transit;

/// A stop's travel mode. Older stops have none and read as driving.
TravelMode modeOf(String? travelMode) {
  switch (travelMode) {
    case 'walking':
      return TravelMode.walking;
    case 'transit':
      return TravelMode.transit;
    case 'flight':
      return TravelMode.flight;
    case 'ferry':
    case 'water':
      return TravelMode.ferry;
    default:
      return TravelMode.driving;
  }
}

String profileOf(TravelMode mode) => mode == TravelMode.walking ? 'walking' : 'driving';

/// Names a road leg; the server computes the same key (server/src/routes/posts.ts).
String legKey(double fromLng, double fromLat, double toLng, double toLat, TravelMode mode) {
  String at(double lng, double lat) => '${lng.toStringAsFixed(5)},${lat.toStringAsFixed(5)}';
  return '${profileOf(mode)}:${at(fromLng, fromLat)};${at(toLng, toLat)}';
}

double haversineKm(double lat1, double lng1, double lat2, double lng2) {
  const rad = math.pi / 180;
  final dLat = (lat2 - lat1) * rad;
  final dLng = (lng2 - lng1) * rad;
  final h = math.pow(math.sin(dLat / 2), 2) + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.pow(math.sin(dLng / 2), 2);
  return 2 * 6371 * math.asin(math.sqrt(h));
}

const _airport = {'airport'};
const _pier = {'ferry_terminal', 'port', 'ferry', 'harbor', 'marina'};

bool _isA(List<String>? types, Set<String> kinds) => (types ?? const []).any(kinds.contains);

/// The likely way from one place to the next, to prefill a new leg.
TravelMode suggestMode(TripLocation from, TripLocation to) {
  if (_isA(from.placeTypes, _airport) && _isA(to.placeTypes, _airport)) return TravelMode.flight;
  if (_isA(from.placeTypes, _pier) && _isA(to.placeTypes, _pier)) return TravelMode.ferry;
  final typesUnknown = (from.placeTypes ?? const []).isEmpty || (to.placeTypes ?? const []).isEmpty;
  if (typesUnknown && haversineKm(from.lat, from.lng, to.lat, to.lng) > 500) return TravelMode.flight;
  return TravelMode.driving;
}

double estimatedSeconds(TravelMode mode, double lat1, double lng1, double lat2, double lng2) {
  final km = haversineKm(lat1, lng1, lat2, lng2);
  return mode == TravelMode.flight ? (km / 800) * 3600 + 30 * 60 : (km / 30) * 3600;
}

/// "45 phút", "2 giờ 10 phút".
String formatTravelDuration(double seconds, {bool estimate = false}) {
  final step = estimate ? 5 : 1;
  final rounded = ((seconds / 60 / step).round() * step);
  final minutes = rounded < step ? step : rounded;
  if (minutes < 60) return '$minutes phút';
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  return rest > 0 ? '$hours giờ $rest phút' : '$hours giờ';
}

String formatDistance(double metres) => metres < 1000 ? '${metres.round()} m' : '${(metres / 1000).toStringAsFixed(metres < 10000 ? 1 : 0)} km';
