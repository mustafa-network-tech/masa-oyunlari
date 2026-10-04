import 'dart:async';

import 'package:flutter/foundation.dart';

import '../net/game_connection.dart';
import '../net/protocol.dart';
import '../ui/sounds.dart';
import 'fairness.dart';
import 'melds.dart';
import 'rack.dart';
import 'table_state.dart';
import 'tiles.dart';

/// Masa ekranının durumu: sunucudan gelen görüntü + bu telefondaki ıstaka dizilimi.
/// Bütün kararlar sunucudadır; buradaki hesaplar yalnızca ekrandaki ipuçları içindir.
class GameController extends ChangeNotifier {
  GameController(this.connection, {this.sounds}) {
    connection.addListener(_onConnection);
    _subscription = connection.messages.listen(_onMessage);
    _onConnection();
  }

  final GameConnection connection;

  /// Testlerde null (ses çalınmaz).
  final Sounds? sounds;
  late final StreamSubscription<ServerMessage> _subscription;

  TableState? state;

  /// Görüntünün geldiği an; süre sayaçları buna göre hesaplanır.
  DateTime stateAt = DateTime.now();
  final rack = Rack();
  int? selectedTileId;

  /// Istaka çift diziliminde mi? (Çifte gidecek oyuncu için.)
  bool pairsMode = false;

  /// Bilgi satırı: son olay veya reddedilen hamlenin sebebi.
  String? notice;
  DateTime noticeAt = DateTime.now();

  /// Koltuk başına son tepki.
  final reactions = <int, ({String id, DateTime at})>{};

  /// Son elin Adil Oyun doğrulaması.
  FairnessCheck? fairness;

  TableSnapshot? _snapshot;
  int? _rackHand;
  int? _pendingDropSlot;
  final _dealt = <int, Set<int>>{};
  int? _verifiedHand;
  Timer? _reactionTimer;

  // ---------------------------------------------------------------------------
  // Sunucudan gelenler

  void _onConnection() {
    final snapshot = connection.room;
    if (identical(snapshot, _snapshot)) return;
    _snapshot = snapshot;
    if (snapshot == null) {
      // Bağlantı geçici koptuysa son görüntü kalır; masadan çıktıysak temizlenir.
      if (!connection.inTable) state = null;
      notifyListeners();
      return;
    }
    _apply(TableState.fromJson(snapshot.json));
  }

  void _apply(TableState next) {
    final hand = next.hand;
    if (hand != null) {
      if (_rackHand != hand.number) {
        rack.slots.fillRange(0, rack.slots.length, null);
        _rackHand = hand.number;
        pairsMode = false;
      }
      _captureDeal(next, hand);
      final before = rack.slots.whereType<int>().length;
      rack.sync([
        for (final t in hand.tiles) t.id,
      ], preferredSlot: hand.tiles.length > before ? _pendingDropSlot : null);
      if (hand.tiles.length > before) _pendingDropSlot = null;
      if (!hand.tiles.any((t) => t.id == selectedTileId)) selectedTileId = null;
    }
    final text = _eventsText(next);
    if (text != null) _setNotice(text);
    _playSounds(next);
    state = next;
    stateAt = DateTime.now();
    _verify(next);
    notifyListeners();
  }

  /// El dağıtıldığı anki taşlar (el sonunda dağıtımı doğrulamak için).
  void _captureDeal(TableState s, HandView hand) {
    if (_dealt.containsKey(hand.number)) return;
    final untouched =
        hand.turn.number == 1 &&
        hand.melds.isEmpty &&
        hand.discards.every((d) => d.isEmpty);
    if (untouched && s.you != null) {
      _dealt[hand.number] = {for (final t in hand.tiles) t.id};
    }
  }

  void _verify(TableState s) {
    final result = s.result;
    final hand = s.hand;
    if (result == null || hand == null || _verifiedHand == hand.number) return;
    _verifiedHand = hand.number;
    final f = result.fairness;
    fairness = verifyFairness(
      commit: f.commit,
      serverSeed: f.serverSeed,
      clientSeeds: f.clientSeeds,
      seed: f.seed,
      hand: hand.number,
      starter: hand.starter,
      indicatorId: hand.indicator.id,
      you: s.you,
      mySeed: connection.seeds[hand.number],
      myDealtTileIds: _dealt[hand.number],
    );
  }

  void _onMessage(ServerMessage msg) {
    switch (msg) {
      case Arrangement(:final mode, :final melds):
        final hand = state?.hand;
        if (hand == null) return;
        final used = {for (final m in melds) ...m};
        pairsMode = mode == 'pairs';
        rack.arrange(melds, [
          for (final t in hand.tiles)
            if (!used.contains(t.id)) t,
        ], pairs: pairsMode);
        notifyListeners();
      case ReactionMessage(:final seat, :final id):
        reactions[seat] = (id: id, at: DateTime.now());
        _reactionTimer?.cancel();
        _reactionTimer = Timer(reactionDuration, notifyListeners);
        notifyListeners();
      case ServerError(:final code, :final message, :final reason):
        // Eskimiş hamle (hızlı çift tıklama) sessizce yok sayılır.
        if (code == 'stale') return;
        _pendingDropSlot = null;
        _setNotice(actionErrors[reason] ?? message);
        notifyListeners();
      default:
        break;
    }
  }

  static const reactionDuration = Duration(seconds: 3);

  /// Motorun hamle hatalarının oyuncuya gösterilen karşılığı.
  static const actionErrors = {
    'handOver': 'El bitti',
    'notYourTurn': 'Sıra sende değil',
    'wrongPhase': 'Bu hamle şimdi yapılamaz',
    'noSuchTile': 'Taş bulunamadı',
    'noSuchMeld': 'Per bulunamadı',
    'duplicateTile': 'Aynı taş iki kez kullanılamaz',
    'invalidMeld': 'Geçersiz per var',
    'belowThreshold': 'Açmak için yeterli değil',
    'mixedOpening': 'Per ve çift birlikte açılamaz',
    'alreadyOpened': 'Zaten açtın',
    'notOpened': 'Önce açmalısın',
    'pairsOnly': 'Çifte gittin, yalnızca çift açabilirsin',
    'noPairsAfterSets': 'Perle açtın, çift açamazsın',
    'cannotLayOff': 'Bu taş o pere işlenmez',
    'cannotSwap': 'Okeyin yerine bu taş konamaz',
    'emptyDiscard': 'Yerde taş yok',
    'takeBlocked': 'Bu tur desteden çekmelisin',
    'noTakenTile': 'Yerden aldığın taş yok',
    'mustUseTakenTile': 'Yerden aldığın taşı kullanmalısın',
    'mustKeepOneTile': 'Elinde en az bir taş kalmalı',
  };

  void _setNotice(String text) {
    notice = text;
    noticeAt = DateTime.now();
  }

  String _name(TableState s, int seat) =>
      seat == s.you ? 'Sen' : s.seats[seat]?.name ?? 'Koltuk ${seat + 1}';

  /// Son olaylardan bilgi satırına yazılacak olan (çekme ve atma gibi sıradan olaylar yazılmaz).
  String? _eventsText(TableState s) {
    String? text;
    for (final e in s.events) {
      final seat = e['seat'] as int?;
      final who = seat == null ? '' : _name(s, seat);
      switch (e['type']) {
        case 'tookDiscard':
          text = '$who yerden taş aldı';
        case 'returnedTaken':
          text = '$who aldığı taşı geri koydu';
        case 'opened':
          text = e['kind'] == 'pairs'
              ? '$who çifte gitti'
              : '$who ${e['value']} ile açtı';
        case 'meldsAdded':
          text = '$who yeni per açtı';
        case 'laidOff':
          text = '$who taş işledi';
        case 'swappedOkey':
          text = '$who okeyi aldı';
        case 'penalty':
          text =
              '$who ${e['amount']} ceza: ${penaltyReasons[e['reason']] ?? ''}';
        case 'handOver':
          text = 'El bitti';
      }
    }
    return text;
  }

  void _playSounds(TableState s) {
    final sounds = this.sounds;
    if (sounds == null) return;
    Sound? sound;
    for (final e in s.events) {
      final next = switch (e['type']) {
        'drew' || 'tookDiscard' || 'discarded' || 'returnedTaken' => Sound.tas,
        'opened' || 'meldsAdded' || 'laidOff' || 'swappedOkey' => Sound.per,
        'penalty' => Sound.ceza,
        'handOver' => Sound.bitis,
        'turn' when e['seat'] == s.you => Sound.sira,
        _ => null,
      };
      // Aynı anda birden çok olay varsa en önemlisi çalar.
      if (next != null && (sound == null || next.index > sound.index)) {
        sound = next;
      }
    }
    if (sound != null) sounds.play(sound);
  }

  static const penaltyReasons = {
    'layOffableDiscard': 'işlek taş attı',
    'okeyDiscard': 'okey attı',
    'takenNotUsed': 'yerden aldığı taşı kullanamadı',
  };

  // ---------------------------------------------------------------------------
  // Ekran için hesaplar

  HandView? get hand => state?.hand;

  Map<int, Tile> get tilesById => {
    for (final t in hand?.tiles ?? <Tile>[]) t.id: t,
  };

  String? get myOpening {
    final s = state;
    return s?.you == null ? null : s?.hand?.opened[s.you!];
  }

  bool get isMyTurn => state?.isMyTurn ?? false;
  bool get canDraw => isMyTurn && hand!.turn.isDraw;
  bool get canPlay => isMyTurn && !hand!.turn.isDraw;

  /// Önceki oyuncunun (taşını alabildiğimiz) koltuğu.
  int? get previousSeat => state?.you == null ? null : (state!.you! + 3) % 4;

  bool get canTakeDiscard =>
      canDraw &&
      !hand!.turn.mustDrawFromStock &&
      hand!.discards[previousSeat!].isNotEmpty;

  /// Istaka grupları çift olarak mı değerlendirilir?
  bool get evaluatesPairs =>
      myOpening == 'pairs' || (myOpening == null && pairsMode);

  List<GroupEval> get groups {
    final h = hand;
    if (h == null) return const [];
    return evaluateGroups(rack, tilesById, h.okey, pairs: evaluatesPairs);
  }

  List<GroupMeld> get groupMelds => [for (final g in groups) ...g.melds];

  /// Açılmamışsa açma ipucu: değer veya çift sayısı ve eksik.
  ({int have, int need, bool pairs})? get openingProgress {
    final h = hand;
    if (h == null || state?.you == null || myOpening != null) return null;
    final melds = groupMelds;
    return evaluatesPairs
        ? (have: melds.length, need: h.requiredPairs, pairs: true)
        : (
            have: melds.fold(0, (sum, m) => sum + m.value),
            need: h.requiredPoints,
            pairs: false,
          );
  }

  bool get canOpen {
    final progress = openingProgress;
    return canPlay && progress != null && progress.have >= progress.need;
  }

  bool get canAddMelds => canPlay && myOpening != null && groupMelds.isNotEmpty;

  bool get hasTakenTile => canPlay && hand!.turn.takenTileId != null;

  /// Sürüklenen taş bu pere işlenebilir veya okeyle değiştirilebilir mi?
  bool canDropOnMeld(int tileId, TableMeld meld) {
    final h = hand;
    final tile = tilesById[tileId];
    if (h == null || tile == null || !canPlay || myOpening == null) {
      return false;
    }
    return layOff(meld.kind, meld.tiles, tile, h.okey) != null ||
        canSwapJoker(meld.kind, meld.tiles, tile, h.okey);
  }

  // ---------------------------------------------------------------------------
  // Hamleler

  void _act(Map<String, Object?> action) {
    final h = hand;
    if (h == null) return;
    connection.lastSeq++;
    connection.send(
      actMessage(connection.lastSeq, h.number, h.turn.number, action),
    );
  }

  void draw({int? toSlot}) {
    if (!canDraw) return;
    _pendingDropSlot = toSlot;
    _act({'type': 'draw'});
  }

  void takeDiscard({int? toSlot}) {
    if (!canTakeDiscard) return;
    _pendingDropSlot = toSlot;
    _act({'type': 'takeDiscard'});
  }

  void returnTaken() {
    if (hasTakenTile) _act({'type': 'returnTaken'});
  }

  void discard(int tileId) {
    if (!canPlay) return;
    selectedTileId = null;
    _act({'type': 'discard', 'tileId': tileId});
  }

  List<Map<String, Object?>> _meldPayload() => [
    for (final m in groupMelds)
      {
        'kind': m.kind.name,
        'tileIds': [for (final t in m.tiles) t.id],
      },
  ];

  void open() {
    if (canOpen) _act({'type': 'open', 'melds': _meldPayload()});
  }

  void addMelds() {
    if (canAddMelds) _act({'type': 'addMelds', 'melds': _meldPayload()});
  }

  /// Taşı masadaki pere bırakır: işlenebiliyorsa işler, olmuyorsa okeyle değiştirir.
  void dropOnMeld(int tileId, TableMeld meld, LayOffEnd end) {
    final h = hand;
    final tile = tilesById[tileId];
    if (h == null || tile == null) return;
    selectedTileId = null;
    final fitsEnd = layOff(meld.kind, meld.tiles, tile, h.okey, end) != null;
    final fitsAny = layOff(meld.kind, meld.tiles, tile, h.okey) != null;
    if (!fitsAny && canSwapJoker(meld.kind, meld.tiles, tile, h.okey)) {
      _act({'type': 'swapOkey', 'tileId': tileId, 'meldId': meld.id});
      return;
    }
    _act({
      'type': 'layOff',
      'tileId': tileId,
      'meldId': meld.id,
      // Seride uç önemli (okey iki uca da gidebilir): bırakılan tarafı dene.
      if (meld.kind == MeldKind.run && fitsEnd) 'end': end.name,
    });
  }

  void select(int tileId) {
    selectedTileId = selectedTileId == tileId ? null : tileId;
    notifyListeners();
  }

  void moveTile(int tileId, int slot) {
    rack.move(tileId, slot);
    notifyListeners();
  }

  void arrange(String mode) => connection.send(arrangeMessage(mode));

  void react(String id) => connection.send(reactMessage(id));

  void back() => connection.send(backMessage());

  void start() => connection.start();

  void leave() => connection.leave();

  @override
  void dispose() {
    connection.removeListener(_onConnection);
    _subscription.cancel();
    _reactionTimer?.cancel();
    super.dispose();
  }
}
