import 'dart:math';

import 'package:flutter/material.dart';

import '../game/game_controller.dart';
import '../game/table_state.dart';
import '../net/game_connection.dart';
import '../theme.dart';
import '../ui/action_bar.dart';
import '../ui/overlays.dart';
import '../ui/rack_view.dart';
import '../ui/table_parts.dart';
import '../ui/tile_widget.dart';

/// Oyun masası (yatay ekran). Oyuncu her zaman altta oturur; sağındaki sonraki oyuncudur.
///
///   [karşının yığını]          karşı          [sağdakinin yığını]
///   sol                        perler                        sağ
///   [soldakinin yığını]   deste · gösterge       [senin yığının]
///   ─────────────── işlem çubuğu ───────────────
///   ─────────────── ıstaka ─────────────────────
class GameView extends StatelessWidget {
  const GameView({super.key, required this.controller, required this.onLeave});

  final GameController controller;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final s = c.state!;
    final you = s.you ?? 0;
    final right = (you + 1) % 4;
    final across = (you + 2) % 4;
    final left = (you + 3) % 4;

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight;
        // Istaka ekran yüksekliğinin en fazla %42'sini alır.
        // Tablette taşlar devleşmesin diye ıstaka genişliği sınırlı.
        final rackW = min(min(w, 1000.0), RackView.widthFor(h * 0.42));
        final rackH = RackView.heightFor(rackW);
        final avatar = (h * 0.1).clamp(28.0, 50.0);

        final table = Container(
          margin: const EdgeInsets.fromLTRB(6, 6, 6, 0),
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: const RadialGradient(
              radius: 1.1,
              colors: [Color(0xFF1D5A54), MasaColors.masa, Color(0xFF0F3431)],
              stops: [0, 0.6, 1],
            ),
            border: Border.all(
              color: MasaColors.altin.withValues(alpha: 0.35),
              width: 2,
            ),
            boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 12)],
          ),
          child: LayoutBuilder(
            builder: (context, box) {
              // Boyutlar masanın gerçek yüksekliğinden: küçük ekranda da perlere yer kalsın.
              final th = box.maxHeight;
              final pileTile = (th * 0.17).clamp(18.0, 44.0);
              final meldTile = min(box.maxWidth / 34, th / 7).clamp(14.0, 30.0);
              final sideWidth = max(pileTile + 14, avatar * 2.4);

              Widget side(int pileTop, int seat, Widget pileBottom) => SizedBox(
                width: sideWidth,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    DiscardPile(
                      controller: c,
                      seat: pileTop,
                      role: PileRole.other,
                      tileWidth: pileTile,
                    ),
                    Flexible(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: SeatChip(
                          controller: c,
                          seat: seat,
                          size: avatar,
                        ),
                      ),
                    ),
                    pileBottom,
                  ],
                ),
              );

              return Row(
                children: [
                  side(
                    across,
                    left,
                    DiscardPile(
                      controller: c,
                      seat: left,
                      role: PileRole.takeable,
                      tileWidth: pileTile,
                    ),
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: SeatChip(
                            controller: c,
                            seat: across,
                            size: avatar * 0.8,
                            horizontal: true,
                          ),
                        ),
                        Expanded(
                          child: MeldArea(controller: c, tileWidth: meldTile),
                        ),
                        SizedBox(
                          height: pileTile * tileAspect + 10,
                          child: CenterInfo(controller: c, tileWidth: pileTile),
                        ),
                      ],
                    ),
                  ),
                  side(
                    right,
                    right,
                    DiscardPile(
                      controller: c,
                      seat: you,
                      role: PileRole.mine,
                      tileWidth: pileTile,
                    ),
                  ),
                ],
              );
            },
          ),
        );

        final mySeat = s.you == null ? null : s.seats[s.you!];
        final connected = c.connection.status == ConnectionStatus.connected;

        return Stack(
          children: [
            Column(
              children: [
                Expanded(child: table),
                ActionBar(controller: c, onLeave: onLeave),
                SizedBox(
                  width: rackW,
                  height: rackH,
                  child: RackView(controller: c),
                ),
              ],
            ),
            if (s.phase == TablePhase.seeding) const SeedingCard(),
            if (s.phase == TablePhase.handOver && s.result != null)
              HandResultPanel(controller: c),
            if (s.phase == TablePhase.finished)
              MatchOverPanel(controller: c, onHome: onLeave),
            Positioned(
              top: 10,
              left: 0,
              right: 0,
              child: Center(
                child: !connected
                    ? const InfoBanner(
                        text: 'Bağlantı koptu, yeniden bağlanılıyor… Yerine bot oynuyor.',
                        color: MasaColors.hata,
                      )
                    : mySeat?.status == SeatStatus.away &&
                          s.phase == TablePhase.playing
                    ? InfoBanner(
                        text: 'Süren doldu, yerine bot oynuyor.',
                        color: const Color(0xFF8A5A12),
                        action: TextButton(
                          onPressed: c.back,
                          child: const Text('Döndüm'),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),
          ],
        );
      },
    );
  }
}
