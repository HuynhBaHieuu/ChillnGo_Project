import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/password.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/auth_service.dart';
import '../../state/providers.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';
import 'auth_widgets.dart';
import '../../ui/navigation.dart';

/// Đăng ký (web: RegisterPage).
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.next});

  final String? next;

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _displayName = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _pending = false;
  String? _error;
  ({String email, bool emailSent})? _done;

  @override
  void dispose() {
    _displayName.dispose();
    _username.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    String? problem;
    if (_displayName.text.trim().isEmpty) {
      problem = 'Vui lòng nhập tên hiển thị.';
    } else if (usernameProblem(_username.text) case final p?) {
      problem = p;
    } else if (!looksLikeEmail(_email.text)) {
      problem = 'Email không hợp lệ.';
    } else if (!passwordMeetsRules(_password.text)) {
      problem = 'Mật khẩu chưa đạt đủ các yêu cầu bên dưới ô mật khẩu.';
    } else if (_password.text != _confirm.text) {
      problem = 'Mật khẩu xác nhận không khớp.';
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _pending = true;
    });
    try {
      final result = await AuthService.register(displayName: _displayName.text, username: _username.text, email: _email.text, password: _password.text);
      if (mounted) setState(() => _done = result);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = _done;
    final settings = ref.watch(publicSettingsProvider).value;
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome()),
      body: done != null
          ? _CheckEmail(email: done.email, emailSent: done.emailSent)
          : settings != null && !settings.registrationOpen
          ? ListView(
              padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 40),
              children: [
                Text('Tạm ngừng đăng ký', style: AppText.h1),
                const SizedBox(height: 8),
                Text('ChillnGo đang tạm ngừng nhận tài khoản mới. Vui lòng quay lại sau.', style: AppText.meta),
                const SizedBox(height: 16),
                AppCard(child: Text('Người đã có tài khoản vẫn đăng nhập bình thường, bằng email hoặc Google.', style: AppText.bodySmall)),
                const SizedBox(height: 16),
                AppButton(label: 'Đăng nhập', onPressed: () => context.pushReplacement('/login')),
              ],
            )
          : AutofillGroup(child: _form(context)),
    );
  }

  Widget _form(BuildContext context) {
    final mismatch = _confirm.text.isNotEmpty && _confirm.text != _password.text;
    final handle = _username.text.trim().toLowerCase();
    return ListView(
      padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 40),
      children: [
        Text('Bắt đầu ngay', style: AppText.h1),
        const SizedBox(height: 8),
        Text('Tạo tài khoản để chia sẻ hành trình của bạn, và sao chép những lịch trình bạn thích về làm của mình.', style: AppText.meta),
        const SizedBox(height: 20),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppTextField(
                controller: _displayName,
                label: 'Tên hiển thị',
                maxLength: 60,
                autofillHints: const [AutofillHints.name],
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _username,
                label: 'Tên người dùng',
                maxLength: 30,
                autocorrect: false,
                autofillHints: const [AutofillHints.newUsername],
                textInputAction: TextInputAction.next,
                helper: '3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới. Hiện là @${handle.isEmpty ? '…' : handle}',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _email,
                label: 'Email',
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                helper: 'Chúng tôi sẽ gửi email xác nhận tới địa chỉ này.',
              ),
              const SizedBox(height: 16),
              PasswordField(
                controller: _password,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.next,
                onChanged: (_) => setState(() => _error = null),
              ),
              const SizedBox(height: 8),
              PasswordChecklist(password: _password.text),
              const SizedBox(height: 12),
              PasswordField(
                controller: _confirm,
                label: 'Xác nhận mật khẩu',
                autofillHints: const [AutofillHints.newPassword],
                error: mismatch ? 'Mật khẩu xác nhận không khớp.' : null,
                textInputAction: TextInputAction.done,
                onChanged: (_) => setState(() => _error = null),
                onSubmitted: (_) => _submit(),
              ),
              if (!mismatch && _confirm.text.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text('Mật khẩu đã khớp.', style: AppText.meta.copyWith(color: AppColors.teal, fontSize: 12)),
              ],
              if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error)],
              const SizedBox(height: 16),
              AppButton(label: 'Tạo tài khoản', size: ButtonSize.lg, fullWidth: true, loading: _pending, onPressed: _submit),
              const SizedBox(height: 16),
              GoogleSignInButton(signUp: true, onSignedIn: (session) => completeSignIn(context, ref, session, widget.next)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        AuthSwitchLink(
          question: 'Đã có tài khoản?',
          action: 'Đăng nhập',
          onTap: () => context.pushReplacement(widget.next == null ? '/login' : '/login?next=${Uri.encodeComponent(widget.next!)}'),
        ),
      ],
    );
  }
}

class _CheckEmail extends StatelessWidget {
  const _CheckEmail({required this.email, required this.emailSent});

  final String email;
  final bool emailSent;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 40),
      children: [
        Text('Kiểm tra email', style: AppText.h1),
        const SizedBox(height: 8),
        Text('Tài khoản của bạn đã được tạo. Chỉ còn bước xác nhận email là xong.', style: AppText.meta),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.well, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                      child: Icon(emailSent ? LucideIcons.mailCheck : LucideIcons.mailWarning, size: 20, color: AppColors.onPrimary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: emailSent
                            ? [Text('Chúng tôi đã gửi email xác nhận tới', style: AppText.bodySmall), Text(email, style: AppText.label)]
                            : [
                                Text('Chưa gửi được email xác nhận', style: AppText.label),
                                Text('Tài khoản $email đã được tạo. Bấm nút bên dưới để gửi lại email.', style: AppText.bodySmall),
                              ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text('1. Mở email có tiêu đề “Xác nhận email đăng ký tài khoản ChillnGo”.', style: AppText.bodySmall),
              const SizedBox(height: 6),
              Text('2. Bấm nút Xác nhận email. Nếu liên kết mở bằng trình duyệt, sau khi xác nhận bạn quay lại đây và đăng nhập.', style: AppText.bodySmall),
              const SizedBox(height: 8),
              Text('Không thấy email? Hãy xem thư mục Spam hoặc Quảng cáo. Liên kết có hiệu lực trong 24 giờ.', style: AppText.meta),
              const SizedBox(height: 14),
              ResendVerificationButton(email: email, justSent: emailSent),
              const SizedBox(height: 10),
              AppButton(label: 'Dán liên kết xác nhận', variant: ButtonVariant.outline, fullWidth: true, onPressed: () => context.push('/verify-email')),
              const SizedBox(height: 6),
              AppButton(
                label: 'Đã xác nhận xong? Đăng nhập',
                variant: ButtonVariant.ghost,
                fullWidth: true,
                onPressed: () => context.pushReplacement('/login'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
