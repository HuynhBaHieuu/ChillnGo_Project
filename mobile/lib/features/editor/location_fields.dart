import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/geo.dart';
import '../../core/itinerary.dart';
import '../../core/links.dart';
import '../../core/maps_link.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import 'map_picker.dart';
import 'place_search.dart';

/// A stop's name, with place suggestions as the author types. Picking one also
/// fills the address and pins the stop (web: PlaceField).
class PlaceField extends StatefulWidget {
  const PlaceField({super.key, required this.index, required this.location, required this.onChanged});

  final int index;
  final TripLocation location;

  /// The location was changed in place; [placed] when it got a new position.
  final void Function({bool placed}) onChanged;

  @override
  State<PlaceField> createState() => _PlaceFieldState();
}

class _PlaceFieldState extends State<PlaceField> {
  late final _text = TextEditingController(text: widget.location.name);
  final _search = PlaceSearch();
  final _focus = FocusNode();
  bool _open = false;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
    _focus.addListener(() {
      if (!_focus.hasFocus) {
        // Let a tap on a suggestion land first.
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) setState(() => _open = false);
        });
      }
    });
  }

  @override
  void didUpdateWidget(PlaceField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.location.name != _text.text && !_focus.hasFocus) _text.text = widget.location.name;
  }

  @override
  void dispose() {
    _text.dispose();
    _search.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _pick(Place place) {
    final loc = widget.location
      ..name = place.name
      ..address = [place.name, place.address].where((s) => s.isNotEmpty).join(', ')
      ..lng = place.lng
      ..lat = place.lat
      ..placeTypes = place.types;
    _text.text = loc.name;
    _search.clear();
    setState(() => _open = false);
    _focus.unfocus();
    widget.onChanged(placed: true);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          controller: _text,
          focusNode: _focus,
          label: 'Tên địa điểm',
          hint: canSearchPlaces ? 'Gõ tên địa điểm, rồi chọn một gợi ý' : 'Tên địa điểm',
          maxLength: 200,
          suffix: _search.searching
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : null,
          onChanged: (text) {
            widget.location.name = text;
            widget.onChanged();
            setState(() => _open = true);
            _search.search(text);
          },
        ),
        if (_open) PlaceSuggestions(places: _search.results, onPick: _pick),
        if (_search.error != null) ...[const SizedBox(height: 6), ErrorText(_search.error)],
      ],
    );
  }
}

/// Where a stop is. Three ways in: type an address and pick a suggestion,
/// paste a Google Maps link or coordinates, or choose the spot on a map. Each
/// one pins the stop; typing a new address unpins it (web: AddressField).
class AddressField extends StatefulWidget {
  const AddressField({super.key, required this.index, required this.location, required this.onChanged});

  final int index;
  final TripLocation location;
  final void Function({bool placed}) onChanged;

  @override
  State<AddressField> createState() => _AddressFieldState();
}

class _AddressFieldState extends State<AddressField> {
  late final _text = TextEditingController(text: widget.location.address ?? '');
  final _search = PlaceSearch(minLength: 3);
  final _focus = FocusNode();
  bool _open = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
    _focus.addListener(() {
      if (!_focus.hasFocus) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) setState(() => _open = false);
        });
      }
    });
  }

  @override
  void didUpdateWidget(AddressField oldWidget) {
    super.didUpdateWidget(oldWidget);
    final address = widget.location.address ?? '';
    if (address != _text.text && !_focus.hasFocus) _text.text = address;
  }

  @override
  void dispose() {
    _text.dispose();
    _search.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _apply(ResolvedPlace place) {
    final loc = widget.location
      ..address = place.address
      ..lat = place.lat
      ..lng = place.lng
      // A moved stop drops the old place's categories: they would suggest the wrong mode.
      ..placeTypes = place.types ?? const [];
    if (loc.name.trim().isEmpty && (place.name ?? '').isNotEmpty) loc.name = place.name!;
    _text.text = place.address;
    _search.clear();
    setState(() {
      _error = null;
      _open = false;
    });
    widget.onChanged(placed: true);
  }

  void _applyPlace(Place place) => _apply(
    ResolvedPlace(
      lat: place.lat,
      lng: place.lng,
      address: [place.name, place.address].where((s) => s.isNotEmpty).join(', '),
      name: place.name,
      types: place.types,
    ),
  );

  Future<void> _resolve(String text) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      _apply(await resolveLinkOrCoordinates(text));
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _typed(String text) {
    final before = widget.location.address ?? '';
    // A new address no longer matches the old pin.
    widget.location
      ..address = text
      ..lng = unpinnedLng
      ..lat = unpinnedLat;
    widget.onChanged();
    setState(() {
      _error = null;
      _open = true;
    });
    final linkLike = looksLikeLinkOrCoordinates(text);
    _search.search(linkLike ? null : text);
    // A pasted link resolves at once, as on the web.
    if (linkLike && text.length - before.length > 8) unawaited(_resolve(text));
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim() ?? '';
    if (text.isEmpty) {
      setState(() => _error = 'Bộ nhớ tạm đang trống. Hãy sao chép link Google Maps trước.');
      return;
    }
    _text.text = text;
    widget.location.address = text;
    widget.onChanged();
    if (looksLikeLinkOrCoordinates(text)) {
      unawaited(_resolve(text));
    } else {
      setState(() => _open = true);
      _search.search(text);
    }
  }

  Future<void> _pickOnMap() async {
    final loc = widget.location;
    final place = await pickPlaceOnMap(context, lat: isPinned(loc) ? loc.lat : null, lng: isPinned(loc) ? loc.lng : null);
    if (place != null && mounted) _apply(place);
  }

  @override
  Widget build(BuildContext context) {
    final loc = widget.location;
    final pinned = isPinned(loc);
    final address = loc.address ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          controller: _text,
          focusNode: _focus,
          label: 'Địa chỉ',
          icon: LucideIcons.mapPin,
          hint: 'Gõ địa chỉ, hoặc dán link Google Maps / toạ độ',
          maxLength: 300,
          autocorrect: false,
          textInputAction: TextInputAction.search,
          suffix: _busy
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : null,
          onChanged: _typed,
          onSubmitted: (text) {
            if (looksLikeLinkOrCoordinates(text)) {
              _resolve(text);
            } else if (_search.results.isNotEmpty) {
              _applyPlace(_search.results.first);
            }
          },
        ),
        if (_open && !looksLikeLinkOrCoordinates(_text.text)) PlaceSuggestions(places: _search.results, onPick: _applyPlace),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            AppButton(label: 'Chọn trên bản đồ', icon: LucideIcons.map, variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: _pickOnMap),
            AppButton(label: 'Dán link', icon: LucideIcons.clipboardPaste, variant: ButtonVariant.outline, size: ButtonSize.sm, onPressed: _paste),
            AppButton(
              label: 'Google Maps',
              icon: LucideIcons.externalLink,
              variant: ButtonVariant.ghost,
              size: ButtonSize.sm,
              onPressed: () => openExternal(googleMapsSearchUrl(address.isNotEmpty ? address : loc.name)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (pinned)
          Text.rich(
            TextSpan(
              style: AppText.meta.copyWith(color: AppColors.sage),
              children: [
                TextSpan(text: 'Đã ghim · ${loc.lat.toStringAsFixed(5)}, ${loc.lng.toStringAsFixed(5)} · '),
                TextSpan(
                  text: 'Xem trên Google Maps',
                  style: const TextStyle(decoration: TextDecoration.underline),
                  recognizer: TapGestureRecognizer()..onTap = () => openExternal(googleMapsUrl(loc.lat, loc.lng)),
                ),
              ],
            ),
          )
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(LucideIcons.circleAlert, size: 14, color: address.trim().isNotEmpty ? AppColors.ochre : AppColors.meta),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  address.trim().isNotEmpty
                      ? 'Chưa ghim. Chọn một gợi ý, dán link Google Maps, hoặc chọn trên bản đồ. Nếu không, khi lưu ChillnGo sẽ tự tìm theo địa chỉ.'
                      : 'Trên Google Maps: mở địa điểm, bấm Chia sẻ, Sao chép đường liên kết, rồi bấm "Dán link".',
                  style: AppText.meta.copyWith(fontSize: 12, color: address.trim().isNotEmpty ? AppColors.ochre : AppColors.meta),
                ),
              ),
            ],
          ),
        if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
      ],
    );
  }
}
