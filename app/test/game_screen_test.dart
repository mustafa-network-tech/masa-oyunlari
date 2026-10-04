import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masa/net/game_connection.dart';
import 'package:masa/net/protocol.dart';
import 'package:masa/screens/table_screen.dart';
import 'package:masa/theme.dart';
import 'package:masa/ui/rack_view.dart';
import 'package:masa/ui/tile_widget.dart';

/// Gönderilen mesajları kaydeden bağlantı.
class RecordingConnection extends GameConnection {
  RecordingConnection() : super(Uri.parse('ws://localhost:1')) {
    status = ConnectionStatus.connected;
  }

  final sent = <Map<String, Object?>>[];

  @override
  void send(Map<String, Object?> msg) => sent.add(msg);
}

Map<String, Object?> fixture(String name) =>
    jsonDecode(File('test/fixtures/$name').readAsStringSync())
        as Map<String, Object?>;

Future<RecordingConnection> openTable(WidgetTester tester, String name) async {
  tester.view.physicalSize = const Size(800, 360) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final c = RecordingConnection();
  c.debugSetRoom(TableSnapshot.fromJson(fixture(name)), seat: 0);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildMasaTheme(),
      home: TableScreen(connection: c),
    ),
  );
  await tester.pump(const Duration(milliseconds: 500));
  return c;
}

/// Istakadaki taşlar (göstergeyi ve yığınları saymadan).
Finder rackTiles() =>
    find.descendant(of: find.byType(RackView), matching: find.byType(TileFace));

Map<String, Object?>? lastAct(RecordingConnection c) =>
    c.sent.lastWhere((m) => m['t'] == 'act', orElse: () => {})['action']
        as Map<String, Object?>?;

void main() {
  // Örnekte el başı: sıra bizde, 22 taş, çekmeden atacağız.
  testWidgets('taşa dokunup kendi yığınına dokununca taş atılır', (
    tester,
  ) async {
    final c = await openTable(tester, 'state_playing.json');
    final state = fixture('state_playing.json');
    final firstTile = ((state['hand'] as Map)['tiles'] as List).first as Map;

    final tile = rackTiles().first;
    await tester.tap(tile);
    await tester.pump();
    expect(find.text('At'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.south_east));
    await tester.pump();

    final act = c.sent.lastWhere((m) => m['t'] == 'act');
    expect(act['seq'], 1);
    expect(act['hand'], 1);
    expect(act['turn'], 1);
    expect(act['action'], {'type': 'discard', 'tileId': firstTile['id']});
  });

  testWidgets('taş sürüklenip yığına bırakılınca atılır', (tester) async {
    final c = await openTable(tester, 'state_playing.json');
    final from = tester.getCenter(rackTiles().at(3));
    final to = tester.getCenter(find.byIcon(Icons.south_east));
    final gesture = await tester.startGesture(from);
    await gesture.moveBy(const Offset(0, -20));
    await tester.pump();
    await gesture.moveTo(to);
    await tester.pump();
    await gesture.up();
    await tester.pump();
    expect(lastAct(c)?['type'], 'discard');
  });

  testWidgets('otomatik diz isteği gider, gelen öneriyle ıstaka dizilir', (
    tester,
  ) async {
    final c = await openTable(tester, 'state_playing.json');
    await tester.tap(find.text('Seri diz'));
    await tester.pump();
    expect(c.sent.last, {'t': 'arrange', 'mode': 'sets'});

    final tiles =
        ((fixture('state_playing.json')['hand'] as Map)['tiles'] as List)
            .cast<Map>();
    // Sunucu ilk üç taşı bir per olarak önermiş olsun.
    c.debugReceive({
      't': 'arrangement',
      'mode': 'sets',
      'melds': [
        {
          'kind': 'run',
          'tileIds': [for (final t in tiles.take(3)) t['id']],
        },
      ],
    });
    await tester.pump(const Duration(milliseconds: 300));
    // Önerilen per ıstakanın başına dizilir, altı geçerli per olarak işaretlenir (değeri yazılır).
    final firstThree = [
      for (final t in tiles.take(3))
        tester.getTopLeft(find.byKey(ValueKey<int>(t['id'] as int))),
    ];
    expect(
      firstThree[0].dx < firstThree[1].dx &&
          firstThree[1].dx < firstThree[2].dx,
      isTrue,
    );
    expect(firstThree.map((o) => o.dy).toSet(), hasLength(1));
    expect(rackTiles(), findsNWidgets(tiles.length));
  });

  testWidgets('el sonu puan tablosu ve Adil Oyun rozeti görünür', (
    tester,
  ) async {
    await openTable(tester, 'state_hand_over.json');
    expect(find.text('Oyuncu'), findsOneWidget);
    expect(find.textContaining('Adil Oyun'), findsOneWidget);
  });

  testWidgets('bekleme odasında masa sahibi başlatabilir', (tester) async {
    final c = await openTable(tester, 'state_waiting.json');
    expect(find.textContaining('Başlat'), findsOneWidget);
    expect(find.text('ornek-masa'), findsOneWidget);
    expect(c.sent, isEmpty);
  });
}
