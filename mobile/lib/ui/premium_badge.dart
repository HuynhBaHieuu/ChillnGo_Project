/// The crown next to a Premium member's name (web: components/PremiumBadge.tsx).
library;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/i18n.dart';

const premiumGold = Color(0xFFFBBF24);

/// Nothing for everyone else, so callers can drop it in unconditionally.
class PremiumBadge extends StatelessWidget {
  const PremiumBadge({super.key, required this.show, this.size = 12});

  final bool show;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (!show) return const SizedBox.shrink();
    return Tooltip(
      message: t('Thành viên Premium'),
      child: Container(
        padding: EdgeInsets.all(size * 0.2),
        decoration: const BoxDecoration(color: premiumGold, shape: BoxShape.circle),
        child: Icon(LucideIcons.crown, size: size, color: const Color(0xFF451A03), semanticLabel: t('Thành viên Premium')),
      ),
    );
  }
}
