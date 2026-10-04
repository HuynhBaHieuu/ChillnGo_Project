import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme.dart';
import 'data/api.dart';
import 'data/services/auth_service.dart';
import 'router.dart';
import 'state/providers.dart';
import 'state/session.dart';

class ChillnGoApp extends ConsumerStatefulWidget {
  const ChillnGoApp({super.key});

  @override
  ConsumerState<ChillnGoApp> createState() => _ChillnGoAppState();
}

class _ChillnGoAppState extends ConsumerState<ChillnGoApp> {
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _syncSession();
    // Back in the app: re-read the account (it may have been locked) and refresh live data.
    _lifecycle = AppLifecycleListener(
      onResume: () {
        _syncSession();
        ref.invalidate(notificationsProvider);
        ref.invalidate(liveNowProvider);
      },
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  /// SessionSync: the stored user is refreshed from /api/auth/me. A rejected
  /// token signs out (the API transport handles the 401).
  Future<void> _syncSession() async {
    final session = ref.read(sessionProvider);
    if (!session.signedIn) return;
    try {
      final user = await AuthService.currentUser();
      if (ref.read(sessionProvider).token == session.token) await ref.read(sessionProvider.notifier).setUser(user);
    } on ApiError catch (_) {
      // Offline or signed out: nothing to refresh.
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'ChillnGo',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      darkTheme: buildTheme(),
      themeMode: ThemeMode.dark,
      routerConfig: appRouter,
      locale: const Locale('vi'),
      supportedLocales: const [Locale('vi'), Locale('en')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
    );
  }
}
