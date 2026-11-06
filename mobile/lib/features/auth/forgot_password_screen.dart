import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/password.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/auth_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/navigation.dart';
import '../../ui/surfaces.dart';
import 'auth_widgets.dart';
import '../../core/i18n.dart';

/// Matches RESET_COOLDOWN_MS on the server.
const _cooldownSeconds = 60;

/// Quên mật khẩu (web: ForgotPasswordPage). The answer is the same whether or
/// not the email has an account, so this screen never says which it was.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.email});

  /// Whatever was already typed on the login screen.
  final String? email;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final _email = TextEditingController(text: widget.email);
  bool _pending = false;
  bool _sent = false;
  int _secondsLeft = 0;
  String? _error;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_pending || _secondsLeft > 0) return;
    if (!looksLikeEmail(_email.text)) {
      setState(() => _error = t('Email không hợp lệ.'));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await AuthService.forgotPassword(_email.text);
      if (!mounted) return;
      setState(() {
        _sent = true;
        _secondsLeft = _cooldownSeconds;
      });
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) return timer.cancel();
        setState(() => _secondsLeft--);
        if (_secondsLeft <= 0) timer.cancel();
      });
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
      body: ListView(
        padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 40),
        children: _sent ? _sentView(context) : _formView(context),
      ),
    );
  }

  List<Widget> _formView(BuildContext context) {
    return [
      Text(t('Quên mật khẩu'), style: AppText.h1),
      const SizedBox(height: 8),
      Text(t('Nhập email của tài khoản, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.'), style: AppText.meta),
      const SizedBox(height: 20),
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(
              controller: _email,
              label: 'Email',
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.go,
              autocorrect: false,
              onChanged: (_) => setState(() => _error = null),
              onSubmitted: (_) => _send(),
            ),
            if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error)],
            const SizedBox(height: 16),
            AppButton(
              label: t('Gửi liên kết đặt lại'),
              size: ButtonSize.lg,
              fullWidth: true,
              loading: _pending,
              onPressed: _email.text.trim().isEmpty ? null : _send,
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      AuthSwitchLink(question: t('Đã nhớ ra mật khẩu?'), action: t('Đăng nhập'), onTap: () => context.canPop() ? context.pop() : context.go('/login')),
    ];
  }

  List<Widget> _sentView(BuildContext context) {
    final waiting = _secondsLeft > 0;
    return [
      Text(t('Kiểm tra email'), style: AppText.h1),
      const SizedBox(height: 20),
      AppCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(LucideIcons.mailCheck, size: 26, color: AppColors.teal),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t('Nếu địa chỉ này có tài khoản ChillnGo, chúng tôi đã gửi liên kết đặt lại mật khẩu tới'), style: AppText.bodySmall),
                  Text(_email.text.trim(), style: AppText.label),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      Text(t('1. Mở email có tiêu đề “Đặt lại mật khẩu tài khoản ChillnGo”.'), style: AppText.bodySmall),
      const SizedBox(height: 6),
      Text(t('2. Bấm nút Đặt lại mật khẩu để đổi ngay trên trình duyệt, hoặc giữ lâu nút đó để sao chép liên kết rồi dán vào ứng dụng.'), style: AppText.bodySmall),
      const SizedBox(height: 8),
      Text(t('Không thấy email? Hãy xem thư mục Spam hoặc Quảng cáo. Liên kết có hiệu lực trong 60 phút và chỉ dùng được một lần.'), style: AppText.meta),
      if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error)],
      const SizedBox(height: 14),
      AppButton(
        label: t('Dán liên kết đặt lại'),
        fullWidth: true,
        onPressed: () => context.push('/reset-password'),
      ),
      const SizedBox(height: 10),
      AppButton(
        label: waiting ? t('Gửi lại email sau {_secondsLeft} giây', {'_secondsLeft': _secondsLeft}) : t('Gửi lại email'),
        icon: LucideIcons.mail,
        variant: ButtonVariant.secondary,
        fullWidth: true,
        loading: _pending,
        onPressed: waiting ? null : _send,
      ),
    ];
  }
}
