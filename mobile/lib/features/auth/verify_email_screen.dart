import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/auth_service.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';
import 'auth_widgets.dart';
import '../../ui/navigation.dart';

/// The token inside a pasted confirmation link ("…/verify-email?token=…"), or the text itself when it is a bare token.
String? tokenFrom(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return null;
  final match = RegExp(r'[?&]token=([^&#\s]+)').firstMatch(trimmed);
  if (match != null) {
    try {
      return Uri.decodeComponent(match.group(1)!);
    } catch (_) {
      return match.group(1);
    }
  }
  return RegExp(r'^[A-Za-z0-9_-]{16,200}$').hasMatch(trimmed) ? trimmed : null;
}

/// Xác nhận email (web: VerifyEmailPage). Opened from a link
/// (chillngo://app/verify-email?token=…) or by pasting the email's link here.
class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, this.token});

  final String? token;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final _link = TextEditingController();
  final _resendEmail = TextEditingController();
  String? _requested;
  bool _verifying = false;
  String? _welcome;
  String? _failure;
  String? _linkError;

  @override
  void initState() {
    super.initState();
    final token = widget.token;
    if (token != null && token.isNotEmpty) WidgetsBinding.instance.addPostFrameCallback((_) => _verify(token));
  }

  @override
  void dispose() {
    _link.dispose();
    _resendEmail.dispose();
    super.dispose();
  }

  Future<void> _verify(String token) async {
    // The token is single-use: never send the same one twice.
    if (_requested == token) return;
    _requested = token;
    setState(() {
      _verifying = true;
      _failure = null;
    });
    try {
      final session = await AuthService.verifyEmail(token);
      await ref.read(sessionProvider.notifier).signIn(session);
      if (mounted) setState(() => _welcome = session.user.displayName);
    } catch (error) {
      if (mounted) setState(() => _failure = errorMessage(error, 'Không thể xác nhận email.'));
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final welcome = _welcome;
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Xác nhận email')),
      body: _verifying
          ? const LoadingView(message: 'Đang kiểm tra liên kết xác nhận…')
          : ListView(
              padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 40),
              children: welcome != null
                  ? [
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(LucideIcons.circleCheck, size: 28, color: AppColors.teal),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Đã xác nhận', style: AppText.h2),
                                      const SizedBox(height: 4),
                                      Text('Chào mừng $welcome đến với ChillnGo! Bạn đã được đăng nhập.', style: AppText.bodySmall),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            AppButton(label: 'Vào ChillnGo ngay', fullWidth: true, onPressed: () => context.go('/')),
                          ],
                        ),
                      ),
                    ]
                  : [
                      if (_failure != null) ...[
                        AppCard(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(LucideIcons.circleX, size: 26, color: AppColors.destructive),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Chưa xác nhận được', style: AppText.label),
                                    const SizedBox(height: 4),
                                    Text(_failure!, style: AppText.bodySmall),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text('Dán liên kết xác nhận', style: AppText.h2),
                            const SizedBox(height: 8),
                            Text(
                              'Trong email “Xác nhận email đăng ký tài khoản ChillnGo”, giữ lâu nút Xác nhận email để sao chép liên kết, rồi dán vào đây.',
                              style: AppText.meta,
                            ),
                            const SizedBox(height: 12),
                            AppTextField(
                              controller: _link,
                              hint: 'https://…/verify-email?token=…',
                              autocorrect: false,
                              keyboardType: TextInputType.url,
                              onChanged: (_) => setState(() => _linkError = null),
                            ),
                            if (_linkError != null) ...[const SizedBox(height: 6), ErrorText(_linkError)],
                            const SizedBox(height: 12),
                            AppButton(
                              label: 'Xác nhận email',
                              fullWidth: true,
                              onPressed: _link.text.trim().isEmpty
                                  ? null
                                  : () {
                                      final token = tokenFrom(_link.text);
                                      if (token == null) {
                                        setState(() => _linkError = 'Không tìm thấy mã xác nhận trong liên kết này.');
                                        return;
                                      }
                                      _requested = null;
                                      _verify(token);
                                    },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text('Cần liên kết mới?', style: AppText.h3),
                            const SizedBox(height: 12),
                            AppTextField(
                              controller: _resendEmail,
                              label: 'Email đã dùng để đăng ký',
                              keyboardType: TextInputType.emailAddress,
                              autocorrect: false,
                              onChanged: (_) => setState(() {}),
                            ),
                            const SizedBox(height: 12),
                            ResendVerificationButton(email: _resendEmail.text),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      AuthSwitchLink(question: 'Email đã được xác nhận trước đó?', action: 'Đăng nhập', onTap: () => context.pushReplacement('/login')),
                    ],
            ),
    );
  }
}
