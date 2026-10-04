import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/images.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/post_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';

/// Photos a journey can carry in its header; the server enforces the same limit.
const maxCoverImages = 10;
const _coverMaxSide = 1920;

/// The journey's photos: up to 10, the first is the cover (web: CoverPicker).
/// Each photo is shrunk and uploaded to Cloudinary right away.
class CoverPicker extends StatefulWidget {
  const CoverPicker({super.key, required this.value, required this.onChanged, required this.fallbackUrl, this.disabled = false, this.onBusy});

  final List<String> value;
  final ValueChanged<List<String>> onChanged;

  /// What the post gets when no photo is chosen.
  final String fallbackUrl;
  final bool disabled;

  /// Uploading started (true) or finished (false).
  final ValueChanged<bool>? onBusy;

  @override
  State<CoverPicker> createState() => _CoverPickerState();
}

class _CoverPickerState extends State<CoverPicker> {
  String? _error;
  ({int index, int total})? _processing;
  int _progress = 0;

  bool get _busy => widget.disabled || _processing != null;
  int get _remaining => maxCoverImages - widget.value.length;

  Future<void> _pick() async {
    if (_remaining <= 0) {
      setState(() => _error = 'Tối đa $maxCoverImages ảnh.');
      return;
    }
    setState(() => _error = null);
    List<PickedImage> images;
    try {
      images = await pickImages(limit: _remaining, maxSide: _coverMaxSide);
    } catch (error) {
      setState(() => _error = errorMessage(error));
      return;
    }
    if (images.isEmpty) return;

    widget.onBusy?.call(true);
    final problems = <String>[];
    var current = [...widget.value];
    for (var i = 0; i < images.length; i++) {
      setState(() {
        _processing = (index: i + 1, total: images.length);
        _progress = 0;
      });
      try {
        final url = await PostService.uploadJourneyImage(
          images[i],
          onProgress: (p) {
            if (mounted) setState(() => _progress = p);
          },
        );
        current = [...current, url];
        widget.onChanged(current);
      } catch (error) {
        problems.add(errorMessage(error));
      }
    }
    widget.onBusy?.call(false);
    if (!mounted) return;
    setState(() {
      _processing = null;
      _error = problems.isEmpty ? null : problems.toSet().join(' ');
    });
  }

  @override
  Widget build(BuildContext context) {
    final hasOwn = widget.value.isNotEmpty;
    final processing = _processing;
    final status = processing == null ? null : 'Đang tải ảnh${processing.total > 1 ? ' ${processing.index}/${processing.total}' : ''}… $_progress%';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: !hasOwn,
          label: hasOwn ? 'Ảnh bìa' : 'Chọn tối đa $maxCoverImages ảnh',
          child: GestureDetector(
            onTap: hasOwn || _busy ? null : _pick,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Opacity(
                      opacity: hasOwn ? 1 : 0.45,
                      child: NetImage(hasOwn ? widget.value.first : widget.fallbackUrl, placeholderColor: AppColors.canopy),
                    ),
                    if (hasOwn) const Positioned(left: 10, top: 10, child: AppBadge('Ảnh bìa', tone: BadgeTone.overlay)),
                    if (!hasOwn || processing != null)
                      Container(
                        color: hasOwn ? const Color(0xB3000000) : Colors.transparent,
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: const BoxDecoration(color: Color(0x8C000000), shape: BoxShape.circle),
                              child: processing != null
                                  ? const Padding(
                                      padding: EdgeInsets.all(14),
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.cream),
                                    )
                                  : const Icon(LucideIcons.imageUp, size: 22, color: AppColors.cream),
                            ),
                            const SizedBox(height: 10),
                            Text(status ?? 'Chạm để chọn tối đa $maxCoverImages ảnh', style: AppText.label, textAlign: TextAlign.center),
                            if (!hasOwn) ...[
                              const SizedBox(height: 4),
                              Text('Chưa chọn ảnh, bài viết sẽ dùng ảnh tự động này', style: AppText.meta, textAlign: TextAlign.center),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (hasOwn) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 72,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (var i = 0; i < widget.value.length; i++) ...[
                  _Thumb(
                    url: widget.value[i],
                    isCover: i == 0,
                    enabled: !_busy,
                    onMakeCover: () => widget.onChanged([widget.value[i], ...widget.value.where((u) => u != widget.value[i])]),
                    onRemove: () {
                      setState(() => _error = null);
                      widget.onChanged([...widget.value]..removeAt(i));
                    },
                    index: i,
                  ),
                  const SizedBox(width: 8),
                ],
                if (_remaining > 0)
                  Semantics(
                    button: true,
                    label: 'Thêm ảnh',
                    child: InkWell(
                      onTap: _busy ? null : _pick,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: AppColors.well,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.borderStrong),
                        ),
                        child: processing != null
                            ? const Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(LucideIcons.imagePlus, size: 22, color: AppColors.meta),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            AppButton(
              label: hasOwn ? 'Thêm ảnh (${widget.value.length}/$maxCoverImages)' : 'Chọn ảnh',
              icon: LucideIcons.imageUp,
              variant: ButtonVariant.outline,
              size: ButtonSize.sm,
              onPressed: _busy || _remaining <= 0 ? null : _pick,
            ),
            if (hasOwn)
              AppButton(
                label: 'Dùng ảnh tự động',
                icon: LucideIcons.rotateCcw,
                variant: ButtonVariant.ghost,
                size: ButtonSize.sm,
                onPressed: _busy
                    ? null
                    : () {
                        setState(() => _error = null);
                        widget.onChanged(const []);
                      },
              ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Tối đa $maxCoverImages ảnh, ảnh đầu tiên là ảnh bìa. $acceptedImagesLabel. Ảnh được tự nén trước khi tải lên.',
          style: AppText.meta.copyWith(fontSize: 12),
        ),
        if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
      ],
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.url, required this.isCover, required this.enabled, required this.onMakeCover, required this.onRemove, required this.index});

  final String url;
  final bool isCover;
  final bool enabled;
  final VoidCallback onMakeCover;
  final VoidCallback onRemove;
  final int index;

  @override
  Widget build(BuildContext context) {
    Widget action(IconData icon, String label, VoidCallback? onTap, {bool filled = false}) => Semantics(
      button: onTap != null,
      label: label,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(color: Color(0x99000000), shape: BoxShape.circle),
          child: Icon(filled ? Icons.star_rounded : icon, size: 14, color: AppColors.white),
        ),
      ),
    );

    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isCover ? AppColors.primary : Colors.transparent, width: 2),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            NetImage(url),
            Positioned(
              left: 3,
              right: 3,
              top: 3,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  isCover ? action(LucideIcons.star, 'Ảnh bìa', null, filled: true) : action(LucideIcons.star, 'Đặt ảnh ${index + 1} làm ảnh bìa', onMakeCover),
                  action(LucideIcons.x, 'Xoá ảnh ${index + 1}', onRemove),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tags: suggestions from tags in use, plus free entry; Enter or comma commits (web: TagPicker).
class TagPicker extends ConsumerStatefulWidget {
  const TagPicker({super.key, required this.value, required this.onChanged, this.max = 6});

  final List<String> value;
  final ValueChanged<List<String>> onChanged;
  final int max;

  @override
  ConsumerState<TagPicker> createState() => _TagPickerState();
}

class _TagPickerState extends ConsumerState<TagPicker> {
  final _draft = TextEditingController();

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  void _add(String raw) {
    var tag = raw.trim().replaceFirst(RegExp(r'^#'), '').toLowerCase();
    if (tag.length > 40) tag = tag.substring(0, 40);
    _draft.clear();
    if (tag.isEmpty || widget.value.contains(tag) || widget.value.length >= widget.max) return;
    widget.onChanged([...widget.value, tag]);
  }

  @override
  Widget build(BuildContext context) {
    final suggestions = ref.watch(allTagsProvider).value ?? const [];
    final unused = suggestions.where((s) => !widget.value.contains(s.tag)).take(10).toList();
    final full = widget.value.length >= widget.max;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.value.isNotEmpty) ...[
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final tag in widget.value)
                AppChip(label: tag, selected: true, onRemove: () => widget.onChanged(widget.value.where((t) => t != tag).toList())),
            ],
          ),
          const SizedBox(height: 10),
        ],
        AppTextField(
          controller: _draft,
          enabled: !full,
          hint: full ? 'Đã đủ tối đa ${widget.max} thẻ' : 'Thêm thẻ, nhấn Enter hoặc dấu phẩy',
          textInputAction: TextInputAction.done,
          autocorrect: false,
          onChanged: (text) {
            if (text.endsWith(',')) _add(text.substring(0, text.length - 1));
          },
          onSubmitted: _add,
        ),
        if (unused.isNotEmpty && !full) ...[
          const SizedBox(height: 10),
          Text('Gợi ý', style: AppText.meta),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [for (final s in unused) AppChip(label: '#${s.tag}', onTap: () => _add(s.tag))],
          ),
        ],
      ],
    );
  }
}
