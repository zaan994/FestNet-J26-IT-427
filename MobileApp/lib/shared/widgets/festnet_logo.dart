import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// FestNet mark: gradient wristband tile with a pulse line (same artwork as the dashboard).
class FestNetLogo extends StatelessWidget {
  const FestNetLogo({super.key, this.size = 40, this.wordmark = true, this.subtitle});

  final double size;
  final bool wordmark;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final tile = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(size * 0.28),
        boxShadow: [
          BoxShadow(color: AppColors.violet.withValues(alpha: 0.35), blurRadius: size * 0.4, offset: Offset(0, size * 0.12)),
        ],
      ),
      child: CustomPaint(painter: _PulsePainter()),
    );
    if (!wordmark) return tile;

    final textSize = size * 0.55;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        tile,
        SizedBox(width: size * 0.3),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Fest', style: TextStyle(fontSize: textSize, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                GradientText('Net', style: TextStyle(fontSize: textSize, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
              ],
            ),
            if (subtitle != null)
              Text(subtitle!, style: TextStyle(fontSize: textSize * 0.45, color: context.festnet.muted)),
          ],
        ),
      ],
    );
  }
}

class _PulsePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 64; // artwork is drawn on a 64×64 grid
    final path = Path()
      ..moveTo(12 * s, 34 * s)
      ..lineTo(22 * s, 34 * s)
      ..lineTo(27 * s, 22 * s)
      ..lineTo(35 * s, 44 * s)
      ..lineTo(41 * s, 30 * s)
      ..lineTo(52 * s, 30 * s);
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5 * s
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Text filled with the brand gradient.
class GradientText extends StatelessWidget {
  const GradientText(this.text, {super.key, this.style});

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) => AppColors.brandGradient.createShader(Offset.zero & bounds.size),
      child: Text(text, style: style),
    );
  }
}
