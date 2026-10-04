/// Turning what an author pastes or types into a position (web/src/lib/mapsLink.ts):
/// a Google Maps link (full or maps.app.goo.gl), coordinates, or plain text
/// looked up with Mapbox. Short links are followed by the API (server/src/routes/geo.ts).
library;

import '../data/api.dart';
import '../data/json.dart';
import 'geo.dart';

class ResolvedPlace {
  const ResolvedPlace({required this.lat, required this.lng, required this.address, this.name, this.types});

  final double lat;
  final double lng;
  final String address;
  final String? name;
  final List<String>? types;
}

bool _inRange(double lat, double lng) => lat.isFinite && lng.isFinite && lat.abs() <= 90 && lng.abs() <= 180;

/// "15.8801, 108.3380" or "15.8801 108.3380" → position; anything else → null.
({double lat, double lng})? parseCoordinates(String text) {
  final match = RegExp(r'^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$').firstMatch(text.trim());
  if (match == null) return null;
  final lat = double.parse(match.group(1)!);
  final lng = double.parse(match.group(2)!);
  return _inRange(lat, lng) ? (lat: lat, lng: lng) : null;
}

String? _hostOf(String text) {
  final uri = Uri.tryParse(text.trim());
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) return null;
  return uri.host;
}

bool isGoogleMapsUrl(String text) {
  final host = _hostOf(text);
  if (host == null) return false;
  return RegExp(r'(^|\.)google\.[a-z.]+$').hasMatch(host) || host == 'maps.app.goo.gl' || host == 'goo.gl';
}

bool _isShortLink(String text) {
  final host = _hostOf(text);
  return host == 'maps.app.goo.gl' || host == 'goo.gl';
}

String _safeDecode(String value) {
  try {
    return Uri.decodeFull(value);
  } catch (_) {
    return value;
  }
}

/// What a full Google Maps link says about a place.
({double? lat, double? lng, String? name, String? query}) readGoogleMapsUrl(String raw) {
  final url = Uri.parse(raw);
  final text = _safeDecode(raw);

  final nameMatch = RegExp(r'/place/([^/]+)').firstMatch(url.path);
  final placeName = nameMatch == null ? null : _safeDecode(nameMatch.group(1)!).replaceAll('+', ' ').trim();

  final pin = RegExp(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)').firstMatch(text);
  if (pin != null) {
    final lat = double.parse(pin.group(1)!);
    final lng = double.parse(pin.group(2)!);
    if (_inRange(lat, lng)) return (lat: lat, lng: lng, name: placeName, query: null);
  }

  for (final key in ['q', 'query', 'll', 'destination', 'center']) {
    final value = url.queryParameters[key];
    if (value == null || value.isEmpty) continue;
    final coords = parseCoordinates(value);
    if (coords != null) return (lat: coords.lat, lng: coords.lng, name: placeName, query: null);
    if (key == 'q' || key == 'query' || key == 'destination') return (lat: null, lng: null, name: placeName, query: value);
  }

  final at = RegExp(r'@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)').firstMatch(text);
  if (at != null) {
    final lat = double.parse(at.group(1)!);
    final lng = double.parse(at.group(2)!);
    if (_inRange(lat, lng)) return (lat: lat, lng: lng, name: placeName, query: null);
  }

  return (lat: null, lng: null, name: placeName, query: placeName);
}

Future<String> _addressAt(double lat, double lng) async {
  final place = await placeAt(lat, lng).catchError((_) => null);
  if (place == null) return '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
  return [place.name, place.address].where((s) => s.isNotEmpty).join(', ');
}

Future<ResolvedPlace> _lookUp(String text, String? name) async {
  final places = await searchPlaces(text);
  if (places.isEmpty) {
    throw Exception('Không tìm thấy địa chỉ này. Hãy thử dán link Google Maps hoặc chọn trên bản đồ.');
  }
  final place = places.first;
  return ResolvedPlace(
    lat: place.lat,
    lng: place.lng,
    address: [place.name, place.address].where((s) => s.isNotEmpty).join(', '),
    types: place.types,
    name: name,
  );
}

/// Resolves a pasted Google Maps link or typed coordinates. Throws with a message ready to show.
Future<ResolvedPlace> resolveLinkOrCoordinates(String input) async {
  final text = input.trim();

  final coords = parseCoordinates(text);
  if (coords != null) return ResolvedPlace(lat: coords.lat, lng: coords.lng, address: await _addressAt(coords.lat, coords.lng));

  if (!isGoogleMapsUrl(text)) throw Exception('Không nhận ra link hay toạ độ này.');

  var full = text;
  if (_isShortLink(text)) {
    final result = await Api.get('/api/geo/resolve-maps-link?url=${Uri.encodeQueryComponent(text)}');
    full = str(result['url'], text);
  }

  final info = readGoogleMapsUrl(full);
  if (info.lat != null && info.lng != null) {
    final address = info.name ?? await _addressAt(info.lat!, info.lng!);
    return ResolvedPlace(lat: info.lat!, lng: info.lng!, address: address, name: info.name);
  }
  if (info.query != null && info.query!.isNotEmpty) return _lookUp(info.query!, info.name);
  throw Exception('Link Google Maps này không có vị trí. Hãy mở địa điểm trên Google Maps rồi bấm Chia sẻ, Sao chép đường liên kết.');
}

bool looksLikeLinkOrCoordinates(String text) => parseCoordinates(text) != null || isGoogleMapsUrl(text);
