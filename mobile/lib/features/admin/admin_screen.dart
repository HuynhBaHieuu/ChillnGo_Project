import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/roles.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import '../auth/auth_widgets.dart';
import 'admin_common.dart';
import 'admin_panels.dart';

class _Section {
  const _Section({required this.path, required this.label, required this.title, required this.description, required this.icon, required this.allowed});

  final String path;
  final String label;
  final String title;
  final String Function(User user) description;
  final IconData icon;
  final bool Function(User user) allowed;
}

/// Every screen of the admin console, in sidebar order (web: ADMIN_SECTIONS).
/// `allowed` only decides what is shown; the API enforces the same rules.
final _sections = [
  _Section(
    path: 'overview',
    label: 'Tổng quan',
    title: 'Tổng quan hệ thống',
    description: (user) =>
        isSuperAdmin(user) ? 'Số liệu toàn bộ tài khoản và hoạt động quản trị.' : 'Số liệu tài khoản người dùng thường, trong phạm vi bạn được cấp.',
    icon: LucideIcons.chartColumn,
    allowed: (user) => hasModule(user, 'stats'),
  ),
  _Section(
    path: 'users',
    label: 'Người dùng',
    title: 'Quản lý người dùng',
    description: (user) => isSuperAdmin(user)
        ? 'Tất cả tài khoản. Khoá, mở khoá, đặt lại mật khẩu, phân quyền và xoá mọi tài khoản trừ Super Admin.'
        : 'Người dùng thường. Khoá, mở khoá và đặt lại mật khẩu.',
    icon: LucideIcons.users,
    allowed: (user) => hasModule(user, 'users'),
  ),
  _Section(
    path: 'admins',
    label: 'Quản trị viên',
    title: 'Quản trị viên',
    description: (_) => 'Tạo, khoá, xoá, hạ quyền và phân quyền từng mục cho Admin. Chỉ Super Admin.',
    icon: LucideIcons.shieldCheck,
    allowed: isSuperAdmin,
  ),
  _Section(
    path: 'content',
    label: 'Nội dung',
    title: 'Kiểm duyệt nội dung',
    description: (_) => 'Bài đăng, lịch trình, bình luận, báo cáo vi phạm và danh mục.',
    icon: LucideIcons.construction,
    allowed: contentAllowed,
  ),
  _Section(
    path: 'audit',
    label: 'Nhật ký',
    title: 'Nhật ký hoạt động',
    description: (_) => 'Mọi thao tác của Admin và Super Admin. Không sửa hay xoá được.',
    icon: LucideIcons.clipboardList,
    allowed: isSuperAdmin,
  ),
  _Section(
    path: 'settings',
    label: 'Cấu hình',
    title: 'Cấu hình hệ thống',
    description: (_) => 'Đóng hoặc mở đăng ký và thông báo toàn trang. Có hiệu lực ngay.',
    icon: LucideIcons.settings,
    allowed: isSuperAdmin,
  ),
];

/// /admin and /admin/:section: the admin console, its own shell apart from the
/// public app (web: AdminLayout). Sections the account may not use are not
/// listed, and their addresses fall back to the first allowed one.
class AdminScreen extends ConsumerWidget {
  const AdminScreen({super.key, this.section});

  final String? section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    if (user == null) return const Scaffold();
    final allowed = _sections.where((s) => s.allowed(user)).toList();
    final current = allowed.where((s) => s.path == section).firstOrNull ?? allowed.firstOrNull;

    Future<void> signOut() async {
      final session = ref.read(sessionProvider.notifier);
      final router = GoRouter.of(context);
      ref.read(adminNoticeProvider.notifier).show(null);
      await signOutOfGoogle();
      await session.signOut();
      // As on the web, signing out of the console leads to the sign-in page.
      router.go('/login');
    }

    return Scaffold(
      body: Column(
        children: [
          Container(
            color: AppColors.surface,
            padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(kGutter, 10, 8, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ChillnGo',
                              style: TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w900, fontSize: 20, color: AppColors.cream),
                            ),
                            Text('QUẢN TRỊ HỆ THỐNG', style: AppText.caps.copyWith(fontSize: 10, letterSpacing: 2)),
                          ],
                        ),
                      ),
                      RoleBadge(role: user.role),
                      AppIconButton(icon: LucideIcons.logOut, label: 'Đăng xuất', onPressed: signOut),
                    ],
                  ),
                ),
                if (allowed.isNotEmpty)
                  SizedBox(
                    height: 48,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                      itemCount: allowed.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 4),
                      itemBuilder: (context, i) {
                        final s = allowed[i];
                        final active = s == current;
                        return Material(
                          color: active ? AppColors.primary : Colors.transparent,
                          shape: const StadiumBorder(),
                          child: InkWell(
                            customBorder: const StadiumBorder(),
                            onTap: () {
                              ref.read(adminNoticeProvider.notifier).show(null);
                              context.go('/admin/${s.path}');
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Row(
                                children: [
                                  Icon(s.icon, size: 16, color: active ? AppColors.onPrimary : AppColors.meta),
                                  const SizedBox(width: 6),
                                  Text(s.label, style: AppText.label.copyWith(fontSize: 13, color: active ? AppColors.onPrimary : AppColors.meta)),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                const Divider(height: 1),
              ],
            ),
          ),
          Expanded(
            child: current == null
                ? const Padding(
                    padding: EdgeInsets.all(kGutter),
                    child: Center(
                      child: EmptyState(
                        icon: LucideIcons.shieldOff,
                        title: 'Chưa được cấp quyền',
                        description: 'Tài khoản Admin của bạn chưa được Super Admin cấp quyền cho mục nào.',
                      ),
                    ),
                  )
                : ListView(
                    key: PageStorageKey(current.path),
                    padding: const EdgeInsets.fromLTRB(kGutter, 20, kGutter, 40),
                    children: [
                      Text(current.title, style: AppText.h1),
                      const SizedBox(height: 6),
                      Text(current.description(user), style: AppText.meta),
                      const SizedBox(height: 18),
                      const NoticeBar(),
                      switch (current.path) {
                        'overview' => const StatsPanel(),
                        'users' => UsersPanel(actor: user),
                        'admins' => AdminsPanel(actor: user),
                        'content' => ContentPanel(actor: user),
                        'audit' => const AuditPanel(),
                        _ => const SettingsPanel(),
                      },
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
