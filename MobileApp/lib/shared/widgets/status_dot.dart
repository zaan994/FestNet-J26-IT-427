import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class StatusDot extends StatelessWidget {
  const StatusDot({super.key, required this.online, this.label});

  final bool online;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: online ? AppColors.normal : AppColors.offline,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(label ?? (online ? 'Online' : 'Offline'), style: Theme.of(context).textTheme.labelMedium),
      ],
    );
  }
}
