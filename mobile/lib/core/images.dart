/// Picking photos and preparing them for upload.
///
/// The picker shrinks each photo so its longest side is at most `maxSide` and
/// re-compresses it, as the web app does in the browser (web/src/lib/images.ts):
/// a 5–10 MB camera photo leaves the phone at a few hundred kB.
library;

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

const acceptedImagesLabel = 'Ảnh JPG, PNG, WebP hoặc HEIC';

/// Originals larger than this are refused.
const _maxBytes = 30 * 1024 * 1024;

class ImagePickError implements Exception {
  ImagePickError(this.message);

  final String message;

  @override
  String toString() => message;
}

class PickedImage {
  const PickedImage({required this.path, required this.name});

  final String path;
  final String name;

  File get file => File(path);
}

final _picker = ImagePicker();

Never _explain(PlatformException error) {
  final code = error.code.toLowerCase();
  if (code.contains('camera')) {
    throw ImagePickError('Bạn chưa cho ChillnGo dùng camera. Hãy bật quyền Camera trong Cài đặt của điện thoại.');
  }
  if (code.contains('photo') || code.contains('access')) {
    throw ImagePickError('Bạn chưa cho ChillnGo truy cập ảnh. Hãy bật quyền Ảnh trong Cài đặt của điện thoại.');
  }
  throw ImagePickError('Không mở được ảnh. Vui lòng thử lại.');
}

Future<PickedImage?> _checked(XFile? file) async {
  if (file == null) return null;
  final mime = file.mimeType;
  if (mime != null && !mime.startsWith('image/')) throw ImagePickError('Tệp này không phải ảnh.');
  if (await file.length() > _maxBytes) throw ImagePickError('Ảnh quá lớn. Vui lòng chọn ảnh dưới 30 MB.');
  return PickedImage(path: file.path, name: file.name);
}

/// Opens the photo library. Resolves to [] when the user cancels.
Future<List<PickedImage>> pickImages({int limit = 1, required int maxSide}) async {
  final size = maxSide.toDouble();
  try {
    if (limit <= 1) {
      final one = await _checked(await _picker.pickImage(source: ImageSource.gallery, maxWidth: size, maxHeight: size, imageQuality: 85));
      return one == null ? [] : [one];
    }
    final files = await _picker.pickMultiImage(maxWidth: size, maxHeight: size, imageQuality: 85, limit: limit);
    final out = <PickedImage>[];
    for (final file in files.take(limit)) {
      final checked = await _checked(file);
      if (checked != null) out.add(checked);
    }
    return out;
  } on PlatformException catch (error) {
    _explain(error);
  }
}

/// Opens the camera. Resolves to null when the user cancels.
Future<PickedImage?> takePhoto({required int maxSide}) async {
  final size = maxSide.toDouble();
  try {
    return await _checked(await _picker.pickImage(source: ImageSource.camera, maxWidth: size, maxHeight: size, imageQuality: 85));
  } on PlatformException catch (error) {
    _explain(error);
  }
}
