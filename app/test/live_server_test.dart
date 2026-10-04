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
      .timeout(const Duration(seconds: 5))
      .whenComplete(() => c.removeListener(listener));
}

void main() {
  test(
    'gerçek sunucuya bağlanır, ping ölçer ve odaya katılır',
    () async {
      final ali = GameConnection(Uri.parse(liveServerUrl))..connect();
      final veli = GameConnection(Uri.parse(liveServerUrl))..connect();
      await waitFor(ali, () => ali.status == ConnectionStatus.connected);
      await waitFor(veli, () => veli.status == ConnectionStatus.connected);
      await waitFor(ali, () => ali.latencyMs != null);

      ali.join('test-masa', 'Ali');
      await waitFor(ali, () => ali.room?.players.length == 1);
      veli.join('test-masa', 'Veli');
      await waitFor(ali, () => ali.room?.players.length == 2);
      expect(ali.room!.players, ['Ali', 'Veli']);

      veli.dispose();
      await waitFor(ali, () => ali.room?.players.length == 1);
      ali.dispose();
    },
    skip: liveServerUrl.isEmpty ? 'LIVE_SERVER_URL verilmedi' : false,
  );
}
