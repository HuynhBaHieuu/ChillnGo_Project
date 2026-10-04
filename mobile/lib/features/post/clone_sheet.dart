import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/itinerary_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';

/// "Dùng làm lịch trình của tôi": name the copy, pick a start date (web: CloneDialog).
Future<void> showCloneSheet(BuildContext context, TripPost post) {
  return showAppSheet<void>(
    context,
    title: 'Dùng làm lịch trình của tôi',
    description: 'Sao chép ${post.days.length} ngày từ hành trình này thành lịch trình của riêng bạn. Bạn có thể đổi thứ tự và ghép thêm ngày từ bài khác sau.',
    builder: (_) => _CloneForm(post: post, parentContext: context),
  );
}

class _CloneForm extends ConsumerStatefulWidget {
  const _CloneForm({required this.post, required this.parentContext});

  final TripPost post;
  final BuildContext parentContext;

  @override
  ConsumerState<_CloneForm> createState() => _CloneFormState();
}

class _CloneFormState extends ConsumerState<_CloneForm> {
  late final _title = TextEditingController(text: '${widget.post.title} (bản của tôi)');
  late String _startDate = widget.post.startDate;
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _clone() async {
    final viewerId = ref.read(viewerIdProvider);
    if (viewerId == null) return;
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final itinerary = await ItineraryService.clonePost(postId: widget.post.id, ownerId: viewerId, title: _title.text, startDate: _startDate);
      ref.invalidate(myItinerariesProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      final parent = widget.parentContext;
      if (parent.mounted) {
        toast(parent, 'Đã clone vào Hành trình của tôi.');
        parent.push('/itineraries/${itinerary.id}');
      }
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              NetImage(post.coverUrl, width: 56, height: 56, radius: 10),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(post.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.label),
                    Text('${tripLengthLabel(post.days.length)} · ${formatVnd(post.totalEstCost)}', style: AppText.meta),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppTextField(controller: _title, label: 'Tên lịch trình', maxLength: 150),
        const SizedBox(height: 14),
        DateField(
          label: 'Ngày khởi hành',
          value: _startDate,
          onChanged: (v) => setState(() => _startDate = v),
          helper: 'Các ngày trong lịch trình sẽ được đánh lại từ ngày này.',
        ),
        if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: AppButton(label: 'Huỷ', variant: ButtonVariant.outline, onPressed: _pending ? null : () => Navigator.of(context).pop()),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AppButton(label: 'Clone hành trình', icon: LucideIcons.copy, loading: _pending, onPressed: _clone),
            ),
          ],
        ),
      ],
    );
  }
}
