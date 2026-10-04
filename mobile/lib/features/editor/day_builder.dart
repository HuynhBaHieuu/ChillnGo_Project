import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/images.dart';
import '../../core/itinerary.dart';
import '../../core/theme.dart';
import '../../core/travel.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/post_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';
import 'location_fields.dart';

const _stopPhotoMaxSide = 1600;

TripLocation newStop(String dayId, int number) =>
    TripLocation(id: '${dayId}_l${number}_${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}', address: '', lng: unpinnedLng, lat: unpinnedLat);

/// One day in the editor: its title, date and stops (web: DayBuilder). The
/// day is edited in place; [onChanged] tells the editor to redraw.
class DayBuilder extends StatefulWidget {
  const DayBuilder({super.key, required this.day, required this.index, required this.canRemove, required this.onChanged, required this.onRemove});

  final TripDay day;
  final int index;
  final bool canRemove;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  State<DayBuilder> createState() => _DayBuilderState();
}

class _DayBuilderState extends State<DayBuilder> {
  late final _title = TextEditingController(text: widget.day.title);

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  void _changed() {
    setState(() {});
    widget.onChanged();
  }

  /// A stop placed or moved: prefill the legs into and out of it; a chosen mode is never overridden.
  void _suggestLegs(TripLocation placed) {
    final pinned = widget.day.locations.where(isPinned).toList();
    final at = pinned.indexOf(placed);
    if (at < 0) return;
    for (final i in [at, at + 1]) {
      if (i - 1 < 0 || i >= pinned.length) continue;
      final from = pinned[i - 1];
      final to = pinned[i];
      to.travelMode ??= suggestMode(from, to).name;
    }
  }

  @override
  Widget build(BuildContext context) {
    final day = widget.day;
    final number = widget.index + 1;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: dayColor(number), shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text('Ngày $number', style: AppText.h3)),
              if (widget.canRemove)
                AppIconButton(icon: LucideIcons.trash, label: 'Xoá ngày $number', tone: IconTone.danger, size: 36, onPressed: widget.onRemove),
            ],
          ),
          const SizedBox(height: 14),
          AppTextField(
            controller: _title,
            label: 'Tiêu đề ngày $number',
            hint: 'Ví dụ: Hà Nội → Hà Giang',
            maxLength: 200,
            onChanged: (text) {
              day.title = text;
              widget.onChanged();
            },
          ),
          const SizedBox(height: 14),
          DateField(
            label: 'Ngày',
            value: day.date,
            onChanged: (date) {
              day.date = date;
              _changed();
            },
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < day.locations.length; i++) ...[
            if (i > 0)
              _LegPicker(
                value: modeOf(day.locations[i].travelMode),
                from: i,
                to: i + 1,
                onChanged: (mode) {
                  day.locations[i].travelMode = mode.name;
                  _changed();
                },
              ),
            _LocationRow(
              key: ValueKey(day.locations[i].id),
              location: day.locations[i],
              index: i,
              canRemove: day.locations.length > 1,
              onChanged: ({bool placed = false}) {
                if (placed) _suggestLegs(day.locations[i]);
                _changed();
              },
              onRemove: () {
                day.locations.removeAt(i);
                _changed();
              },
            ),
            const SizedBox(height: 4),
          ],
          const SizedBox(height: 10),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: [
              AppButton(
                label: 'Thêm điểm dừng',
                icon: LucideIcons.plus,
                variant: ButtonVariant.outline,
                size: ButtonSize.sm,
                onPressed: () {
                  day.locations.add(newStop(day.id, day.locations.length + 1));
                  _changed();
                },
              ),
              Text.rich(
                TextSpan(
                  style: AppText.meta,
                  children: [
                    const TextSpan(text: 'Ngày này: '),
                    TextSpan(
                      text: formatVnd(dayCostOf(day)),
                      style: const TextStyle(color: AppColors.cream),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LocationRow extends StatefulWidget {
  const _LocationRow({super.key, required this.location, required this.index, required this.canRemove, required this.onChanged, required this.onRemove});

  final TripLocation location;
  final int index;
  final bool canRemove;
  final void Function({bool placed}) onChanged;
  final VoidCallback onRemove;

  @override
  State<_LocationRow> createState() => _LocationRowState();
}

class _LocationRowState extends State<_LocationRow> {
  late final _cost = TextEditingController(text: widget.location.estCost > 0 ? '${widget.location.estCost}' : '');
  late final _note = TextEditingController(text: widget.location.note);
  String? _photoError;
  int? _uploading;

  @override
  void dispose() {
    _cost.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _uploadPhoto() async {
    setState(() => _photoError = null);
    try {
      final images = await pickImages(maxSide: _stopPhotoMaxSide);
      if (images.isEmpty) return;
      setState(() => _uploading = 0);
      final url = await PostService.uploadJourneyImage(
        images.first,
        onProgress: (p) {
          if (mounted) setState(() => _uploading = p);
        },
      );
      widget.location.photoUrl = url;
      widget.onChanged();
    } catch (error) {
      if (mounted) setState(() => _photoError = errorMessage(error));
    } finally {
      if (mounted) setState(() => _uploading = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = widget.location;
    final number = widget.index + 1;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0x66080808),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: AppColors.raised, shape: BoxShape.circle),
                child: Text(
                  '$number',
                  style: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.cream),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text('Điểm dừng $number', style: AppText.label)),
              if (widget.canRemove) AppIconButton(icon: LucideIcons.trash, label: 'Xoá địa điểm $number', size: 34, onPressed: widget.onRemove),
            ],
          ),
          const SizedBox(height: 12),
          PlaceField(index: widget.index, location: loc, onChanged: widget.onChanged),
          const SizedBox(height: 12),
          AppTextField(
            controller: _cost,
            label: 'Chi phí (₫)',
            hint: '0',
            helper: loc.estCost > 0 ? formatVnd(loc.estCost) : 'Để 0 nếu miễn phí',
            keyboardType: TextInputType.number,
            maxLength: 13,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (text) {
              loc.estCost = int.tryParse(text) ?? 0;
              setState(() {});
              widget.onChanged();
            },
          ),
          const SizedBox(height: 12),
          AddressField(index: widget.index, location: loc, onChanged: widget.onChanged),
          const SizedBox(height: 12),
          AppTextField(
            controller: _note,
            label: 'Ghi chú',
            hint: 'Mẹo, giờ mở cửa, món nên thử…',
            maxLines: 5,
            minLines: 2,
            maxLength: 2000,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (text) {
              loc.note = text;
              widget.onChanged();
            },
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (loc.photoUrl != null || _uploading != null)
                SizedBox(
                  width: 64,
                  height: 64,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (loc.photoUrl != null) NetImage(loc.photoUrl) else const ColoredBox(color: AppColors.well),
                        if (_uploading != null)
                          ColoredBox(
                            color: const Color(0xB3000000),
                            child: Center(child: Text('${_uploading!}%', style: AppText.label.copyWith(fontSize: 11))),
                          ),
                      ],
                    ),
                  ),
                ),
              AppButton(
                label: _uploading != null ? 'Đang tải ảnh…' : (loc.photoUrl != null ? 'Đổi ảnh' : 'Thêm ảnh'),
                icon: LucideIcons.imagePlus,
                variant: ButtonVariant.outline,
                size: ButtonSize.sm,
                onPressed: _uploading != null ? null : _uploadPhoto,
              ),
              if (loc.photoUrl != null)
                AppButton(
                  label: 'Bỏ ảnh',
                  variant: ButtonVariant.ghost,
                  size: ButtonSize.sm,
                  onPressed: _uploading != null
                      ? null
                      : () {
                          loc.photoUrl = null;
                          setState(() {});
                          widget.onChanged();
                        },
                ),
            ],
          ),
          if (_photoError != null) ...[const SizedBox(height: 6), ErrorText(_photoError)],
        ],
      ),
    );
  }
}

/// How the traveller went from one stop to the next.
class _LegPicker extends StatelessWidget {
  const _LegPicker({required this.value, required this.from, required this.to, required this.onChanged});

  final TravelMode value;
  final int from;
  final int to;
  final ValueChanged<TravelMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Phương tiện từ điểm $from đến điểm $to',
      child: Padding(
        padding: const EdgeInsets.only(left: 12, top: 4, bottom: 4),
        child: Row(
          children: [
            Container(width: 1, height: 36, color: AppColors.borderStrong),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final mode in TravelMode.values)
                    Semantics(
                      selected: mode == value,
                      button: true,
                      label: modeLabels[mode],
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: () => onChanged(mode),
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(color: mode == value ? AppColors.cream : Colors.transparent, shape: BoxShape.circle),
                          child: Icon(modeIcons[mode], size: 16, color: mode == value ? AppColors.ground : AppColors.meta),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(modeLabels[value]!, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta.copyWith(fontSize: 12)),
            ),
          ],
        ),
      ),
    );
  }
}
