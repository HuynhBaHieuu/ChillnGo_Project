import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';
import '../shell/tab_header.dart';
import 'profile_view.dart';

/// The "Cá nhân" tab: your own profile, with shortcuts to your activity and journeys.
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    if (user == null) {
      return Scaffold(
        body: Column(
          children: [
            const TabHeader(title: 'Cá nhân'),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(kGutter),
                  child: Column(
                    children: [
                      EmptyState(
                        icon: LucideIcons.logIn,
                        title: 'Đăng nhập để có trang cá nhân',
                        description: 'Lưu hành trình bạn thích, sao chép lịch trình về làm của mình, check-in và phát trực tiếp chuyến đi.',
                        action: Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          alignment: WrapAlignment.center,
                          children: [
                            AppButton(label: 'Đăng nhập', onPressed: () => context.push('/login')),
                            AppButton(label: 'Tạo tài khoản', variant: ButtonVariant.outline, onPressed: () => context.push('/register')),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      AppButton(label: 'Về ChillnGo', variant: ButtonVariant.ghost, onPressed: () => context.push('/about')),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }
    return Scaffold(
      body: Column(
        children: [
          TabHeader(
            title: 'Cá nhân',
            actions: [
              AppIconButton(icon: LucideIcons.map, label: 'Hành trình của tôi', tone: IconTone.well, size: 38, onPressed: () => context.push('/itineraries')),
              AppIconButton(icon: LucideIcons.activity, label: 'Hoạt động của bạn', tone: IconTone.well, size: 38, onPressed: () => context.push('/activity')),
            ],
          ),
          Expanded(
            child: ProfileView(key: ValueKey(user.id), userId: user.id),
          ),
        ],
      ),
    );
  }
}
