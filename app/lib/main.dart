import 'package:flutter/material.dart';

import 'net/game_connection.dart';
import 'screens/connection_test_screen.dart';
import 'theme.dart';

/// Sunucu adresi derleme sırasında verilir:
///   flutter run --dart-define=SERVER_URL=ws://192.168.1.20:2567
/// Varsayılan adres Android emülatöründen bilgisayara ulaşır.
const serverUrl = String.fromEnvironment(
  'SERVER_URL',
  defaultValue: 'ws://10.0.2.2:2567',
);

void main() {
  final connection = GameConnection(Uri.parse(serverUrl))..connect();
  runApp(MasaApp(connection: connection));
}

class MasaApp extends StatelessWidget {
  const MasaApp({super.key, required this.connection});

  final GameConnection connection;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Masa',
      debugShowCheckedModeBanner: false,
      theme: buildMasaTheme(),
      home: ConnectionTestScreen(connection: connection),
    );
  }
}
