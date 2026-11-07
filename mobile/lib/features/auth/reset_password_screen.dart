import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/password.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/auth_service.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/navigation.dart';
import '../../ui/surfaces.dart';
import 'auth_widgets.dart';
import 'verify_email_screen.dart' show tokenFrom;
import '../../core/i18n.dart';

/// Đặt mật khẩu mới (web: ResetPasswordPage). Opened from a link
/// (chillngo://app/reset-password?token=…) or by pasting the email's link here.
class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, this.token});

  final String? token;

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _link = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _pending = false;
  bool _done = false;
  String? _linkFailure;
  String? _error;

  bool get _hasToken => widget.token?.isNotEmpty ?? false;

  @override
  void dispose() {
    _link.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_pending) return;
    final token = _hasToken ? widget.token : tokenFrom(_link.text);
    final String? problem;
    if (token == null) {
      problem = t('Không tìm thấy mã đặt lại trong liên kết này.');
    } else if (!passwordMeetsRules(_password.text)) {
      problem = t('Mật khẩu chưa đạt đủ các yêu cầu bên dưới ô mật khẩu.');
    } else if (_password.text != _confirm.text) {
      problem = t('Mật khẩu xác nhận không khớp.');
    } else {
      problem = null;
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await AuthService.resetPassword(token!, _password.text);
      // The server has just ended every session of the account.
      if (ref.read(sessionProvider).signedIn) await ref.read(sessionProvider.notifier).signOut();
      if (mounted) setState(() => _done = true);
    } on ApiError catch (error) {
      if (mounted) {
        setState(() {
          if (error.code == 'INVALID_RESET_TOKEN') {
            _linkFailure = error.message;
          } else {
            _error = error.message;
          }
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome()),
      body: AutofillGroup(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 40),
          children: _done
              ? _doneView(context)
              : _linkFailure != null
              ? _failedView(context)
              : _formView(),
        ),
      ),
    );
  }

  List<Widget> _doneView(BuildContext context) {
    return [
      AppCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(t('Đã đổi mật khẩu'), style: AppText.hero),
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(LucideIcons.circleCheck, size: 26, color: AppColors.teal),
                const SizedBox(width: 12),
                Expanded(child: Text(t('Mật khẩu mới đã có hiệu lực. Mọi thiết bị đang đăng nhập đã được đăng xuất.'), style: AppText.bodySmall)),
              ],
            ),
            const SizedBox(height: 14),
            AppButton(label: t('Đăng nhập'), fullWidth: true, onPressed: () => context.go('/login')),
          ],
        ),
      ),
    ];
  }

  List<Widget> _failedView(BuildContext context) {
    return [
      AppCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(t('Liên kết không dùng được'), style: AppText.hero),
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(LucideIcons.circleX, size: 26, color: AppColors.destructive),
                const SizedBox(width: 12),
                Expanded(child: Text(_linkFailure!, style: AppText.bodySmall)),
              ],
            ),
            const SizedBox(height: 14),
            AppButton(label: t('Nhận liên kết mới'), fullWidth: true, onPressed: () => context.pushReplacement('/forgot-password')),
          ],
        ),
      ),
    ];
  }

  List<Widget> _formView() {
    final mismatch = _confirm.text.isNotEmpty && _confirm.text != _password.text;
    final canSubmit = _password.text.isNotEmpty && _confirm.text.isNotEmpty && (_hasToken || _link.text.trim().isNotEmpty);
    return [
      AppCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(t('Đặt mật khẩu mới'), style: AppText.hero),
            const SizedBox(height: 10),
            Text(t('Chọn mật khẩu mới cho tài khoản ChillnGo của bạn.'), style: AppText.meta),
            const SizedBox(height: 24),
            if (!_hasToken) ...[
              AppTextField(
                controller: _link,
                label: t('Liên kết trong email'),
                hint: 'https://…/reset-password?token=…',
                autocorrect: false,
                keyboardType: TextInputType.url,
                textInputAction: TextInputAction.next,
                onChanged: (_) => setState(() => _error = null),
              ),
              const SizedBox(height: 16),
            ],
            PasswordField(
              controller: _password,
              label: t('Mật khẩu mới'),
              autofillHints: const [AutofillHints.newPassword],
              textInputAction: TextInputAction.next,
              onChanged: (_) => setState(() => _error = null),
            ),
            const SizedBox(height: 8),
            PasswordChecklist(password: _password.text),
            const SizedBox(height: 12),
            PasswordField(
              controller: _confirm,
              label: t('Xác nhận mật khẩu'),
              autofillHints: const [AutofillHints.newPassword],
              textInputAction: TextInputAction.go,
              error: mismatch ? t('Mật khẩu xác nhận không khớp.') : null,
              onChanged: (_) => setState(() => _error = null),
              onSubmitted: (_) => _submit(),
            ),
            if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error)],
            const SizedBox(height: 16),
            BeamButton(label: t('Đặt mật khẩu mới'), large: true, loading: _pending, onPressed: canSubmit ? _submit : null),
          ],
        ),
      ),
    ];
  }
}
