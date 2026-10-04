import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:livekit_client/livekit_client.dart';

import 'app.dart';
import 'core/env.dart';
import 'core/prefs.dart';
import 'core/theme.dart';
import 'data/mock_db.dart';
import 'state/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.ground,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Everything the first screen needs, read while the launch screen shows.
  await Env.load();
  await AppPrefs.load();
  await MockDb.instance.load();
  wireSession();
  await appContainer.read(sessionProvider.notifier).hydrate();

  try {
    await LiveKitClient.initialize();
  } catch (error) {
    debugPrint('LiveKit not initialised: $error');
  }

  runApp(UncontrolledProviderScope(container: appContainer, child: const ChillnGoApp()));
}
