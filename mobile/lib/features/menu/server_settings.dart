import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/env.dart';
import '../../core/theme.dart';
import '../../data/server_posts.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';

/// A small link to the API address setting (on the sign-in screen and the menu).
class ServerAddressLink extends StatelessWidget {
  const ServerAddressLink({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextLink(label: 'Máy chủ: ${Env.apiUrl}', icon: LucideIcons.server, color: AppColors.meta, onPressed: () => showServerSettings(context)),
    );
  }
}

/// Lets a tester point the app at another API (a phone on Wi-Fi needs the
/// computer's LAN address). Kept on the phone; empty goes back to the default.
Future<void> showServerSettings(BuildContext context) {
  return showAppSheet<void>(
    context,
    title: 'Địa chỉ máy chủ API',
    description: 'Dùng khi chạy trên điện thoại thật: nhập địa chỉ IP của máy tính đang chạy server (cùng mạng Wi-Fi), ví dụ http://192.168.1.10:4000.',
    builder: (_) => const _ServerForm(),
  );
}

class _ServerForm extends ConsumerStatefulWidget {
  const _ServerForm();

  @override
  ConsumerState<_ServerForm> createState() => _ServerFormState();
}

class _ServerFormState extends ConsumerState<_ServerForm> {
  late final _url = TextEditingController(text: Env.apiUrl);
  bool _checking = false;
  String? _result;
  bool _ok = false;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _check() async {
    setState(() {
      _checking = true;
      _result = null;
    });
    var base = _url.text.trim().replaceFirst(RegExp(r'/+$'), '');
    if (!base.startsWith('http')) base = 'http://$base';
    try {
      final response = await Dio(
        BaseOptions(connectTimeout: const Duration(seconds: 6), receiveTimeout: const Duration(seconds: 6), validateStatus: (_) => true),
      ).get<dynamic>('$base/api/health');
      _ok = (response.statusCode ?? 0) < 500;
      _result = _ok ? 'Kết nối được tới máy chủ.' : 'Máy chủ trả về lỗi ${response.statusCode}.';
    } catch (_) {
      _ok = false;
      _result = 'Không kết nối được. Kiểm tra địa chỉ, cổng 4000 và tường lửa của máy tính.';
    }
    if (mounted) setState(() => _checking = false);
  }

  Future<void> _save(String? url) async {
    await Env.setApiUrlOverride(url);
    invalidateServerPosts();
    if (!mounted) return;
    Navigator.of(context).pop();
    toast(context, 'Đã đổi máy chủ: ${Env.apiUrl}. Kéo xuống để tải lại dữ liệu.');
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(controller: _url, label: 'Địa chỉ', keyboardType: TextInputType.url, autocorrect: false, hint: 'http://192.168.1.10:4000'),
        const SizedBox(height: 8),
        Text('Mặc định: ${Env.defaultApiUrl}', style: AppText.meta),
        if (_result != null) ...[
          const SizedBox(height: 8),
          Text(_result!, style: AppText.bodySmall.copyWith(color: _ok ? AppColors.teal : AppColors.destructive)),
        ],
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            AppButton(label: 'Kiểm tra', variant: ButtonVariant.outline, size: ButtonSize.sm, loading: _checking, onPressed: _check),
            AppButton(label: 'Dùng mặc định', variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => _save(null)),
            AppButton(label: 'Lưu', size: ButtonSize.sm, onPressed: () => _save(_url.text)),
          ],
        ),
      ],
    );
  }
}
