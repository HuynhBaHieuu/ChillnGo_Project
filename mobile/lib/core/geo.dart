/// Places: search by name (Mapbox Search Box, as the web app), the phone's own
/// position, and links out to maps. Without a Mapbox token, search is off but
/// "use my location" still works, without a place name.
library;

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';

import '../data/api.dart';
import '../data/json.dart';
import '../data/models.dart';
import 'env.dart';

bool get canSearchPlaces => Env.mapboxToken != null;

const _search = 'https://api.mapbox.com/search/searchbox/v1';

Place _toPlace(Json feature) {
  final props = mapOf(feature['properties']);
  final coords = listOf(mapOf(feature['geometry'])['coordinates'], doubleOf);
  final types = <String>{...stringList(props['poi_category_ids']), if (str(props['maki']).isNotEmpty) str(props['maki'])};
  final formatted = str(props['place_formatted']);
  return Place(
    name: str(props['name']),
    address: formatted.isNotEmpty ? formatted : str(props['full_address']),
    lng: coords.isNotEmpty ? coords[0] : 0,
    lat: coords.length > 1 ? coords[1] : 0,
    types: types.toList(),
  );
}

List<Place> _distinct(List<Place> places) {
  final seen = <String>{};
  return places.where((p) => seen.add('${p.name.toLowerCase()}|${p.address.toLowerCase()}')).toList();
}

/// Places matching [text], near [near] when given (Mapbox guesses from the IP otherwise).
Future<List<Place>> searchPlaces(String text, {CancelToken? cancel, ({double lat, double lng})? near}) async {
  final token = Env.mapboxToken;
  if (token == null || text.trim().length < 2) return [];
  final params = queryString({
    'q': text.trim(),
    'access_token': token,
    'language': 'vi',
    'limit': '8',
    'proximity': near == null ? 'ip' : '${near.lng},${near.lat}',
  });
  final data = await Api.getExternal('$_search/forward$params', cancel: cancel);
  if (cancel?.isCancelled ?? false) return [];
  if (data == null) throw Exception('Không tìm được địa điểm lúc này. Vui lòng thử lại.');
  return _distinct(listOf(data['features'], (f) => _toPlace(mapOf(f)))).take(6).toList();
}

/// The named place at a position, or null when Mapbox has none.
Future<Place?> placeAt(double lat, double lng) async {
  final token = Env.mapboxToken;
  if (token == null) return null;
  final params = queryString({'longitude': '$lng', 'latitude': '$lat', 'access_token': token, 'language': 'vi', 'limit': '1'});
  final data = await Api.getExternal('$_search/reverse$params');
  final features = listOf(data?['features'], mapOf);
  if (features.isEmpty) return null;
  return _toPlace(features.first).copyWith(lat: lat, lng: lng);
}

/// Asks for the phone's position. Throws with a message ready to show.
Future<({double lat, double lng})> getDevicePosition() async {
  final enabled = await Geolocator.isLocationServiceEnabled().catchError((_) => true);
  if (!enabled) {
    throw Exception('Định vị trên điện thoại đang tắt. Hãy bật Vị trí rồi thử lại, hoặc tìm địa điểm bằng tên.');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
  if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
    throw Exception('Bạn chưa cho ChillnGo dùng vị trí. Hãy bật quyền Vị trí trong Cài đặt, hoặc tìm địa điểm bằng tên.');
  }
  try {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
    );
    return (lat: position.latitude, lng: position.longitude);
  } catch (error) {
    // A recent fix is better than nothing indoors.
    final last = await Geolocator.getLastKnownPosition().catchError((_) => null);
    if (last != null) return (lat: last.latitude, lng: last.longitude);
    throw Exception(
      error is TimeoutException ? 'Lấy vị trí quá lâu. Vui lòng thử lại.' : 'Không xác định được vị trí của điện thoại. Hãy tìm địa điểm bằng tên.',
    );
  }
}

/// A static street map with a pin, for check-in cards. Null without a token.
String? staticMapUrl(double lat, double lng, int width, int height) {
  final token = Env.mapboxToken;
  if (token == null) return null;
  final pin = 'pin-m+d60072($lng,$lat)';
  final w = width.clamp(1, 1280);
  final h = height.clamp(1, 1280);
  return 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/$pin/$lng,$lat,14/${w}x$h@2x?access_token=$token';
}

String googleMapsUrl(double lat, double lng) => 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';

String googleMapsSearchUrl(String text) =>
    'https://www.google.com/maps/search/?api=1&query=${Uri.encodeQueryComponent(text.trim().isEmpty ? 'Việt Nam' : text.trim())}';

String googleDirectionsUrl(double lat, double lng) => 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng';
