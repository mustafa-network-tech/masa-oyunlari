import 'package:flutter/material.dart';

import '../game/game_controller.dart';
import '../net/protocol.dart';
import '../theme.dart';
import 'table_parts.dart';

/// Istakanın üstündeki çubuk: sıra/süre, açma ipucu ve hamle düğmeleri.
class ActionBar extends StatelessWidget {
  const ActionBar({super.key, required this.controller, required this.onLeave});

  final GameController controller;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final s = c.state!;
    final you = s.you;
    final hand = c.hand;
    final turnSeat = hand?.turn.seat;
    final progress = c.openingProgress;
    final pairs = c.evaluatesPairs;

    return SizedBox(
      height: 40,
      child: Row(
        children: [
          const SizedBox(width: 8),
          if (you != null) _MyClock(controller: c, seat: you),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _hint(c, turnSeat, progress),
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                color: progress != null && progress.have >= progress.need
                    ? MasaColors.turkuaz
                    : Colors.white70,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          _Button(
            'Seri diz',
            () => c.arrange('sets'),
            visible: hand != null && c.myOpening != 'pairs',
          ),
          _Button(
            'Çift diz',
            () => c.arrange('pairs'),
            visible: hand != null && c.myOpening != 'sets',
          ),
          _Button(
            'Geri koy',
            c.returnTaken,
            visible: c.hasTakenTile,
            tone: MasaColors.hata,
          ),
          _Button(
            pairs ? 'Çifte git' : 'Aç',
            c.open,
            visible: c.myOpening == null && c.canPlay,
            enabled: c.canOpen,
            primary: true,
          ),
          _Button(
            'Per aç',
            c.addMelds,
            visible: c.myOpening != null && c.canPlay,
            enabled: c.canAddMelds,
            primary: true,
          ),
          _Button(
            'At',
            c.selectedTileId == null
                ? null
                : () => c.discard(c.selectedTileId!),
            visible: c.canPlay && c.selectedTileId != null,
            primary: true,
          ),
          PopupMenuButton<String>(
            tooltip: 'Tepki',
            icon: const Icon(Icons.emoji_emotions_outlined, size: 22),
            onSelected: c.react,
            itemBuilder: (context) => [
              for (final e in reactions.entries)
                PopupMenuItem(value: e.key, child: Text(e.value)),
            ],
          ),
          PopupMenuButton<String>(
            tooltip: 'Menü',
            icon: const Icon(Icons.more_vert, size: 22),
            onSelected: (v) {
              if (v == 'leave') onLeave();
              if (v == 'sound') c.sounds?.toggle();
            },
            itemBuilder: (context) => [
              if (c.sounds != null)
                PopupMenuItem(
                  value: 'sound',
                  child: Text(c.sounds!.muted ? 'Sesi aç' : 'Sesi kapat'),
                ),
              const PopupMenuItem(value: 'leave', child: Text('Masadan kalk')),
            ],
          ),
        ],
      ),
    );
  }

  static String _hint(
    GameController c,
    int? turnSeat,
    ({int have, int need, bool pairs})? progress,
  ) {
    final s = c.state!;
    if (turnSeat == null) return '';
    if (!c.isMyTurn) return '${s.seats[turnSeat]?.name ?? ''} oynuyor';
    final hand = c.hand!;
    if (hand.turn.takenTileId != null) {
      return 'Yerden aldığın taşı kullan ya da geri koy (101 ceza)';
    }
    if (hand.turn.isDraw) {
      return hand.turn.mustDrawFromStock
          ? 'Desteden çek'
          : 'Desteden çek ya da soldaki taşı al';
    }
    if (progress != null) {
      final missing = progress.need - progress.have;
      if (progress.pairs) {
        return missing > 0
            ? 'Çiftlerin: ${progress.have}/${progress.need}'
            : 'Çifte gidebilirsin (${progress.have} çift)';
      }
      if (progress.have == 0) return 'Perlerini diz ya da bir taş at';
      return missing > 0
          ? 'Perlerin: ${progress.have} · açman için $missing puan daha lazım'
          : 'Açabilirsin: ${progress.have} puan';
    }
    return c.canAddMelds
        ? 'Yeni perleri açabilir, taş işleyebilirsin'
        : 'Taş işle ya da bir taş at';
  }
}

class _MyClock extends StatelessWidget {
  const _MyClock({required this.controller, required this.seat});
  final GameController controller;
  final int seat;

  @override
  Widget build(BuildContext context) {
    return Ticking(
      builder: (context) {
        final clock = clockFor(controller, seat);
        if (clock == null) return const SizedBox(width: 4);
        final color = clock.bank ? MasaColors.hata : MasaColors.turkuaz;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                clock.bank ? Icons.hourglass_bottom : Icons.timer_outlined,
                size: 14,
                color: color,
              ),
              const SizedBox(width: 4),
              Text(
                'Sıra sende · ${clock.seconds} sn',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Button extends StatelessWidget {
  const _Button(
    this.label,
    this.onPressed, {
    this.visible = true,
    this.enabled = true,
    this.primary = false,
    this.tone,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool visible;
  final bool enabled;
  final bool primary;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    final style = ButtonStyle(
      visualDensity: VisualDensity.compact,
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: 12),
      ),
      textStyle: WidgetStatePropertyAll(
        Theme.of(context).textTheme.labelLarge
            ?.copyWith(fontSize: 13, fontWeight: FontWeight.w700),
      ),
      backgroundColor: tone == null ? null : WidgetStatePropertyAll(tone),
    );
    final action = enabled ? onPressed : null;
    return Padding(
      padding: const EdgeInsets.only(left: 6),
      child: primary
          ? FilledButton(onPressed: action, style: style, child: Text(label))
          : FilledButton.tonal(
              onPressed: action,
              style: style,
              child: Text(label),
            ),
    );
  }
}
