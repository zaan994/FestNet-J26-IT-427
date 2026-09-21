import 'package:festnet/core/theme/app_theme.dart';
import 'package:festnet/shared/widgets/festnet_logo.dart';
import 'package:festnet/shared/widgets/gradient_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Smoke tests for the FestNet theme widgets in both light and night mode
/// (the full app needs Firebase, so it is not pumped here).
void main() {
  for (final (name, theme) in [('light', AppTheme.light), ('night', AppTheme.dark)]) {
    testWidgets('logo and gradient button render in $name theme', (tester) async {
      var tapped = false;
      await tester.pumpWidget(MaterialApp(
        theme: theme,
        home: Scaffold(
          body: Column(
            children: [
              const FestNetLogo(subtitle: 'Festival safety wearable'),
              GradientButton(label: 'Sign in', onPressed: () => tapped = true),
            ],
          ),
        ),
      ));

      expect(find.text('Fest'), findsOneWidget);
      expect(find.text('Net'), findsOneWidget);
      await tester.tap(find.text('Sign in'));
      expect(tapped, isTrue);
      expect(theme.extension<FestNetColors>(), isNotNull);
    });
  }
}
