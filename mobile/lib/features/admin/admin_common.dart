import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/roles.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';

/// A result line shown above a panel after an action.
class Notice {
  const Notice(this.text, {this.error = false});

  final String text;
  final bool error;
}

final adminNoticeProvider = NotifierProvider<AdminNotice, Notice?>(AdminNotice.new);

class AdminNotice extends Notifier<Notice?> {
  @override
  Notice? build() => null;

  void show(Notice? notice) => state = notice;
}

/// Mirrors canManageAccount on the server: what the UI offers, not what it enforces.
bool canManage(User actor, AdminUser target) {
  if (target.role == 'superadmin' || actor.id == target.id) return false;
  if (actor.role == 'superadmin') return true;
  return actor.role == 'admin' && target.role == 'user';
}

class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.role});

  final String role;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, Color border) = switch (role) {
      'superadmin' => (AppColors.cream, AppColors.ground, AppColors.cream),
      'admin' => (AppColors.primary, AppColors.onPrimary, AppColors.primary),
      _ => (Colors.transparent, AppColors.meta, AppColors.borderStrong),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: border),
      ),
      child: Text(
        roleLabels[role] ?? role,
        style: TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, fontSize: 11.5, color: fg),
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final locked = status == 'locked';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: locked ? const Color(0x1AE5534B) : const Color(0x14FFFFFF), borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(locked ? LucideIcons.circleAlert : LucideIcons.circleCheck, size: 12, color: locked ? AppColors.destructive : AppColors.cream),
          const SizedBox(width: 4),
          Text(
            locked ? 'Đã khoá' : 'Hoạt động',
            style: TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, fontSize: 11.5, color: locked ? AppColors.destructive : AppColors.cream),
          ),
        ],
      ),
    );
  }
}

class NoticeBar extends ConsumerWidget {
  const NoticeBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notice = ref.watch(adminNoticeProvider);
    if (notice == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
      decoration: BoxDecoration(
        color: notice.error ? const Color(0x1AE5534B) : const Color(0x14FFFFFF),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: notice.error ? const Color(0x4DE5534B) : const Color(0x26FFFFFF)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(notice.text, style: AppText.bodySmall.copyWith(color: notice.error ? AppColors.destructive : AppColors.cream)),
          ),
          TextButton(onPressed: () => ref.read(adminNoticeProvider.notifier).show(null), child: const Text('Đóng')),
        ],
      ),
    );
  }
}

class Pagination extends StatelessWidget {
  const Pagination({super.key, required this.page, required this.pageCount, required this.onPage});

  final int page;
  final int pageCount;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    if (pageCount <= 1) return const SizedBox.shrink();
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        AppButton(
          label: 'Trước',
          icon: LucideIcons.chevronLeft,
          variant: ButtonVariant.outline,
          size: ButtonSize.sm,
          onPressed: page <= 1 ? null : () => onPage(page - 1),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text('Trang $page / $pageCount', style: AppText.meta),
        ),
        AppButton(
          label: 'Sau',
          icon: LucideIcons.chevronRight,
          iconRight: true,
          variant: ButtonVariant.outline,
          size: ButtonSize.sm,
          onPressed: page >= pageCount ? null : () => onPage(page + 1),
        ),
      ],
    );
  }
}

/// The module checklist, used on its own and inside the "create admin" form.
class PermissionChecklist extends StatelessWidget {
  const PermissionChecklist({super.key, required this.value, required this.onChanged});

  final List<String> value;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Được phép dùng', style: AppText.label),
        const SizedBox(height: 8),
        for (final module in adminModules) ...[
          CheckboxRow(
            checked: value.contains(module),
            onChanged: (checked) => onChanged(checked ? [...value, module] : value.where((m) => m != module).toList()),
            title: moduleLabels[module]!.$1,
            description: moduleLabels[module]!.$2,
          ),
          const SizedBox(height: 8),
        ],
        Text(
          'Admin không bao giờ tạo được Admin khác, đổi cấu hình hệ thống hay thao tác trên Super Admin, dù được cấp quyền nào.',
          style: AppText.meta.copyWith(fontSize: 12),
        ),
      ],
    );
  }
}
