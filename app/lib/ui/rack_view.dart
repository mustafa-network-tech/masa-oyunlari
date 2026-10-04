import 'package:flutter/material.dart';

import '../game/game_controller.dart';
import '../game/rack.dart';
import '../theme.dart';
import 'tile_widget.dart';

/// Sürüklenen şey: ıstakadaki bir taş, desteden çekilecek taş veya yerden alınacak taş.
sealed class DragPayload {
  const DragPayload();
}

class RackTileDrag extends DragPayload {
  const RackTileDrag(this.tileId);
  final int tileId;
}

class StockDrag extends DragPayload {
  const StockDrag();
}

class DiscardDrag extends DragPayload {
  const DiscardDrag();
}

/// Sürüklenen taş parmağın biraz üstünde görünür; parmak taşı kapatmaz.
Widget dragFeedback(Widget tile, double width) => Transform.translate(
  offset: Offset(-width / 2, -width * tileAspect * 0.9),
  child: Opacity(opacity: 0.92, child: tile),
);

class RackView extends StatefulWidget {
  const RackView({super.key, required this.controller});

  final GameController controller;

  /// Verilen genişlikte ıstakanın yüksekliği.
  static double heightFor(double width) {
    final slot = width / Rack.columns;
    return Rack.rows * _rowHeight(slot * _tileRatio) + _padding * 2;
  }

  /// Verilen yüksekliğe sığan en geniş ıstaka.
  static double widthFor(double height) =>
      (height - _padding * 2) /
      Rack.rows /
      (_tileRatio * tileAspect * 1.2) *
      Rack.columns;

  static const _tileRatio = 0.92;
  static const _padding = 6.0;
  static double _rowHeight(double tileWidth) => tileWidth * tileAspect * 1.2;

  @override
  State<RackView> createState() => _RackViewState();
}

class _RackViewState extends State<RackView> {
  final _key = GlobalKey();
  int? _hoverSlot;

  GameController get c => widget.controller;

  int _slotAt(Offset global, double slotWidth, double rowHeight) {
    final box = _key.currentContext!.findRenderObject() as RenderBox;
    final local =
        box.globalToLocal(global) -
        const Offset(RackView._padding, RackView._padding);
    final col = (local.dx / slotWidth).floor().clamp(0, Rack.columns - 1);
    final row = (local.dy / rowHeight).floor().clamp(0, Rack.rows - 1);
    return row * Rack.columns + col;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final inner = constraints.maxWidth - RackView._padding * 2;
        final slotW = inner / Rack.columns;
        final tileW = slotW * RackView._tileRatio;
        final tileH = tileW * tileAspect;
        final rowH = RackView._rowHeight(tileW);
        final hand = c.hand;
        final byId = c.tilesById;
        final groups = c.groups;

        Offset slotOffset(int slot) => Offset(
          (slot % Rack.columns) * slotW + (slotW - tileW) / 2,
          (slot ~/ Rack.columns) * rowH + (rowH - tileH) * 0.35,
        );

        return DragTarget<DragPayload>(
          onWillAcceptWithDetails: (d) => switch (d.data) {
            RackTileDrag() => true,
            StockDrag() => c.canDraw,
            DiscardDrag() => c.canTakeDiscard,
          },
          onMove: (d) {
            final slot = _slotAt(d.offset, slotW, rowH);
            if (slot != _hoverSlot) setState(() => _hoverSlot = slot);
          },
          onLeave: (_) => setState(() => _hoverSlot = null),
          onAcceptWithDetails: (d) {
            final slot = _slotAt(d.offset, slotW, rowH);
            setState(() => _hoverSlot = null);
            switch (d.data) {
              case RackTileDrag(:final tileId):
                c.moveTile(tileId, slot);
              case StockDrag():
                c.draw(toSlot: slot);
              case DiscardDrag():
                c.takeDiscard(toSlot: slot);
            }
          },
          builder: (context, candidates, rejected) => Container(
            key: _key,
            padding: const EdgeInsets.all(RackView._padding),
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(14),
              ),
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF1E3A3E), Color(0xFF0D2125)],
              ),
              border: Border(
                top: BorderSide(
                  color: MasaColors.altin.withValues(alpha: 0.5),
                  width: 1.5,
                ),
              ),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Raf çizgileri.
                for (var row = 0; row < Rack.rows; row++)
                  Positioned(
                    left: 0,
                    right: 0,
                    top: row * rowH + (rowH - tileH) * 0.35 + tileH + 1,
                    height: rowH * 0.1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(3),
                        border: Border(
                          top: BorderSide(
                            color: MasaColors.altin.withValues(alpha: 0.25),
                          ),
                        ),
                      ),
                    ),
                  ),
                // Geçerli per gruplarının altı turkuaz çizilir, değeri yazılır.
                for (final g in groups)
                  if (g.valid)
                    Positioned(
                      left: g.group.start * slotW + 2,
                      width: g.group.ids.length * slotW - 4,
                      top:
                          g.group.row * rowH +
                          (rowH - tileH) * 0.35 +
                          tileH +
                          1,
                      height: rowH * 0.1,
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: MasaColors.turkuaz.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: c.evaluatesPairs
                            ? null
                            : FittedBox(
                                child: Text(
                                  '${g.melds.fold(0, (s, m) => s + m.value)}',
                                  style: const TextStyle(
                                    color: MasaColors.zemin,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                      ),
                    ),
                if (_hoverSlot != null)
                  Positioned(
                    left: slotOffset(_hoverSlot!).dx - 2,
                    top: slotOffset(_hoverSlot!).dy - 2,
                    width: tileW + 4,
                    height: tileH + 4,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(tileW * 0.15),
                        border: Border.all(color: MasaColors.turkuaz, width: 2),
                        color: MasaColors.turkuaz.withValues(alpha: 0.15),
                      ),
                    ),
                  ),
                if (hand != null)
                  for (var slot = 0; slot < c.rack.slots.length; slot++)
                    if (c.rack.slots[slot] case final id? when byId[id] != null)
                      _positionedTile(id, slotOffset(slot), tileW, tileH),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _positionedTile(int id, Offset at, double tileW, double tileH) {
    final tile = c.tilesById[id]!;
    final selected = c.selectedTileId == id;
    final taken = c.hand!.turn.takenTileId == id && c.isMyTurn;
    final face = TileFace(
      tile: tile,
      width: tileW,
      okey: c.hand!.okey,
      selected: selected || taken,
    );
    return AnimatedPositioned(
      key: ValueKey(id),
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      left: at.dx,
      top: at.dy - (selected ? tileH * 0.14 : 0),
      child: TweenAnimationBuilder<double>(
        // Yeni gelen taş büyüyerek belirir.
        tween: Tween(begin: 0.6, end: 1),
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutBack,
        builder: (context, scale, child) =>
            Transform.scale(scale: scale, child: child),
        child: Draggable<DragPayload>(
          data: RackTileDrag(id),
          dragAnchorStrategy: pointerDragAnchorStrategy,
          feedback: dragFeedback(
            TileFace(
              tile: tile,
              width: tileW * 1.1,
              okey: c.hand!.okey,
              selected: true,
            ),
            tileW * 1.1,
          ),
          childWhenDragging: Opacity(opacity: 0.25, child: face),
          child: GestureDetector(onTap: () => c.select(id), child: face),
        ),
      ),
    );
  }
}
