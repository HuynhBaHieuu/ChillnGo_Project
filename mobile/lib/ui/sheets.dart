import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/theme.dart';
import '../data/api.dart';
import 'buttons.dart';
import 'fields.dart';

/// A bottom sheet with a title, optional description, content and footer
/// (web: Dialog, which phones show as a sheet).
Future<T?> showAppSheet<T>(
  BuildContext context, {
  required String title,
  String? description,
  required WidgetBuilder builder,
  WidgetBuilder? footer,
  bool tall = false,
  bool dismissible = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: dismissible,
    enableDrag: dismissible,
    backgroundColor: AppColors.surface,
    builder: (sheetContext) {
      final media = MediaQuery.of(sheetContext);
      return Padding(
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: media.size.height * (tall ? 0.92 : 0.85)),
          child: SheetBody(title: title, description: description, footer: footer?.call(sheetContext), child: builder(sheetContext)),
        ),
      );
    },
  );
}

/// The inside of a sheet: header, scrolling content, pinned footer.
class SheetBody extends StatelessWidget {
  const SheetBody({super.key, required this.title, this.description, required this.child, this.footer, this.scroll = true});

  final String title;
  final String? description;
  final Widget child;
  final Widget? footer;
  final bool scroll;

  @override
  Widget build(BuildContext context) {
    // Without a footer, the content itself must clear the gesture bar or the
    // navigation buttons: the sheet runs edge to edge (0 while the keyboard is up).
    final bottomInset = footer == null ? MediaQuery.paddingOf(context).bottom : 0.0;
    final content = Padding(padding: EdgeInsets.fromLTRB(kGutter, 4, kGutter, 16 + bottomInset), child: child);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppText.h2),
              if (description != null) ...[const SizedBox(height: 4), Text(description!, style: AppText.meta)],
            ],
          ),
        ),
        Flexible(child: scroll ? SingleChildScrollView(child: content) : content),
        if (footer != null)
          DecoratedBox(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SafeArea(
              top: false,
              child: Padding(padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 12), child: footer),
            ),
          ),
      ],
    );
  }
}

/// A list of options in a sheet; resolves to the picked one.
Future<SelectOption<T>?> showOptionsSheet<T>(BuildContext context, {required String title, required List<SelectOption<T>> options, T? selected}) {
  return showAppSheet<SelectOption<T>>(
    context,
    title: title,
    builder: (sheetContext) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final option in options) _OptionTile(option: option, selected: option.value == selected, onTap: () => Navigator.of(sheetContext).pop(option)),
      ],
    ),
  );
}

class _OptionTile<T> extends StatelessWidget {
  const _OptionTile({required this.option, required this.selected, required this.onTap});

  final SelectOption<T> option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: selected ? AppColors.raised : AppColors.well,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.md),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(option.label, style: AppText.label),
                      if (option.description != null) ...[const SizedBox(height: 2), Text(option.description!, style: AppText.meta)],
                    ],
                  ),
                ),
                if (selected) const Icon(LucideIcons.check, size: 18, color: AppColors.primary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One entry of an action menu.
class MenuAction<T> {
  const MenuAction(this.value, this.label, {this.icon, this.destructive = false});

  final T value;
  final String label;
  final IconData? icon;
  final bool destructive;
}

/// A short action menu as a sheet (web: DropdownMenu).
Future<T?> showActionSheet<T>(BuildContext context, {String? title, required List<MenuAction<T>> actions}) {
  return showModalBottomSheet<T>(
    context: context,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    builder: (sheetContext) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: Text(title, style: AppText.h3, maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
            for (final action in actions)
              ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
                leading: action.icon == null ? null : Icon(action.icon, size: 20, color: action.destructive ? AppColors.destructive : AppColors.body),
                title: Text(action.label, style: AppText.label.copyWith(color: action.destructive ? AppColors.destructive : AppColors.cream)),
                onTap: () => Navigator.of(sheetContext).pop(action.value),
              ),
          ],
        ),
      ),
    ),
  );
}

/// Asks before an action; runs [onConfirm] with a spinner and shows its error
/// inline. Resolves to true when the action went through.
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  String? description,
  Widget? content,
  String confirmLabel = 'Xác nhận',
  String cancelLabel = 'Huỷ',
  bool destructive = false,
  required Future<void> Function() onConfirm,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (_) => _ConfirmDialog(
      title: title,
      description: description,
      content: content,
      confirmLabel: confirmLabel,
      cancelLabel: cancelLabel,
      destructive: destructive,
      onConfirm: onConfirm,
    ),
  );
  return result ?? false;
}

class _ConfirmDialog extends StatefulWidget {
  const _ConfirmDialog({
    required this.title,
    this.description,
    this.content,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.destructive,
    required this.onConfirm,
  });

  final String title;
  final String? description;
  final Widget? content;
  final String confirmLabel;
  final String cancelLabel;
  final bool destructive;
  final Future<void> Function() onConfirm;

  @override
  State<_ConfirmDialog> createState() => _ConfirmDialogState();
}

class _ConfirmDialogState extends State<_ConfirmDialog> {
  bool _pending = false;
  String? _error;

  Future<void> _confirm() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await widget.onConfirm();
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _pending = false;
          _error = errorMessage(error);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_pending,
      child: AlertDialog(
        title: Text(widget.title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.description != null) Text(widget.description!, style: AppText.body),
            ?widget.content,
            if (_error != null) ...[const SizedBox(height: 10), ErrorText(_error)],
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          AppButton(
            label: widget.cancelLabel,
            variant: ButtonVariant.ghost,
            size: ButtonSize.sm,
            onPressed: _pending ? null : () => Navigator.of(context).pop(false),
          ),
          AppButton(
            label: widget.confirmLabel,
            variant: widget.destructive ? ButtonVariant.destructive : ButtonVariant.primary,
            size: ButtonSize.sm,
            loading: _pending,
            onPressed: _confirm,
          ),
        ],
      ),
    );
  }
}

/// A short message at the bottom of the screen.
void toast(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(error ? LucideIcons.circleAlert : LucideIcons.circleCheck, size: 18, color: error ? AppColors.destructive : AppColors.moss),
            const SizedBox(width: 10),
            Expanded(
              child: Text(message, style: AppText.label.copyWith(color: AppColors.ground)),
            ),
          ],
        ),
        duration: Duration(milliseconds: error ? 4500 : 2600),
      ),
    );
}
