import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/theme.dart';
import 'buttons.dart';
import 'surfaces.dart';

/// Opens photos full screen, swipe between them, pinch to zoom.
Future<void> showPhotoViewer(BuildContext context, List<String> photos, int index) {
  if (photos.isEmpty) return Future.value();
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black,
      pageBuilder: (_, _, _) => _PhotoViewer(photos: photos, initial: index.clamp(0, photos.length - 1)),
      transitionsBuilder: (_, animation, _, child) => FadeTransition(opacity: animation, child: child),
    ),
  );
}

class _PhotoViewer extends StatefulWidget {
  const _PhotoViewer({required this.photos, required this.initial});

  final List<String> photos;
  final int initial;

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer> {
  late final PageController _pages = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _pages,
            itemCount: widget.photos.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => InteractiveViewer(
              minScale: 1,
              maxScale: 4,
              child: Center(
                child: NetImage(widget.photos[i], fit: BoxFit.contain, placeholderColor: Colors.black),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  if (widget.photos.length > 1)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: AppColors.overlay, borderRadius: BorderRadius.circular(AppRadius.pill)),
                      child: Text('${_index + 1}/${widget.photos.length}', style: AppText.label.copyWith(color: AppColors.white)),
                    ),
                  const Spacer(),
                  AppIconButton(icon: LucideIcons.x, label: 'Đóng ảnh', tone: IconTone.overlay, onPressed: () => Navigator.of(context).pop()),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
