/// HTTP transport for the API in server/. Every error comes back as an
/// [ApiError] carrying the server's Vietnamese message (ready to show) and code.
library;

import 'dart:async';

import 'package:dio/dio.dart';

import '../core/env.dart';
import 'json.dart';

/// Thrown for anything the API answers with a 4xx/5xx (status 0: no network).
/// [code] is set for errors the UI reacts to, e.g. EMAIL_NOT_VERIFIED.
class ApiError implements Exception {
  ApiError(this.message, {this.status = 404, this.code});

  final String message;
  final int status;
  final String? code;

  @override
  String toString() => message;
}

/// A message for any error, ready to show.
String errorMessage(Object? error, [String fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.']) {
  if (error == null) return fallback;
  if (error is ApiError) return error.message;
  if (error is TimeoutException) return 'Thao tác quá lâu. Vui lòng thử lại.';
  final text = error.toString();
  if (text.startsWith('Exception: ')) return text.substring(11);
  return text.isEmpty ? fallback : text;
}

abstract final class Api {
  /// The stored session token; set by the session controller.
  static String? Function() readToken = () => null;

  /// The signed-in user's id; set by the session controller.
  static String? Function() readViewerId = () => null;

  /// Called when the server rejects the token that was sent.
  static void Function(String token) onUnauthorized = (_) {};

  static final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 12),
      responseType: ResponseType.json,
      validateStatus: (_) => true,
      headers: {'Accept': 'application/json'},
    ),
  );

  /// The full address of an API path, for things that fetch it themselves (a video player).
  static String url(String path) => path.startsWith('http://') || path.startsWith('https://') ? path : '${Env.apiUrl}$path';

  static Future<Json> get(String path, {bool auth = true, Duration timeout = const Duration(seconds: 20)}) => request(path, auth: auth, timeout: timeout);

  static Future<Json> post(String path, {Object? body, bool auth = true, Duration timeout = const Duration(seconds: 20)}) =>
      request(path, method: 'POST', body: body, auth: auth, timeout: timeout);

  static Future<Json> patch(String path, {Object? body, Duration timeout = const Duration(seconds: 20)}) =>
      request(path, method: 'PATCH', body: body, timeout: timeout);

  static Future<Json> put(String path, {Object? body}) => request(path, method: 'PUT', body: body);

  static Future<Json> delete(String path) => request(path, method: 'DELETE');

  static Future<Json> request(String path, {String method = 'GET', Object? body, bool auth = true, Duration timeout = const Duration(seconds: 20)}) async {
    final token = auth ? readToken() : null;
    final cancel = CancelToken();
    var timedOut = false;
    final timer = Timer(timeout, () {
      timedOut = true;
      cancel.cancel('timeout');
    });

    Response<dynamic> response;
    try {
      response = await _dio.request<dynamic>(
        url(path),
        data: body,
        cancelToken: cancel,
        options: Options(
          method: method,
          contentType: body == null ? null : Headers.jsonContentType,
          headers: {if (token != null) 'Authorization': 'Bearer $token'},
        ),
      );
    } on DioException catch (error) {
      final slow =
          timedOut ||
          error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout;
      throw ApiError(slow ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.' : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', status: 0);
    } finally {
      timer.cancel();
    }

    final status = response.statusCode ?? 0;
    final data = mapOrNull(response.data);
    if (status < 200 || status >= 300) {
      // A rejected token means the stored session is dead: drop it so the app
      // stops showing a signed-in user the server no longer recognises.
      if (status == 401 && token != null && readToken() == token) onUnauthorized(token);
      throw ApiError(
        data != null && data['message'] is String ? data['message'] as String : 'Máy chủ trả về lỗi $status',
        status: status,
        code: data == null ? null : strOrNull(data['code']),
      );
    }
    return data ?? <String, dynamic>{};
  }

  /// Sends one file straight to Cloudinary with a signature from our API,
  /// as the web app does. [onProgress] gets 0–100.
  static Future<Json> uploadSigned(Json signed, String filePath, {void Function(int percent)? onProgress}) async {
    final uploadUrl = str(signed['uploadUrl']);
    final fields = mapOf(signed['fields']).map((k, v) => MapEntry(k, str(v)));
    if (uploadUrl.isEmpty) throw ApiError('Máy chủ chưa cấu hình nơi lưu ảnh.', status: 0);

    final name = filePath.split(RegExp(r'[\\/]')).last;
    final form = FormData.fromMap({...fields, 'file': await MultipartFile.fromFile(filePath, filename: name)});

    try {
      final response = await _dio.post<dynamic>(
        uploadUrl,
        data: form,
        options: Options(sendTimeout: const Duration(minutes: 2), receiveTimeout: const Duration(minutes: 2)),
        onSendProgress: (sent, total) {
          if (total > 0) onProgress?.call((sent * 100 / total).round().clamp(0, 100));
        },
      );
      final status = response.statusCode ?? 0;
      final data = mapOrNull(response.data) ?? <String, dynamic>{};
      if (status < 200 || status >= 300) {
        final detail = str(mapOf(data['error'])['message']);
        throw ApiError('Không tải được ảnh lên${detail.isEmpty ? '' : ': $detail'}.', status: status);
      }
      onProgress?.call(100);
      return data;
    } on DioException catch (error) {
      final slow = error.type == DioExceptionType.sendTimeout || error.type == DioExceptionType.receiveTimeout;
      throw ApiError(slow ? 'Tải ảnh lên quá lâu. Vui lòng thử lại.' : 'Không kết nối được tới máy chủ ảnh. Vui lòng thử lại.', status: 0);
    }
  }

  /// The body of [url] as text (an HLS playlist). Null on any failure.
  static Future<String?> getText(String url) async {
    try {
      final response = await _dio.get<String>(
        url,
        options: Options(responseType: ResponseType.plain, receiveTimeout: const Duration(seconds: 15)),
      );
      final status = response.statusCode ?? 0;
      return status >= 200 && status < 300 ? response.data : null;
    } on DioException {
      return null;
    }
  }

  /// Plain GET of an outside JSON service (Mapbox). Null on any failure.
  static Future<Json?> getExternal(String url, {CancelToken? cancel}) async {
    try {
      final response = await _dio.get<dynamic>(
        url,
        cancelToken: cancel,
        options: Options(receiveTimeout: const Duration(seconds: 15)),
      );
      final status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) return null;
      return mapOrNull(response.data);
    } on DioException {
      return null;
    }
  }
}

/// "?a=1&b=2" from the non-empty values.
String queryString(Map<String, Object?> params) {
  final parts = <String>[];
  params.forEach((key, value) {
    if (value == null) return;
    final text = value.toString();
    if (text.isEmpty) return;
    parts.add('${Uri.encodeQueryComponent(key)}=${Uri.encodeQueryComponent(text)}');
  });
  return parts.isEmpty ? '' : '?${parts.join('&')}';
}
