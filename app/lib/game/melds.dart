// Per doğrulama. Sunucudaki karşılığı: engine/src/okey101/melds.ts
//
// Karar her zaman sunucunundur; istemci bunu yalnızca ekranda ipucu göstermek için kullanır
// (ıstakadaki grubun değeri, "açman için 23 puan daha lazım", taş bu pere işlenir mi).

import 'tiles.dart';

enum MeldKind { run, set, pair }

class MeldInfo {
  const MeldInfo(this.kind, this.value);
  final MeldKind kind;

  /// Açma değeri (jokerler yerine geçtikleri taşın değerini alır).
  final int value;
}

/// Taşlar perin sırasıyla verilir (seri için küçükten büyüğe). Geçersizse null.
MeldInfo? analyzeMeld(MeldKind kind, List<Tile> tiles, Identity okey) {
  if (tiles.map((t) => t.id).toSet().length != tiles.length) return null;
  return switch (kind) {
    MeldKind.run => _analyzeRun(tiles, okey),
    MeldKind.set => _analyzeSet(tiles, okey),
    MeldKind.pair => _analyzePair(tiles, okey),
  };
}

MeldInfo? _analyzeRun(List<Tile> tiles, Identity okey) {
  if (tiles.length < 3 || tiles.length > 13) return null;
  TileColor? color;
  int? start;
  for (var i = 0; i < tiles.length; i++) {
    final tile = tiles[i];
    if (tile.isJoker(okey)) continue;
    final id = tile.identity(okey);
    color ??= id.color;
    start ??= id.number - i;
    if (id.color != color || id.number != start + i) return null;
  }
  if (color == null || start == null) return null;
  final end = start + tiles.length - 1;
  // Seriler 1'den başlayıp 13'te biter; 12-13-1 gibi dönen seriler geçersiz.
  if (start < 1 || end > 13) return null;
  var value = 0;
  for (var n = start; n <= end; n++) {
    value += n;
  }
  return MeldInfo(MeldKind.run, value);
}

MeldInfo? _analyzeSet(List<Tile> tiles, Identity okey) {
  if (tiles.length < 3 || tiles.length > 4) return null;
  int? number;
  final colors = <TileColor>{};
  for (final tile in tiles) {
    if (tile.isJoker(okey)) continue;
    final id = tile.identity(okey);
    number ??= id.number;
    if (id.number != number || !colors.add(id.color)) return null;
  }
  if (number == null) return null;
  return MeldInfo(MeldKind.set, number * tiles.length);
}

MeldInfo? _analyzePair(List<Tile> tiles, Identity okey) {
  if (tiles.length != 2) return null;
  final [a, b] = tiles;
  final ja = a.isJoker(okey);
  final jb = b.isJoker(okey);
  if (ja && jb) return const MeldInfo(MeldKind.pair, 0);
  final real = ja ? b : a;
  final id = real.identity(okey);
  if (!ja && !jb && b.identity(okey) != id) return null;
  return MeldInfo(MeldKind.pair, id.number * 2);
}

enum LayOffEnd { start, end }

/// Taşın bu pere işlenmesi sonucu oluşacak yeni dizi; işlenemiyorsa null.
List<Tile>? layOff(
  MeldKind kind,
  List<Tile> meld,
  Tile tile,
  Identity okey, [
  LayOffEnd? end,
]) {
  if (kind == MeldKind.pair) return null;
  if (kind == MeldKind.set) {
    final next = [...meld, tile];
    return analyzeMeld(MeldKind.set, next, okey) != null ? next : null;
  }
  List<Tile>? tryEnd(LayOffEnd side) {
    final next = side == LayOffEnd.start ? [tile, ...meld] : [...meld, tile];
    return analyzeMeld(MeldKind.run, next, okey) != null ? next : null;
  }

  if (end != null) return tryEnd(end);
  return tryEnd(LayOffEnd.end) ?? tryEnd(LayOffEnd.start);
}

/// Perdeki jokerin yerine gerçek taş konabilir mi?
bool canSwapJoker(MeldKind kind, List<Tile> meld, Tile tile, Identity okey) {
  if (tile.isJoker(okey)) return false;
  for (var i = 0; i < meld.length; i++) {
    if (!meld[i].isJoker(okey)) continue;
    final next = [...meld]..[i] = tile;
    if (analyzeMeld(kind, next, okey) != null) return true;
  }
  return false;
}
