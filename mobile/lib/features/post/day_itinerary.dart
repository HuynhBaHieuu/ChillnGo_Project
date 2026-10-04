import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/geo.dart';
import '../../core/itinerary.dart';
import '../../core/links.dart';
import '../../core/theme.dart';
import '../../core/travel.dart';
import '../../data/models.dart';
import '../../ui/photo_viewer.dart';
import '../../ui/surfaces.dart';

/// One day of a trip: its stops as a timeline, with notes, costs and photos (web: DayItinerary).
class DayItinerary extends StatelessWidget {
  const DayItinerary({super.key, required this.day});

  final TripDay day;

  @override
  Widget build(BuildContext context) {
    final color = dayColor(day.dayNumber);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 6),
                        Text('NGÀY ${day.dayNumber}', style: AppText.caps),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(day.title.isEmpty ? 'Chưa đặt tên' : day.title, style: AppText.h3),
                    if (day.date.isNotEmpty) Text(formatLongDate(day.date), style: AppText.meta),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Ước tính', style: AppText.meta),
                  Text(
                    formatVnd(dayCostOf(day)),
                    style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w700, color: AppColors.cream),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          for (var index = 0; index < day.locations.length; index++)
            _Stop(location: day.locations[index], index: index, last: index == day.locations.length - 1, color: color),
          if (day.photos.isNotEmpty) ...[
            const SizedBox(height: 4),
            SizedBox(
              height: 124,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: day.photos.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, i) => Semantics(
                  button: true,
                  label: 'Ảnh ${i + 1} của ngày ${day.dayNumber}',
                  child: GestureDetector(
                    onTap: () => showPhotoViewer(context, day.photos, i),
                    child: NetImage(day.photos[i], width: 168, height: 124, radius: AppRadius.md, placeholderColor: AppColors.canopy),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stop extends StatelessWidget {
  const _Stop({required this.location, required this.index, required this.last, required this.color});

  final TripLocation location;
  final int index;
  final bool last;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final mode = modeOf(location.travelMode);
    final pinned = isPinned(location);
    final address = location.address ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (index > 0)
          Padding(
            padding: const EdgeInsets.only(left: 34, top: 2, bottom: 2),
            child: Row(
              children: [
                Icon(modeIcons[mode], size: 12, color: AppColors.meta),
                const SizedBox(width: 6),
                Text(modeLabels[mode]!, style: AppText.meta.copyWith(fontSize: 12)),
              ],
            ),
          ),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 26,
                child: Column(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.well,
                        shape: BoxShape.circle,
                        border: Border.all(color: color, width: 2),
                      ),
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w700, fontSize: 11, color: AppColors.cream),
                      ),
                    ),
                    if (!last)
                      Expanded(
                        child: Container(width: 1, margin: const EdgeInsets.symmetric(vertical: 4), color: AppColors.border),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: Text(location.name.isEmpty ? 'Điểm dừng ${index + 1}' : location.name, style: AppText.label)),
                          const SizedBox(width: 10),
                          Text(location.estCost > 0 ? formatVnd(location.estCost) : 'Miễn phí', style: AppText.meta),
                        ],
                      ),
                      if (address.isNotEmpty || pinned) ...[
                        const SizedBox(height: 6),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Icon(LucideIcons.mapPin, size: 13, color: AppColors.ochre),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text.rich(
                                TextSpan(
                                  style: AppText.meta,
                                  children: [
                                    TextSpan(text: address),
                                    if (address.isNotEmpty && pinned) const TextSpan(text: ' · '),
                                    if (pinned)
                                      TextSpan(
                                        text: 'Chỉ đường',
                                        style: const TextStyle(decoration: TextDecoration.underline, color: AppColors.body),
                                        recognizer: TapGestureRecognizer()..onTap = () => openExternal(googleDirectionsUrl(location.lat, location.lng)),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (location.note.isNotEmpty) ...[const SizedBox(height: 6), Text(location.note, style: AppText.bodySmall)],
                      if (location.photoUrl != null) ...[
                        const SizedBox(height: 8),
                        Semantics(
                          button: true,
                          label: 'Xem ảnh ${location.name.isEmpty ? 'điểm dừng ${index + 1}' : location.name} cỡ lớn',
                          child: GestureDetector(
                            onTap: () => showPhotoViewer(context, [location.photoUrl!], 0),
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 420),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(AppRadius.md),
                                child: AspectRatio(
                                  aspectRatio: 16 / 10,
                                  child: NetImage(location.photoUrl, placeholderColor: AppColors.canopy),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The journey's photos, swiped sideways, the cover first (web: DimensionalSwitchSlider).
class PostGallery extends StatefulWidget {
  const PostGallery({super.key, required this.coverUrl, required this.images});

  final String coverUrl;
  final List<String> images;

  @override
  State<PostGallery> createState() => _PostGalleryState();
}

class _PostGalleryState extends State<PostGallery> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final photos = widget.images.isNotEmpty ? widget.images : [widget.coverUrl];
    final width = MediaQuery.sizeOf(context).width;
    return SizedBox(
      height: (width * 0.68).roundToDouble(),
      child: Stack(
        children: [
          PageView.builder(
            itemCount: photos.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) => Semantics(
              button: true,
              label: 'Ảnh ${i + 1} trên ${photos.length}',
              child: GestureDetector(
                onTap: () => showPhotoViewer(context, photos, i),
                child: NetImage(photos[i], placeholderColor: AppColors.canopy),
              ),
            ),
          ),
          if (photos.length > 1)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < photos.length; i++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: i == _index ? 18 : 7,
                        height: 7,
                        decoration: BoxDecoration(color: i == _index ? AppColors.white : const Color(0x80FFFFFF), borderRadius: BorderRadius.circular(4)),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
