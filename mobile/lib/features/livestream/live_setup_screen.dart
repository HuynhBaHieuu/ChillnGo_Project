import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/services/livestream_service.dart';
import '../../state/providers.dart';
import '../../state/session.dart';
import '../../ui/buttons.dart';
import '../../ui/fields.dart';
import '../../ui/surfaces.dart';
import 'live_room.dart';
import '../../ui/navigation.dart';

const _titleMax = 100;
const _descriptionMax = 500;

enum _Access { asking, ready, blocked }

/// "Bắt đầu livestream" (web: LivestreamSetupDialog): check picture and sound,
/// then name the stream and choose who may watch.
class LiveSetupScreen extends ConsumerStatefulWidget {
  const LiveSetupScreen({super.key});

  @override
  ConsumerState<LiveSetupScreen> createState() => _LiveSetupScreenState();
}

class _LiveSetupScreenState extends ConsumerState<LiveSetupScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  String _audience = 'public';
  bool _record = true;

  _Access _access = _Access.asking;
  String? _notice;
  LocalVideoTrack? _preview;
  bool _cameraOn = true;
  bool _front = true;
  bool _hasMic = false;
  bool _starting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _openDevices();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _stopPreview();
    super.dispose();
  }

  void _stopPreview() {
    final track = _preview;
    _preview = null;
    if (track != null) {
      unawaited(() async {
        try {
          await track.stop();
          await track.dispose();
        } catch (_) {}
      }());
    }
  }

  /// Asks for the camera and microphone, then shows the camera.
  Future<void> _openDevices() async {
    setState(() {
      _access = _Access.asking;
      _notice = null;
    });
    // iOS asks by itself the first time the camera opens; Android asks here.
    final statuses = Platform.isAndroid ? await [Permission.camera, Permission.microphone].request() : const <Permission, PermissionStatus>{};
    final camera = Platform.isAndroid ? (statuses[Permission.camera]?.isGranted ?? false) : true;
    final mic = Platform.isAndroid ? (statuses[Permission.microphone]?.isGranted ?? false) : true;
    if (!mounted) return;
    if (!camera && !mic) {
      setState(() {
        _access = _Access.blocked;
        _notice = 'Bạn đã chặn quyền camera và micro. Hãy cho phép trong Cài đặt của điện thoại rồi thử lại.';
      });
      return;
    }
    _hasMic = mic;
    if (!camera) {
      setState(() {
        _cameraOn = false;
        _access = _Access.ready;
        _notice = 'Không dùng được camera. Livestream sẽ chỉ có âm thanh.';
      });
      return;
    }
    await _startPreview();
  }

  Future<void> _startPreview() async {
    _stopPreview();
    if (!_cameraOn) {
      setState(() => _access = _Access.ready);
      return;
    }
    try {
      final track = await LocalVideoTrack.createCameraTrack(CameraCaptureOptions(cameraPosition: _front ? CameraPosition.front : CameraPosition.back));
      if (!mounted) {
        await track.stop();
        return;
      }
      setState(() {
        _preview = track;
        _access = _Access.ready;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _cameraOn = false;
        _access = _hasMic ? _Access.ready : _Access.blocked;
        _notice = _hasMic ? 'Không dùng được camera. Livestream sẽ chỉ có âm thanh.' : mediaErrorMessage(error);
      });
    }
  }

  Future<void> _start(bool canRecord) async {
    if (_title.text.trim().isEmpty || _starting) return;
    setState(() {
      _starting = true;
      _error = null;
    });
    try {
      final result = await LivestreamService.start(
        title: _title.text.trim(),
        description: _description.text.trim(),
        audience: _audience,
        record: canRecord && _record,
      );
      // Hand the camera over to the live page.
      _stopPreview();
      LiveHandoff.put(result.livestream.id, result.connection, camera: _cameraOn, frontCamera: _front);
      ref.invalidate(liveNowProvider);
      if (mounted) context.pushReplacement('/live/${result.livestream.id}');
    } on ApiError catch (error) {
      if (mounted) {
        setState(() => _error = error.code == 'ALREADY_LIVE' ? 'Bạn đang có một livestream khác. Hãy kết thúc nó trước khi phát buổi mới.' : error.message);
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider.select((s) => s.user));
    final config = ref.watch(liveConfigProvider);
    final canRecord = config.value?.recording ?? false;
    final canGoLive = _access == _Access.ready && _title.text.trim().isNotEmpty && !_starting;

    return Scaffold(
      appBar: AppBar(leading: const BackOrHome(), title: const Text('Bắt đầu livestream')),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(kGutter, 0, kGutter, 32),
          children: [
            Text('Kiểm tra hình và tiếng trước khi phát trực tiếp, ${user?.displayName ?? ''}.', style: AppText.meta),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              child: AspectRatio(
                aspectRatio: 3 / 4,
                child: ColoredBox(
                  color: Colors.black,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (_preview != null && _cameraOn && _access == _Access.ready)
                        VideoTrackRenderer(_preview!, fit: VideoViewFit.cover, mirrorMode: _front ? VideoViewMirrorMode.mirror : VideoViewMirrorMode.off),
                      if (!_cameraOn || _access != _Access.ready)
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: switch (_access) {
                              _Access.asking => Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.cream)),
                                  const SizedBox(height: 12),
                                  Text('Đang xin quyền dùng camera và micro…', style: AppText.label, textAlign: TextAlign.center),
                                ],
                              ),
                              _Access.blocked => Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(LucideIcons.videoOff, size: 28, color: AppColors.cream),
                                  const SizedBox(height: 10),
                                  Text(
                                    _notice ?? '',
                                    style: AppText.bodySmall.copyWith(color: AppColors.cream),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 12),
                                  Wrap(
                                    spacing: 8,
                                    children: [
                                      AppButton(label: 'Thử lại', variant: ButtonVariant.secondary, size: ButtonSize.sm, onPressed: _openDevices),
                                      AppButton(label: 'Mở Cài đặt', variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: openAppSettings),
                                    ],
                                  ),
                                ],
                              ),
                              _Access.ready => Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  AppAvatar(url: user?.avatarUrl, name: user?.displayName ?? '', size: 80, ring: true),
                                  const SizedBox(height: 12),
                                  Text('Chỉ phát âm thanh', style: AppText.label),
                                ],
                              ),
                            },
                          ),
                        ),
                      if (_access == _Access.ready)
                        Positioned(
                          left: 10,
                          bottom: 10,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(color: const Color(0xB3000000), borderRadius: BorderRadius.circular(AppRadius.pill)),
                            child: Row(
                              children: [
                                Icon(_hasMic ? LucideIcons.mic : LucideIcons.micOff, size: 14, color: AppColors.white),
                                const SizedBox(width: 6),
                                Text(_hasMic ? 'Micro sẵn sàng' : 'Không có micro', style: AppText.meta.copyWith(fontSize: 12, color: AppColors.white)),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            if (_access == _Access.ready && _notice != null) ...[const SizedBox(height: 8), Text(_notice!, style: AppText.meta)],
            if (_access == _Access.ready) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  AppButton(
                    label: _cameraOn ? 'Tắt camera (chỉ âm thanh)' : 'Bật camera',
                    icon: _cameraOn ? LucideIcons.videoOff : LucideIcons.video,
                    variant: ButtonVariant.outline,
                    size: ButtonSize.sm,
                    onPressed: () {
                      setState(() => _cameraOn = !_cameraOn);
                      _startPreview();
                    },
                  ),
                  if (_cameraOn)
                    AppButton(
                      label: _front ? 'Dùng camera sau' : 'Dùng camera trước',
                      icon: LucideIcons.switchCamera,
                      variant: ButtonVariant.outline,
                      size: ButtonSize.sm,
                      onPressed: () {
                        setState(() => _front = !_front);
                        _startPreview();
                      },
                    ),
                ],
              ),
            ],
            const SizedBox(height: 18),
            AppTextField(
              controller: _title,
              label: 'Tiêu đề',
              maxLength: _titleMax,
              onChanged: (_) => setState(() {}),
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 14),
            AppTextField(
              controller: _description,
              label: 'Mô tả (không bắt buộc)',
              maxLines: 4,
              minLines: 2,
              maxLength: _descriptionMax,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 14),
            SelectField<String>(
              label: 'Ai được xem',
              value: _audience,
              options: const [
                SelectOption('public', 'Công khai', 'Mọi người đã đăng nhập'),
                SelectOption('followers', 'Người theo dõi', 'Chỉ những ai theo dõi bạn'),
                SelectOption('private', 'Chỉ mình tôi', 'Để phát thử'),
              ],
              onChanged: (v) => setState(() => _audience = v),
            ),
            if (_audience != 'private') ...[
              const SizedBox(height: 6),
              Text('Người theo dõi bạn sẽ nhận được thông báo khi bạn bắt đầu phát.', style: AppText.meta.copyWith(fontSize: 12)),
            ],
            if (canRecord) ...[
              const SizedBox(height: 14),
              CheckboxRow(
                checked: _record,
                onChanged: (v) => setState(() => _record = v),
                title: 'Lưu lại buổi phát',
                description: 'Sau khi kết thúc, mọi người được xem lại trên trang cá nhân của bạn (cùng chế độ người xem như trên).',
              ),
            ],
            if (_error != null) ...[const SizedBox(height: 12), ErrorText(_error)],
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: AppButton(label: 'Huỷ', variant: ButtonVariant.outline, onPressed: _starting ? null : () => leavePage(context)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AppButton(label: 'Phát trực tiếp', icon: LucideIcons.radio, loading: _starting, onPressed: canGoLive ? () => _start(canRecord) : null),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
