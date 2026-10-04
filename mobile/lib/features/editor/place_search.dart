import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/geo.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';

/// Place suggestions for what the author types, once they pause; answers to
/// older queries are dropped (web: usePlaceSearch).
class PlaceSearch extends ChangeNotifier {
  PlaceSearch({this.minLength = 2});

  final int minLength;
  List<Place> results = const [];
  bool searching = false;
  String? error;

  Timer? _timer;
  CancelToken? _cancel;

  /// Searches for [query] after a short pause; null or a short text clears.
  void search(String? query) {
    _timer?.cancel();
    _cancel?.cancel();
    final q = query?.trim() ?? '';
    if (!canSearchPlaces || q.length < minLength) {
      _set(const [], searching: false);
      return;
    }
    _timer = Timer(const Duration(milliseconds: 400), () async {
      final cancel = CancelToken();
      _cancel = cancel;
      searching = true;
      notifyListeners();
      try {
        final places = await searchPlaces(q, cancel: cancel);
        if (cancel.isCancelled) return;
        error = null;
        _set(places, searching: false);
      } catch (e) {
        if (cancel.isCancelled) return;
        error = errorMessage(e);
        _set(const [], searching: false);
      }
    });
  }

  void clear() {
    _timer?.cancel();
    _cancel?.cancel();
    _set(const [], searching: false);
  }

  void _set(List<Place> places, {required bool searching}) {
    results = places;
    this.searching = searching;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _cancel?.cancel();
    super.dispose();
  }
}

/// The list under a field while the author types a place (the web's dropdown).
class PlaceSuggestions extends StatelessWidget {
  const PlaceSuggestions({super.key, required this.places, required this.onPick});

  final List<Place> places;
  final ValueChanged<Place> onPick;

  @override
  Widget build(BuildContext context) {
    if (places.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(top: 6),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0x1FFFFFFF)),
      ),
      child: Column(
        children: [
          for (var i = 0; i < places.length; i++)
            Material(
              type: MaterialType.transparency,
              child: InkWell(
                onTap: () => onPick(places[i]),
                child: Container(
                  decoration: BoxDecoration(
                    border: i > 0 ? const Border(top: BorderSide(color: AppColors.border)) : null,
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.mapPin, size: 16, color: AppColors.ochre),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              places[i].name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.bodySmall.copyWith(fontWeight: FontWeight.w600, color: AppColors.cream),
                            ),
                            if (places[i].address.isNotEmpty) Text(places[i].address, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.meta),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
