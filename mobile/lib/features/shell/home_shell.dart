import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/prefs.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/sheets.dart';

const _tabs = [
  (label: 'Newsfeed', icon: LucideIcons.house),
  (label: 'Khám phá', icon: LucideIcons.compass),
  (label: 'Đang live', icon: LucideIcons.radio),
  (label: 'Cá nhân', icon: LucideIcons.user),
];

/// The public app's shell: four tabs and a "+" in the middle (the web's
/// mobile bottom navigation), with the announcement floating above it.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final liveCount = ref.watch(liveNowProvider).value?.length ?? 0;
    return Scaffold(
      body: Stack(
        children: [
          shell,
          const Positioned(left: 0, right: 0, bottom: 0, child: AnnouncementBanner()),
        ],
      ),
      bottomNavigationBar: _Dock(
        index: shell.currentIndex,
        liveCount: liveCount,
        onTab: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        onCreate: () => showCreateSheet(context, ref),
      ),
    );
  }
}

/// The web's mobile bottom bar (web/src/components/MobileBottomNav.tsx): a
/// round glass pill of icons, the "+" a blue pill in the middle. The app keeps
/// a Live tab where the web has Bookmarks: streams are a phone's main use.
class _Dock extends StatelessWidget {
  const _Dock({required this.index, required this.liveCount, required this.onTab, required this.onCreate});

  final int index;
  final int liveCount;
  final ValueChanged<int> onTab;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    Widget tab(int i) => _TabButton(label: _tabs[i].label, icon: _tabs[i].icon, selected: index == i, badge: i == 2 ? liveCount : 0, onTap: () => onTab(i));

    return Container(
      color: AppColors.ground,
      padding: EdgeInsets.fromLTRB(16, 4, 16, MediaQuery.paddingOf(context).bottom.clamp(12, 40)),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 384),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xE6141414),
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: const Color(0x1AFFFFFF)),
              boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 24, offset: Offset(0, 8))],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                tab(0),
                tab(1),
                Semantics(
                  button: true,
                  label: 'Tạo mới: hành trình, check-in hoặc livestream',
                  excludeSemantics: true,
                  child: Material(
                    color: AppColors.primary,
                    shape: const StadiumBorder(),
                    child: InkWell(
                      customBorder: const StadiumBorder(),
                      onTap: () {
                        HapticFeedback.selectionClick();
                        onCreate();
                      },
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Icon(LucideIcons.plus, size: 22, color: AppColors.onPrimary),
                      ),
                    ),
                  ),
                ),
                tab(2),
                tab(3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.label, required this.icon, required this.selected, required this.badge, required this.onTap});

  final String label;
  final IconData icon;
  final bool selected;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      label: badge > 0 ? '$label, $badge người đang phát' : label,
      excludeSemantics: true,
      child: Tooltip(
        message: label,
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22, color: selected ? AppColors.cream : AppColors.meta),
                if (badge > 0)
                  Positioned(
                    top: -7,
                    right: -10,
                    child: CountBubble(count: badge, borderColor: const Color(0xFF141414)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

const _createActions = [
  (
    path: '/posts/new',
    title: 'Đăng hành trình',
    description: 'Kể lại chuyến đi theo từng ngày, từng điểm dừng và chi phí.',
    icon: LucideIcons.squarePen,
    tint: AppColors.primary,
  ),
  (path: '/checkin/new', title: 'Check-in', description: 'Ảnh, cảm xúc và nơi bạn đang đến.', icon: LucideIcons.imagePlus, tint: AppColors.teal),
  (path: '/live/new', title: 'Phát trực tiếp', description: 'Livestream chuyến đi cho người theo dõi bạn.', icon: LucideIcons.video, tint: AppColors.social),
];

/// The "+" in the tab bar: what the web's Newsfeed composer offers, in one sheet.
void showCreateSheet(BuildContext context, WidgetRef ref) {
  final signedIn = ref.read(sessionProvider).signedIn;
  showAppSheet<void>(
    context,
    title: 'Tạo mới',
    description: 'Bạn muốn chia sẻ gì hôm nay?',
    builder: (sheetContext) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final action in _createActions)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: AppColors.well,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                side: const BorderSide(color: AppColors.border),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  if (!signedIn) {
                    context.push('/login?next=${Uri.encodeComponent(action.path)}');
                  } else {
                    context.push(action.path);
                  }
                },
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: action.tint.withValues(alpha: 0.14),
                          shape: BoxShape.circle,
                          border: Border.all(color: action.tint.withValues(alpha: 0.33)),
                        ),
                        child: Icon(action.icon, size: 22, color: action.tint),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(action.title, style: AppText.label),
                            const SizedBox(height: 2),
                            Text(action.description, style: AppText.meta),
                          ],
                        ),
                      ),
                      const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.meta),
                    ],
                  ),
                ),
              ),
            ),
          ),
        if (!signedIn)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('Bạn cần đăng nhập để đăng bài, check-in hoặc phát trực tiếp.', style: AppText.meta, textAlign: TextAlign.center),
          ),
      ],
    ),
  );
}

/// The superadmin's announcement (Quản trị, Cấu hình), floating above the tab
/// bar. Closing it hides this text only: a new announcement shows again.
class AnnouncementBanner extends ConsumerStatefulWidget {
  const AnnouncementBanner({super.key});

  @override
  ConsumerState<AnnouncementBanner> createState() => _AnnouncementBannerState();
}

class _AnnouncementBannerState extends ConsumerState<AnnouncementBanner> {
  String _dismissed = AppPrefs.dismissedAnnouncement;

  @override
  Widget build(BuildContext context) {
    final text = ref.watch(publicSettingsProvider).value?.announcement.trim() ?? '';
    if (text.isEmpty || text == _dismissed) return const SizedBox.shrink();
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        child: Semantics(
          container: true,
          label: 'Thông báo từ ChillnGo',
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            decoration: BoxDecoration(
              color: AppColors.raised,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: const Color(0x4D0099FF)),
              boxShadow: AppShadows.raised,
            ),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: const Icon(LucideIcons.megaphone, size: 16, color: AppColors.onPrimary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(text, style: AppText.bodySmall.copyWith(color: AppColors.cream)),
                ),
                AppIconButton(
                  icon: LucideIcons.x,
                  label: 'Đóng thông báo',
                  size: 34,
                  onPressed: () {
                    setState(() => _dismissed = text);
                    AppPrefs.dismissAnnouncement(text);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
