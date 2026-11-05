import 'package:chillngo/features/auth/forgot_password_screen.dart';
import 'package:chillngo/features/auth/reset_password_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child) => ProviderScope(child: MaterialApp(home: child));

void main() {
  group('forgot password screen', () {
    testWidgets('starts with the email from the login form', (tester) async {
      await tester.pumpWidget(_app(const ForgotPasswordScreen(email: 'a@b.vn')));
      expect(find.text('a@b.vn'), findsOneWidget);
    });

    testWidgets('refuses a malformed email without calling the server', (tester) async {
      await tester.pumpWidget(_app(const ForgotPasswordScreen(email: 'not-an-email')));
      await tester.tap(find.text('Gửi liên kết đặt lại'));
      await tester.pump();
      expect(find.text('Email không hợp lệ.'), findsOneWidget);
      expect(find.text('Kiểm tra email'), findsNothing);
    });
  });

  group('reset password screen', () {
    Future<void> fill(WidgetTester tester, {String? link, required String password, required String confirm}) async {
      final fields = find.byType(TextField);
      var i = 0;
      if (link != null) await tester.enterText(fields.at(i++), link);
      await tester.enterText(fields.at(i++), password);
      await tester.enterText(fields.at(i), confirm);
      await tester.pump();
    }

    Future<void> submit(WidgetTester tester) async {
      final button = find.text('Đặt mật khẩu mới').last;
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pump();
    }

    testWidgets('asks for the link only when opened without a token', (tester) async {
      await tester.pumpWidget(_app(const ResetPasswordScreen()));
      expect(find.text('Liên kết trong email'), findsOneWidget);
      await tester.pumpWidget(_app(const ResetPasswordScreen(token: 'abc', key: ValueKey('with-token'))));
      await tester.pump();
      expect(find.text('Liên kết trong email'), findsNothing);
    });

    testWidgets('refuses a pasted link with no token in it', (tester) async {
      await tester.pumpWidget(_app(const ResetPasswordScreen()));
      await fill(tester, link: 'https://chillngo.vn/feed', password: 'NewPass!2', confirm: 'NewPass!2');
      await submit(tester);
      expect(find.text('Không tìm thấy mã đặt lại trong liên kết này.'), findsOneWidget);
    });

    testWidgets('refuses a password that breaks the rules', (tester) async {
      await tester.pumpWidget(_app(const ResetPasswordScreen(token: 'abc')));
      await fill(tester, password: 'weak', confirm: 'weak');
      await submit(tester);
      expect(find.text('Mật khẩu chưa đạt đủ các yêu cầu bên dưới ô mật khẩu.'), findsOneWidget);
    });

    testWidgets('refuses a confirmation that does not match', (tester) async {
      await tester.pumpWidget(_app(const ResetPasswordScreen(token: 'abc')));
      await fill(tester, password: 'NewPass!2', confirm: 'NewPass!3');
      await submit(tester);
      expect(find.text('Mật khẩu xác nhận không khớp.'), findsWidgets);
    });
  });
}
