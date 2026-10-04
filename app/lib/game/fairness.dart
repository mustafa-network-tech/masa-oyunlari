// Adil Oyun doğrulaması. Sunucudaki karşılığı: engine/src/fairness.ts
//
// El bitince sunucu gizli tohumunu açıklar. Uygulama şunları kendisi kontrol eder:
// 1. Açıklanan tohum, el başında yayınlanan özetle tutuyor mu? (Sunucu tohumu sonradan değiştirmedi.)
// 2. Bu telefonun gönderdiği tohum karıştırmaya katıldı mı? (Sunucu sonucu önceden seçemedi.)
// 3. Tohumlardan üretilen dağıtım, ele gelen taşlarla aynı mı?

import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

import 'tiles.dart';

String _sha256Hex(String input) =>
    sha256.convert(utf8.encode(input)).toString();

String commitSeed(String serverSeed) => _sha256Hex('commit:$serverSeed');

String combineSeeds(String serverSeed, List<String> clientSeeds, int hand) =>
    _sha256Hex(['shuffle', serverSeed, ...clientSeeds, '$hand'].join(':'));

/// Tohumdan belirlenimci rastgele sayı üreteci (SHA-256 sayaç modu).
class SeededRandom {
  SeededRandom(this.seed);

  final String seed;
  int _counter = 0;
  Uint8List _buffer = Uint8List(0);
  int _offset = 0;

  int _nextUint32() {
    if (_offset + 4 > _buffer.length) {
      _buffer = Uint8List.fromList(
        sha256.convert(utf8.encode('$seed:${_counter++}')).bytes,
      );
      _offset = 0;
    }
    final value = ByteData.sublistView(_buffer).getUint32(_offset);
    _offset += 4;
    return value;
  }

  /// [0, n) aralığında eşit dağılımlı tam sayı (modulo sapması olmadan).
  int nextInt(int n) {
    const range = 0x100000000;
    final limit = (range ~/ n) * n;
    int x;
    do {
      x = _nextUint32();
    } while (x >= limit);
    return x % n;
  }
}

/// Fisher–Yates karıştırma.
List<T> shuffle<T>(List<T> items, String seed) {
  final result = [...items];
  final random = SeededRandom(seed);
  for (var i = result.length - 1; i > 0; i--) {
    final j = random.nextInt(i + 1);
    final tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/// Tohumdan dağıtım: gösterge ve koltuk başına taşlar (başlayan 22, diğerleri 21).
({Tile indicator, List<List<Tile>> hands}) dealFromSeed(
  String seed,
  int starter,
) {
  final deck = shuffle(createTileSet(), seed);
  var indicatorIndex = deck.length - 1;
  while (deck[indicatorIndex].fake) {
    indicatorIndex--;
  }
  final indicator = deck.removeAt(indicatorIndex);
  final hands = List.generate(4, (_) => <Tile>[]);
  var seat = starter;
  var offset = 0;
  for (var i = 0; i < 4; i++) {
    final count = seat == starter ? 22 : 21;
    hands[seat] = deck.sublist(offset, offset + count);
    offset += count;
    seat = (seat + 1) % 4;
  }
  return (indicator: indicator, hands: hands);
}

class FairnessCheck {
  const FairnessCheck({
    required this.commitMatches,
    required this.seedMatches,
    required this.mySeedIncluded,
    required this.dealMatches,
  });

  final bool commitMatches;
  final bool seedMatches;

  /// Telefonun tohumu karıştırmaya katıldı mı? Tohum gönderilmediyse null.
  final bool? mySeedIncluded;

  /// Dağıtım ele gelen taşlarla aynı mı? İlk dağıtım görülmediyse (sonradan bağlanma) null.
  final bool? dealMatches;

  bool get ok =>
      commitMatches &&
      seedMatches &&
      mySeedIncluded != false &&
      dealMatches != false;
}

FairnessCheck verifyFairness({
  required String commit,
  required String serverSeed,
  required List<String> clientSeeds,
  required String seed,
  required int hand,
  required int starter,
  required int indicatorId,
  int? you,
  String? mySeed,
  Set<int>? myDealtTileIds,
}) {
  final seedMatches = combineSeeds(serverSeed, clientSeeds, hand) == seed;
  bool? dealMatches;
  if (seedMatches) {
    final deal = dealFromSeed(seed, starter);
    dealMatches = deal.indicator.id == indicatorId;
    if (you != null && myDealtTileIds != null) {
      final dealt = deal.hands[you].map((t) => t.id).toSet();
      dealMatches =
          dealMatches &&
          dealt.length == myDealtTileIds.length &&
          dealt.containsAll(myDealtTileIds);
    }
  }
  return FairnessCheck(
    commitMatches: commitSeed(serverSeed) == commit,
    seedMatches: seedMatches,
    mySeedIncluded: you == null || mySeed == null
        ? null
        : clientSeeds[you] == mySeed,
    dealMatches: dealMatches,
  );
}
