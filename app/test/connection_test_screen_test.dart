import 'package:flutter_test/flutter_test.dart';
import 'package:masa/main.dart';
import 'package:masa/net/game_connection.dart';

void main() {
  testWidgets('bağlantı yokken durum ve devre dışı buton gösterilir',
      (tester) async {
    // connect() çağrılmadığı için ağa çıkılmaz.
    final connection = GameConnection(Uri.parse('ws://localhost:1'));
    await tester.pumpWidget(MasaApp(connection: connection));

    expect(find.text('Bağlantı Testi'), findsOneWidget);
    expect(find.text('Bağlı değil'), findsOneWidget);
    expect(find.text('Test masasına otur'), findsOneWidget);
  });
}
