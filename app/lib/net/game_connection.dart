import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'protocol.dart';

enum ConnectionStatus { disconnected, connecting, connected, versionMismatch }

/// Sunucuyla tek WebSocket bağlantısı. Koparsa artan aralıklarla yeniden bağlanır
/// ve masadaysa aynı koltuğa geri oturur.
class GameConnection extends ChangeNotifier {
  GameConnection(this.url);

  final Uri url;

  ConnectionStatus status = ConnectionStatus.disconnected;
  String? clientId;
  TableSnapshot? room;
  int? seat;
  int? latencyMs;
  String? lastError;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  int _attempt = 0;
  bool _wanted = false;
  final _pingSentAt = <int, int>{};
  int _pingCounter = 0;

  // Yeniden bağlanınca katılacağımız masa. Koltuk jetonu varsa aynı koltuğa döneriz.
  String? _roomName;
  String? _playerName;
  String? _seatToken;
  int _seededHand = 0;
  final _random = Random.secure();

  void connect() {
    _wanted = true;
    _open();
  }

  void disconnect() {
    _wanted = false;
    _reconnectTimer?.cancel();
    _close();
    _setStatus(ConnectionStatus.disconnected);
  }

  void join(String roomName, String playerName) {
    _roomName = roomName;
    _playerName = playerName;
    _seatToken = null;
    _send(joinMessage(roomName, playerName));
  }

  void leave() {
    _roomName = null;
    _seatToken = null;
    seat = null;
    _send(leaveMessage());
    room = null;
    notifyListeners();
  }

  /// Masa sahibi oyunu başlatır; boş koltuklara bot oturur.
  void start() => _send(startMessage());

  /// Ağ kopmasını taklit eder: bağlantı kapanır, yeniden bağlanma devreye girer.
  @visibleForTesting
  void simulateDrop() => _onLost();

  Future<void> _open() async {
    _close();
    _setStatus(ConnectionStatus.connecting);
    final channel = WebSocketChannel.connect(url);
    _channel = channel;
    _subscription = channel.stream.listen(
      _onData,
      onDone: _onLost,
      onError: (Object e) {
        lastError = e.toString();
        _onLost();
      },
    );
    try {
      await channel.ready;
    } catch (e) {
      // Hata stream üzerinden de gelir; yeniden bağlanma _onLost'ta yapılır.
    }
  }

  void _onData(dynamic data) {
    if (data is! String) return;
    final msg = ServerMessage.parse(jsonDecode(data) as Map<String, Object?>);
    switch (msg) {
      case Welcome(:final protocol, clientId: final id):
        if (protocol != protocolVersion) {
          _wanted = false;
          _close();
          _setStatus(ConnectionStatus.versionMismatch);
          return;
        }
        clientId = id;
        _attempt = 0;
        lastError = null;
        _setStatus(ConnectionStatus.connected);
        _startPing();
        if (_roomName != null && _seatToken != null) {
          _send(resumeMessage(_roomName!, _seatToken!));
        } else if (_roomName != null && _playerName != null) {
          _send(joinMessage(_roomName!, _playerName!));
        }
      case Pong(:final n):
        final sentAt = _pingSentAt.remove(n);
        if (sentAt != null) {
          latencyMs = DateTime.now().millisecondsSinceEpoch - sentAt;
          notifyListeners();
        }
      case Seated(:final token, seat: final s):
        _seatToken = token;
        seat = s;
        notifyListeners();
      case TableSnapshot(:final seedingHand):
        room = msg;
        if (seedingHand != null && seedingHand != _seededHand) {
          _seededHand = seedingHand;
          _send(seedMessage(seedingHand, _newSeed()));
        }
        notifyListeners();
      case Ack():
        break;
      case ServerError(:final code, :final message):
        lastError = message;
        // Dönüş süresi dolduysa koltuk bota geçti; masadan çıkmış sayılırız.
        if (code == 'seatLost' || code == 'badToken' || code == 'replaced') {
          _roomName = null;
          _seatToken = null;
          seat = null;
          room = null;
        }
        notifyListeners();
      case null:
        break;
    }
  }

  void _onLost() {
    _close();
    if (!_wanted) return;
    _setStatus(ConnectionStatus.connecting);
    // 0.5 sn, 1 sn, 2 sn ... en fazla 10 sn bekleyerek yeniden dene.
    final delayMs = min(10000, 500 * pow(2, _attempt).toInt());
    _attempt++;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(milliseconds: delayMs), _open);
  }

  void _startPing() {
    _pingTimer?.cancel();
    void ping() {
      final n = ++_pingCounter;
      _pingSentAt[n] = DateTime.now().millisecondsSinceEpoch;
      _send(pingMessage(n));
    }

    ping();
    _pingTimer = Timer.periodic(const Duration(seconds: 5), (_) => ping());
  }

  /// Adil Oyun: cihazda üretilen 32 baytlık rastgele tohum (64 hex karakter).
  String _newSeed() => [
        for (var i = 0; i < 32; i++)
          _random.nextInt(256).toRadixString(16).padLeft(2, '0'),
      ].join();

  void _send(Map<String, Object?> msg) {
    if (status != ConnectionStatus.connected) return;
    _channel?.sink.add(jsonEncode(msg));
  }

  void _close() {
    _pingTimer?.cancel();
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
    _pingSentAt.clear();
  }

  void _setStatus(ConnectionStatus value) {
    status = value;
    if (value != ConnectionStatus.connected) room = null;
    notifyListeners();
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}
