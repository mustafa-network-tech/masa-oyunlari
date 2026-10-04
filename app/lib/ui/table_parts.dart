import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../game/game_controller.dart';
import '../game/melds.dart';
import '../game/table_state.dart';
import '../net/protocol.dart';
import '../theme.dart';
import 'rack_view.dart';
import 'tile_widget.dart';

/// Hamle süreleri (ms). Sunucudaki karşılığı: server/src/table.ts DEFAULT_TIMING
const moveMsBySpeed = {'fast': 12000, 'normal': 20000, 'relaxed': 35000};

/// Sıradaki koltuğun kalan süresi. Bot oynuyorsa veya sıra onda değilse null.
({double fraction, int seconds, bool bank})? clockFor(
  GameController c,
  int seat,
) {
  final clock = c.hand?.clock;
  if (clock == null || clock.seat != seat || clock.endsIn == null) return null;
  final elapsed = DateTime.now().difference(c.stateAt).inMilliseconds;
  final left = max(0, clock.endsIn! - elapsed);
  final moveLeft = max(0, clock.moveLeft! - elapsed);
  final bank = moveLeft == 0;
  final moveMs = moveMsBySpeed[c.state!.settings.speed] ?? 20000;
  final total = bank ? max(1, clock.banks[seat]) : moveMs;
  final current = bank ? left : moveLeft;
  return (
    fraction: (current / total).clamp(0.0, 1.0),
    seconds: (left / 1000).ceil(),
    bank: bank,
  );
}

/// Süre sayaçları için ekranı saniyede birkaç kez yeniler.
class Ticking extends StatefulWidget {
  const Ticking({super.key, required this.builder});
  final WidgetBuilder builder;

  @override
  State<Ticking> createState() => _TickingState();
}

class _TickingState extends State<Ticking> {
  late final Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(
      const Duration(milliseconds: 250),
      (_) => setState(() {}),
    );
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}

/// Rakip (veya eş) koltuğu: avatar, süre halkası, taş sayısı, açma durumu, tepki balonu.
class SeatChip extends StatelessWidget {
  const SeatChip({
    super.key,
    required this.controller,
    required this.seat,
    required this.size,
    this.horizontal = false,
  });

  final GameController controller;
  final int seat;

  /// Avatar çapı.
  final double size;

  /// Karşıdaki oyuncu için: avatar solda, bilgiler sağda (dikey yer kazandırır).
  final bool horizontal;

  @override
  Widget build(BuildContext context) {
    final s = controller.state!;
    final view = s.seats[seat];
    final hand = s.hand;
    final turn = s.phase == TablePhase.playing && hand?.turn.seat == seat;
    final opened = hand?.opened[seat];
    final reaction = controller.reactions[seat];
    final showReaction =
        reaction != null &&
        DateTime.now().difference(reaction.at) <
            GameController.reactionDuration;
    final partner =
        s.settings.partnership && s.you != null && (s.you! + 2) % 4 == seat;

    final avatar = Ticking(
      builder: (context) {
        final clock = clockFor(controller, seat);
        return SizedBox.square(
          dimension: size,
          child: CustomPaint(
            painter: _ClockRing(
              fraction: clock?.fraction,
              bank: clock?.bank ?? false,
              active: turn,
            ),
            child: Padding(
              padding: EdgeInsets.all(size * 0.1),
              child: CircleAvatar(
                backgroundColor: view?.bot == true
                    ? const Color(0xFF2A3A40)
                    : MasaColors.masa,
                child: Text(
                  view == null ? '?' : view.name.characters.first.toUpperCase(),
                  style: TextStyle(
                    fontSize: size * 0.36,
                    fontWeight: FontWeight.w700,
                    color: MasaColors.kirikBeyaz,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
    final name = ConstrainedBox(
      constraints: BoxConstraints(maxWidth: size * 2.6),
      child: Text(
        view?.name ?? 'Boş',
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12,
          fontWeight: turn ? FontWeight.w700 : FontWeight.w500,
          color: turn ? MasaColors.altin : MasaColors.kirikBeyaz,
        ),
      ),
    );
    final badges = ConstrainedBox(
      constraints: BoxConstraints(maxWidth: size * 2.8),
      child: Wrap(
        spacing: 3,
        runSpacing: 2,
        alignment: WrapAlignment.center,
        children: [
          if (hand != null) _Badge('${hand.counts[seat]} taş'),
          if (opened == 'sets') const _Badge('Açtı', color: MasaColors.turkuaz),
          if (opened == 'pairs')
            const _Badge('Çift', color: MasaColors.turkuaz),
          if (partner) const _Badge('Eşin', color: MasaColors.altin),
          if (view?.bot == true) const _Badge('BOT', color: Color(0xFF7D8B90)),
          if (view?.status == SeatStatus.offline)
            const _Badge('Bağlantı yok', color: MasaColors.hata),
          if (view?.status == SeatStatus.away)
            const _Badge('Uzakta', color: MasaColors.hata),
          if ((hand?.penalties[seat] ?? 0) > 0)
            _Badge('Ceza ${hand!.penalties[seat]}', color: MasaColors.hata),
        ],
      ),
    );

    final body = horizontal
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              avatar,
              const SizedBox(width: 6),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [name, const SizedBox(height: 2), badges],
              ),
            ],
          )
        : Column(
            mainAxisSize: MainAxisSize.min,
            children: [avatar, const SizedBox(height: 2), name, badges],
          );

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        body,
        if (showReaction)
          Positioned(
            top: horizontal ? size : null,
            bottom: horizontal ? null : size * 0.6,
            child: ReactionBubble(text: reactions[reaction.id] ?? reaction.id),
          ),
      ],
    );
  }
}

class ReactionBubble extends StatelessWidget {
  const ReactionBubble({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.5, end: 1),
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutBack,
      builder: (context, v, child) => Transform.scale(scale: v, child: child),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: MasaColors.kirikBeyaz,
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 6)],
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: MasaColors.zemin,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text, {this.color = const Color(0x33F4F0E8)});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final light = color.computeLuminance() > 0.3;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(
        color: color.withValues(alpha: color.a < 1 ? color.a : 0.9),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: light ? MasaColors.zemin : MasaColors.kirikBeyaz,
        ),
      ),
    );
  }
}

class _ClockRing extends CustomPainter {
  _ClockRing({
    required this.fraction,
    required this.bank,
    required this.active,
  });
  final double? fraction;
  final bool bank;
  final bool active;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final stroke = size.width * 0.07;
    final ring = rect.deflate(stroke / 2);
    canvas.drawArc(
      ring,
      0,
      2 * pi,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = active
            ? MasaColors.altin.withValues(alpha: 0.35)
            : Colors.white12,
    );
    if (fraction != null) {
      canvas.drawArc(
        ring,
        -pi / 2,
        2 * pi * fraction!,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = bank ? MasaColors.hata : MasaColors.turkuaz,
      );
    }
  }

  @override
  bool shouldRepaint(_ClockRing old) =>
      old.fraction != fraction || old.bank != bank || old.active != active;
}

enum PileRole { takeable, mine, other }

/// Bir oyuncunun attığı taşlar; en üstteki görünür.
class DiscardPile extends StatelessWidget {
  const DiscardPile({
    super.key,
    required this.controller,
    required this.seat,
    required this.role,
    required this.tileWidth,
  });

  final GameController controller;
  final int seat;
  final PileRole role;
  final double tileWidth;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final pile = c.hand?.discards[seat] ?? const [];
    final top = pile.isEmpty ? null : pile.last;
    final active = switch (role) {
      PileRole.takeable => c.canTakeDiscard,
      PileRole.mine => c.canPlay,
      PileRole.other => false,
    };

    Widget slot(bool highlight) => AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: tileWidth + 10,
      height: tileWidth * tileAspect + 10,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(tileWidth * 0.2),
        border: Border.all(
          color: highlight ? MasaColors.turkuaz : Colors.white24,
          width: highlight ? 2 : 1,
        ),
        color: highlight
            ? MasaColors.turkuaz.withValues(alpha: 0.15)
            : Colors.black12,
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        transitionBuilder: (child, anim) =>
            ScaleTransition(scale: anim, child: child),
        child: top == null
            ? (role == PileRole.mine
                  ? Icon(
                      Icons.south_east,
                      key: const ValueKey('bos'),
                      color: Colors.white38,
                      size: tileWidth * 0.6,
                    )
                  : const SizedBox.shrink(key: ValueKey('bos')))
            : TileFace(
                key: ValueKey(top.id),
                tile: top,
                width: tileWidth,
                okey: c.hand!.okey,
              ),
      ),
    );

    Widget pileWidget = Stack(
      clipBehavior: Clip.none,
      children: [
        slot(active),
        if (pile.length > 1)
          Positioned(
            right: -4,
            top: -4,
            child: CircleAvatar(
              radius: 8,
              backgroundColor: MasaColors.zemin,
              child: Text(
                '${pile.length}',
                style: const TextStyle(
                  fontSize: 9,
                  color: MasaColors.kirikBeyaz,
                ),
              ),
            ),
          ),
      ],
    );

    switch (role) {
      case PileRole.takeable:
        if (c.canTakeDiscard && top != null) {
          pileWidget = Draggable<DragPayload>(
            data: const DiscardDrag(),
            dragAnchorStrategy: pointerDragAnchorStrategy,
            feedback: dragFeedback(
              TileFace(tile: top, width: tileWidth * 1.2, okey: c.hand!.okey),
              tileWidth * 1.2,
            ),
            child: GestureDetector(onTap: c.takeDiscard, child: pileWidget),
          );
        }
      case PileRole.mine:
        final inner = pileWidget;
        pileWidget = DragTarget<DragPayload>(
          onWillAcceptWithDetails: (d) => d.data is RackTileDrag && c.canPlay,
          onAcceptWithDetails: (d) =>
              c.discard((d.data as RackTileDrag).tileId),
          builder: (context, candidates, _) => GestureDetector(
            // Seçili taşı atmak için yığına dokun.
            onTap: c.selectedTileId != null
                ? () => c.discard(c.selectedTileId!)
                : null,
            child: candidates.isNotEmpty ? slot(true) : inner,
          ),
        );
      case PileRole.other:
        break;
    }
    return pileWidget;
  }
}

/// Masadaki perler. Açmış oyuncu taşı bir pere sürükleyip işler veya okeyi alır.
class MeldArea extends StatelessWidget {
  const MeldArea({
    super.key,
    required this.controller,
    required this.tileWidth,
  });

  final GameController controller;
  final double tileWidth;

  @override
  Widget build(BuildContext context) {
    final melds = controller.hand?.melds ?? const <TableMeld>[];
    if (melds.isEmpty) return const SizedBox.expand();
    return SingleChildScrollView(
      padding: const EdgeInsets.all(4),
      child: Wrap(
        spacing: tileWidth * 0.5,
        runSpacing: tileWidth * 0.3,
        alignment: WrapAlignment.center,
        children: [
          for (final m in melds)
            _MeldView(controller: controller, meld: m, tileWidth: tileWidth),
        ],
      ),
    );
  }
}

class _MeldView extends StatefulWidget {
  const _MeldView({
    required this.controller,
    required this.meld,
    required this.tileWidth,
  });
  final GameController controller;
  final TableMeld meld;
  final double tileWidth;

  @override
  State<_MeldView> createState() => _MeldViewState();
}

class _MeldViewState extends State<_MeldView> {
  final _key = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final meld = widget.meld;
    final mine = meld.owner == c.state?.you;
    return DragTarget<DragPayload>(
      onWillAcceptWithDetails: (d) =>
          d.data is RackTileDrag &&
          c.canDropOnMeld((d.data as RackTileDrag).tileId, meld),
      onAcceptWithDetails: (d) {
        final box = _key.currentContext!.findRenderObject() as RenderBox;
        final local = box.globalToLocal(d.offset);
        final end = local.dx < box.size.width / 2
            ? LayOffEnd.start
            : LayOffEnd.end;
        c.dropOnMeld((d.data as RackTileDrag).tileId, meld, end);
      },
      builder: (context, candidates, _) => TweenAnimationBuilder<double>(
        key: ValueKey(meld.id),
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 300),
        builder: (context, v, child) => Opacity(opacity: v, child: child),
        child: AnimatedContainer(
          key: _key,
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            color: candidates.isNotEmpty
                ? MasaColors.turkuaz.withValues(alpha: 0.3)
                : Colors.black12,
            border: Border.all(
              color: candidates.isNotEmpty
                  ? MasaColors.turkuaz
                  : mine
                  ? MasaColors.turkuaz.withValues(alpha: 0.5)
                  : Colors.white10,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final t in meld.tiles)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 0.5),
                  child: TileFace(
                    tile: t,
                    width: widget.tileWidth,
                    okey: c.hand!.okey,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Masanın ortası: deste, gösterge, bilgi satırı.
class CenterInfo extends StatelessWidget {
  const CenterInfo({
    super.key,
    required this.controller,
    required this.tileWidth,
  });

  final GameController controller;
  final double tileWidth;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    final hand = c.hand;
    if (hand == null) return const SizedBox.shrink();

    Widget stock = Stack(
      clipBehavior: Clip.none,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(tileWidth * 0.2),
            border: Border.all(
              color: c.canDraw ? MasaColors.turkuaz : Colors.transparent,
              width: 2,
            ),
          ),
          child: TileBack(width: tileWidth),
        ),
        Positioned(
          right: -6,
          bottom: -6,
          child: CircleAvatar(
            radius: 10,
            backgroundColor: MasaColors.zemin,
            child: Text(
              '${hand.stock}',
              style: const TextStyle(
                fontSize: 10,
                color: MasaColors.kirikBeyaz,
              ),
            ),
          ),
        ),
      ],
    );
    if (c.canDraw) {
      stock = Draggable<DragPayload>(
        data: const StockDrag(),
        dragAnchorStrategy: pointerDragAnchorStrategy,
        feedback: dragFeedback(
          TileBack(width: tileWidth * 1.2),
          tileWidth * 1.2,
        ),
        child: GestureDetector(onTap: c.draw, child: stock),
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        stock,
        const SizedBox(width: 14),
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TileFace(tile: hand.indicator, width: tileWidth * 0.85),
            const Text(
              'Gösterge',
              style: TextStyle(fontSize: 9, color: Colors.white60),
            ),
          ],
        ),
        const SizedBox(width: 14),
        Flexible(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: Text(
              c.notice ?? '',
              key: ValueKey(c.noticeAt),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                color: MasaColors.kirikBeyaz,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
