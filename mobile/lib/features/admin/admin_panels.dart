import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/password.dart';
import '../../core/roles.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/admin_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../auth/auth_widgets.dart';
import 'admin_common.dart';
import 'reports_panel.dart';
import '../../core/i18n.dart';

final adminStatsProvider = FutureProvider.autoDispose<AdminStats>((ref) => AdminService.getStats());

final adminSettingsProvider = FutureProvider.autoDispose<AppSettings>((ref) => AdminService.getSettings());

/// Bumped after any admin action, so every admin list reloads.
final adminVersionProvider = NotifierProvider<AdminVersion, int>(AdminVersion.new);

class AdminVersion extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state++;
}

/* ------------------------------------------------------------- Tổng quan */

/// Tổng quan: account statistics. Admins see regular users only.
class StatsPanel extends ConsumerWidget {
  const StatsPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(adminVersionProvider);
    final stats = ref.watch(adminStatsProvider);
    if (stats.isLoading && !stats.hasValue) return LoadingView(message: t('Đang tải thống kê…'));
    if (stats.hasError && !stats.hasValue) return ErrorPanel(error: stats.error, onRetry: () => ref.invalidate(adminStatsProvider));
    final s = stats.value!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (s.pendingBusinesses != null && s.pendingBusinesses! > 0) ...[
          AppCard(
            onTap: () => context.go('/admin/businesses'),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Doanh nghiệp chờ duyệt'), style: AppText.meta.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Text(formatNumber(s.pendingBusinesses!), style: AppText.h1.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                    ],
                  ),
                ),
                Text(t('Mở hàng chờ duyệt'), style: AppText.label.copyWith(fontSize: 13)),
                const SizedBox(width: 4),
                const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.cream),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (s.newsToday != null) ...[
          AppCard(
            onTap: () => context.go('/admin/news'),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Tin mới hôm nay'), style: AppText.meta.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Text(formatNumber(s.newsToday!), style: AppText.h2),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Tin chờ duyệt'), style: AppText.meta.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Text(formatNumber(s.newsPending ?? 0), style: AppText.h2),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (s.revenue30 != null) ...[
          AppCard(
            onTap: () => context.go('/admin/revenue'),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Doanh thu 30 ngày'), style: AppText.meta.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Text(formatVnd(s.revenue30!), style: AppText.h2),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Thành viên Premium'), style: AppText.meta.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Text(formatNumber(s.premiumMembers ?? 0), style: AppText.h2),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (s.pendingReports != null) ...[
          AppCard(
            onTap: () => context.go('/admin/content'),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('Báo cáo chờ xử lý'), style: AppText.meta.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Text(formatNumber(s.pendingReports!), style: AppText.h1.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                    ],
                  ),
                ),
                Text(t('Mở hàng chờ kiểm duyệt'), style: AppText.label.copyWith(fontSize: 13)),
                const SizedBox(width: 4),
                const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.cream),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        _TileGrid(
          tiles: [
            _Tile(t('Tổng tài khoản'), s.total),
            _Tile(t('Đăng ký mới 7 ngày'), s.new7),
            _Tile(t('Đăng ký mới 30 ngày'), s.new30),
            _Tile(t('Đã xác nhận email'), s.verified, of: s.total),
            _Tile(t('Liên kết Google'), s.googleLinked, of: s.total),
            _Tile(t('Đang bị khoá'), s.locked, of: s.total),
          ],
        ),
        const SizedBox(height: 20),
        if (s.signupsByDay.isNotEmpty) _SignupChart(data: s.signupsByDay),
        if (s.content case final c?) ...[
          const SizedBox(height: 20),
          Text(t('Nội dung và hoạt động'), style: AppText.label),
          const SizedBox(height: 10),
          _TileGrid(
            tiles: [
              _Tile(t('Hành trình đã đăng'), c['posts'] ?? 0, note: t('+{n} trong 7 ngày', {'n': c['posts7'] ?? 0})),
              _Tile(t('Check-in'), c['checkins'] ?? 0, note: t('+{n} trong 7 ngày', {'n': c['checkins7'] ?? 0})),
              _Tile(t('Đang livestream'), c['liveNow'] ?? 0, note: t('{n} buổi trong 30 ngày', {'n': c['streams30'] ?? 0})),
              _Tile(t('Báo cáo mới 7 ngày'), c['reports7'] ?? 0, note: t('{n} nội dung đang bị ẩn', {'n': c['hidden'] ?? 0})),
              _Tile(t('Lượt dùng AI hôm nay'), c['aiRequestsToday'] ?? 0, note: t('{n} người dùng', {'n': c['aiUsersToday'] ?? 0})),
              _Tile(t('Bản nháp AI 7 ngày'), c['aiDrafts7'] ?? 0),
            ],
          ),
        ],
        if (s.scope == 'full' && s.byRole != null) ...[
          const SizedBox(height: 20),
          Text(t('Chỉ dành cho Super Admin'), style: AppText.label),
          const SizedBox(height: 10),
          _TileGrid(
            tiles: [
              _Tile(roleLabels['user']!, s.byRole!['user'] ?? 0),
              _Tile(roleLabels['admin']!, s.byRole!['admin'] ?? 0),
              _Tile(roleLabels['superadmin']!, s.byRole!['superadmin'] ?? 0),
              _Tile(t('Thao tác quản trị 7 ngày'), s.adminActions7 ?? 0),
            ],
          ),
        ],
      ],
    );
  }
}

class _Tile {
  const _Tile(this.label, this.value, {this.of, this.note});

  final String label;
  final int value;
  final int? of;
  final String? note;
}

class _TileGrid extends StatelessWidget {
  const _TileGrid({required this.tiles});

  final List<_Tile> tiles;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final tile in tiles)
              Container(
                width: width,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tile.label, style: AppText.meta.copyWith(fontSize: 12)),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(formatNumber(tile.value), style: AppText.h1.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                        if (tile.of != null && tile.of! > 0) ...[
                          const SizedBox(width: 6),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text('${(tile.value / tile.of! * 100).round()}%', style: AppText.meta.copyWith(fontSize: 12)),
                          ),
                        ],
                      ],
                    ),
                    if (tile.note != null) ...[const SizedBox(height: 4), Text(tile.note!, style: AppText.meta.copyWith(fontSize: 12))],
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

String _dayLabel(String iso) {
  final parts = iso.split('-');
  return parts.length == 3 ? '${parts[2]}/${parts[1]}' : iso;
}

/// Daily sign-ups, last 30 days (one series: the heading names it).
class _SignupChart extends StatefulWidget {
  const _SignupChart({required this.data});

  final List<(String date, int count)> data;

  @override
  State<_SignupChart> createState() => _SignupChartState();
}

class _SignupChartState extends State<_SignupChart> {
  int? _active;
  bool _table = false;

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final max = math.max(1, data.fold(0, (m, d) => math.max(m, d.$2)));
    final total = data.fold(0, (sum, d) => sum + d.$2);
    final shown = _active == null ? null : data[_active!];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(t('Đăng ký mới mỗi ngày, 30 ngày qua'), style: AppText.label),
          const SizedBox(height: 4),
          Text(
            shown != null ? t('{value}: {value2} tài khoản', {'value': _dayLabel(shown.$1), 'value2': shown.$2}) : t('Tổng {total} tài khoản · cao nhất {value}/ngày', {'total': total, 'value': total == 0 ? 0 : max}),
            style: AppText.meta.copyWith(fontSize: 12),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 160,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('$max', style: AppText.meta.copyWith(fontSize: 11)),
                    Text('0', style: AppText.meta.copyWith(fontSize: 11)),
                  ],
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    decoration: const BoxDecoration(
                      border: Border(bottom: BorderSide(color: AppColors.borderStrong)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (var i = 0; i < data.length; i++)
                          Expanded(
                            child: Semantics(
                              label: t('{value}: {value2} tài khoản', {'value': _dayLabel(data[i].$1), 'value2': data[i].$2}),
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTapDown: (_) => setState(() => _active = i),
                                onTapUp: (_) => Future.delayed(const Duration(seconds: 2), () {
                                  if (mounted && _active == i) setState(() => _active = null);
                                }),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 1),
                                  child: FractionallySizedBox(
                                    alignment: Alignment.bottomCenter,
                                    heightFactor: data[i].$2 == 0 ? 0 : math.max(0.03, data[i].$2 / max),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: _active == i ? AppColors.cream : AppColors.teal,
                                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_dayLabel(data.first.$1), style: AppText.meta.copyWith(fontSize: 11)),
                Text(_dayLabel(data[data.length ~/ 2].$1), style: AppText.meta.copyWith(fontSize: 11)),
                Text(_dayLabel(data.last.$1), style: AppText.meta.copyWith(fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextLink(label: _table ? t('Ẩn bảng') : t('Xem dạng bảng'), color: AppColors.meta, onPressed: () => setState(() => _table = !_table)),
          ),
          if (_table)
            for (final d in data)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 4),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    Expanded(child: Text(_dayLabel(d.$1), style: AppText.meta.copyWith(fontSize: 12))),
                    Text('${d.$2}', style: AppText.meta.copyWith(fontSize: 12, color: AppColors.cream)),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------- Người dùng */

/// Accounts with search, filters and per-account actions (web: UsersTable).
class UsersPanel extends ConsumerStatefulWidget {
  const UsersPanel({super.key, required this.actor, this.fixedRole, this.showPermissions = false});

  final User actor;

  /// Lock the list to one role (the Admins section). Otherwise superadmins get a role filter.
  final String? fixedRole;

  /// Show each admin's modules instead of the last sign-in.
  final bool showPermissions;

  @override
  ConsumerState<UsersPanel> createState() => _UsersPanelState();
}

class _UsersPanelState extends ConsumerState<UsersPanel> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _q = '';
  String _status = 'all';
  String _role = 'all';
  int _page = 1;
  AdminPage<AdminUser>? _data;
  Object? _error;
  bool _loading = true;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final page = await AdminService.listUsers(
        q: _q.isEmpty ? null : _q,
        status: _status == 'all' ? null : _status,
        role: widget.fixedRole ?? (_role == 'all' ? null : _role),
        page: _page,
      );
      if (!mounted || request != _request) return;
      setState(() {
        _data = page;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(adminVersionProvider, (_, _) => _load());
    final showRoleFilter = widget.fixedRole == null && widget.actor.role == 'superadmin';
    final data = _data;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          controller: _search,
          icon: LucideIcons.search,
          hint: t('Tìm theo tên, tên người dùng hoặc email'),
          autocorrect: false,
          onChanged: (text) {
            _debounce?.cancel();
            // Wait for a pause in typing before querying.
            _debounce = Timer(const Duration(milliseconds: 300), () {
              _q = text.trim();
              _page = 1;
              _load();
            });
          },
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            if (showRoleFilter) ...[
              Expanded(
                child: SelectField<String>(
                  value: _role,
                  options: [SelectOption('all', t('Mọi vai trò')), for (final r in roleLabels.keys) SelectOption(r, roleLabels[r]!)],
                  onChanged: (v) {
                    setState(() {
                      _role = v;
                      _page = 1;
                    });
                    _load();
                  },
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: SelectField<String>(
                value: _status,
                options: [SelectOption('all', t('Mọi trạng thái')), SelectOption('active', t('Hoạt động')), SelectOption('locked', t('Đã khoá'))],
                onChanged: (v) {
                  setState(() {
                    _status = v;
                    _page = 1;
                  });
                  _load();
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (_loading && data == null)
          LoadingView(message: t('Đang tải danh sách…'))
        else if (_error != null && data == null)
          ErrorPanel(error: _error, onRetry: _load)
        else if (data == null || data.items.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.borderStrong),
            ),
            child: Text(t('Không có tài khoản nào khớp bộ lọc.'), style: AppText.meta, textAlign: TextAlign.center),
          )
        else ...[
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          for (final u in data.items) ...[_UserCard(actor: widget.actor, user: u, showPermissions: widget.showPermissions), const SizedBox(height: 10)],
          Row(
            children: [
              Text(t('{total} tài khoản', {'total': data.total}), style: AppText.meta.copyWith(fontSize: 12)),
              const Spacer(),
              Pagination(
                page: data.page,
                pageCount: data.pageCount,
                onPage: (p) {
                  setState(() => _page = p);
                  _load();
                },
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _UserCard extends ConsumerWidget {
  const _UserCard({required this.actor, required this.user, required this.showPermissions});

  final User actor;
  final AdminUser user;
  final bool showPermissions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppAvatar(url: user.avatarUrl, name: user.displayName, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        style: AppText.label,
                        children: [
                          TextSpan(text: user.displayName),
                          if (user.id == actor.id) TextSpan(text: t('  (bạn)'), style: AppText.meta.copyWith(fontSize: 12)),
                        ],
                      ),
                    ),
                    Text('@${user.username} · ${user.email}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta.copyWith(fontSize: 12)),
                    if (!user.emailVerified) Text(t('Chưa xác nhận email'), style: AppText.meta.copyWith(fontSize: 12)),
                  ],
                ),
              ),
              if (canManage(actor, user))
                AppIconButton(
                  icon: LucideIcons.ellipsis,
                  label: t('Thao tác với {displayName} (@{username})', {'displayName': user.displayName, 'username': user.username}),
                  onPressed: () => showUserActions(context, ref, actor, user),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              RoleBadge(role: user.role),
              StatusBadge(status: user.status),
              if (user.googleLinked) const AppBadge('Google', tone: BadgeTone.outline),
            ],
          ),
          if (user.status == 'locked' && user.lockedReason.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(t('Lý do khoá: {lockedReason}', {'lockedReason': user.lockedReason}), style: AppText.meta.copyWith(fontSize: 12)),
          ],
          const SizedBox(height: 8),
          if (showPermissions)
            user.role == 'superadmin'
                ? Text(t('Toàn quyền'), style: AppText.meta.copyWith(fontSize: 12))
                : user.permissions.isEmpty
                ? Text(t('Chưa được cấp quyền nào'), style: AppText.meta.copyWith(fontSize: 12))
                : Wrap(spacing: 4, runSpacing: 4, children: [for (final p in user.permissions) AppBadge(moduleLabels[p]?.$1 ?? p)])
          else
            Text(t('Đăng nhập gần nhất: {time}', {'time': formatDateTime(user.lastLoginAt)}), style: AppText.meta.copyWith(fontSize: 12)),
        ],
      ),
    );
  }
}

/// The "…" menu on an account, plus the dialog each action opens (web: UserActions).
Future<void> showUserActions(BuildContext context, WidgetRef ref, User actor, AdminUser target) async {
  final superadmin = isSuperAdmin(actor);
  final name = '${target.displayName} (@${target.username})';
  final choice = await showActionSheet<String>(
    context,
    title: name,
    actions: [
      if (target.status == 'active')
        MenuAction('lock', t('Khoá tài khoản'), icon: LucideIcons.lock)
      else
        MenuAction('unlock', t('Mở khoá'), icon: LucideIcons.lockOpen),
      MenuAction('reset', t('Đặt lại mật khẩu'), icon: LucideIcons.keyRound),
      if (superadmin) ...[
        if (target.role == 'user')
          MenuAction('promote', t('Đặt làm Admin'), icon: LucideIcons.shieldCheck)
        else ...[
          MenuAction('permissions', t('Phân quyền'), icon: LucideIcons.shieldCheck),
          MenuAction('demote', t('Hạ xuống người dùng'), icon: LucideIcons.shieldMinus),
        ],
      ],
    ],
  );
  if (choice == null || !context.mounted) return;

  final notice = ref.read(adminNoticeProvider.notifier);
  void done(String text) {
    notice.show(Notice(text));
    ref.read(adminVersionProvider.notifier).bump();
  }

  Future<void> run(Future<String> Function() action) async {
    try {
      done(await action());
    } catch (error) {
      notice.show(Notice(errorMessage(error), error: true));
      rethrow;
    }
  }

  switch (choice) {
    case 'lock':
      final reason = TextEditingController();
      await confirmAction(
        context,
        title: t('Khoá tài khoản'),
        description:
            t('{name} sẽ không đăng nhập được, và phiên đang mở sẽ bị đăng xuất ở lần tải trang tiếp theo. Buổi livestream đang phát (nếu có) sẽ kết thúc, và tài khoản không còn được tính vào số người theo dõi / đang theo dõi của người khác cho tới khi được mở khoá.', {'name': name}),
        confirmLabel: t('Khoá tài khoản'),
        destructive: true,
        content: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: AppTextField(controller: reason, label: t('Lý do (người dùng sẽ thấy khi đăng nhập)'), maxLength: 200, maxLines: 3, minLines: 2),
        ),
        onConfirm: () => run(() async {
          await AdminService.lockUser(target.id, reason.text.trim());
          return t('Đã khoá {name}.', {'name': name});
        }),
      );
      reason.dispose();
    case 'unlock':
      await confirmAction(
        context,
        title: t('Mở khoá tài khoản'),
        description: t('{name} sẽ đăng nhập lại được bình thường, và các lượt theo dõi được tính lại như cũ.', {'name': name}),
        confirmLabel: t('Mở khoá'),
        onConfirm: () => run(() async {
          await AdminService.unlockUser(target.id);
          return t('Đã mở khoá {name}.', {'name': name});
        }),
      );
    case 'reset':
      await confirmAction(
        context,
        title: t('Đặt lại mật khẩu'),
        description:
            t('Hệ thống tạo một mật khẩu tạm thời ngẫu nhiên và gửi tới {email}. Mật khẩu hiện tại sẽ không dùng được nữa. Bạn sẽ không nhìn thấy mật khẩu mới.', {'email': target.email}),
        confirmLabel: t('Đặt lại và gửi email'),
        onConfirm: () => run(() => AdminService.resetPassword(target.id)),
      );
    case 'demote':
      await confirmAction(
        context,
        title: t('Hạ xuống người dùng thường'),
        description: t('{name} sẽ mất toàn bộ quyền quản trị. Tài khoản vẫn giữ nguyên.', {'name': name}),
        confirmLabel: t('Hạ quyền'),
        destructive: true,
        onConfirm: () => run(() async {
          await AdminService.setRole(target.id, 'user');
          return t('{name} đã trở về người dùng thường.', {'name': name});
        }),
      );
    case 'promote':
    case 'permissions':
      final promote = choice == 'promote';
      await showAppSheet<void>(
        context,
        title: promote ? t('Đặt {displayName} làm Admin', {'displayName': target.displayName}) : t('Phân quyền cho {displayName}', {'displayName': target.displayName}),
        description: t('Chọn những mục Admin này được dùng trong trang quản trị.'),
        builder: (sheetContext) => _PermissionsForm(
          initial: target.role == 'admin' ? target.permissions : const [],
          confirmLabel: promote ? t('Đặt làm Admin') : t('Lưu quyền'),
          onConfirm: (value) async {
            try {
              await run(() async {
                if (promote) {
                  await AdminService.setRole(target.id, 'admin', value);
                  return t('{name} giờ là Admin.', {'name': name});
                }
                await AdminService.setPermissions(target.id, value);
                return t('Đã cập nhật quyền của {name}.', {'name': name});
              });
            } catch (_) {
              // Shown in the notice bar.
            }
            if (sheetContext.mounted) Navigator.of(sheetContext).pop();
          },
        ),
      );
  }
}

class _PermissionsForm extends StatefulWidget {
  const _PermissionsForm({required this.initial, required this.confirmLabel, required this.onConfirm});

  final List<String> initial;
  final String confirmLabel;
  final Future<void> Function(List<String> value) onConfirm;

  @override
  State<_PermissionsForm> createState() => _PermissionsFormState();
}

class _PermissionsFormState extends State<_PermissionsForm> {
  late List<String> _value = [...widget.initial];
  bool _pending = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PermissionChecklist(value: _value, onChanged: (v) => setState(() => _value = v)),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: AppButton(label: t('Huỷ'), variant: ButtonVariant.outline, onPressed: _pending ? null : () => Navigator.of(context).pop()),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AppButton(
                label: widget.confirmLabel,
                loading: _pending,
                onPressed: () async {
                  setState(() => _pending = true);
                  await widget.onConfirm(_value);
                  if (mounted) setState(() => _pending = false);
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/* --------------------------------------------------------- Quản trị viên */

/// Quản trị viên: superadmin only. Create, re-permission, lock and demote admins. Accounts are never deleted.
class AdminsPanel extends ConsumerWidget {
  const AdminsPanel({super.key, required this.actor});

  final User actor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t('Muốn nâng một người dùng có sẵn lên Admin? Vào mục Người dùng, mở menu của tài khoản đó và chọn “Đặt làm Admin”.'), style: AppText.meta),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: AppButton(
            label: t('Tạo Admin mới'),
            icon: LucideIcons.userPlus,
            onPressed: () => showAppSheet<void>(
              context,
              title: t('Tạo Admin mới'),
              description: t('Tài khoản được kích hoạt ngay, không cần xác nhận email. Admin nên đổi mật khẩu sau lần đăng nhập đầu tiên.'),
              tall: true,
              builder: (_) => const _CreateAdminForm(),
            ),
          ),
        ),
        const SizedBox(height: 16),
        UsersPanel(actor: actor, fixedRole: 'admin', showPermissions: true),
      ],
    );
  }
}

class _CreateAdminForm extends ConsumerStatefulWidget {
  const _CreateAdminForm();

  @override
  ConsumerState<_CreateAdminForm> createState() => _CreateAdminFormState();
}

class _CreateAdminFormState extends ConsumerState<_CreateAdminForm> {
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  List<String> _permissions = ['users', 'stats'];
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    String? problem;
    if (_name.text.trim().isEmpty) {
      problem = t('Vui lòng nhập tên hiển thị.');
    } else if (!RegExp(r'^[A-Za-z0-9._]{3,30}$').hasMatch(_username.text.trim())) {
      problem = t('Tên người dùng dài 3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới.');
    } else if (!looksLikeEmail(_email.text)) {
      problem = t('Email không hợp lệ.');
    } else if (!passwordMeetsRules(_password.text)) {
      problem = t('Mật khẩu chưa đạt đủ yêu cầu.');
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final user = await AdminService.createAdmin(
        displayName: _name.text.trim(),
        username: _username.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
        permissions: _permissions,
      );
      ref
          .read(adminNoticeProvider.notifier)
          .show(Notice(t('Đã tạo Admin {displayName} (@{username}). Hãy gửi email và mật khẩu cho họ qua kênh an toàn.', {'displayName': user.displayName, 'username': user.username})));
      ref.read(adminVersionProvider.notifier).bump();
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(controller: _name, label: t('Tên hiển thị'), maxLength: 60),
        const SizedBox(height: 12),
        AppTextField(controller: _username, label: t('Tên người dùng'), maxLength: 30, autocorrect: false),
        const SizedBox(height: 12),
        AppTextField(controller: _email, label: 'Email', keyboardType: TextInputType.emailAddress, autocorrect: false),
        const SizedBox(height: 12),
        PasswordField(controller: _password, label: t('Mật khẩu ban đầu'), autofillHints: const [AutofillHints.newPassword], onChanged: (_) => setState(() {})),
        const SizedBox(height: 8),
        PasswordChecklist(password: _password.text),
        const SizedBox(height: 14),
        PermissionChecklist(value: _permissions, onChanged: (v) => setState(() => _permissions = v)),
        if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: AppButton(label: t('Huỷ'), variant: ButtonVariant.outline, onPressed: _pending ? null : () => Navigator.of(context).pop()),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AppButton(label: t('Tạo Admin'), loading: _pending, onPressed: _submit),
            ),
          ],
        ),
      ],
    );
  }
}

/* -------------------------------------------------------------- Nội dung */

/// The modules the Nội dung screen serves.
bool contentAllowed(User user) => ['reports', 'content'].any((m) => hasModule(user, m));

/// Hàng chờ báo cáo [reports], Đang bị ẩn and Đang phát [content]; tabs when more than one is granted.
class ContentPanel extends StatefulWidget {
  const ContentPanel({super.key, required this.actor});

  final User actor;

  @override
  State<ContentPanel> createState() => _ContentPanelState();
}

class _ContentPanelState extends State<ContentPanel> {
  String _tab = 'reports';

  @override
  Widget build(BuildContext context) {
    // Reports need [reports]; unhiding and stopping a stream need [content].
    final tabs = [
      if (hasModule(widget.actor, 'reports')) (value: 'reports', label: t('Hàng chờ báo cáo'), count: null),
      if (hasModule(widget.actor, 'content')) ...[
        (value: 'hidden', label: t('Đang bị ẩn'), count: null),
        (value: 'live', label: t('Đang phát'), count: null),
      ],
    ];
    final current = tabs.any((tab) => tab.value == _tab) ? _tab : tabs.first.value;
    final panel = switch (current) {
      'hidden' => const HiddenContentPanel(),
      'live' => const LiveStreamsPanel(),
      _ => ReportsPanel(actor: widget.actor),
    };
    if (tabs.length == 1) return panel;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentTabs<String>(items: tabs, value: current, onChanged: (v) => setState(() => _tab = v)),
        const SizedBox(height: 16),
        panel,
      ],
    );
  }
}

/* ---------------------------------------------------------------- Nhật ký */

Map<String, String> get _actionLabels => {
  'user.lock': t('Khoá tài khoản'),
  'user.unlock': t('Mở khoá tài khoản'),
  'user.reset_password': t('Đặt lại mật khẩu'),
  'user.delete': t('Xoá tài khoản'),
  'user.role': t('Đổi vai trò'),
  'admin.create': t('Tạo Admin'),
  'admin.permissions': t('Phân quyền Admin'),
  'report.dismiss': t('Bỏ qua báo cáo#log'),
  'report.hide': t('Ẩn nội dung#log'),
  'report.remove': t('Gỡ nội dung#log'),
  'report.lock': t('Khoá chủ nội dung#log'),
  'content.unhide': t('Bỏ ẩn nội dung#log'),
  'livestream.end': t('Dừng livestream#log'),
  'catalog.destination.create': t('Thêm điểm đến#log'),
  'catalog.destination.update': t('Sửa điểm đến#log'),
  'catalog.destination.delete': t('Xoá điểm đến#log'),
  'catalog.place.create': t('Thêm địa điểm#log'),
  'catalog.place.update': t('Sửa địa điểm#log'),
  'catalog.place.delete': t('Xoá địa điểm#log'),
  'catalog.checklist.create': t('Thêm mục chuẩn bị#log'),
  'catalog.checklist.update': t('Sửa mục chuẩn bị#log'),
  'catalog.checklist.delete': t('Xoá mục chuẩn bị#log'),
  'settings.update': t('Đổi cấu hình hệ thống'),
  'system.reset_users': t('Reset toàn bộ tài khoản'),
  'system.seed_superadmin': t('Tạo Super Admin (script)'),
};

String _modules(Object? list) {
  final items = list is List ? list.map((e) => e.toString()).toList() : const <String>[];
  return items.isEmpty ? t('không có quyền nào') : items.map((m) => moduleLabels[m]?.$1 ?? m).join(', ');
}

String _role(Object? role) => roleLabels[role?.toString()] ?? '${role ?? ''}';

/// One readable line describing what changed.
String _describe(AuditEntry entry) {
  final d = entry.details;
  Map<String, dynamic> m(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};
  switch (entry.action) {
    case 'user.lock':
      final reason = (d['reason'] ?? '').toString().isNotEmpty ? t('Lý do: {value}', {'value': d['reason']}) : t('Không ghi lý do');
      return d['via'] == 'report' ? '$reason · ${t('qua báo cáo vi phạm')}' : reason;
    case 'report.dismiss' || 'report.hide' || 'report.remove' || 'report.lock':
      final count = t('{n} báo cáo#log', {'n': d['reports'] is num ? d['reports'] : 0});
      final note = (d['note'] ?? '').toString();
      return note.isNotEmpty ? '$count · ${t('Ghi chú: {note}', {'note': note})}' : count;
    case 'livestream.end':
      return (d['reason'] ?? '').toString().isNotEmpty ? t('Lý do: {value}', {'value': d['reason']}) : t('Không ghi lý do');
    case 'content.unhide':
      return d['previousAction'] == 'remove' ? t('Khôi phục nội dung đã gỡ') : t('Hiện lại nội dung đã ẩn');
    case 'user.delete':
      return '${d['email'] ?? ''} · ${_role(d['role'])}';
    case 'user.role':
      return '${_role(m(d['before'])['role'])} → ${_role(m(d['after'])['role'])}';
    case 'admin.create':
      return t('Quyền: {value}', {'value': _modules(d['permissions'])});
    case 'admin.permissions':
      return '${_modules(d['before'])} → ${_modules(d['after'])}';
    case 'settings.update':
      final before = m(d['before']);
      final after = m(d['after']);
      final changes = <String>[];
      if (before['registrationOpen'] != after['registrationOpen']) changes.add(after['registrationOpen'] == true ? t('Mở đăng ký') : t('Đóng đăng ký'));
      if (before['announcement'] != after['announcement']) {
        final text = (after['announcement'] ?? '').toString();
        changes.add(text.isNotEmpty ? t('Thông báo: “{text}”', {'text': text}) : t('Gỡ thông báo'));
      }
      return changes.isEmpty ? t('Không đổi gì') : changes.join(' · ');
    case 'system.reset_users':
      return t('Đã xoá {value} tài khoản', {'value': d['deletedUsers'] ?? 0});
    case 'system.seed_superadmin':
      return d['created'] == true ? t('Tạo mới') : t('Khôi phục quyền Super Admin cho tài khoản có sẵn');
    default:
      return '';
  }
}

/// Nhật ký hoạt động: superadmin only.
class AuditPanel extends ConsumerStatefulWidget {
  const AuditPanel({super.key});

  @override
  ConsumerState<AuditPanel> createState() => _AuditPanelState();
}

class _AuditPanelState extends ConsumerState<AuditPanel> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _q = '';
  String _action = 'all';
  int _page = 1;
  AdminPage<AuditEntry>? _data;
  Object? _error;
  bool _loading = true;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final page = await AdminService.listAuditLogs(q: _q.isEmpty ? null : _q, action: _action == 'all' ? null : _action, page: _page);
      if (!mounted || request != _request) return;
      setState(() {
        _data = page;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(adminVersionProvider, (_, _) => _load());
    final data = _data;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t('Mọi thao tác của Admin và Super Admin đều được ghi lại ở đây. Nhật ký không sửa hay xoá được từ giao diện.'), style: AppText.meta),
        const SizedBox(height: 12),
        AppTextField(
          controller: _search,
          icon: LucideIcons.search,
          hint: t('Tìm trong nhật ký'),
          onChanged: (text) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 300), () {
              _q = text.trim();
              _page = 1;
              _load();
            });
          },
        ),
        const SizedBox(height: 10),
        SelectField<String>(
          value: _action,
          options: [SelectOption('all', t('Mọi hành động')), for (final e in _actionLabels.entries) SelectOption(e.key, e.value)],
          onChanged: (v) {
            setState(() {
              _action = v;
              _page = 1;
            });
            _load();
          },
        ),
        const SizedBox(height: 14),
        if (_loading && data == null)
          LoadingView(message: t('Đang tải nhật ký…'))
        else if (_error != null && data == null)
          ErrorPanel(error: _error, onRetry: _load)
        else if (data == null || data.items.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.borderStrong),
            ),
            child: Text(t('Chưa có hoạt động nào khớp bộ lọc.'), style: AppText.meta, textAlign: TextAlign.center),
          )
        else ...[
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          for (final entry in data.items) ...[
            AppCard(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(_actionLabels[entry.action] ?? entry.action, style: AppText.label)),
                      Text(formatDateTime(entry.createdAt), style: AppText.meta.copyWith(fontSize: 11)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${entry.actorName} · ${entry.actorRole == 'system' ? t('Hệ thống') : _role(entry.actorRole)}${entry.ip.isNotEmpty ? ' · ${entry.ip}' : ''}',
                    style: AppText.meta.copyWith(fontSize: 12),
                  ),
                  Text(t('Đối tượng: {value}', {'value': entry.targetLabel.isEmpty ? '—' : entry.targetLabel}), style: AppText.bodySmall),
                  if (_describe(entry).isNotEmpty) Text(_describe(entry), style: AppText.meta.copyWith(fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              Text(t('{total} mục', {'total': data.total}), style: AppText.meta.copyWith(fontSize: 12)),
              const Spacer(),
              Pagination(
                page: data.page,
                pageCount: data.pageCount,
                onPage: (p) {
                  setState(() => _page = p);
                  _load();
                },
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/* --------------------------------------------------------------- Cấu hình */

const _announcementMax = 280;

/// Cấu hình hệ thống: superadmin only. Both settings take effect immediately.
class SettingsPanel extends ConsumerWidget {
  const SettingsPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(adminSettingsProvider);
    if (current.isLoading && !current.hasValue) return LoadingView(message: t('Đang tải cấu hình…'));
    if (current.hasError && !current.hasValue) return ErrorPanel(error: current.error, onRetry: () => ref.invalidate(adminSettingsProvider));
    final saved = current.value!;
    // Re-mount the form whenever the saved values change, so it starts from them.
    return _SettingsForm(key: ValueKey('${saved.registrationOpen}|${saved.announcement}'), saved: saved);
  }
}

class _SettingsForm extends ConsumerStatefulWidget {
  const _SettingsForm({super.key, required this.saved});

  final AppSettings saved;

  @override
  ConsumerState<_SettingsForm> createState() => _SettingsFormState();
}

class _SettingsFormState extends ConsumerState<_SettingsForm> {
  late bool _open = widget.saved.registrationOpen;
  late final _announcement = TextEditingController(text: widget.saved.announcement);
  bool _saving = false;

  @override
  void dispose() {
    _announcement.dispose();
    super.dispose();
  }

  bool get _dirty => _open != widget.saved.registrationOpen || _announcement.text.trim() != widget.saved.announcement;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await AdminService.saveSettings(AppSettings(registrationOpen: _open, announcement: _announcement.text.trim()));
      ref.read(adminNoticeProvider.notifier).show(Notice(t('Đã lưu cấu hình hệ thống.')));
      ref.invalidate(adminSettingsProvider);
      ref.invalidate(publicSettingsProvider);
      ref.read(adminVersionProvider.notifier).bump();
    } catch (error) {
      ref.read(adminNoticeProvider.notifier).show(Notice(errorMessage(error), error: true));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CheckboxRow(
          checked: _open,
          onChanged: (v) => setState(() => _open = v),
          title: t('Cho phép đăng ký tài khoản mới'),
          description: t('Khi tắt, trang đăng ký báo tạm ngừng, và đăng nhập Google lần đầu không tạo được tài khoản mới. Người đã có tài khoản vẫn đăng nhập bình thường.'),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(t('Thông báo toàn trang'), style: AppText.label),
              const SizedBox(height: 4),
              Text(t('Hiện thành một dải thông báo trên mọi trang, ví dụ lịch bảo trì. Để trống để tắt.'), style: AppText.meta),
              const SizedBox(height: 10),
              AppTextField(
                controller: _announcement,
                maxLines: 4,
                minLines: 3,
                maxLength: _announcementMax,
                showCounter: true,
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            AppButton(label: t('Lưu cấu hình'), loading: _saving, onPressed: _dirty ? _save : null),
            if (_dirty) ...[
              const SizedBox(width: 10),
              AppButton(
                label: t('Huỷ thay đổi'),
                variant: ButtonVariant.ghost,
                onPressed: _saving
                    ? null
                    : () => setState(() {
                        _open = widget.saved.registrationOpen;
                        _announcement.text = widget.saved.announcement;
                      }),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
