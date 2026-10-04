import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../core/travel.dart';
import '../../data/models.dart';
import '../../ui/buttons.dart';
import 'legs.dart';
import 'map_tiles.dart';

/// A trip's route on a map (web: MapboxMap with `days`): every stop numbered in
/// its day's colour; picking a day (its chip, or one of its stops) draws that
/// day's legs the way they were travelled. In a scrolling page the map is a
/// still preview; "Phóng to" opens it full screen to pan and zoom.
class RouteMap extends StatelessWidget {
  const RouteMap({super.key, required this.days, this.height = 260, this.label = 'Bản đồ hành trình'});

  final List<TripDay> days;
  final double height;
  final String label;

  @override
  Widget build(BuildContext context) {
    final stops = stopsOfDays(days);
    if (stops.isEmpty) {
      return Container(
        height: math.min(height, 160),
        alignment: Alignment.center,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: const Color(0x29FFFFFF)),
        ),
        child: Text('Chưa có điểm dừng nào được ghim trên bản đồ.', style: AppText.meta, textAlign: TextAlign.center),
      );
    }
    return Semantics(
      label: label,
      child: SizedBox(
        height: height,
        child: Stack(
          children: [
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                child: RouteMapView(days: days, interactive: false),
              ),
            ),
            Positioned(
              right: 10,
              bottom: 22,
              child: AppIconButton(
                icon: LucideIcons.maximize2,
                label: 'Mở bản đồ toàn màn hình',
                tone: IconTone.overlay,
                size: 38,
                onPressed: () => Navigator.of(
                  context,
                  rootNavigator: true,
                ).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => _FullScreenMap(days: days))),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FullScreenMap extends StatelessWidget {
  const _FullScreenMap({required this.days});

  final List<TripDay> days;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: AppColors.canopy,
      body: Stack(
        children: [
          Positioned.fill(
            child: RouteMapView(days: days, interactive: true, topInset: top),
          ),
          Positioned(
            top: top + 8,
            right: 12,
            child: AppIconButton(icon: LucideIcons.x, label: 'Đóng bản đồ', tone: IconTone.overlay, size: 42, onPressed: () => Navigator.of(context).pop()),
          ),
        ],
      ),
    );
  }
}

/// The map itself, with day chips, numbered stops, legs and the tapped leg's details.
class RouteMapView extends StatefulWidget {
  const RouteMapView({super.key, required this.days, required this.interactive, this.topInset = 0});

  final List<TripDay> days;
  final bool interactive;
  final double topInset;

  @override
  State<RouteMapView> createState() => _RouteMapViewState();
}

class _RouteMapViewState extends State<RouteMapView> {
  final _map = MapController();
  final _hits = ValueNotifier<LayerHitResult<int>?>(null);
  int? _day;
  int? _picked;
  bool _ready = false;
  int _routesArrived = 0;

  late List<MapStop> _stops = stopsOfDays(widget.days);

  @override
  void didUpdateWidget(RouteMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.days != widget.days) {
      _stops = stopsOfDays(widget.days);
      _fit();
    }
  }

  @override
  void dispose() {
    _hits.dispose();
    super.dispose();
  }

  List<int> get _stopDays => _stops.map((s) => s.day).toSet().toList();

  int? get _activeDay => _day != null && _stopDays.contains(_day) ? _day : null;

  List<Segment> get _segments => _activeDay == null ? const [] : segmentsOf(_stops.where((s) => s.day == _activeDay).toList());

  void _fetchMissing(List<Segment> segments) {
    final missing = segments.where((s) => isRoadMode(s.mode) && s.cached == null && !hasRoute(s.key)).toList();
    if (missing.isEmpty) return;
    Future.wait(missing.map((s) => fetchRoute(s.key))).then((_) {
      if (mounted) setState(() => _routesArrived++);
    });
  }

  EdgeInsets get _padding => EdgeInsets.fromLTRB(40, 70 + widget.topInset, 40, 60);

  /// Frame the picked day (arcs bow outside their stops), or everything.
  void _fit() {
    if (!_ready) return;
    final day = _activeDay;
    final drawn = day == null ? const <DrawnSegment>[] : _segments.map(drawSegment).toList();
    final points = day == null
        ? _stops.map((s) => s.point).toList()
        : [..._stops.where((s) => s.day == day).map((s) => s.point), for (final d in drawn.where((d) => d.dashed)) ...d.points];
    if (points.isEmpty) return;
    if (points.length == 1) {
      _map.move(points.first, 13);
      return;
    }
    _map.fitCamera(CameraFit.coordinates(coordinates: points, padding: _padding, maxZoom: 15));
  }

  void _selectDay(int? day) {
    setState(() {
      _day = day;
      _picked = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _fit());
  }

  @override
  Widget build(BuildContext context) {
    final activeDay = _activeDay;
    final segments = _segments;
    _fetchMissing(segments);
    final drawn = segments.map(drawSegment).toList();
    final color = dayColor(activeDay ?? 1);
    final picked = _picked != null && _picked! < drawn.length ? drawn[_picked!] : null;
    final stopPoints = _stops.map((s) => s.point).toList();

    return Stack(
      children: [
        FlutterMap(
          mapController: _map,
          options: MapOptions(
            initialCameraFit: stopPoints.length > 1
                ? CameraFit.coordinates(coordinates: stopPoints, padding: _padding, maxZoom: 15)
                : CameraFit.coordinates(coordinates: stopPoints, maxZoom: 13),
            backgroundColor: AppColors.canopy,
            interactionOptions: InteractionOptions(flags: widget.interactive ? InteractiveFlag.all & ~InteractiveFlag.rotate : InteractiveFlag.none),
            onMapReady: () => _ready = true,
            onTap: (_, _) {
              if (_hits.value != null) return;
              setState(() => _picked = null);
              if (widget.interactive) _selectDay(null);
            },
          ),
          children: [
            baseTiles(),
            GestureDetector(
              onTap: () {
                final hit = _hits.value;
                if (hit != null && hit.hitValues.isNotEmpty) setState(() => _picked = hit.hitValues.first);
              },
              child: PolylineLayer<int>(
                hitNotifier: _hits,
                minimumHitbox: 16,
                polylines: [
                  for (var i = 0; i < drawn.length; i++)
                    Polyline<int>(
                      points: drawn[i].points,
                      color: color,
                      strokeWidth: drawn[i].dashed ? 3 : 4,
                      pattern: drawn[i].dashed ? StrokePattern.dashed(segments: const [10, 8]) : const StrokePattern.solid(),
                      borderColor: const Color(0xCCFFFFFF),
                      borderStrokeWidth: drawn[i].dashed ? 0 : 1.5,
                      hitValue: i,
                    ),
                ],
              ),
            ),
            MarkerLayer(
              markers: [
                for (var i = 0; i < drawn.length; i++)
                  if (drawn[i].icon != null)
                    Marker(
                      point: drawn[i].icon!,
                      width: 30,
                      height: 30,
                      child: GestureDetector(
                        onTap: () => setState(() => _picked = i),
                        child: _ModeBubble(segment: drawn[i], color: color),
                      ),
                    ),
                for (final stop in _stops.where((s) => s.day != activeDay)) _stopMarker(stop, activeDay),
                for (final stop in _stops.where((s) => s.day == activeDay)) _stopMarker(stop, activeDay),
              ],
            ),
            mapAttribution(),
          ],
        ),
        if (_stopDays.isNotEmpty)
          Positioned(
            left: 0,
            right: widget.interactive ? 64 : 0,
            top: 8 + widget.topInset,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                children: [
                  _DayChip(label: 'Tất cả', selected: activeDay == null, onTap: () => _selectDay(null)),
                  for (final day in _stopDays)
                    Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: _DayChip(label: 'Ngày $day', color: dayColor(day), selected: activeDay == day, onTap: () => _selectDay(day)),
                    ),
                ],
              ),
            ),
          ),
        if (picked != null)
          Positioned(left: 12, bottom: 22, child: _SegmentLabel(segment: picked))
        else if (activeDay == null)
          Positioned(
            left: 0,
            right: 0,
            bottom: 22,
            child: IgnorePointer(
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(color: const Color(0xEBFFFFFF), borderRadius: BorderRadius.circular(AppRadius.pill)),
                  child: Text('Chọn một ngày hoặc một điểm để xem đường đi', style: AppText.label.copyWith(fontSize: 11, color: AppColors.ground)),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Marker _stopMarker(MapStop stop, int? activeDay) {
    final dimmed = activeDay != null && stop.day != activeDay;
    final active = stop.day == activeDay;
    final size = active ? 31.0 : 28.0;
    return Marker(
      point: stop.point,
      width: size,
      height: size,
      child: Semantics(
        button: true,
        label: 'Ngày ${stop.day} · ${stop.order}. ${stop.name.isEmpty ? 'Điểm dừng' : stop.name}',
        child: GestureDetector(
          onTap: () => _selectDay(stop.day),
          child: Opacity(
            opacity: dimmed ? 0.4 : 1,
            child: Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: dayColor(stop.day),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.white, width: 2),
                boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 4, offset: Offset(0, 1))],
              ),
              child: Text(
                '${stop.order}',
                style: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.white, height: 1),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({required this.label, this.color, required this.selected, required this.onTap});

  final String label;
  final Color? color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? AppColors.cream : const Color(0xEB000000),
        shape: const StadiumBorder(side: BorderSide(color: Color(0x26FFFFFF))),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (color != null) ...[
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                ],
                Text(label, style: AppText.label.copyWith(fontSize: 13, color: selected ? AppColors.ground : AppColors.cream)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ModeBubble extends StatelessWidget {
  const _ModeBubble({required this.segment, required this.color});

  final DrawnSegment segment;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final flight = segment.mode == TravelMode.flight;
    Widget icon = Icon(modeIcons[segment.mode], size: 15, color: color);
    // Lucide's plane points north-east: turn it to the leg's heading.
    if (flight) icon = Transform.rotate(angle: (segment.heading - 45) * math.pi / 180, child: icon);
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.white,
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 2),
      ),
      child: icon,
    );
  }
}

/// How a tapped leg was travelled and roughly how long it took.
class _SegmentLabel extends StatelessWidget {
  const _SegmentLabel({required this.segment});

  final DrawnSegment segment;

  @override
  Widget build(BuildContext context) {
    final duration = segment.duration;
    final time = duration == null
        ? null
        : '${segment.estimated ? 'khoảng ' : ''}${formatTravelDuration(duration, estimate: segment.estimated)}${segment.estimated ? ' (ước tính)' : ''}';
    const line = TextStyle(fontFamily: AppFonts.body, fontSize: 12, color: Color(0xFF333333));
    return Container(
      constraints: const BoxConstraints(maxWidth: 260),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: AppColors.cream, borderRadius: BorderRadius.circular(AppRadius.md)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(modeIcons[segment.mode], size: 18, color: AppColors.ground),
          const SizedBox(width: 8),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(modeLabels[segment.mode]!, style: AppText.label.copyWith(fontSize: 13, color: AppColors.ground)),
                if (time != null) Text(time, style: line),
                if (segment.distance != null) Text(formatDistance(segment.distance!), style: line),
                if (duration == null) const Text('Chưa có dữ liệu thời gian', style: line),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A point helper for other map screens.
LatLng latLngOf(double lat, double lng) => LatLng(lat, lng);
