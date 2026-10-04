import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import 'live_format.dart';

/// The red "● LIVE" pill; the dot pulses. [social] uses the coral tone.
class LiveBadge extends StatefulWidget {
  const LiveBadge({super.key, this.social = false, this.trailing});

  final bool social;
  final Widget? trailing;

  @override
  State<LiveBadge> createState() => _LiveBadgeState();
}

class _LiveBadgeState extends State<LiveBadge> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bg = widget.social ? AppColors.social : AppColors.live;
    final fg = widget.social ? AppColors.onPrimary : AppColors.white;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: Tween<double>(begin: 1, end: 0.35).animate(_pulse),
            child: Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
            ),
          ),
          const SizedBox(width: 5),
          Text(
            'LIVE',
            style: TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 11, letterSpacing: 1, color: fg, height: 1.2),
          ),
          if (widget.trailing != null) ...[const SizedBox(width: 5), widget.trailing!],
        ],
      ),
    );
  }
}

/// "● LIVE 12:34", ticking from [baseSec] seconds measured at [baseAt].
class LiveClock extends StatelessWidget {
  const LiveClock({super.key, required this.baseSec, required this.baseAt, this.social = false});

  final double baseSec;
  final DateTime baseAt;
  final bool social;

  @override
  Widget build(BuildContext context) {
    return Ticker1s(
      builder: (_) {
        final elapsed = elapsedSince(baseSec, baseAt);
        return Semantics(
          label: 'Đã phát ${liveClock(elapsed)}',
          child: LiveBadge(
            social: social,
            trailing: Text(
              liveClock(elapsed),
              style: TextStyle(
                fontFamily: AppFonts.body,
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: social ? AppColors.onPrimary : AppColors.white,
                fontFeatures: const [FontFeature.tabularFigures()],
                height: 1.2,
              ),
            ),
          ),
        );
      },
    );
  }
}

/// "👁 12 người đang xem"
class ViewerCount extends StatelessWidget {
  const ViewerCount({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: const Color(0x73000000), borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.eye, size: 13, color: AppColors.white),
          const SizedBox(width: 5),
          Text(
            '${formatNumber(count)} người đang xem',
            style: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, fontSize: 11, color: AppColors.white, height: 1.2),
          ),
        ],
      ),
    );
  }
}

/// The numbers of a stream: length, audience, engagement (web: LiveStats).
class LiveStats extends StatelessWidget {
  const LiveStats({super.key, required this.stream, this.compactView = false, this.showReactions = true});

  final Livestream stream;
  final bool compactView;
  final bool showReactions;

  @override
  Widget build(BuildContext context) {
    final reactions = totalReactions(stream.reactions);
    final stats = [
      (icon: LucideIcons.clock, label: 'Thời lượng', value: liveDuration(stream.durationSec)),
      (icon: LucideIcons.users, label: 'Người xem', value: compact(stream.uniqueViewers)),
      (icon: LucideIcons.eye, label: 'Cao nhất cùng lúc', value: compact(stream.peakViewers)),
      (icon: LucideIcons.messageCircle, label: 'Bình luận', value: compact(stream.commentCount)),
      (icon: LucideIcons.sparkles, label: 'Cảm xúc', value: compact(reactions)),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            // Phones: two columns with the duration across both (web: grid-cols-2,
            // col-span-2), so no label is cut. Wider screens: one row of five.
            const gap = 8.0;
            final wide = constraints.maxWidth >= 560;
            final columns = wide ? 5 : 2;
            final cell = (constraints.maxWidth - gap * (columns - 1)) / columns;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final (i, s) in stats.indexed)
                  Container(
                    width: !wide && i == 0 ? constraints.maxWidth : cell,
                    padding: EdgeInsets.symmetric(horizontal: 10, vertical: compactView ? 8 : 10),
                    // Web (void): flat panels with a hairline; the duration tinted coral.
                    decoration: BoxDecoration(
                      color: i == 0 ? const Color(0x1FF07C6C) : AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: i == 0 ? const Color(0x40F07C6C) : AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 1),
                              child: Icon(s.icon, size: 13, color: i == 0 ? AppColors.social : AppColors.meta),
                            ),
                            const SizedBox(width: 5),
                            Flexible(
                              child: Text(s.label, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.mono.copyWith(fontSize: 11, height: 1.3)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          s.value,
                          style: AppText.mono.copyWith(
                            fontSize: compactView ? 15 : 17,
                            fontWeight: FontWeight.w700,
                            color: AppColors.cream,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
        if (showReactions && !compactView && reactions > 0) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              for (final kind in reactionKinds)
                if ((stream.reactions[kind] ?? 0) > 0)
                  Semantics(
                    label: '${reactionLabel[kind]}: ${stream.reactions[kind]}',
                    child: Text('${reactionEmoji[kind]} ${compact(stream.reactions[kind]!)}', style: AppText.body),
                  ),
            ],
          ),
        ],
      ],
    );
  }
}
