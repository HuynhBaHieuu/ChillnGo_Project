/// Every screen of the app and the rules for reaching them, as in
/// web/src/app/router.tsx:
///
/// - Staff accounts (admin, superadmin) only see the admin console.
/// - Screens that need an account send signed-out users to /login?next=…,
///   and /login returns them there once signed in.
/// - The first launch opens the welcome screen, later launches the Newsfeed.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/prefs.dart';
import 'core/roles.dart';
import 'features/activity/activity_screen.dart';
import 'features/activity/activity_section_screen.dart';
import 'features/admin/admin_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/auth/verify_email_screen.dart';
import 'features/checkin/new_checkin_screen.dart';
import 'features/common/not_found_screen.dart';
import 'features/discover/discover_screen.dart';
import 'features/discover/interest_screen.dart';
import 'features/editor/post_editor_screen.dart';
import 'features/feed/feed_screen.dart';
import 'features/itinerary/itineraries_screen.dart';
import 'features/itinerary/itinerary_detail_screen.dart';
import 'features/livestream/live_screen.dart';
import 'features/livestream/live_setup_screen.dart';
import 'features/livestream/live_tab_screen.dart';
import 'features/menu/menu_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/post/post_detail_screen.dart';
import 'features/profile/edit_profile_screen.dart';
import 'features/profile/me_screen.dart';
import 'features/profile/user_screen.dart';
import 'features/shell/home_shell.dart';
import 'features/welcome/about_screen.dart';
import 'features/welcome/welcome_screen.dart';
import 'state/session.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();

/// Paths that need a signed-in account.
bool _needsAccount(String path) {
  if (path == '/posts/new' || path == '/profile/edit' || path == '/live/new' || path == '/checkin/new') return true;
  if (path == '/notifications' || path == '/menu') return true;
  if (RegExp(r'^/posts/[^/]+/edit$').hasMatch(path)) return true;
  if (RegExp(r'^/live/[^/]+$').hasMatch(path)) return true;
  return path.startsWith('/activity') || path.startsWith('/itineraries') || path.startsWith('/admin');
}

String? _redirect(BuildContext context, GoRouterState state) {
  final session = appContainer.read(sessionProvider);
  final user = session.user;
  final path = state.uri.path;
  final staff = isStaff(user);

  if (path == '/' || path.isEmpty) {
    if (staff) return '/admin';
    if (session.signedIn || AppPrefs.welcomed) return '/feed';
    return '/welcome';
  }

  if (staff) return path.startsWith('/admin') ? null : '/admin';

  if (!session.signedIn && _needsAccount(path)) {
    return '/login?next=${Uri.encodeComponent(state.uri.toString())}';
  }
  if (session.signedIn && path.startsWith('/admin')) return '/feed';
  return null;
}

Page<void> _modal(GoRouterState state, Widget child) => MaterialPage<void>(key: state.pageKey, fullscreenDialog: true, child: child);

final appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/',
  refreshListenable: SessionListenable(),
  redirect: _redirect,
  errorBuilder: (context, state) => const NotFoundScreen(),
  routes: [
    GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
    GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
    GoRoute(path: '/about', builder: (_, _) => const AboutScreen()),

    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => HomeShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [GoRoute(path: '/feed', builder: (_, _) => const FeedScreen())],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/discover',
              builder: (_, state) => DiscoverScreen(
                initialQuery: state.uri.queryParameters['q'],
                initialRegion: state.uri.queryParameters['region'],
                initialTag: state.uri.queryParameters['tag'],
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/live',
              builder: (_, state) => LiveTabScreen(initialTab: state.uri.queryParameters['tab']),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [GoRoute(path: '/me', builder: (_, _) => const MeScreen())],
        ),
      ],
    ),

    GoRoute(
      path: '/discover/interest/:tag',
      builder: (_, state) => InterestScreen(tag: state.pathParameters['tag'] ?? ''),
    ),

    GoRoute(
      path: '/login',
      pageBuilder: (_, state) => _modal(state, LoginScreen(next: state.uri.queryParameters['next'])),
    ),
    GoRoute(
      path: '/register',
      pageBuilder: (_, state) => _modal(state, RegisterScreen(next: state.uri.queryParameters['next'])),
    ),
    GoRoute(
      path: '/verify-email',
      builder: (_, state) => VerifyEmailScreen(token: state.uri.queryParameters['token']),
    ),

    GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
    GoRoute(path: '/menu', pageBuilder: (_, state) => _modal(state, const MenuScreen())),

    GoRoute(
      path: '/checkin/new',
      pageBuilder: (_, state) => _modal(state, NewCheckInScreen(startWithPhotos: state.uri.queryParameters['start'] == 'photos')),
    ),

    GoRoute(path: '/live/new', pageBuilder: (_, state) => _modal(state, const LiveSetupScreen())),
    GoRoute(
      path: '/live/:id',
      builder: (_, state) => LiveScreen(id: state.pathParameters['id'] ?? ''),
    ),

    GoRoute(path: '/posts/new', builder: (_, _) => const PostEditorScreen()),
    GoRoute(
      path: '/posts/:id',
      builder: (_, state) => PostDetailScreen(id: state.pathParameters['id'] ?? ''),
    ),
    GoRoute(
      path: '/posts/:id/edit',
      builder: (_, state) => PostEditorScreen(postId: state.pathParameters['id']),
    ),

    GoRoute(
      path: '/users/:id',
      builder: (_, state) => UserScreen(id: state.pathParameters['id'] ?? '', initialTab: state.uri.queryParameters['tab']),
    ),
    GoRoute(path: '/profile/edit', builder: (_, _) => const EditProfileScreen()),

    GoRoute(
      path: '/itineraries',
      builder: (_, state) => ItinerariesScreen(initialTab: state.uri.queryParameters['tab']),
    ),
    GoRoute(
      path: '/itineraries/:id',
      builder: (_, state) => ItineraryDetailScreen(id: state.pathParameters['id'] ?? ''),
    ),

    GoRoute(path: '/activity', builder: (_, _) => const ActivityScreen()),
    GoRoute(
      path: '/activity/:section',
      builder: (_, state) => ActivitySectionScreen(section: state.pathParameters['section'] ?? '', initialTab: state.uri.queryParameters['tab']),
    ),

    GoRoute(path: '/admin', builder: (_, _) => const AdminScreen()),
    GoRoute(
      path: '/admin/:section',
      builder: (_, state) => AdminScreen(section: state.pathParameters['section']),
    ),
  ],
);
