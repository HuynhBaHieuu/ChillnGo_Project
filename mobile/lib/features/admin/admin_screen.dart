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
import 'catalog_panel.dart';
import '../../core/i18n.dart';
import 'business_panels.dart';
import 'news_panel.dart';

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
List<_Section> get _sections => [
  _Section(
    path: 'overview',
    label: t('Tổng quan'),
    title: t('Tổng quan hệ thống'),
    description: (user) =>
        isSuperAdmin(user) ? t('Số liệu toàn bộ tài khoản và hoạt động quản trị.') : t('Số liệu tài khoản người dùng thường, trong phạm vi bạn được cấp.'),
    icon: LucideIcons.chartColumn,
    allowed: (user) => hasModule(user, 'stats'),
  ),
  _Section(
    path: 'users',
    label: t('Người dùng'),
    title: t('Quản lý người dùng'),
    description: (user) => isSuperAdmin(user)
        ? t('Tất cả tài khoản. Khoá, mở khoá, đặt lại mật khẩu và phân quyền mọi tài khoản trừ Super Admin. Tài khoản chỉ bị khoá, không bị xoá.')
        : t('Người dùng thường. Khoá, mở khoá và đặt lại mật khẩu.'),
    icon: LucideIcons.users,
    allowed: (user) => hasModule(user, 'users'),
  ),
  _Section(
    path: 'admins',
    label: t('Quản trị viên'),
    title: t('Quản trị viên'),
    description: (_) => t('Tạo, khoá, hạ quyền và phân quyền từng mục cho Admin. Chỉ Super Admin.'),
    icon: LucideIcons.shieldCheck,
    allowed: isSuperAdmin,
  ),
  _Section(
    path: 'content',
    label: t('Nội dung'),
    title: t('Kiểm duyệt nội dung'),
    description: (_) => t('Báo cáo vi phạm từ người dùng: xem xét, ẩn, gỡ nội dung hoặc khoá tài khoản vi phạm. Xem và hiện lại những gì đang bị ẩn, dừng livestream vi phạm.'),
    icon: LucideIcons.flag,
    allowed: contentAllowed,
  ),
  _Section(
    path: 'businesses',
    label: t('Doanh nghiệp'),
    title: t('Duyệt doanh nghiệp'),
    description: (_) => t('Hồ sơ homestay, khách sạn, quán ăn, cà phê và tour: duyệt, từ chối kèm lý do, ẩn hoặc hiển thị lại.'),
    icon: LucideIcons.building2,
    allowed: (user) => hasModule(user, 'businesses'),
  ),
  _Section(
    path: 'news',
    label: t('Tin tức'),
    title: t('Tin tức du lịch'),
    description: (_) => t('Chọn nguồn tin (báo, Google News, YouTube, mạng xã hội) để ChillnGo tự cào, tóm tắt và đăng lên Newsfeed.'),
    icon: LucideIcons.newspaper,
    allowed: (user) => hasModule(user, 'news'),
  ),
  _Section(
    path: 'revenue',
    label: t('Doanh thu'),
    title: t('Doanh thu'),
    description: (_) => t('Đơn hàng thanh toán qua PayOS: gói Premium và gói Đề xuất của doanh nghiệp.'),
    icon: LucideIcons.banknote,
    allowed: (user) => hasModule(user, 'revenue'),
  ),
  _Section(
    path: 'catalog',
    label: t('Danh mục'),
    title: t('Danh mục địa điểm'),
    description: (_) => t('Điểm đến, địa điểm và checklist chuẩn bị mà AI dùng để lên lịch trình. AI chỉ gợi ý những gì có ở đây.'),
    icon: LucideIcons.mapPinned,
    allowed: (user) => hasModule(user, 'categories'),
  ),
  _Section(
    path: 'audit',
    label: t('Nhật ký'),
    title: t('Nhật ký hoạt động'),
    description: (_) => t('Mọi thao tác của Admin và Super Admin. Không sửa hay xoá được.'),
    icon: LucideIcons.clipboardList,
    allowed: isSuperAdmin,
  ),
  _Section(
    path: 'settings',
    label: t('Cấu hình'),
    title: t('Cấu hình hệ thống'),
    description: (_) => t('Đóng hoặc mở đăng ký và thông báo toàn trang. Có hiệu lực ngay.'),
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
                            Text(t('QUẢN TRỊ HỆ THỐNG'), style: AppText.caps.copyWith(fontSize: 10, letterSpacing: 2)),
                          ],
                        ),
                      ),
                      RoleBadge(role: user.role),
                      AppIconButton(icon: LucideIcons.logOut, label: t('Đăng xuất'), onPressed: signOut),
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
                ? Padding(
                    padding: EdgeInsets.all(kGutter),
                    child: Center(
                      child: EmptyState(
                        icon: LucideIcons.shieldOff,
                        title: t('Chưa được cấp quyền'),
                        description: t('Tài khoản Admin của bạn chưa được Super Admin cấp quyền cho mục nào.'),
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
                        'businesses' => const BusinessesPanel(),
                        'revenue' => const RevenuePanel(),
                        'news' => const NewsPanel(),
                        'catalog' => const CatalogPanel(),
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
