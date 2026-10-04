/// Password and username rules for new accounts: mirror passwordSchema and
/// usernameSchema in server/src/lib/schemas.ts. "Special" is anything that is
/// not a letter, digit or space, so a Vietnamese letter such as "ệ" does not count.
library;

import 'text.dart';

class PasswordRule {
  const PasswordRule(this.id, this.label, this.test);

  final String id;
  final String label;
  final bool Function(String value) test;
}

final passwordRules = <PasswordRule>[
  PasswordRule('length', 'Ít nhất 6 ký tự', (v) => chars(v).length >= 6),
  PasswordRule('upper', 'Ít nhất 1 chữ viết hoa (A–Z)', (v) => chars(v).any(isUpperLetter)),
  PasswordRule('special', 'Ít nhất 1 ký tự đặc biệt (! @ # \$ % …)', (v) => chars(v).any((ch) => !isLetter(ch) && !isDigit(ch) && !isSpace(ch))),
];

bool passwordMeetsRules(String value) => value.length <= 72 && passwordRules.every((rule) => rule.test(value));

final usernamePattern = RegExp(r'^[a-z0-9._]{3,30}$');

String? usernameProblem(String value) {
  final v = value.trim().toLowerCase();
  if (v.isEmpty) return 'Vui lòng nhập tên người dùng';
  if (!usernamePattern.hasMatch(v)) {
    return 'Tên người dùng dài 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới';
  }
  return null;
}

bool looksLikeEmail(String value) => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value.trim());
