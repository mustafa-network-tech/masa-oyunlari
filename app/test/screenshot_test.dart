// Ekranları farklı telefon boyutlarında PNG olarak çizer (görsel kontrol için).
// Sadece istenince çalışır; çıktılar test/screenshots/ altına yazılır ve depoya girmez:
//   flutter test test/screenshot_test.dart --update-goldens --dart-define=SCREENSHOTS=true

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masa/net/game_connection.dart';
import 'package:masa/net/protocol.dart';
import 'package:masa/screens/home_screen.dart';
import 'package:masa/screens/table_screen.dart';
import 'package:masa/theme.dart';

const enabled = bool.fromEnvironment('SCREENSHOTS');

/// Testlerde metinler kutu olarak çizilir; gerçek fontları yükle.
Future<void> loadFonts() async {
  final root = Platform.environment['FLUTTER_ROOT'] ?? r'C:\flutter';
  final fonts = '$root/bin/cache/artifacts/material_fonts';
  Future<void> load(String family, List<String> files) async {
    final loader = FontLoader(family);
    for (final f in files) {
      loader.addFont(
        Future.value(ByteData.sublistView(File('$fonts/$f').readAsBytesSync())),
      );
    }
    await loader.load();
  }

  await load('Roboto', [
    'roboto-regular.ttf',
    'roboto-medium.ttf',
    'roboto-bold.ttf',
    'roboto-black.ttf',
  ]);
  await load('MaterialIcons', ['materialicons-regular.otf']);
}

TableSnapshot snapshot(String name) {
  final json = jsonDecode(
    File('test/fixtures/$name').readAsStringSync(),
  ) as Map<String, Object?>;
  // Örnekler kısa sürelerle üretildi; ekranda gerçekçi bir sayaç görünsün.
  final clock =
      (json['hand'] as Map<String, Object?>?)?['clock']
          as Map<String, Object?>?;
  if (clock != null && clock['endsIn'] != null) {
    clock['endsIn'] = 52000;
    clock['moveLeft'] = 12000;
  }
  return TableSnapshot.fromJson(json);
}

/// Yatay telefon boyutları (mantıksal piksel).
const sizes = {
  'kucuk': Size(640, 320),
  'orta': Size(800, 360),
  'buyuk': Size(915, 412),
  'tablet': Size(1280, 800),
};

void main() {
  setUpAll(() async {
    if (enabled) await loadFonts();
  });

  Future<void> shoot(
    WidgetTester tester,
    String name,
    Size size,
    Widget home,
  ) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasaTheme(),
        debugShowCheckedModeBanner: false,
        home: home,
      ),
    );
    await tester.pump(const Duration(milliseconds: 600));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('screenshots/$name.png'),
    );
  }

  GameConnection connectionWith(String fixture) {
    final c = GameConnection(Uri.parse('ws://localhost:1'))
      ..status = ConnectionStatus.connected;
    c.debugSetRoom(snapshot(fixture), seat: 0);
    return c;
  }

  for (final MapEntry(key: sizeName, value: size) in sizes.entries) {
    for (final fixture in ['state_playing', 'state_melds', 'state_hand_over']) {
      testWidgets('$fixture $sizeName', (tester) async {
        await shoot(
          tester,
          '${fixture}_$sizeName',
          size,
          TableScreen(connection: connectionWith('$fixture.json')),
        );
      }, skip: !enabled);
    }
  }

  testWidgets('bekleme odası', (tester) async {
    await shoot(
      tester,
      'waiting',
      sizes['orta']!,
      TableScreen(connection: connectionWith('state_waiting.json')),
    );
  }, skip: !enabled);

  testWidgets('ana sayfa', (tester) async {
    final c = GameConnection(Uri.parse('ws://localhost:1'))
      ..status = ConnectionStatus.connected
      ..latencyMs = 24;
    await shoot(tester, 'home', sizes['orta']!, HomeScreen(connection: c));
  }, skip: !enabled);
}
