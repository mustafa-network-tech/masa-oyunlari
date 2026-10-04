import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masa/game/fairness.dart';
import 'package:masa/game/melds.dart';
import 'package:masa/game/rack.dart';
import 'package:masa/game/table_state.dart';
import 'package:masa/game/tiles.dart';

Map<String, Object?> fixture(String name) =>
    jsonDecode(File('test/fixtures/$name').readAsStringSync())
        as Map<String, Object?>;

const okey = Identity(TileColor.blue, 5);
var _id = 200;
Tile t(TileColor c, int n) => Tile(_id++, c, n);
Tile joker() => t(TileColor.blue, 5);
const r = TileColor.red, y = TileColor.yellow, k = TileColor.black;

void main() {
  group('per doğrulama (sunucuyla aynı kurallar)', () {
    test('seri, küt ve çift değerleri', () {
      expect(
        analyzeMeld(MeldKind.run, [t(r, 3), t(r, 4), t(r, 5)], okey)?.value,
        12,
      );
      expect(
        analyzeMeld(MeldKind.set, [t(r, 9), t(y, 9), t(k, 9)], okey)?.value,
        27,
      );
      expect(analyzeMeld(MeldKind.pair, [t(r, 7), t(r, 7)], okey)?.value, 14);
    });

    test('okey eksik taşın yerine geçer, değeri o taşın değeridir', () {
      expect(
        analyzeMeld(MeldKind.run, [t(r, 11), joker(), t(r, 13)], okey)?.value,
        36,
      );
      expect(
        analyzeMeld(MeldKind.set, [t(r, 4), t(y, 4), joker()], okey)?.value,
        12,
      );
    });

    test('dönen seri, aynı renkli küt ve karışık seri geçersiz', () {
      expect(
        analyzeMeld(MeldKind.run, [t(r, 12), t(r, 13), t(r, 1)], okey),
        isNull,
      );
      expect(
        analyzeMeld(MeldKind.set, [t(r, 4), t(r, 4), t(y, 4)], okey),
        isNull,
      );
      expect(
        analyzeMeld(MeldKind.run, [t(r, 3), t(y, 4), t(r, 5)], okey),
        isNull,
      );
    });

    test('sahte okey okeyin kimliğini alır', () {
      final fake = Tile(105, r, 0, fake: true);
      expect(
        analyzeMeld(MeldKind.run, [
          t(TileColor.blue, 4),
          fake,
          t(TileColor.blue, 6),
        ], okey)?.value,
        15,
      );
    });

    test('işleme ve okey değiştirme', () {
      final run = [t(r, 5), t(r, 6), t(r, 7)];
      expect(layOff(MeldKind.run, run, t(r, 8), okey), isNotNull);
      expect(
        layOff(MeldKind.run, run, t(r, 4), okey, LayOffEnd.start),
        isNotNull,
      );
      expect(layOff(MeldKind.run, run, t(r, 10), okey), isNull);
      final withJoker = [t(r, 5), joker(), t(r, 7)];
      expect(canSwapJoker(MeldKind.run, withJoker, t(r, 6), okey), isTrue);
      expect(canSwapJoker(MeldKind.run, withJoker, t(y, 6), okey), isFalse);
    });
  });

  group('Adil Oyun', () {
    test('sunucuyla aynı tohumdan aynı deste ve dağıtım çıkar', () {
      final f = fixture('fairness.json');
      final serverSeed = f['serverSeed'] as String;
      final clientSeeds = (f['clientSeeds'] as List).cast<String>();
      expect(commitSeed(serverSeed), f['commit']);
      expect(
        combineSeeds(serverSeed, clientSeeds, f['hand'] as int),
        f['seed'],
      );

      final deck = shuffle(createTileSet(), f['seed'] as String);
      expect([for (final t in deck) t.id], f['deck']);

      final deal = dealFromSeed(f['seed'] as String, f['starter'] as int);
      expect(deal.indicator.id, f['indicator']);
      expect([
        for (final h in deal.hands) [for (final t in h) t.id],
      ], f['hands']);
    });

    test('doğrulama: tohum değiştirilmişse veya el farklıysa yakalanır', () {
      final f = fixture('fairness.json');
      final hands = (f['hands'] as List).cast<List>();
      FairnessCheck check({String? serverSeed, Set<int>? dealt}) =>
          verifyFairness(
            commit: f['commit'] as String,
            serverSeed: serverSeed ?? f['serverSeed'] as String,
            clientSeeds: (f['clientSeeds'] as List).cast<String>(),
            seed: f['seed'] as String,
            hand: f['hand'] as int,
            starter: f['starter'] as int,
            indicatorId: f['indicator'] as int,
            you: 0,
            mySeed: '01' * 32,
            myDealtTileIds: dealt ?? hands[0].cast<int>().toSet(),
          );
      expect(check().ok, isTrue);
      expect(check(serverSeed: 'cd' * 32).ok, isFalse);
      expect(check(dealt: {...hands[0].cast<int>().skip(1), 999}).ok, isFalse);
    });
  });

  group('ıstaka', () {
    test('yeni el iki sıraya bölünür, gelen taş sona eklenir, giden çıkar', () {
      final rack = Rack()..sync(List.generate(21, (i) => i));
      expect(rack.slots.sublist(0, 11), List.generate(11, (i) => i));
      expect(rack.slots.sublist(16, 26), List.generate(10, (i) => i + 11));
      rack.sync([...List.generate(21, (i) => i), 50]);
      expect(rack.slotOf(50), 26);
      rack.sync(List.generate(21, (i) => i + 1)..add(50));
      expect(rack.slotOf(0), isNull);
    });

    test('dolu yuvaya bırakılan taş araya girer, sıradakiler kayar', () {
      final rack = Rack()..sync([1, 2, 3, 4]);
      // 4 taş: üst sıra 1,2 ; alt sıra 3,4
      rack.move(4, 0);
      expect(rack.slots.sublist(0, 3), [4, 1, 2]);
    });

    test('sürüklenip bırakılan çekilmiş taş istenen yuvaya konur', () {
      final rack = Rack()..sync([1, 2, 3]);
      rack.sync([1, 2, 3, 9], preferredSlot: 10);
      expect(rack.slotOf(9), 10);
    });

    test('boşlukla ayrılan gruplar per olarak değerlendirilir', () {
      final tiles = [
        t(r, 3),
        t(r, 4),
        t(r, 5),
        t(k, 9),
        t(y, 9),
        t(r, 9),
        t(k, 1),
      ];
      final byId = {for (final x in tiles) x.id: x};
      final rack = Rack();
      final layout = [0, 1, 2, null, 3, 4, 5, null, 6];
      for (var i = 0; i < layout.length; i++) {
        rack.slots[i] = layout[i] == null ? null : tiles[layout[i]!].id;
      }
      final groups = evaluateGroups(rack, byId, okey, pairs: false);
      expect(groups.map((g) => g.valid), [true, true, false]);
      expect(
        groups.expand((g) => g.melds).fold(0, (s, m) => s + m.value),
        12 + 27,
      );
    });

    test('ters dizilmiş seri küçükten büyüğe gönderilir; bitişik çiftler ayrı sayılır', () {
      final run = [t(r, 9), t(r, 8), t(r, 7)];
      final pairs = [t(y, 2), t(y, 2), t(k, 6), t(k, 6)];
      final rack = Rack();
      final all = [...run, ...pairs];
      final byId = {for (final x in all) x.id: x};
      rack.slots.setAll(0, [for (final x in run) x.id]);
      rack.slots.setAll(16, [for (final x in pairs) x.id]);
      final sets = evaluateGroups(rack, byId, okey, pairs: false);
      expect(
        [for (final x in sets.first.melds.single.tiles) x.number],
        [7, 8, 9],
      );
      final pairEval = evaluateGroups(rack, byId, okey, pairs: true);
      expect(pairEval.last.melds, hasLength(2));
    });

    test('otomatik diz perleri boşlukla, kalanları sıralı dizer', () {
      final rack = Rack();
      rack.arrange(
        [
          [1, 2, 3],
          [4, 5, 6, 7],
        ],
        [t(k, 2), t(r, 9)],
      );
      final groups = rack.groups();
      expect(groups[0].ids, [1, 2, 3]);
      expect(groups[1].ids, [4, 5, 6, 7]);
      expect(groups[2].ids.length, 2);
      // Kalanlar renge göre: kırmızı önce.
      expect(groups[2].ids.first, _id - 1);
    });
  });

  group('masa görüntüsü', () {
    test('sunucunun gerçek çıktısı okunur', () {
      for (final name in [
        'state_waiting.json',
        'state_playing.json',
        'state_melds.json',
        'state_hand_over.json',
      ]) {
        final state = TableState.fromJson(fixture(name));
        expect(state.room, 'ornek-masa');
        expect(state.seats, hasLength(4));
      }
      final playing = TableState.fromJson(fixture('state_playing.json'));
      expect(playing.hand!.tiles.length, playing.hand!.counts[playing.you!]);
      final melds = TableState.fromJson(fixture('state_melds.json'));
      expect(melds.hand!.melds.length, greaterThanOrEqualTo(3));
      final over = TableState.fromJson(fixture('state_hand_over.json'));
      expect(over.phase, TablePhase.handOver);
      expect(over.result!.rows, hasLength(4));
    });
  });
}
