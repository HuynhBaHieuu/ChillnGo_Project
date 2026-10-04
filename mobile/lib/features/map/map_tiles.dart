import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../../core/env.dart';
import '../../core/theme.dart';

/// The base map: Mapbox Streets, as on the web, or OpenStreetMap without a token.
TileLayer baseTiles() {
  final token = Env.mapboxToken;
  if (token != null) {
    return TileLayer(
      urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=$token',
      maxNativeZoom: 20,
      userAgentPackageName: 'vn.chillngo.chillngo',
    );
  }
  return TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxNativeZoom: 19, userAgentPackageName: 'vn.chillngo.chillngo');
}

/// The map data credit, required by both providers.
Widget mapAttribution() => SimpleAttributionWidget(
  backgroundColor: const Color(0xCCFFFFFF),
  source: Text(Env.mapboxToken != null ? '© Mapbox © OpenStreetMap' : '© OpenStreetMap', style: AppText.meta.copyWith(fontSize: 10, color: AppColors.ground)),
);
