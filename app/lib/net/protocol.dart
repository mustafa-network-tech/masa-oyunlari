// Sunucu ile konuşulan mesajlar. Sunucu tarafındaki karşılığı: server/src/protocol.ts

const protocolVersion = 1;

Map<String, Object?> pingMessage(int n) => {'t': 'ping', 'n': n};

Map<String, Object?> joinMessage(String room, String name) =>
    {'t': 'join', 'room': room, 'name': name};

Map<String, Object?> leaveMessage() => {'t': 'leave'};

sealed class ServerMessage {
  const ServerMessage();

  /// Bilinmeyen veya bozuk mesajlar için null döner.
  static ServerMessage? parse(Map<String, Object?> json) {
    switch (json['t']) {
      case 'welcome':
        return Welcome(
          protocol: json['protocol'] as int,
          clientId: json['clientId'] as String,
        );
      case 'pong':
        return Pong((json['n'] as num).toInt());
      case 'joined':
      case 'roomUpdate':
        return RoomState(
          room: json['room'] as String,
          players: (json['players'] as List).cast<String>(),
        );
      case 'error':
        return ServerError(json['code'] as String, json['message'] as String);
      default:
        return null;
    }
  }
}

final class Welcome extends ServerMessage {
  const Welcome({required this.protocol, required this.clientId});
  final int protocol;
  final String clientId;
}

final class Pong extends ServerMessage {
  const Pong(this.n);
  final int n;
}

final class RoomState extends ServerMessage {
  const RoomState({required this.room, required this.players});
  final String room;
  final List<String> players;
}

final class ServerError extends ServerMessage {
  const ServerError(this.code, this.message);
  final String code;
  final String message;
}
