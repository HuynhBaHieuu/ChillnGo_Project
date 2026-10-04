import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/images.dart';
import '../../core/password.dart';
import '../../core/photos.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../data/services/auth_service.dart';
import '../../data/services/profile_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/sheets.dart';
import '../../ui/surfaces.dart';
import '../../ui/navigation.dart';

const _bioMax = 300;
const _locationMax = 80;

class _ImageDraft {
  const _ImageDraft({this.image, this.remove = false});

  final PickedImage? image;

  /// Back to the default travel photo.
  final bool remove;

  bool get changed => image != null || remove;
}

/// /profile/edit: your own profile (web: EditProfilePage).
class EditProfileScreen extends ConsumerWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Chỉnh sửa hồ sơ')),
      body: user == null ? const SizedBox.shrink() : _EditProfileForm(key: ValueKey(user.id), user: user),
    );
  }
}

class _EditProfileForm extends ConsumerStatefulWidget {
  const _EditProfileForm({super.key, required this.user});

  final User user;

  @override
  ConsumerState<_EditProfileForm> createState() => _EditProfileFormState();
}

class _EditProfileFormState extends ConsumerState<_EditProfileForm> {
  late final _displayName = TextEditingController(text: widget.user.displayName);
  late final _username = TextEditingController(text: widget.user.username);
  late final _bio = TextEditingController(text: widget.user.bio);
  late final _location = TextEditingController(text: widget.user.location);
  _ImageDraft _avatar = const _ImageDraft();
  _ImageDraft _cover = const _ImageDraft();
  bool _saving = false;
  String? _progress;
  String? _error;

  @override
  void dispose() {
    _displayName.dispose();
    _username.dispose();
    _bio.dispose();
    _location.dispose();
    super.dispose();
  }

  bool get _nameChanged => _displayName.text.trim() != widget.user.displayName;
  bool get _usernameChanged => _username.text.trim().toLowerCase() != widget.user.username;
  bool get _bioChanged => _bio.text.trim() != widget.user.bio;
  bool get _locationChanged => _location.text.trim() != widget.user.location;
  bool get _dirty => _nameChanged || _usernameChanged || _bioChanged || _locationChanged || _avatar.changed || _cover.changed;

  Future<void> _save() async {
    if (_displayName.text.trim().isEmpty) {
      setState(() => _error = 'Vui lòng nhập tên hiển thị.');
      return;
    }
    if (_usernameChanged) {
      final problem = usernameProblem(_username.text);
      if (problem != null) {
        setState(() => _error = problem);
        return;
      }
    }
    if (!_dirty) return;
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      for (final (kind, draft, name) in [('avatar', _avatar, 'ảnh đại diện'), ('cover', _cover, 'ảnh bìa')]) {
        final image = draft.image;
        if (image == null) continue;
        setState(() => _progress = 'Đang tải $name lên… 0%');
        await ProfileService.uploadImage(
          kind,
          image,
          onProgress: (p) {
            if (mounted) setState(() => _progress = 'Đang tải $name lên… $p%');
          },
        );
      }
      setState(() => _progress = 'Đang lưu hồ sơ…');
      final fresh = adoptUser(
        await ProfileService.updateProfile(
          displayName: _nameChanged ? _displayName.text.trim() : null,
          username: _usernameChanged ? _username.text.trim() : null,
          bio: _bioChanged ? _bio.text.trim() : null,
          location: _locationChanged ? _location.text.trim() : null,
          avatar: _avatar.image != null ? 'uploaded' : (_avatar.remove ? 'remove' : null),
          cover: _cover.image != null ? 'uploaded' : (_cover.remove ? 'remove' : null),
        ),
      );
      await ref.read(sessionProvider.notifier).setUser(fresh);
      ref.invalidate(userProvider(fresh.id));
      invalidateJourneys(ref);
      if (!mounted) return;
      toast(context, 'Đã lưu hồ sơ.');
      leavePage(context);
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _progress = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    return ListView(
      padding: const EdgeInsets.fromLTRB(kGutter, 8, kGutter, 40),
      children: [
        Text('Thông tin này hiện trên trang cá nhân của bạn.', style: AppText.meta),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Ảnh', style: AppText.h3),
              const SizedBox(height: 14),
              _ImagePicker(
                cover: true,
                label: 'Ảnh bìa',
                hint: 'Ảnh ngang, tỉ lệ khoảng 3:1. $acceptedImagesLabel. Ảnh được tự nén trước khi tải lên.',
                currentUrl: user.coverUrl,
                defaultUrl: travelBanner(user.username),
                draft: _cover,
                onChanged: (d) => setState(() => _cover = d),
                disabled: _saving,
              ),
              const SizedBox(height: 18),
              _ImagePicker(
                cover: false,
                label: 'Ảnh đại diện',
                hint: 'Ảnh vuông sẽ đẹp nhất. $acceptedImagesLabel.',
                currentUrl: user.avatarUrl,
                defaultUrl: travelAvatar(user.username),
                draft: _avatar,
                onChanged: (d) => setState(() => _avatar = d),
                disabled: _saving,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Thông tin', style: AppText.h3),
              const SizedBox(height: 14),
              AppTextField(
                controller: _displayName,
                label: 'Tên hiển thị',
                maxLength: 60,
                autofillHints: const [AutofillHints.name],
                textCapitalization: TextCapitalization.words,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              AppTextField(
                controller: _username,
                label: 'Tên người dùng',
                maxLength: 30,
                autocorrect: false,
                helper:
                    '3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới. Hiện là @${_username.text.trim().toLowerCase().isEmpty ? '…' : _username.text.trim().toLowerCase()}',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              AppTextField(
                controller: _bio,
                label: 'Giới thiệu',
                maxLines: 5,
                minLines: 3,
                maxLength: _bioMax,
                showCounter: true,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              AppTextField(controller: _location, label: 'Nơi sống', maxLength: _locationMax, onChanged: (_) => setState(() {})),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ErrorText(_error),
        if (_progress != null) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
              const SizedBox(width: 8),
              Text(_progress!, style: AppText.meta),
            ],
          ),
        ],
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: AppButton(label: 'Huỷ', variant: ButtonVariant.outline, onPressed: _saving ? null : () => leavePage(context)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AppButton(label: 'Lưu thay đổi', loading: _saving, onPressed: _dirty ? _save : null),
            ),
          ],
        ),
      ],
    );
  }
}

class _ImagePicker extends StatefulWidget {
  const _ImagePicker({
    required this.cover,
    required this.label,
    required this.hint,
    required this.currentUrl,
    required this.defaultUrl,
    required this.draft,
    required this.onChanged,
    required this.disabled,
  });

  final bool cover;
  final String label;
  final String hint;
  final String currentUrl;
  final String defaultUrl;
  final _ImageDraft draft;
  final ValueChanged<_ImageDraft> onChanged;
  final bool disabled;

  @override
  State<_ImagePicker> createState() => _ImagePickerState();
}

class _ImagePickerState extends State<_ImagePicker> {
  String? _error;

  Future<void> _pick() async {
    setState(() => _error = null);
    try {
      final images = await pickImages(maxSide: widget.cover ? coverMaxSide : avatarMaxSide);
      if (images.isEmpty) return;
      widget.onChanged(_ImageDraft(image: images.first));
    } catch (error) {
      setState(() => _error = errorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = widget.draft;
    final hasOwnImage = widget.currentUrl != widget.defaultUrl;
    final Widget picture = draft.image != null
        ? Image.file(File(draft.image!.path), fit: BoxFit.cover)
        : NetImage(draft.remove ? widget.defaultUrl : widget.currentUrl);

    final frame = widget.cover
        ? ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: AspectRatio(aspectRatio: 3, child: picture),
          )
        : ClipOval(child: SizedBox(width: 88, height: 88, child: picture));

    final actions = Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        AppButton(
          label: 'Chọn ảnh mới',
          icon: widget.cover ? LucideIcons.imageUp : LucideIcons.camera,
          variant: ButtonVariant.outline,
          size: ButtonSize.sm,
          onPressed: widget.disabled ? null : _pick,
        ),
        if (draft.changed)
          AppButton(
            label: 'Hoàn tác',
            icon: LucideIcons.rotateCcw,
            variant: ButtonVariant.ghost,
            size: ButtonSize.sm,
            onPressed: widget.disabled
                ? null
                : () {
                    setState(() => _error = null);
                    widget.onChanged(const _ImageDraft());
                  },
          )
        else if (hasOwnImage)
          AppButton(
            label: 'Dùng ảnh mặc định',
            icon: LucideIcons.trash,
            variant: ButtonVariant.ghost,
            size: ButtonSize.sm,
            onPressed: widget.disabled ? null : () => widget.onChanged(const _ImageDraft(remove: true)),
          ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.label, style: AppText.label),
        const SizedBox(height: 8),
        if (widget.cover) ...[
          Stack(
            children: [
              frame,
              if (draft.changed) const Positioned(left: 6, top: 6, child: AppBadge('Chưa lưu', tone: BadgeTone.primary)),
            ],
          ),
          const SizedBox(height: 10),
          actions,
        ] else
          Row(
            children: [
              Stack(
                children: [
                  frame,
                  if (draft.changed) const Positioned(left: 0, top: 0, child: AppBadge('Chưa lưu', tone: BadgeTone.primary)),
                ],
              ),
              const SizedBox(width: 14),
              Expanded(child: actions),
            ],
          ),
        const SizedBox(height: 8),
        Text(widget.hint, style: AppText.meta),
        if (_error != null) ...[const SizedBox(height: 6), ErrorText(_error)],
      ],
    );
  }
}
