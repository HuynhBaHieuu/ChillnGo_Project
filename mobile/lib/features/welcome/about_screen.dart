import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'landing_content.dart';
import '../../ui/navigation.dart';

/// "Về ChillnGo": the landing page, reachable from the menu.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(leading: const BackOrHome(), backgroundColor: Colors.transparent),
      body: LandingContent(onExplore: () => context.go('/discover')),
    );
  }
}
