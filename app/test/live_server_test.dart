import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masa/net/game_connection.dart';

/// Çalışan bir sunucuya gerçekten bağlanır. Sadece adres verilince çalışır:
///   flutter test test/live_server_test.dart --dart-define=LIVE_SERVER_URL=ws://localhost:2567
const liveServerUrl = String.fromEnvironment('LIVE_SERVER_URL');

Future<void> waitFor(GameConnection c, bool Function() condition) {
  if (condition()) return Future.value();
  final done = Completer<void>();
  void listener() {
    if (condition() && !done.isCompleted) done.complete();
  }

  c.addListener(listener);
  return done.future
      .timeout(const Duration(seconds: 10))
      .whenComplete(() => c.removeListener(listener));
}

void main() {
  final skip = liveServerUrl.isEmpty ? 'LIVE_SERVER_URL verilmedi' : false;
  final room = 'canli-${DateTime.now().millisecondsSinceEpoch}';

  test(
    'gerçek sunucuya bağlanır, ping ölçer ve masaya oturur',
    () async {
      final ali = GameConnection(Uri.parse(liveServerUrl))..connect();
      final veli = GameConnection(Uri.parse(liveServerUrl))..connect();
      await waitFor(ali, () => ali.status == ConnectionStatus.connected);
      await waitFor(veli, () => veli.status == ConnectionStatus.connected);
      await waitFor(ali, () => ali.latencyMs != null);

      ali.join('$room-a', 'Ali');
      await waitFor(ali, () => ali.room?.players.length == 1);
      veli.join('$room-a', 'Veli');
      await waitFor(ali, () => ali.room?.players.length == 2);
      expect(ali.room!.players, ['Ali', 'Veli']);

      veli.dispose();
      await waitFor(ali, () => ali.room?.players.length == 1);
      ali.dispose();
    },
    skip: skip,
  );

  test(
    'oyun sırasında bağlantı koparsa aynı koltuğa döner',
    () async {
      final ali = GameConnection(Uri.parse(liveServerUrl))..connect();
      await waitFor(ali, () => ali.status == ConnectionStatus.connected);
      ali.join('$room-b', 'Ali');
      await waitFor(ali, () => ali.seat != null);
      ali.start();
      // Tohum otomatik gönderilir, el dağıtılır.
      await waitFor(ali, () => ali.room?.phase == 'playing');
      final seat = ali.seat;

      ali.simulateDrop();
      await waitFor(ali, () => ali.status == ConnectionStatus.connecting);
      await waitFor(ali, () => ali.room?.phase == 'playing');
      expect(ali.seat, seat);
      expect(ali.room!.json['you'], seat);
      ali.dispose();
    },
    skip: skip,
  );
}
