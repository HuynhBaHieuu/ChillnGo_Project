package vn.chillngo.chillngo

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

/**
 * The Flutter host. Besides the plugins, it answers one channel:
 *
 * chillngo/frames — reads a recorded livestream (an MP4 address) for the
 * replay-cover picker (lib/features/livestream/frames.dart):
 *   duration(url)                → length in milliseconds
 *   frame(url, timeMs, maxWidth) → path of a JPEG of that moment
 */
class MainActivity : FlutterActivity() {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "chillngo/frames").setMethodCallHandler { call, result ->
            val url = call.argument<String>("url")
            if (url.isNullOrBlank()) {
                result.error("bad_args", "Missing url", null)
                return@setMethodCallHandler
            }
            when (call.method) {
                "duration" -> worker.execute {
                    val ms = readDuration(url)
                    main.post { if (ms != null) result.success(ms) else result.error("unreadable", "Cannot read the video", null) }
                }
                "frame" -> {
                    val timeMs = (call.argument<Number>("timeMs") ?: 0).toLong()
                    val maxWidth = (call.argument<Number>("maxWidth") ?: 1920).toInt()
                    worker.execute {
                        val path = readFrame(url, timeMs, maxWidth)
                        main.post { if (path != null) result.success(path) else result.error("unreadable", "Cannot read this frame", null) }
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun <T> withRetriever(url: String, block: (MediaMetadataRetriever) -> T?): T? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(url, HashMap())
            block(retriever)
        } catch (_: Exception) {
            null
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun readDuration(url: String): Long? = withRetriever(url) {
        it.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
    }

    private fun readFrame(url: String, timeMs: Long, maxWidth: Int): String? = withRetriever(url) { retriever ->
        val timeUs = timeMs * 1000
        val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
        val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
        val bitmap: Bitmap? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 && width > maxWidth && width > 0 && height > 0) {
            val scaledHeight = (height.toLong() * maxWidth / width).toInt().coerceAtLeast(1)
            retriever.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, maxWidth, scaledHeight)
        } else {
            retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
        }
        bitmap?.let {
            val file = File(cacheDir, "frame_${System.nanoTime()}.jpg")
            FileOutputStream(file).use { out -> it.compress(Bitmap.CompressFormat.JPEG, 90, out) }
            it.recycle()
            file.absolutePath
        }
    }

    override fun onDestroy() {
        worker.shutdown()
        super.onDestroy()
    }
}
