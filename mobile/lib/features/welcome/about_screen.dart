import 'package:flutter/material.dart';

import 'landing_content.dart';

/// "Về ChillnGo": the landing page, reachable from the menu.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(body: LandingContent());
}
