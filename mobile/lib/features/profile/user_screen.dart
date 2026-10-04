import 'package:flutter/material.dart';

import 'profile_view.dart';
import '../../ui/navigation.dart';

/// /users/:id: someone's profile; ?tab=live opens their livestreams.
class UserScreen extends StatelessWidget {
  const UserScreen({super.key, required this.id, this.initialTab});

  final String id;
  final String? initialTab;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackOrHome()),
      body: ProfileView(userId: id, initialTab: initialTab),
    );
  }
}
