/// Photo check-ins (server/src/routes/checkins.ts).
library;

import '../../core/images.dart';
import '../../core/photos.dart';
import '../api.dart';
import '../json.dart';
import '../models.dart';
import '../upload.dart';

const maxCheckInPhotos = 4;
const checkInMaxSide = 2048;

CheckIn _withAvatar(CheckIn checkin) {
  if (checkin.author.avatarUrl.isEmpty) checkin.author = checkin.author.withAvatar(travelAvatar(checkin.author.username));
  return checkin;
}

abstract final class CheckInService {
  /// Newest first. [authors] limits to those accounts (the Newsfeed); omitted, everyone's.
  static Future<List<CheckIn>> list([List<String>? authors]) async {
    final data = await Api.get('/api/checkins${queryString({'authors': authors?.join(',')})}', auth: false);
    return listOf(data['items'], (c) => _withAvatar(CheckIn.fromJson(mapOf(c))));
  }

  /// Uploads the photos one by one, then posts the check-in. [onProgress] gets 0–100 over all photos.
  static Future<CheckIn> create({
    required List<PickedImage> images,
    required String caption,
    String? feeling,
    Place? location,
    void Function(int percent)? onProgress,
  }) async {
    final photoIds = <String>[];
    for (var index = 0; index < images.length; index++) {
      final result = await uploadPhoto(
        '/api/checkins/upload-signature',
        images[index],
        onProgress: (p) => onProgress?.call((((index + p / 100) / images.length) * 100).round()),
      );
      photoIds.add(str(result.signature['publicId']));
    }

    String cut(String text, int max) => text.length > max ? text.substring(0, max) : text;
    final data = await Api.post(
      '/api/checkins',
      body: {
        'caption': caption.trim(),
        'photos': photoIds,
        'feeling': feeling,
        'location': location == null
            ? null
            : {'name': cut(location.name, 120), 'address': cut(location.address, 200), 'lat': location.lat, 'lng': location.lng},
      },
      timeout: const Duration(seconds: 45),
    );
    return _withAvatar(CheckIn.fromJson(mapOf(data['checkin'])));
  }

  static Future<void> delete(String id) => Api.delete('/api/checkins/$id');

  static Future<List<CheckIn>> listDeleted() async {
    final data = await Api.get('/api/checkins/deleted');
    return listOf(data['items'], (c) => _withAvatar(CheckIn.fromJson(mapOf(c))));
  }

  static Future<void> restore(String id) => Api.post('/api/checkins/$id/restore');

  static Future<void> deletePermanently(String id) => Api.delete('/api/checkins/$id/permanent');
}
