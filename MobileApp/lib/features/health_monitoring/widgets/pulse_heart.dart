import 'package:flutter/material.dart';

/// Heart icon that beats at the measured BPM (static when BPM is unknown).
class PulseHeart extends StatefulWidget {
  const PulseHeart({super.key, required this.bpm, this.size = 56, this.color = Colors.red});

  final double? bpm;
  final double size;
  final Color color;

  @override
  State<PulseHeart> createState() => _PulseHeartState();
}

class _PulseHeartState extends State<PulseHeart> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(PulseHeart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((oldWidget.bpm ?? 0).round() != (widget.bpm ?? 0).round()) _sync();
  }

  void _sync() {
    final bpm = widget.bpm;
    if (bpm == null || bpm <= 0) {
      _controller.stop();
      _controller.value = 0;
      return;
    }
    _controller.duration = Duration(milliseconds: (60000 / bpm).round().clamp(250, 2000));
    _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // Quick swell in the first 15 % of the beat, then relax.
        final t = _controller.value;
        final scale = t < 0.15 ? 1 + (t / 0.15) * 0.18 : 1.18 - ((t - 0.15) / 0.85) * 0.18;
        return Transform.scale(scale: scale, child: child);
      },
      child: Icon(Icons.favorite, size: widget.size, color: widget.bpm == null ? Colors.grey : widget.color),
    );
  }
}
