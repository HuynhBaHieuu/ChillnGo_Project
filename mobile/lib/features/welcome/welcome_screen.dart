import 'package:flutter/material.dart';

import '../../core/prefs.dart';
import 'landing_content.dart';

/// The first screen on a new phone (web: the home page). Once seen, the app
/// opens on the Newsfeed; the page stays under Menu > "Về ChillnGo".
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  @override
  void initState() {
    super.initState();
    AppPrefs.markWelcomed();
  }

  @override
  Widget build(BuildContext context) => const Scaffold(body: LandingContent(welcome: true));
}
