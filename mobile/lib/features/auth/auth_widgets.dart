import 'dart:async';
import 'dart:io';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/env.dart';
import '../../core/password.dart';
import '../../core/roles.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/auth_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';

/// After signing in: staff go to the admin console; everyone else back to
/// where they were, then on to [next] when it is somewhere else.
Future<void> completeSignIn(BuildContext context, WidgetRef ref, AuthSession session, String? next) async {
  await ref.read(sessionProvider.notifier).signIn(session);
  ref.invalidate(followingIdsProvider);
  ref.invalidate(notificationsProvider);
  if (!context.mounted) return;
  if (isStaff(session.user)) {
    context.go('/admin');
    return;
  }
  final target = next != null && next.startsWith('/') && !next.startsWith('/login') && !next.startsWith('/register') ? next : null;
  final router = GoRouter.of(context);
  if (router.canPop()) {
    router.pop();
    if (target != null) {
      // Wait for the pop to settle before going on.
      await Future<void>.delayed(const Duration(milliseconds: 50));
      if (router.state.uri.toString() != target) router.push(target);
    }
  } else {
    router.go(target ?? '/feed');
  }
}

/* ------------------------------------------------------------------ Google */

bool _googleReady = false;

bool get googleSignInAvailable => Env.googleWebClientId != null && (Platform.isAndroid || (Platform.isIOS && Env.googleIosClientId != null));

Future<void> _initGoogle() async {
  if (_googleReady) return;
  await GoogleSignIn.instance.initialize(
    // The ID token is issued for the WEB client, which the server verifies against.
    serverClientId: Env.googleWebClientId,
    clientId: Platform.isIOS ? Env.googleIosClientId : null,
  );
  _googleReady = true;
}

/// Signs out of Google too, so the next sign-in can pick another account.
Future<void> signOutOfGoogle() async {
  if (!_googleReady) return;
  try {
    await GoogleSignIn.instance.signOut();
  } catch (_) {}
}

/// "Tiếp tục với Google" (web: GoogleSignInButton). Hidden when no client id is configured.
class GoogleSignInButton extends StatefulWidget {
  const GoogleSignInButton({super.key, this.signUp = false, required this.onSignedIn});

  final bool signUp;
  final Future<void> Function(AuthSession session) onSignedIn;

  @override
  State<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends State<GoogleSignInButton> {
  bool _pending = false;
  String? _error;

  Future<void> _signIn() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await _initGoogle();
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) throw Exception('Google không trả về thông tin đăng nhập. Vui lòng thử lại.');
      final session = await AuthService.loginWithGoogle(idToken);
      await widget.onSignedIn(session);
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled || e.code == GoogleSignInExceptionCode.interrupted) return;
      if (mounted) {
        setState(
          () => _error = e.code == GoogleSignInExceptionCode.clientConfigurationError || e.code == GoogleSignInExceptionCode.providerConfigurationError
              ? 'Đăng nhập Google chưa được cấu hình cho ứng dụng này (OAuth client Android và SHA-1). Xem README của ứng dụng.'
              : 'Không đăng nhập được bằng Google. Vui lòng thử lại.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e, 'Không đăng nhập được bằng Google. Vui lòng thử lại.'));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!googleSignInAvailable) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(child: Divider(color: AppColors.borderStrong)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text('hoặc', style: AppText.meta),
            ),
            const Expanded(child: Divider(color: AppColors.borderStrong)),
          ],
        ),
        const SizedBox(height: 12),
        AppButton(
          label: widget.signUp ? 'Đăng ký với Google' : 'Tiếp tục với Google',
          icon: LucideIcons.logIn,
          variant: ButtonVariant.secondary,
          size: ButtonSize.lg,
          fullWidth: true,
          loading: _pending,
          onPressed: _signIn,
        ),
        if (_error != null) ...[const SizedBox(height: 8), ErrorText(_error)],
      ],
    );
  }
}

/* -------------------------------------------------- email verification */

/// Matches RESEND_COOLDOWN_MS on the server.
const _cooldownSeconds = 60;

/// "Gửi lại email xác nhận", with a 60-second wait between sends (web: ResendVerificationButton).
class ResendVerificationButton extends StatefulWidget {
  const ResendVerificationButton({super.key, required this.email, this.justSent = false});

  final String email;
  final bool justSent;

  @override
  State<ResendVerificationButton> createState() => _ResendVerificationButtonState();
}

class _ResendVerificationButtonState extends State<ResendVerificationButton> {
  late int _secondsLeft = widget.justSent ? _cooldownSeconds : 0;
  Timer? _timer;
  bool _pending = false;
  String? _message;
  ApiError? _error;

  @override
  void initState() {
    super.initState();
    if (_secondsLeft > 0) _tick();
  }

  void _tick() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) timer.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _pending = true;
      _error = null;
      _message = null;
    });
    try {
      final message = await AuthService.resendVerification(widget.email);
      setState(() {
        _message = message;
        _secondsLeft = _cooldownSeconds;
      });
      _tick();
    } on ApiError catch (error) {
      setState(() => _error = error);
    } catch (error) {
      setState(() => _error = ApiError(errorMessage(error), status: 0));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final waiting = _secondsLeft > 0;
    final alreadyVerified = _error?.code == 'ALREADY_VERIFIED';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppButton(
          label: waiting ? 'Gửi lại email sau $_secondsLeft giây' : 'Gửi lại email xác nhận',
          icon: LucideIcons.mail,
          variant: ButtonVariant.secondary,
          fullWidth: true,
          loading: _pending,
          onPressed: waiting || widget.email.trim().isEmpty ? null : _send,
        ),
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text('$_message Hãy mở email mới nhất, liên kết cũ không còn dùng được.', style: AppText.meta, textAlign: TextAlign.center),
        ],
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              style: AppText.bodySmall.copyWith(color: alreadyVerified ? AppColors.cream : AppColors.destructive),
              children: [
                TextSpan(text: _error!.message),
                if (alreadyVerified)
                  TextSpan(
                    text: ' Đăng nhập',
                    style: const TextStyle(fontWeight: FontWeight.w700, decoration: TextDecoration.underline),
                    recognizer: TapGestureRecognizer()..onTap = () => context.pushReplacement('/login'),
                  ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}

/// The password rules, ticked off live as the user types (web: PasswordChecklist).
class PasswordChecklist extends StatelessWidget {
  const PasswordChecklist({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final rule in passwordRules)
          Semantics(
            label: '${rule.label}: ${rule.test(password) ? 'đạt' : 'chưa đạt'}',
            excludeSemantics: true,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  rule.test(password)
                      ? const Icon(LucideIcons.check, size: 14, color: AppColors.teal)
                      : const Icon(LucideIcons.circle, size: 12, color: AppColors.meta),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(rule.label, style: AppText.meta.copyWith(color: rule.test(password) ? AppColors.teal : AppColors.meta)),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// "Chưa có tài khoản? Đăng ký" style footer link.
class AuthSwitchLink extends StatelessWidget {
  const AuthSwitchLink({super.key, required this.question, required this.action, required this.onTap});

  final String question;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        style: AppText.meta,
        children: [
          TextSpan(text: '$question '),
          TextSpan(
            text: action,
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.cream),
            recognizer: TapGestureRecognizer()..onTap = onTap,
          ),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }
}
