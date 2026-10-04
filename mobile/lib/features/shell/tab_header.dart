import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/surfaces.dart';

/// The top bar of every tab: the wordmark (or the tab's title), the
/// notification bell and the account button: the web navbar on a phone.
class TabHeader extends ConsumerWidget {
  const TabHeader({super.key, this.title, this.actions = const []});

  final String? title;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    final unread = ref.watch(unreadCountProvider);
    // The web's glass navbar in the void theme: a black bar with a hairline
    // and 12px corners (theme-void.css, header[data-nav='glass']).
    return Container(
      color: AppColors.ground,
      padding: EdgeInsets.fromLTRB(12, MediaQuery.paddingOf(context).top + 6, 12, 8),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
        decoration: BoxDecoration(
          color: const Color(0xB8000000),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title ?? 'ChillnGo',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: title == null
                    ? const TextStyle(fontFamily: AppFonts.display, fontWeight: FontWeight.w600, fontSize: 23, color: AppColors.cream, letterSpacing: -0.7)
                    : AppText.h2,
              ),
            ),
            ...actions.expand((a) => [a, const SizedBox(width: 8)]),
            if (user != null) ...[
              AppIconButton(
                icon: LucideIcons.bell,
                label: unread > 0 ? 'Thông báo ($unread chưa đọc)' : 'Thông báo',
                tone: IconTone.well,
                size: 38,
                dot: unread > 0,
                onPressed: () => context.push('/notifications'),
              ),
              const SizedBox(width: 8),
              Semantics(
                button: true,
                label: 'Tài khoản',
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => context.push('/menu'),
                  child: AppAvatar(url: user.avatarUrl, name: user.displayName, size: 38),
                ),
              ),
            ] else
              // As on the web at phone width: one button; sign-in is a link on that page.
              BeamButton(label: 'Bắt đầu ngay', onPressed: () => context.push('/register')),
          ],
        ),
      ),
    );
  }
}
