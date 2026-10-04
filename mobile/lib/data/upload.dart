/// Uploading one picked photo through a signature from our API.
library;

import '../core/images.dart';
import 'api.dart';
import 'json.dart';

/// Asks [signaturePath] for a signed upload, then sends the photo to Cloudinary.
/// Returns the signature (its `publicId`) and Cloudinary's answer (`secure_url`).
Future<({Json signature, Json uploaded})> uploadPhoto(String signaturePath, PickedImage image, {Object? body, void Function(int percent)? onProgress}) async {
  final signature = await Api.post(signaturePath, body: body);
  final uploaded = await Api.uploadSigned(signature, image.path, onProgress: onProgress);
  return (signature: signature, uploaded: uploaded);
}
