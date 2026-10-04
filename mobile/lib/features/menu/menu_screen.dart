import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../state/session.dart';
import '../../ui/surfaces.dart';
import '../auth/auth_widgets.dart';
import 'server_settings.dart';
import '../../ui/navigation.dart';

/// The account menu behind the header avatar (web: AccountMenu + the navbar's mobile sheet).
class MenuScreen extends ConsumerWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((s) => s.user));

    void open(String path) {
      final router = GoRouter.of(context);
      if (router.canPop()) router.pop();
      Future<void>.delayed(const Duration(milliseconds: 60), () => router.push(path));
    }

    Future<void> signOut() async {
      final session = ref.read(sessionProvider.notifier);
      // Leave the account pages first, so nothing asks to sign in again.
      context.go('/feed');
      await signOutOfGoogle();
      // Every list that showed this account's data watches the session and reloads.
      await session.signOut();
    }

    final items = user == null
        ? [(label: 'Đăng nhập', hint: null, icon: LucideIcons.user, path: '/login'), (label: 'Về ChillnGo', hint: null, icon: LucideIcons.info, path: '/about')]
        : [
            (label: 'Trang cá nhân', hint: null, icon: LucideIcons.user, path: '/users/${user.id}'),
            (label: 'Chỉnh sửa hồ sơ', hint: null, icon: LucideIcons.userPen, path: '/profile/edit'),
            (label: 'Đăng bài mới', hint: null, icon: LucideIcons.squarePen, path: '/posts/new'),
            (label: 'Hoạt động của bạn', hint: 'Lượt thích, bình luận, bản nháp, đã xoá…', icon: LucideIcons.activity, path: '/activity'),
            (label: 'Hành trình của tôi', hint: 'Bài bạn đăng và lịch trình đã clone', icon: LucideIcons.map, path: '/itineraries'),
            (label: 'Đã lưu', hint: null, icon: LucideIcons.bookmark, path: '/activity/saved'),
            (label: 'Phát trực tiếp', hint: null, icon: LucideIcons.radio, path: '/live/new'),
            (label: 'Về ChillnGo', hint: null, icon: LucideIcons.info, path: '/about'),
          ];

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Tài khoản')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 40),
        children: [
          if (user != null) ...[
            AppCard(
              child: Row(
                children: [
                  AppAvatar(url: user.avatarUrl, name: user.displayName, size: 56),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.displayName, style: AppText.h3),
                        Text('@${user.username}', style: AppText.meta),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ] else ...[
            Text('Bạn chưa đăng nhập', style: AppText.h2),
            const SizedBox(height: 12),
          ],
          for (final item in items) _MenuRow(icon: item.icon, label: item.label, hint: item.hint, onTap: () => open(item.path)),
          _MenuRow(icon: LucideIcons.server, label: 'Máy chủ API', hint: 'Đổi địa chỉ khi chạy trên điện thoại thật', onTap: () => showServerSettings(context)),
          if (user != null) _MenuRow(icon: LucideIcons.logOut, label: 'Đăng xuất', danger: true, showChevron: false, onTap: signOut),
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.icon, required this.label, this.hint, required this.onTap, this.danger = false, this.showChevron = true});

  final IconData icon;
  final String label;
  final String? hint;
  final VoidCallback onTap;
  final bool danger;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.md),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: danger ? const Color(0x1FE5534B) : AppColors.well, shape: BoxShape.circle),
              child: Icon(icon, size: 18, color: danger ? AppColors.destructive : AppColors.sage),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppText.label.copyWith(color: danger ? AppColors.destructive : AppColors.cream)),
                  if (hint != null) Text(hint!, style: AppText.meta),
                ],
              ),
            ),
            if (showChevron) const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.meta),
          ],
        ),
      ),
    );
  }
}
