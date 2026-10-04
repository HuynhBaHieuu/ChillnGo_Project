import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Leaves the current page: back to the one below it, or to the Newsfeed when
/// the page was opened straight from a link (chillngo://app/...) and nothing
/// is below it.
void leavePage(BuildContext context, {String fallback = '/feed'}) {
  final navigator = Navigator.of(context);
  if (navigator.canPop()) {
    navigator.pop();
  } else {
    GoRouter.of(context).go(fallback);
  }
}

/// The app bar's back button (an X on full-screen pages such as sign-in), as
/// Flutter draws it, but also on a page opened from a link: there it goes to
/// the Newsfeed instead of leaving the page with no way back.
class BackOrHome extends StatelessWidget {
  const BackOrHome({super.key});

  @override
  Widget build(BuildContext context) {
    final route = ModalRoute.of(context);
    final close = route is PageRoute && route.fullscreenDialog;
    // Flutter's own buttons call maybePop, so a page's PopScope still asks first.
    if (Navigator.of(context).canPop()) return close ? const CloseButton() : const BackButton();
    return IconButton(
      icon: close ? const CloseButtonIcon() : const BackButtonIcon(),
      tooltip: 'Về Newsfeed',
      onPressed: () => GoRouter.of(context).go('/feed'),
    );
  }
}
