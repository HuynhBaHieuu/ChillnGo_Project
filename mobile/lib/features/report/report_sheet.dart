/// "Báo cáo": the ⋯ button on someone else's journey, comment, check-in or
/// profile, and the sheet that sends the report (web: ReportMenu, ReportDialog).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/report_service.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';

const reportReasons = ['spam', 'inappropriate', 'scam', 'misinformation', 'harassment', 'other'];

Map<String, String> get reportReasonLabels => {
  'spam': t('Spam hoặc quảng cáo'),
  'inappropriate': t('Nội dung không phù hợp'),
  'scam': t('Lừa đảo'),
  'misinformation': t('Thông tin sai lệch'),
  'harassment': t('Quấy rối hoặc bắt nạt'),
  'other': t('Khác'),
};

/// "Báo cáo {thing}".
Map<String, String> get reportTargetLabels => {'post': t('hành trình'), 'comment': t('bình luận'), 'checkin': t('check-in'), 'user': t('tài khoản')};

Map<String, String> get reportStatusLabels => {'pending': t('Chờ xử lý'), 'resolved': t('Đã xử lý'), 'dismissed': t('Bỏ qua')};

Map<String, String> get reportActionLabels => {'none': t('Không vi phạm'), 'hide': t('Đã ẩn'), 'remove': t('Đã gỡ'), 'lock': t('Đã khoá tài khoản')};

const _maxNote = 500;

/// The ⋯ menu with "Báo cáo". Shown only to signed-in people, on someone
/// else's content that the API stores; otherwise nothing.
class ReportButton extends ConsumerWidget {
  const ReportButton({super.key, required this.targetType, required this.targetId, required this.ownerId, required this.label, this.size = 36});

  final ReportTargetType targetType;
  final String targetId;

  /// Whose content it is: nothing is shown on your own.
  final String ownerId;

  /// "Thêm thao tác cho …", for screen readers.
  final String label;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewerId = ref.watch(viewerIdProvider);
    if (viewerId == null || viewerId == ownerId || !ReportService.canReport(targetId)) return const SizedBox.shrink();
    return AppIconButton(
      icon: LucideIcons.ellipsis,
      label: label,
      size: size,
      color: AppColors.meta,
      onPressed: () async {
        final choice = await showActionSheet<String>(context, actions: [MenuAction('report', t('Báo cáo'), icon: LucideIcons.flag, destructive: true)]);
        if (choice == 'report' && context.mounted) await showReportSheet(context, targetType: targetType, targetId: targetId);
      },
    );
  }
}

/// Pick a reason, optionally say more, send. Thanks with a toast once sent.
Future<void> showReportSheet(BuildContext context, {required ReportTargetType targetType, required String targetId}) async {
  final message = await showAppSheet<String>(
    context,
    title: t('Báo cáo {thing}', {'thing': reportTargetLabels[targetType] ?? targetType}),
    description: t('Báo cáo được gửi ẩn danh tới đội kiểm duyệt. Người bị báo cáo không biết ai đã báo cáo.'),
    tall: true,
    builder: (sheetContext) => _ReportForm(targetType: targetType, targetId: targetId),
  );
  if (message != null && context.mounted) toast(context, message);
}

class _ReportForm extends StatefulWidget {
  const _ReportForm({required this.targetType, required this.targetId});

  final ReportTargetType targetType;
  final String targetId;

  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<_ReportForm> {
  final _note = TextEditingController();
  String? _reason;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  bool get _ready => _reason != null && !(_reason == 'other' && _note.text.trim().isEmpty);

  Future<void> _send() async {
    if (!_ready || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ReportService.createReport(targetType: widget.targetType, targetId: widget.targetId, reason: _reason!, note: _note.text);
      if (mounted) Navigator.of(context).pop(t('Cảm ơn bạn, chúng tôi sẽ xem xét.'));
    } on ApiError catch (error) {
      if (!mounted) return;
      if (error.code == 'ALREADY_REPORTED') {
        Navigator.of(context).pop(t('Bạn đã báo cáo nội dung này rồi.'));
        return;
      }
      setState(() {
        _sending = false;
        _error = error.message;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = errorMessage(error);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final labels = reportReasonLabels;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t('Vì sao bạn báo cáo?'), style: AppText.label),
        const SizedBox(height: 10),
        RadioGroup<String>(
          groupValue: _reason,
          onChanged: (value) => setState(() => _reason = value),
          child: Column(
            children: [
              for (final reason in reportReasons)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Material(
                    color: _reason == reason ? AppColors.raised : AppColors.well,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      side: BorderSide(color: _reason == reason ? AppColors.cream : AppColors.border),
                    ),
                    child: RadioListTile<String>(
                      value: reason,
                      dense: true,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
                      activeColor: AppColors.cream,
                      title: Text(labels[reason]!, style: AppText.label),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        AppTextField(
          controller: _note,
          label: _reason == 'other' ? t('Mô tả vấn đề (bắt buộc)') : t('Ghi chú thêm (không bắt buộc)'),
          maxLines: 4,
          minLines: 2,
          maxLength: _maxNote,
          showCounter: true,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (_) => setState(() {}),
        ),
        if (_error != null) ...[const SizedBox(height: 8), ErrorText(_error)],
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: AppButton(label: t('Huỷ'), variant: ButtonVariant.outline, onPressed: _sending ? null : () => Navigator.of(context).pop()),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AppButton(
                label: t('Gửi báo cáo'),
                icon: LucideIcons.flag,
                variant: ButtonVariant.destructive,
                loading: _sending,
                onPressed: _ready ? _send : null,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// The note an author sees on their own content that moderation hid.
class ModeratedNotice extends StatelessWidget {
  const ModeratedNotice({super.key, this.removed = false});

  final bool removed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0x1AE5534B),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0x4DE5534B)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(LucideIcons.shieldAlert, size: 16, color: AppColors.destructive),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              removed ? t('Đã bị gỡ do vi phạm quy định cộng đồng. Chỉ bạn còn thấy nội dung này.') : t('Đã bị ẩn do vi phạm. Chỉ bạn còn thấy nội dung này.'),
              style: AppText.bodySmall.copyWith(color: AppColors.destructive, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
