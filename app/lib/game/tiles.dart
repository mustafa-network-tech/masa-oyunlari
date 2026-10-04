// Taşlar ve okey. Sunucudaki karşılığı: engine/src/okey101/tiles.ts

enum TileColor { red, yellow, blue, black }

TileColor parseColor(String name) => TileColor.values.byName(name);

class Identity {
  const Identity(this.color, this.number);

  factory Identity.fromJson(Map<String, Object?> json) =>
      Identity(parseColor(json['color'] as String), json['number'] as int);

  final TileColor color;
  final int number;

  @override
  bool operator ==(Object other) =>
      other is Identity && other.color == color && other.number == number;

  @override
  int get hashCode => Object.hash(color, number);

  @override
  String toString() => '${color.name} $number';
}

class Tile {
  const Tile(this.id, this.color, this.number, {this.fake = false});

  factory Tile.fromJson(Map<String, Object?> json) => Tile(
    json['id'] as int,
    parseColor(json['color'] as String),
    json['number'] as int,
    fake: json['fake'] as bool,
  );

  /// 0–105 arası benzersiz kimlik.
  final int id;
  final TileColor color;
  final int number;

  /// Sahte okey: okeyin rengini ve sayısını taşır, joker değildir.
  final bool fake;

  /// Gerçek okey mi (joker)?
  bool isJoker(Identity okey) =>
      !fake && color == okey.color && number == okey.number;

  /// Taşın oyundaki kimliği. Sahte okey, okeyin kimliğini alır.
  Identity identity(Identity okey) => fake ? okey : Identity(color, number);

  @override
  String toString() => fake ? 'sahte#$id' : '${color.name}$number#$id';
}

const tileCount = 106;

/// Sıralı tam deste: 2 kopya × 4 renk × 1–13 + 2 sahte okey. Sunucuyla aynı sıra (Adil Oyun doğrulaması için).
List<Tile> createTileSet() {
  final tiles = <Tile>[];
  var id = 0;
  for (var copy = 0; copy < 2; copy++) {
    for (final color in TileColor.values) {
      for (var number = 1; number <= 13; number++) {
        tiles.add(Tile(id++, color, number));
      }
    }
  }
  tiles.add(Tile(id++, TileColor.red, 0, fake: true));
  tiles.add(Tile(id++, TileColor.red, 0, fake: true));
  return tiles;
}
