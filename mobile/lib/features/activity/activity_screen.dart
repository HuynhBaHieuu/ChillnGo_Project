import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme.dart';
import '../../ui/surfaces.dart';
import 'activity_common.dart';
import '../../ui/navigation.dart';

/// /activity: the list of sections, each opening as its own screen, like a settings app.
class ActivityScreen extends StatelessWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Hoạt động của bạn')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(kGutter, 4, kGutter, 40),
        children: [
          Text('Xem lại và quản lý mọi hoạt động của bạn trên ChillnGo.', style: AppText.meta),
          const SizedBox(height: 14),
          AppCard(
            surface: Surface.surface,
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < activitySections.length; i++)
                  InkWell(
                    onTap: () => context.push('/activity/${activitySections[i].slug}'),
                    child: Container(
                      decoration: BoxDecoration(
                        border: i > 0 ? const Border(top: BorderSide(color: AppColors.border)) : null,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: const BoxDecoration(color: AppColors.well, shape: BoxShape.circle),
                            child: Icon(activitySections[i].icon, size: 18, color: AppColors.sage),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(activitySections[i].label, style: AppText.label),
                                Text(activitySections[i].hint, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                              ],
                            ),
                          ),
                          const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.meta),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
