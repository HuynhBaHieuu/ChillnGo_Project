/// The signed-in user's own profile (server/src/routes/users.ts). Images go
/// straight from the phone to Cloudinary with a signature from the API.
library;

import '../../core/images.dart';
import '../api.dart';
import '../json.dart';
import '../models.dart';
import '../upload.dart';

/// Longest side a picked photo is shrunk to before upload.
const avatarMaxSide = 1024;
const coverMaxSide = 2560;

abstract final class ProfileService {
  /// [kind]: 'avatar' | 'cover'. The server stores it once the profile is saved with `uploaded`.
  static Future<void> uploadImage(String kind, PickedImage image, {void Function(int percent)? onProgress}) async {
    await uploadPhoto('/api/users/me/upload-signature', image, body: {'kind': kind}, onProgress: onProgress);
  }

  /// Fields left null are not changed. avatar/cover: 'uploaded' | 'remove'.
  static Future<User> updateProfile({String? displayName, String? username, String? bio, String? location, String? avatar, String? cover}) async {
    final data = await Api.patch(
      '/api/users/me',
      body: {'displayName': ?displayName, 'username': ?username, 'bio': ?bio, 'location': ?location, 'avatar': ?avatar, 'cover': ?cover},
    );
    return User.fromJson(mapOf(data['user']));
  }
}
