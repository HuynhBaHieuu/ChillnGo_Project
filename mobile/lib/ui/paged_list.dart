import 'package:flutter/material.dart';

import '../data/api.dart';
import '../data/models.dart';
import 'buttons.dart';
import 'surfaces.dart';

/// A list loaded page by page with "Xem thêm" (web: useInfiniteQuery + a
/// "load more" button). Change [pageKey] to start over.
class PagedList<T> extends StatefulWidget {
  const PagedList({super.key, required this.pageKey, required this.load, required this.itemBuilder, this.empty, this.loading, this.gap = 16, this.onLoaded});

  /// Identifies the list; a new value reloads from the first page.
  final Object pageKey;
  final Future<CursorPage<T>> Function(String? before) load;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final Widget? empty;
  final Widget? loading;
  final double gap;

  /// The items shown so far (for counts elsewhere).
  final ValueChanged<List<T>>? onLoaded;

  @override
  State<PagedList<T>> createState() => PagedListState<T>();
}

class PagedListState<T> extends State<PagedList<T>> {
  final List<T> _items = [];
  String? _next;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    reload();
  }

  @override
  void didUpdateWidget(PagedList<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pageKey != widget.pageKey) reload();
  }

  /// Starts again from the first page.
  Future<void> reload() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.load(null);
      if (!mounted || generation != _generation) return;
      setState(() {
        _items
          ..clear()
          ..addAll(page.items);
        _next = page.nextBefore;
        _loading = false;
      });
      widget.onLoaded?.call(List.unmodifiable(_items));
    } catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _more() async {
    final cursor = _next;
    if (cursor == null || _loadingMore) return;
    final generation = _generation;
    setState(() => _loadingMore = true);
    try {
      final page = await widget.load(cursor);
      if (!mounted || generation != _generation) return;
      setState(() {
        _items.addAll(page.items);
        _next = page.nextBefore;
      });
      widget.onLoaded?.call(List.unmodifiable(_items));
    } catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return widget.loading ??
          Column(
            children: [
              for (var i = 0; i < 2; i++) ...[const Skeleton(height: 160, radius: 16), SizedBox(height: widget.gap)],
            ],
          );
    }
    if (_error != null && _items.isEmpty) {
      return ErrorPanel(error: _error, onRetry: reload);
    }
    if (_items.isEmpty) return widget.empty ?? const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final item in _items) ...[widget.itemBuilder(context, item), SizedBox(height: widget.gap)],
        if (_error != null) ...[Text(errorMessage(_error), textAlign: TextAlign.center), const SizedBox(height: 8)],
        if (_next != null)
          Center(
            child: AppButton(label: 'Xem thêm', variant: ButtonVariant.outline, loading: _loadingMore, onPressed: _more),
          ),
      ],
    );
  }
}
