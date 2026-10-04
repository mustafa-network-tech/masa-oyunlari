// Sunucunun gönderdiği masa görüntüsü. Sunucudaki karşılığı: server/src/view.ts

import 'melds.dart';
import 'tiles.dart';

typedef Json = Map<String, Object?>;

List<Tile> _tiles(Object? list) => [
  for (final t in list as List) Tile.fromJson(t as Json),
];

List<int> _ints(Object? list) => (list as List).cast<int>();

enum TablePhase { waiting, seeding, playing, handOver, finished }

enum SeatStatus { online, offline, away, bot }

class TableSettings {
  const TableSettings({
    required this.openingMode,
    required this.hands,
    required this.partnership,
    required this.unopenedPenalty,
    required this.speed,
  });

  factory TableSettings.fromJson(Json json) => TableSettings(
    openingMode: json['openingMode'] as String,
    hands: json['hands'] as int,
    partnership: json['partnership'] as bool,
    unopenedPenalty: json['unopenedPenalty'] as int,
    speed: json['speed'] as String,
  );

  /// fixed (sabit 101) veya rising (yükselen).
  final String openingMode;
  final int hands;
  final bool partnership;
  final int unopenedPenalty;

  /// fast, normal, relaxed
  final String speed;

  Json toJson() => {
    'openingMode': openingMode,
    'hands': hands,
    'partnership': partnership,
    'unopenedPenalty': unopenedPenalty,
    'speed': speed,
  };
}

class SeatView {
  const SeatView(this.name, this.bot, this.status);

  factory SeatView.fromJson(Json json) => SeatView(
    json['name'] as String,
    json['bot'] as bool,
    SeatStatus.values.byName(json['status'] as String),
  );

  final String name;
  final bool bot;
  final SeatStatus status;
}

class MatchView {
  const MatchView(this.hand, this.hands, this.totals, this.history);

  factory MatchView.fromJson(Json json) => MatchView(
    json['hand'] as int,
    json['hands'] as int,
    _ints(json['totals']),
    [for (final row in json['history'] as List) _ints(row)],
  );

  final int hand;
  final int hands;
  final List<int> totals;

  /// El başına koltukların puanı.
  final List<List<int>> history;
}

class TableMeld {
  const TableMeld(this.id, this.kind, this.owner, this.tiles);

  factory TableMeld.fromJson(Json json) => TableMeld(
    json['id'] as int,
    MeldKind.values.byName(json['kind'] as String),
    json['owner'] as int,
    _tiles(json['tiles']),
  );

  final int id;
  final MeldKind kind;
  final int owner;
  final List<Tile> tiles;
}

class TurnView {
  const TurnView(
    this.seat,
    this.number,
    this.phase,
    this.takenTileId,
    this.mustDrawFromStock,
  );

  factory TurnView.fromJson(Json json) => TurnView(
    json['seat'] as int,
    json['number'] as int,
    json['phase'] as String,
    json['takenTileId'] as int?,
    json['mustDrawFromStock'] as bool,
  );

  final int seat;
  final int number;

  /// draw (taş çekecek) veya play (açma, işleme, atma).
  final String phase;

  /// Yerden alınan ve bu tur kullanılması gereken taş.
  final int? takenTileId;
  final bool mustDrawFromStock;

  bool get isDraw => phase == 'draw';
}

class ClockView {
  const ClockView(this.seat, this.endsIn, this.moveLeft, this.banks);

  factory ClockView.fromJson(Json json) => ClockView(
    json['seat'] as int,
    json['endsIn'] as int?,
    json['moveLeft'] as int?,
    _ints(json['banks']),
  );

  final int seat;

  /// Sıranın bitmesine kalan süre (ms), zaman bankası dahil. Bot oynuyorsa null.
  final int? endsIn;

  /// Hamle süresinden kalan (ms); 0 ise zaman bankası harcanıyor.
  final int? moveLeft;
  final List<int> banks;
}

class HandView {
  const HandView({
    required this.number,
    required this.starter,
    required this.indicator,
    required this.okey,
    required this.stock,
    required this.tiles,
    required this.counts,
    required this.discards,
    required this.melds,
    required this.opened,
    required this.penalties,
    required this.requiredPoints,
    required this.requiredPairs,
    required this.turn,
    required this.clock,
  });

  factory HandView.fromJson(Json json) {
    final requirement = json['requirement'] as Json;
    return HandView(
      number: json['number'] as int,
      starter: json['starter'] as int,
      indicator: Tile.fromJson(json['indicator'] as Json),
      okey: Identity.fromJson(json['okey'] as Json),
      stock: json['stock'] as int,
      tiles: _tiles(json['tiles']),
      counts: _ints(json['counts']),
      discards: [for (final pile in json['discards'] as List) _tiles(pile)],
      melds: [
        for (final m in json['melds'] as List) TableMeld.fromJson(m as Json),
      ],
      opened: (json['opened'] as List).cast<String?>(),
      penalties: _ints(json['penalties']),
      requiredPoints: requirement['points'] as int,
      requiredPairs: requirement['pairs'] as int,
      turn: TurnView.fromJson(json['turn'] as Json),
      clock: json['clock'] == null
          ? null
          : ClockView.fromJson(json['clock'] as Json),
    );
  }

  final int number;
  final int starter;
  final Tile indicator;
  final Identity okey;
  final int stock;

  /// Bu oyuncunun taşları.
  final List<Tile> tiles;
  final List<int> counts;

  /// Koltuk başına atılan taşlar; listenin sonu en üstteki taş.
  final List<List<Tile>> discards;
  final List<TableMeld> melds;

  /// Koltuk başına açma türü: sets, pairs veya null (açmadı).
  final List<String?> opened;
  final List<int> penalties;
  final int requiredPoints;
  final int requiredPairs;
  final TurnView turn;
  final ClockView? clock;
}

class ScoreRow {
  const ScoreRow(this.seat, this.base, this.penalties, this.total);

  factory ScoreRow.fromJson(Json json) => ScoreRow(
    json['seat'] as int,
    json['base'] as int,
    json['penalties'] as int,
    json['total'] as int,
  );

  final int seat;
  final int base;
  final int penalties;
  final int total;
}

class FairnessInfo {
  const FairnessInfo(this.commit, this.serverSeed, this.clientSeeds, this.seed);

  factory FairnessInfo.fromJson(Json json) => FairnessInfo(
    json['commit'] as String,
    json['serverSeed'] as String,
    (json['clientSeeds'] as List).cast<String>(),
    json['seed'] as String,
  );

  final String commit;
  final String serverSeed;
  final List<String> clientSeeds;
  final String seed;
}

class HandResultView {
  const HandResultView({
    required this.finisher,
    required this.okeyFinish,
    required this.elden,
    required this.pairsFinish,
    required this.multiplier,
    required this.rows,
    required this.hands,
    required this.fairness,
  });

  factory HandResultView.fromJson(Json json) {
    final finish = json['finish'] as Json;
    return HandResultView(
      finisher: json['finisher'] as int?,
      okeyFinish: finish['okey'] as bool,
      elden: finish['elden'] as bool,
      pairsFinish: finish['pairs'] as bool,
      multiplier: finish['multiplier'] as int,
      rows: [
        for (final r in json['rows'] as List) ScoreRow.fromJson(r as Json),
      ],
      hands: [for (final h in json['hands'] as List) _tiles(h)],
      fairness: FairnessInfo.fromJson(json['fairness'] as Json),
    );
  }

  /// Biten oyuncu; deste bittiyse null.
  final int? finisher;
  final bool okeyFinish;
  final bool elden;
  final bool pairsFinish;
  final int multiplier;
  final List<ScoreRow> rows;

  /// El sonunda bütün eller açılır.
  final List<List<Tile>> hands;
  final FairnessInfo fairness;
}

class TableState {
  const TableState({
    required this.room,
    required this.phase,
    required this.settings,
    required this.host,
    required this.you,
    required this.seats,
    required this.match,
    required this.seedingHand,
    required this.commit,
    required this.hand,
    required this.result,
    required this.events,
  });

  factory TableState.fromJson(Json json) {
    final seeding = json['seeding'] as Json?;
    return TableState(
      room: json['room'] as String,
      phase: TablePhase.values.byName(json['phase'] as String),
      settings: TableSettings.fromJson(json['settings'] as Json),
      host: json['host'] as int?,
      you: json['you'] as int?,
      seats: [
        for (final s in json['seats'] as List)
          s == null ? null : SeatView.fromJson(s as Json),
      ],
      match: json['match'] == null
          ? null
          : MatchView.fromJson(json['match'] as Json),
      seedingHand: seeding?['hand'] as int?,
      commit: seeding?['commit'] as String?,
      hand: json['hand'] == null
          ? null
          : HandView.fromJson(json['hand'] as Json),
      result: json['result'] == null
          ? null
          : HandResultView.fromJson(json['result'] as Json),
      events: (json['events'] as List).cast<Json>(),
    );
  }

  final String room;
  final TablePhase phase;
  final TableSettings settings;
  final int? host;
  final int? you;
  final List<SeatView?> seats;
  final MatchView? match;

  /// Adil Oyun: tohum beklenen el ve sunucu tohumunun özeti.
  final int? seedingHand;
  final String? commit;
  final HandView? hand;
  final HandResultView? result;

  /// Son görüntüden bu yana olanlar (animasyon ve bilgi satırı için).
  final List<Json> events;

  bool get isMyTurn =>
      phase == TablePhase.playing && hand != null && hand!.turn.seat == you;
}
