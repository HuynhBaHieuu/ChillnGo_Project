import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../ui/buttons.dart';
import '../../ui/navigation.dart';

/// Any address the app does not know (web: NotFoundPage).
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome()),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(kGutter),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('404', style: AppText.caps.copyWith(fontSize: 13)),
              const SizedBox(height: 14),
              Text('Lạc đường rồi', style: AppText.hero.copyWith(fontSize: 40), textAlign: TextAlign.center),
              const SizedBox(height: 14),
              Text(
                'Trang bạn tìm không tồn tại. Nhưng lạc đường đôi khi cũng là một phần của chuyến đi.',
                style: AppText.body.copyWith(color: AppColors.meta),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              AppButton(label: 'Về trang Khám phá', size: ButtonSize.lg, onPressed: () => context.go('/discover')),
            ],
          ),
        ),
      ),
    );
  }
}
