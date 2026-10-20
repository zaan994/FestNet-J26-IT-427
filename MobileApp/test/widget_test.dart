import 'package:festnet/core/theme/app_theme.dart';
import 'package:festnet/core/utils/formatters.dart';
import 'package:festnet/models/device_health.dart';
import 'package:festnet/models/enums.dart';
import 'package:festnet/shared/widgets/festnet_logo.dart';
import 'package:festnet/shared/widgets/gradient_button.dart';
import 'package:festnet/shared/widgets/status_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Widget tests for the theme and the health display widgets in light and night mode
/// (the full app needs Firebase, so it is not pumped here).
void main() {
  for (final (name, theme) in [('light', AppTheme.light), ('night', AppTheme.dark)]) {
    testWidgets('logo and gradient button render in $name theme', (tester) async {
      var tapped = false;
      await tester.pumpWidget(MaterialApp(
        theme: theme,
        home: Scaffold(
          body: Column(children: [
            const FestNetLogo(subtitle: 'Festival safety wearable'),
            GradientButton(label: 'Sign in', onPressed: () => tapped = true),
          ]),
        ),
      ));
      expect(find.text('Fest'), findsOneWidget);
      await tester.tap(find.text('Sign in'));
      expect(tapped, isTrue);
      expect(theme.extension<FestNetColors>(), isNotNull);
    });
  }

  testWidgets('missing metric renders "Not available yet", not 0', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(body: MetricTile(label: 'Surface temperature', value: surfaceTempText(null), icon: Icons.thermostat)),
    ));
    expect(find.text(unavailable), findsOneWidget);
    expect(find.textContaining('0'), findsNothing);
  });

  testWidgets('HRI chip shows insufficient data for a null score', (tester) async {
    const hri = HriResult(
      status: HriStatus.insufficientData,
      confidence: ConfidenceLevel.none,
      confidenceValue: 0,
      factors: [],
      availableInputs: [],
      missingInputs: ['heart_rate'],
      flags: [],
      baselineAvailable: false,
    );
    await tester.pumpWidget(MaterialApp(theme: AppTheme.dark, home: const Scaffold(body: HriChip(hri: hri))));
    expect(find.text('Insufficient data'), findsOneWidget);
  });
}
