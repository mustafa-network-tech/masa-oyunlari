import 'dart:math';

import 'package:flutter/material.dart';

import '../game/tiles.dart';
import '../theme.dart';

/// Taş rengi → yazı rengi. Sarı, kırık beyaz zeminde okunsun diye hardal tonunda.
const tileInk = {
  TileColor.red: Color(0xFFD03A35),
  TileColor.yellow: Color(0xFFC4860A),
  TileColor.blue: Color(0xFF1D6FB5),
  TileColor.black: Color(0xFF1F2429),
};

/// Taş en/boy oranı.
const tileAspect = 1.38;

/// Ön yüzü açık taş. [okey] verilirse gerçek okey köşesinde altın yıldızla işaretlenir.
class TileFace extends StatelessWidget {
  const TileFace({
    super.key,
    required this.tile,
    required this.width,
    this.okey,
    this.selected = false,
    this.dimmed = false,
  });

  final Tile tile;
  final double width;
  final Identity? okey;
  final bool selected;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final height = width * tileAspect;
    final radius = width * 0.13;
    final joker = okey != null && tile.isJoker(okey!);
    final ink = tileInk[tile.color]!;

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFBF8F2), MasaColors.kirikBeyaz, Color(0xFFE4DDD0)],
        ),
        border: Border.all(
          color: selected ? MasaColors.turkuaz : const Color(0xFFCFC6B6),
          width: selected ? max(2, width * 0.06) : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            offset: Offset(0, width * 0.06),
            blurRadius: width * 0.08,
          ),
        ],
      ),
      foregroundDecoration: dimmed
          ? BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(radius),
            )
          : null,
      child: tile.fake
          ? Padding(
              padding: EdgeInsets.all(width * 0.14),
              child: CustomPaint(
                painter: CiniStarPainter(
                  color: MasaColors.turkuaz,
                  accent: MasaColors.altin,
                ),
              ),
            )
          : Stack(
              children: [
                Align(
                  alignment: const Alignment(0, -0.35),
                  child: Text(
                    '${tile.number}',
                    style: TextStyle(
                      color: ink,
                      fontSize: width * 0.56,
                      fontWeight: FontWeight.w800,
                      height: 1,
                      decoration: TextDecoration.none,
                    ),
                  ),
                ),
                // Küçük çini damlası: renk körleri için de renk ipucu.
                Align(
                  alignment: const Alignment(0, 0.62),
                  child: Container(
                    width: width * 0.2,
                    height: width * 0.2,
                    decoration: BoxDecoration(
                      color: ink,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                if (joker)
                  Positioned(
                    top: width * 0.05,
                    right: width * 0.05,
                    child: Icon(
                      Icons.star_rounded,
                      size: width * 0.3,
                      color: MasaColors.altin,
                    ),
                  ),
              ],
            ),
    );
  }
}

/// Taşın arka yüzü: turkuaz zemin üzerinde çini yıldızı.
class TileBack extends StatelessWidget {
  const TileBack({super.key, required this.width});

  final double width;

  @override
  Widget build(BuildContext context) {
    final radius = width * 0.13;
    return Container(
      width: width,
      height: width * tileAspect,
      padding: EdgeInsets.all(width * 0.16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1FB8B0), Color(0xFF13807B)],
        ),
        border: Border.all(color: const Color(0xFF0E6763)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            offset: Offset(0, width * 0.06),
            blurRadius: width * 0.08,
          ),
        ],
      ),
      child: CustomPaint(
        painter: CiniStarPainter(
          color: MasaColors.kirikBeyaz.withValues(alpha: 0.85),
          accent: MasaColors.altin,
        ),
      ),
    );
  }
}

/// Sekiz köşeli çini yıldızı: iç içe iki kare ve ortada bir göbek.
class CiniStarPainter extends CustomPainter {
  const CiniStarPainter({required this.color, required this.accent});

  final Color color;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final r = min(size.width, size.height) / 2;
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = max(1, r * 0.12)
      ..strokeJoin = StrokeJoin.round;

    for (final angle in [0.0, pi / 4]) {
      final path = Path();
      for (var i = 0; i < 4; i++) {
        final a = angle + i * pi / 2 + pi / 4;
        final p = center + Offset(cos(a), sin(a)) * r;
        i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
      }
      path.close();
      canvas.drawPath(path, stroke);
    }
    canvas.drawCircle(center, r * 0.28, Paint()..color = accent);
  }

  @override
  bool shouldRepaint(CiniStarPainter old) =>
      old.color != color || old.accent != accent;
}
