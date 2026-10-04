import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/auth_service.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';
import '../menu/server_settings.dart';
import 'auth_widgets.dart';
import '../../ui/navigation.dart';

/// Đăng nhập (web: LoginPage).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next});

  final String? next;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _pending = false;
  ApiError? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _canSubmit => _email.text.trim().isNotEmpty && _password.text.isNotEmpty;

  Future<void> _submit() async {
    if (!_canSubmit || _pending) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final session = await AuthService.login(_email.text, _password.text);
      if (mounted) await completeSignIn(context, ref, session, widget.next);
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final needsVerification = _error?.code == 'EMAIL_NOT_VERIFIED';
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome()),
      body: AutofillGroup(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 40),
          children: [
            Text('Chào mừng trở lại', style: AppText.h1),
            const SizedBox(height: 8),
            Text('Đăng nhập để theo dõi hành trình của những người bạn đi cùng, và tiếp tục những lịch trình bạn đã lưu.', style: AppText.meta),
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
                    textInputAction: TextInputAction.next,
                    autocorrect: false,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 16),
                  PasswordField(controller: _password, textInputAction: TextInputAction.go, onChanged: (_) => setState(() {}), onSubmitted: (_) => _submit()),
                  if (_error != null && !needsVerification) ...[const SizedBox(height: 12), ErrorText(_error!.message)],
                  if (needsVerification) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.well, borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Email chưa được xác nhận', style: AppText.label),
                          const SizedBox(height: 6),
                          Text.rich(
                            TextSpan(
                              style: AppText.bodySmall,
                              children: [
                                const TextSpan(text: 'Hãy mở email xác nhận chúng tôi đã gửi tới '),
                                TextSpan(
                                  text: _email.text.trim(),
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                const TextSpan(text: ' và bấm nút Xác nhận email. Không thấy email? Gửi lại một email mới:'),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          ResendVerificationButton(email: _email.text),
                          const SizedBox(height: 4),
                          AppButton(
                            label: 'Tôi đã có liên kết xác nhận',
                            variant: ButtonVariant.ghost,
                            size: ButtonSize.sm,
                            onPressed: () => context.push('/verify-email'),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  AppButton(label: 'Đăng nhập', size: ButtonSize.lg, fullWidth: true, loading: _pending, onPressed: _canSubmit ? _submit : null),
                  const SizedBox(height: 16),
                  GoogleSignInButton(onSignedIn: (session) => completeSignIn(context, ref, session, widget.next)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            AuthSwitchLink(
              question: 'Chưa có tài khoản?',
              action: 'Đăng ký',
              onTap: () => context.pushReplacement(widget.next == null ? '/register' : '/register?next=${Uri.encodeComponent(widget.next!)}'),
            ),
            const SizedBox(height: 24),
            const ServerAddressLink(),
          ],
        ),
      ),
    );
  }
}
