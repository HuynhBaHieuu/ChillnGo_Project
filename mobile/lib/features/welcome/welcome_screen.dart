import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/prefs.dart';
import 'landing_content.dart';

/// The first screen on a new phone (web: the home page). After it, the app opens on the Newsfeed.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: LandingContent(
        welcome: true,
        onExplore: () async {
          await AppPrefs.markWelcomed();
          if (context.mounted) context.go('/discover');
        },
      ),
    );
  }
}
