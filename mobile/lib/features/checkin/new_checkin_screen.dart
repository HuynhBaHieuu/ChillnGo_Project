import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/feelings.dart';
import '../../core/geo.dart';
import '../../core/images.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/activity_service.dart';
import '../../data/services/checkin_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../activity/activity_common.dart';
import '../editor/place_search.dart';
import '../../ui/navigation.dart';

const _captionMax = 500;

/// Check-in (web: CheckInDialog): up to four photos, a few words, a feeling and a place.
class NewCheckInScreen extends ConsumerStatefulWidget {
  const NewCheckInScreen({super.key, this.startWithPhotos = false});

  /// "Ảnh" on the Newsfeed opens the photo picker right away.
  final bool startWithPhotos;

  @override
  ConsumerState<NewCheckInScreen> createState() => _NewCheckInScreenState();
}

class _NewCheckInScreenState extends ConsumerState<NewCheckInScreen> {
  final List<PickedImage> _photos = [];
  final _caption = TextEditingController();
  String? _feeling;
  Place? _place;
  String? _photoError;
  String? _error;
  bool _posting = false;
  int? _progress;
  bool _posted = false;

  @override
  void initState() {
    super.initState();
    if (widget.startWithPhotos) {
      Future.delayed(const Duration(milliseconds: 350), () {
        if (mounted) _addPhotos(fromCamera: false);
      });
    }
  }

  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }

  bool get _hasContent => _photos.isNotEmpty || _feeling != null || _caption.text.trim().isNotEmpty;
  bool get _dirty => !_posted && (_hasContent || _place != null);

  Future<void> _addPhotos({required bool fromCamera}) async {
    setState(() => _photoError = null);
    final room = maxCheckInPhotos - _photos.length;
    if (room <= 0) {
      setState(() => _photoError = 'Mỗi check-in tối đa $maxCheckInPhotos ảnh.');
      return;
    }
    try {
      final picked = fromCamera ? [?await takePhoto(maxSide: checkInMaxSide)] : await pickImages(limit: room, maxSide: checkInMaxSide);
      if (mounted) setState(() => _photos.addAll(picked.take(room)));
    } catch (error) {
      if (mounted) setState(() => _photoError = errorMessage(error));
    }
  }

  Future<void> _post() async {
    setState(() {
      _posting = true;
      _error = null;
      _progress = _photos.isEmpty ? null : 0;
    });
    try {
      await CheckInService.create(
        images: _photos,
        caption: _caption.text,
        feeling: _feeling,
        location: _place,
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
      );
      _posted = true;
      ref.invalidate(checkinsProvider);
      invalidateActivity(ref);
      if (!mounted) return;
      toast(context, 'Đã đăng check-in.');
      leavePage(context);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) {
        setState(() {
          _posting = false;
          _progress = null;
        });
      }
    }
  }

  Future<void> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Bỏ check-in này?'),
        content: const Text('Ảnh và nội dung bạn vừa nhập sẽ không được lưu.'),
        actions: [
          AppButton(label: 'Ở lại', variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(false)),
          AppButton(label: 'Bỏ', variant: ButtonVariant.destructive, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(true)),
        ],
      ),
    );
    if (leave == true && mounted) {
      _posted = true;
      leavePage(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    return PopScope(
      canPop: !_dirty || _posting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(leading: const BackOrHome(), title: const Text('Check-in')),
        body: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 40),
            children: [
              Text('Chia sẻ nơi bạn đang đến và cảm xúc lúc này, ${user?.displayName ?? ''}.', style: AppText.meta),
              const SizedBox(height: 18),
              Text('Ảnh', style: AppText.label),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < _photos.length; i++)
                    SizedBox(
                      width: 78,
                      height: 78,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.file(File(_photos[i].path), fit: BoxFit.cover),
                            Positioned(
                              top: 4,
                              right: 4,
                              child: AppIconButton(
                                icon: LucideIcons.x,
                                label: 'Bỏ ảnh ${i + 1}',
                                tone: IconTone.overlay,
                                size: 26,
                                onPressed: _posting ? null : () => setState(() => _photos.removeAt(i)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (_photos.length < maxCheckInPhotos) ...[
                    _AddTile(icon: LucideIcons.imagePlus, label: 'Thư viện', onTap: _posting ? null : () => _addPhotos(fromCamera: false)),
                    _AddTile(icon: LucideIcons.camera, label: 'Chụp ảnh', onTap: _posting ? null : () => _addPhotos(fromCamera: true)),
                  ],
                ],
              ),
              const SizedBox(height: 8),
              Text('$acceptedImagesLabel, tối đa $maxCheckInPhotos ảnh. Ảnh được tự nén trước khi tải lên.', style: AppText.meta),
              if (_photoError != null) ...[const SizedBox(height: 6), ErrorText(_photoError)],
              const SizedBox(height: 18),
              AppTextField(
                controller: _caption,
                label: 'Bạn thấy nơi này thế nào?',
                maxLines: 6,
                minLines: 3,
                maxLength: _captionMax,
                showCounter: true,
                enabled: !_posting,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 18),
              _FeelingPicker(value: _feeling, onChanged: (v) => setState(() => _feeling = v), disabled: _posting),
              const SizedBox(height: 18),
              _PlacePicker(value: _place, onChanged: (p) => setState(() => _place = p), disabled: _posting),
              const SizedBox(height: 18),
              if (_error != null) ...[ErrorText(_error), const SizedBox(height: 10)],
              AppButton(
                label: _progress != null && _progress! < 100 ? 'Đang tải ảnh… ${_progress!}%' : 'Đăng check-in',
                size: ButtonSize.lg,
                fullWidth: true,
                loading: _posting,
                onPressed: _hasContent ? _post : null,
              ),
              if (!_hasContent) ...[
                const SizedBox(height: 8),
                Text('Thêm ảnh, cảm xúc hoặc vài dòng chia sẻ để đăng.', style: AppText.meta, textAlign: TextAlign.center),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onTap,
        child: Container(
          width: 78,
          height: 78,
          decoration: BoxDecoration(
            color: AppColors.well,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: const Color(0x6600BB88), width: 1.5),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: AppColors.teal),
              const SizedBox(height: 4),
              Text(label, style: AppText.meta.copyWith(fontSize: 11)),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeelingPicker extends StatefulWidget {
  const _FeelingPicker({required this.value, required this.onChanged, required this.disabled});

  final String? value;
  final ValueChanged<String?> onChanged;
  final bool disabled;

  @override
  State<_FeelingPicker> createState() => _FeelingPickerState();
}

class _FeelingPickerState extends State<_FeelingPicker> {
  late bool _feelings = feelingOption(widget.value)?.isFeeling ?? true;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text('Cảm xúc / Hoạt động', style: AppText.label)),
            if (widget.value != null)
              AppButton(label: 'Bỏ chọn', variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: widget.disabled ? null : () => widget.onChanged(null)),
          ],
        ),
        const SizedBox(height: 10),
        SegmentTabs<bool>(
          items: const [(value: true, label: 'Cảm xúc', count: null), (value: false, label: 'Hoạt động', count: null)],
          value: _feelings,
          onChanged: (v) => setState(() => _feelings = v),
        ),
        const SizedBox(height: 10),
        LayoutBuilder(
          builder: (context, constraints) {
            final width = (constraints.maxWidth - 8) / 2;
            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final f in feelingOptions.where((f) => f.isFeeling == _feelings))
                  Semantics(
                    selected: widget.value == f.key,
                    button: true,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      onTap: widget.disabled ? null : () => widget.onChanged(widget.value == f.key ? null : f.key),
                      child: Container(
                        width: width,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: widget.value == f.key ? const Color(0x260099FF) : Colors.transparent,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          border: Border.all(color: widget.value == f.key ? AppColors.primary : AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Text(f.emoji, style: const TextStyle(fontSize: 20)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                f.label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.bodySmall.copyWith(
                                  fontWeight: widget.value == f.key ? FontWeight.w700 : FontWeight.w400,
                                  color: widget.value == f.key ? AppColors.cream : AppColors.body,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _PlacePicker extends StatefulWidget {
  const _PlacePicker({required this.value, required this.onChanged, required this.disabled});

  final Place? value;
  final ValueChanged<Place?> onChanged;
  final bool disabled;

  @override
  State<_PlacePicker> createState() => _PlacePickerState();
}

class _PlacePickerState extends State<_PlacePicker> {
  final _query = TextEditingController();
  final _search = PlaceSearch();
  bool _locating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _query.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _useMyLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final me = await getDevicePosition();
      final named = await placeAt(me.lat, me.lng).catchError((_) => null);
      widget.onChanged(
        named ?? Place(name: 'Vị trí hiện tại', address: '${me.lat.toStringAsFixed(5)}, ${me.lng.toStringAsFixed(5)}', lat: me.lat, lng: me.lng),
      );
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = widget.value;
    if (value != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Địa điểm', style: AppText.label),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.well, borderRadius: BorderRadius.circular(AppRadius.md)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(LucideIcons.mapPin, size: 18, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        value.name,
                        style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                      ),
                      if (value.address.isNotEmpty) Text(value.address, style: AppText.meta),
                    ],
                  ),
                ),
                AppButton(label: 'Đổi', variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: widget.disabled ? null : () => widget.onChanged(null)),
              ],
            ),
          ),
        ],
      );
    }
    final q = _query.text.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text('Địa điểm', style: AppText.label)),
            AppButton(
              label: 'Vị trí hiện tại',
              icon: LucideIcons.locateFixed,
              variant: ButtonVariant.outline,
              size: ButtonSize.sm,
              loading: _locating,
              onPressed: widget.disabled ? null : _useMyLocation,
            ),
          ],
        ),
        if (canSearchPlaces) ...[
          const SizedBox(height: 10),
          AppTextField(
            controller: _query,
            icon: LucideIcons.search,
            hint: 'Hoặc tìm theo tên địa điểm',
            enabled: !widget.disabled,
            autocorrect: false,
            suffix: _search.searching
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : null,
            onChanged: (text) {
              setState(() {});
              _search.search(text);
            },
          ),
          PlaceSuggestions(
            places: q.length >= 2 ? _search.results : const [],
            onPick: (place) {
              widget.onChanged(place);
              // Your Activity, Search History: the search that found a place.
              ActivityService.recordSearch('place', _query.text);
              _query.clear();
              _search.clear();
            },
          ),
          if (q.length >= 2 && !_search.searching && _search.results.isEmpty && _search.error == null) ...[
            const SizedBox(height: 6),
            Text('Không tìm thấy địa điểm phù hợp.', style: AppText.meta),
          ],
        ],
        if ((_error ?? _search.error) != null) ...[const SizedBox(height: 6), ErrorText(_error ?? _search.error)],
        const SizedBox(height: 6),
        Text('Không bắt buộc. Check-in vẫn đăng được khi không có địa điểm.', style: AppText.meta),
      ],
    );
  }
}
