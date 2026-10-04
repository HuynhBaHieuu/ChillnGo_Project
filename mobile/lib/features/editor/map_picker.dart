import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/geo.dart';
import '../../core/maps_link.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../ui/buttons.dart';
import '../../ui/sheets.dart';
import '../map/map_tiles.dart';
import '../../ui/navigation.dart';

/// Vietnam, where most stops are, when the stop has no position yet.
const _vietnam = LatLng(16.2, 106.2);

/// Choose a position on the map (web: MapPickerDialog): move the map under the
/// pin, or tap a spot to bring it there. Resolves to the place, or null.
Future<ResolvedPlace?> pickPlaceOnMap(BuildContext context, {double? lat, double? lng}) {
  return Navigator.of(
    context,
    rootNavigator: true,
  ).push<ResolvedPlace>(MaterialPageRoute(fullscreenDialog: true, builder: (_) => _MapPicker(initial: lat != null && lng != null ? LatLng(lat, lng) : null)));
}

class _MapPicker extends StatefulWidget {
  const _MapPicker({this.initial});

  final LatLng? initial;

  @override
  State<_MapPicker> createState() => _MapPickerState();
}

class _MapPickerState extends State<_MapPicker> {
  final _map = MapController();
  late LatLng _center = widget.initial ?? _vietnam;
  bool _moved = false;
  bool _locating = false;
  bool _confirming = false;

  bool get _hasPosition => widget.initial != null || _moved;

  Future<void> _goToMe() async {
    setState(() => _locating = true);
    try {
      final me = await getDevicePosition();
      final point = LatLng(me.lat, me.lng);
      _map.move(point, 16);
      setState(() {
        _center = point;
        _moved = true;
      });
    } catch (error) {
      if (mounted) toast(context, errorMessage(error), error: true);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _confirm() async {
    setState(() => _confirming = true);
    final place = await placeAt(_center.latitude, _center.longitude).catchError((_) => null);
    if (!mounted) return;
    Navigator.of(context).pop(
      ResolvedPlace(
        lat: _center.latitude,
        lng: _center.longitude,
        address: place == null
            ? '${_center.latitude.toStringAsFixed(5)}, ${_center.longitude.toStringAsFixed(5)}'
            : [place.name, place.address].where((s) => s.isNotEmpty).join(', '),
        name: place?.name,
        types: place?.types,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Chọn vị trí trên bản đồ')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 10),
            child: Text('Kéo bản đồ để đặt ghim đúng chỗ, hoặc chạm vào một điểm để đưa ghim tới đó.', style: AppText.meta),
          ),
          Expanded(
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: _center,
                    initialZoom: widget.initial != null ? 15 : 5.2,
                    backgroundColor: AppColors.canopy,
                    interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
                    onPositionChanged: (camera, hasGesture) {
                      setState(() {
                        _center = camera.center;
                        if (hasGesture) _moved = true;
                      });
                    },
                    onTap: (_, point) {
                      _map.move(point, _map.camera.zoom);
                      setState(() {
                        _center = point;
                        _moved = true;
                      });
                    },
                  ),
                  children: [baseTiles(), mapAttribution()],
                ),
                // The pin stays in the middle; its tip marks the spot.
                const IgnorePointer(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.only(bottom: 40),
                      child: Icon(
                        Icons.location_on,
                        size: 44,
                        color: AppColors.primary,
                        shadows: [Shadow(blurRadius: 8, color: Color(0x88000000))],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 12,
                  bottom: 30,
                  child: AppIconButton(
                    icon: LucideIcons.locateFixed,
                    label: 'Đến vị trí của tôi',
                    tone: IconTone.overlay,
                    size: 46,
                    loading: _locating,
                    onPressed: _goToMe,
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(kGutter, 10, kGutter, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _hasPosition ? 'Toạ độ: ${_center.latitude.toStringAsFixed(5)}, ${_center.longitude.toStringAsFixed(5)}' : 'Chưa chọn vị trí',
                    style: AppText.meta,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: AppButton(label: 'Huỷ', variant: ButtonVariant.outline, onPressed: _confirming ? null : () => Navigator.of(context).pop()),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: AppButton(label: 'Dùng vị trí này', loading: _confirming, onPressed: _hasPosition ? _confirm : null),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
