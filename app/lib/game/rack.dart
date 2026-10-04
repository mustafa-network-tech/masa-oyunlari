// Istaka: oyuncunun taşlarını dizdiği iki sıralı raf. Dizilim yalnızca bu telefonda tutulur.
//
// Boşlukla ayrılmış her taş grubu bir per adayıdır. "Aç" ve "Per aç" geçerli grupları sunucuya gönderir.

import 'melds.dart';
import 'tiles.dart';

class RackGroup {
  const RackGroup(this.row, this.start, this.ids);
  final int row;

  /// Grubun ilk taşının sütunu.
  final int start;
  final List<int> ids;
}

class Rack {
  Rack() : slots = List<int?>.filled(rows * columns, null);

  static const rows = 2;
  static const columns = 16;

  /// Satır satır yuva başına taş kimliği; boş yuva null.
  final List<int?> slots;

  int? slotOf(int id) {
    final i = slots.indexOf(id);
    return i < 0 ? null : i;
  }

  bool get isEmpty => slots.every((s) => s == null);

  /// Sunucudaki taşlarla eşitler: gidenleri çıkarır, yenileri yerleştirir.
  /// [preferredSlot] verilirse ilk yeni taş oraya konur (sürükleyip bırakılan çekilmiş taş).
  void sync(List<int> ids, {int? preferredSlot}) {
    final present = ids.toSet();
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] != null && !present.contains(slots[i])) slots[i] = null;
    }
    final wasEmpty = isEmpty;
    final placed = slots.whereType<int>().toSet();
    final incoming = ids.where((id) => !placed.contains(id)).toList();
    if (incoming.isEmpty) return;

    if (wasEmpty) {
      // Yeni el: iki sıraya eşit böl.
      final perRow = (incoming.length / rows).ceil().clamp(0, columns);
      for (var i = 0; i < incoming.length && i < slots.length; i++) {
        final row = i ~/ perRow;
        slots[row * columns + i % perRow] = incoming[i];
      }
      return;
    }

    for (final id in incoming) {
      if (preferredSlot != null) {
        _insert(id, preferredSlot);
        preferredSlot = null;
        continue;
      }
      // Son taşın yanına; yer yoksa ilk boş yuvaya.
      final last = slots.lastIndexWhere((s) => s != null);
      final after = last + 1 < slots.length && slots[last + 1] == null
          ? last + 1
          : null;
      _insert(id, after ?? slots.indexOf(null));
    }
  }

  /// Taşı başka bir yuvaya taşır. Yuva doluysa o sıradaki taşlar kayar.
  void move(int id, int to) {
    final from = slotOf(id);
    if (from == null || from == to || to < 0 || to >= slots.length) return;
    slots[from] = null;
    if (!_insert(id, to)) {
      // Sıra tamamen dolu: yer değiştir.
      slots[from] = slots[to];
      slots[to] = id;
    }
  }

  bool _insert(int id, int to) {
    if (to < 0) return false;
    if (slots[to] == null) {
      slots[to] = id;
      return true;
    }
    final rowStart = to - to % columns;
    final rowEnd = rowStart + columns;
    for (var e = to + 1; e < rowEnd; e++) {
      if (slots[e] != null) continue;
      for (var i = e; i > to; i--) {
        slots[i] = slots[i - 1];
      }
      slots[to] = id;
      return true;
    }
    for (var e = to - 1; e >= rowStart; e--) {
      if (slots[e] != null) continue;
      for (var i = e; i < to; i++) {
        slots[i] = slots[i + 1];
      }
      slots[to] = id;
      return true;
    }
    return false;
  }

  /// Boşlukla ayrılmış taş grupları.
  List<RackGroup> groups() {
    final result = <RackGroup>[];
    for (var row = 0; row < rows; row++) {
      List<int>? current;
      var start = 0;
      for (var col = 0; col <= columns; col++) {
        final id = col < columns ? slots[row * columns + col] : null;
        if (id != null) {
          if (current == null) {
            current = [];
            start = col;
          }
          current.add(id);
        } else if (current != null) {
          result.add(RackGroup(row, start, current));
          current = null;
        }
      }
    }
    return result;
  }

  /// Önerilen perleri aralarında boşlukla, kalan taşları renge ve sayıya göre sıralı dizer.
  /// Çiftler bitişik dizilir (her iki taş bir çifttir).
  void arrange(List<List<int>> melds, List<Tile> rest, {bool pairs = false}) {
    final sortedRest = [...rest]
      ..sort(
        (a, b) => a.color.index != b.color.index
            ? a.color.index - b.color.index
            : a.number - b.number,
      );
    final blocks = pairs
        ? [
            [for (final m in melds) ...m],
            [for (final t in sortedRest) t.id],
          ]
        : [
            ...melds,
            [for (final t in sortedRest) t.id],
          ];
    final layout =
        _layout(blocks.where((b) => b.isNotEmpty).toList(), gaps: true) ??
        _layout([
          [for (final b in blocks) ...b],
        ], gaps: false);
    if (layout == null) return;
    slots.setAll(0, layout);
  }

  /// Blokları satırlara yerleştirir; bir blok sığmazsa (çok uzun değilse) alt satıra geçer.
  static List<int?>? _layout(List<List<int>> blocks, {required bool gaps}) {
    final out = List<int?>.filled(rows * columns, null);
    var row = 0;
    var col = 0;
    for (final block in blocks) {
      var remaining = block;
      while (remaining.isNotEmpty) {
        if (row >= rows) return null;
        final space = columns - col;
        // Kısa blok satır sonuna sığmıyorsa bölmek yerine alt satıra geç.
        if (remaining.length > space &&
            remaining.length <= columns &&
            col > 0 &&
            row + 1 < rows) {
          row++;
          col = 0;
          continue;
        }
        final take = remaining.length < space ? remaining.length : space;
        for (var i = 0; i < take; i++) {
          out[row * columns + col + i] = remaining[i];
        }
        remaining = remaining.sublist(take);
        col += take;
        if (col >= columns || remaining.isNotEmpty) {
          row++;
          col = 0;
        }
      }
      if (gaps && col > 0) col++;
      if (col >= columns) {
        row++;
        col = 0;
      }
    }
    return out;
  }
}

class GroupMeld {
  const GroupMeld(this.kind, this.tiles, this.value);
  final MeldKind kind;

  /// Sunucuya gönderilecek sıra (seri için küçükten büyüğe).
  final List<Tile> tiles;
  final int value;
}

class GroupEval {
  const GroupEval(this.group, this.melds);
  final RackGroup group;

  /// Grubun oluşturduğu perler; geçersizse boş. Çift diziliminde bir grup birden çok çift olabilir.
  final List<GroupMeld> melds;

  bool get valid => melds.isNotEmpty;
}

/// Istakadaki grupları per olarak değerlendirir. [pairs] ise gruplar ikişer ikişer çift sayılır.
List<GroupEval> evaluateGroups(
  Rack rack,
  Map<int, Tile> tilesById,
  Identity okey, {
  required bool pairs,
}) {
  return [
    for (final group in rack.groups())
      GroupEval(group, _groupMelds(group, tilesById, okey, pairs)),
  ];
}

List<GroupMeld> _groupMelds(
  RackGroup group,
  Map<int, Tile> byId,
  Identity okey,
  bool pairs,
) {
  final tiles = [for (final id in group.ids) byId[id]]
      .whereType<Tile>()
      .toList();
  if (tiles.length != group.ids.length) return const [];
  if (pairs) {
    if (tiles.length.isOdd) return const [];
    final result = <GroupMeld>[];
    for (var i = 0; i < tiles.length; i += 2) {
      final pair = tiles.sublist(i, i + 2);
      final info = analyzeMeld(MeldKind.pair, pair, okey);
      if (info == null) return const [];
      result.add(GroupMeld(MeldKind.pair, pair, info.value));
    }
    return result;
  }
  if (tiles.length < 3) return const [];
  for (final candidate in [tiles, tiles.reversed.toList()]) {
    final info = analyzeMeld(MeldKind.run, candidate, okey);
    if (info != null) return [GroupMeld(MeldKind.run, candidate, info.value)];
  }
  final info = analyzeMeld(MeldKind.set, tiles, okey);
  return info == null ? const [] : [GroupMeld(MeldKind.set, tiles, info.value)];
}
