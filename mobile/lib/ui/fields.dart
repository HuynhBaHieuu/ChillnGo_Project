import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/format.dart';
import '../core/theme.dart';
import 'sheets.dart';

InputDecoration appInputDecoration({String? hint, IconData? icon, Widget? suffix, String? error, bool dense = false}) {
  OutlineInputBorder border(Color color, [double width = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(AppRadius.md),
    borderSide: BorderSide(color: color, width: width),
  );
  return InputDecoration(
    hintText: hint,
    hintStyle: AppText.body.copyWith(color: AppColors.meta.withValues(alpha: 0.75)),
    filled: true,
    fillColor: AppColors.well,
    isDense: dense,
    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: dense ? 10 : 13),
    prefixIcon: icon == null ? null : Icon(icon, size: 18, color: AppColors.meta),
    prefixIconConstraints: const BoxConstraints(minWidth: 42, minHeight: 40),
    suffixIcon: suffix,
    errorText: error,
    errorStyle: AppText.bodySmall.copyWith(color: AppColors.destructive),
    errorMaxLines: 3,
    counterStyle: AppText.meta.copyWith(fontSize: 11),
    border: border(const Color(0x99000000)),
    enabledBorder: border(const Color(0x99000000)),
    focusedBorder: border(AppColors.primary, 1.5),
    errorBorder: border(AppColors.destructive),
    focusedErrorBorder: border(AppColors.destructive, 1.5),
    disabledBorder: border(AppColors.border),
  );
}

/// A labelled text field (web: Label + Input / Textarea).
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.helper,
    this.error,
    this.icon,
    this.suffix,
    this.maxLength,
    this.showCounter = false,
    this.maxLines = 1,
    this.minLines,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.autofillHints,
    this.onChanged,
    this.onSubmitted,
    this.enabled = true,
    this.autofocus = false,
    this.textCapitalization = TextCapitalization.none,
    this.focusNode,
    this.inputFormatters,
    this.dense = false,
    this.autocorrect = true,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? helper;
  final String? error;
  final IconData? icon;
  final Widget? suffix;
  final int? maxLength;
  final bool showCounter;
  final int? maxLines;
  final int? minLines;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool enabled;
  final bool autofocus;
  final TextCapitalization textCapitalization;
  final FocusNode? focusNode;
  final List<TextInputFormatter>? inputFormatters;
  final bool dense;
  final bool autocorrect;

  @override
  Widget build(BuildContext context) {
    final field = TextField(
      controller: controller,
      focusNode: focusNode,
      style: AppText.body.copyWith(color: AppColors.cream),
      decoration: appInputDecoration(hint: hint, icon: icon, suffix: suffix, error: error, dense: dense).copyWith(counterText: showCounter ? null : ''),
      maxLength: maxLength,
      maxLengthEnforcement: MaxLengthEnforcement.enforced,
      maxLines: obscureText ? 1 : maxLines,
      minLines: minLines,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      obscureText: obscureText,
      autofillHints: autofillHints,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      enabled: enabled,
      autofocus: autofocus,
      autocorrect: autocorrect && !obscureText,
      enableSuggestions: !obscureText,
      textCapitalization: textCapitalization,
      inputFormatters: inputFormatters,
      cursorColor: AppColors.primary,
    );

    if (label == null && helper == null) return field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[Text(label!, style: AppText.label), const SizedBox(height: 6)],
        field,
        if (helper != null && error == null) ...[const SizedBox(height: 5), Text(helper!, style: AppText.meta.copyWith(fontSize: 12))],
      ],
    );
  }
}

/// A password field with a show/hide eye.
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    this.label = 'Mật khẩu',
    this.error,
    this.onChanged,
    this.onSubmitted,
    this.textInputAction,
    this.autofillHints = const [AutofillHints.password],
  });

  final TextEditingController controller;
  final String label;
  final String? error;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;
  final Iterable<String> autofillHints;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _shown = false;

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      controller: widget.controller,
      label: widget.label,
      error: widget.error,
      icon: LucideIcons.lock,
      obscureText: !_shown,
      autofillHints: widget.autofillHints,
      onChanged: widget.onChanged,
      onSubmitted: widget.onSubmitted,
      textInputAction: widget.textInputAction,
      keyboardType: TextInputType.visiblePassword,
      suffix: IconButton(
        tooltip: _shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu',
        icon: Icon(_shown ? LucideIcons.eyeOff : LucideIcons.eye, size: 18, color: AppColors.meta),
        onPressed: () => setState(() => _shown = !_shown),
      ),
    );
  }
}

class SelectOption<T> {
  const SelectOption(this.value, this.label, [this.description]);

  final T value;
  final String label;
  final String? description;
}

/// A field that opens a list of options in a bottom sheet.
class SelectField<T> extends StatelessWidget {
  const SelectField({
    super.key,
    required this.value,
    required this.options,
    required this.onChanged,
    this.label,
    this.placeholder = 'Chọn…',
    this.enabled = true,
    this.icon,
  });

  final T? value;
  final List<SelectOption<T>> options;
  final ValueChanged<T> onChanged;
  final String? label;
  final String placeholder;
  final bool enabled;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final selected = options.where((o) => o.value == value).firstOrNull;
    final box = InkWell(
      borderRadius: BorderRadius.circular(AppRadius.md),
      onTap: !enabled
          ? null
          : () async {
              final picked = await showOptionsSheet<T>(context, title: label ?? placeholder, options: options, selected: value);
              if (picked != null) onChanged(picked.value);
            },
      child: InputDecorator(
        decoration: appInputDecoration(
          icon: icon,
          suffix: const Icon(LucideIcons.chevronDown, size: 18, color: AppColors.meta),
        ),
        isEmpty: selected == null,
        child: Text(
          selected?.label ?? placeholder,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.body.copyWith(color: selected == null ? AppColors.meta : AppColors.cream),
        ),
      ),
    );
    final field = Opacity(opacity: enabled ? 1 : 0.5, child: box);
    if (label == null) return field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label!, style: AppText.label),
        const SizedBox(height: 6),
        field,
      ],
    );
  }
}

/// A calendar day ("YYYY-MM-DD") picked with the system date picker.
class DateField extends StatelessWidget {
  const DateField({super.key, required this.value, required this.onChanged, this.label, this.helper, this.enabled = true});

  final String value;
  final ValueChanged<String> onChanged;
  final String? label;
  final String? helper;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final current = value.isEmpty ? DateTime.now() : fromDateOnly(value);
    final box = InkWell(
      borderRadius: BorderRadius.circular(AppRadius.md),
      onTap: !enabled
          ? null
          : () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: current,
                firstDate: DateTime(2000),
                lastDate: DateTime(2100),
                helpText: label ?? 'Chọn ngày',
                cancelText: 'Huỷ',
                confirmText: 'Chọn',
              );
              if (picked != null) onChanged(toDateOnly(picked));
            },
      child: InputDecorator(
        decoration: appInputDecoration(icon: LucideIcons.calendar),
        child: Text(value.isEmpty ? 'Chọn ngày' : formatLongDate(value), style: AppText.body.copyWith(color: value.isEmpty ? AppColors.meta : AppColors.cream)),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[Text(label!, style: AppText.label), const SizedBox(height: 6)],
        Opacity(opacity: enabled ? 1 : 0.5, child: box),
        if (helper != null) ...[const SizedBox(height: 5), Text(helper!, style: AppText.meta.copyWith(fontSize: 12))],
      ],
    );
  }
}

/// A tappable row with a checkbox, a title and an explanation.
class CheckboxRow extends StatelessWidget {
  const CheckboxRow({super.key, required this.checked, required this.onChanged, required this.title, this.description, this.enabled = true});

  final bool checked;
  final ValueChanged<bool> onChanged;
  final String title;
  final String? description;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: AppColors.well,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: const BorderSide(color: AppColors.border),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.md),
          onTap: enabled ? () => onChanged(!checked) : null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 6, 12, 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(value: checked, onChanged: enabled ? (v) => onChanged(v ?? false) : null),
                const SizedBox(width: 2),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppText.label),
                        if (description != null) ...[const SizedBox(height: 2), Text(description!, style: AppText.meta)],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A short red message under a form, hidden when empty.
class ErrorText extends StatelessWidget {
  const ErrorText(this.message, {super.key});

  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null || message!.isEmpty) return const SizedBox.shrink();
    return Semantics(
      liveRegion: true,
      child: Text(message!, style: AppText.bodySmall.copyWith(color: AppColors.destructive)),
    );
  }
}
