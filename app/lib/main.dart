import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'net/game_connection.dart';
import 'screens/home_screen.dart';
import 'theme.dart';
import 'ui/sounds.dart';

/// Sunucu adresi derleme sırasında verilir:
///   flutter run --dart-define=SERVER_URL=ws://192.168.1.20:2567
/// Varsayılan adres Android emülatöründen bilgisayara ulaşır.
const serverUrl = String.fromEnvironment(
  'SERVER_URL',
  defaultValue: 'ws://10.0.2.2:2567',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Okey masası yatay oynanır.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  final connection = GameConnection(Uri.parse(serverUrl))..connect();
  runApp(MasaApp(connection: connection, sounds: Sounds()));
}

class MasaApp extends StatelessWidget {
  const MasaApp({super.key, required this.connection, this.sounds});

  final GameConnection connection;
  final Sounds? sounds;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Masa',
      debugShowCheckedModeBanner: false,
      theme: buildMasaTheme(),
      home: HomeScreen(connection: connection, sounds: sounds),
    );
  }
}
