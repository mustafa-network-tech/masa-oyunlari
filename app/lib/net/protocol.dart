// Sunucu ile konuşulan mesajlar. Sunucu tarafındaki karşılığı: server/src/protocol.ts

const protocolVersion = 2;

Map<String, Object?> pingMessage(int n) => {'t': 'ping', 'n': n};

Map<String, Object?> joinMessage(String room, String name) =>
    {'t': 'join', 'room': room, 'name': name};

Map<String, Object?> resumeMessage(String room, String token) =>
    {'t': 'resume', 'room': room, 'token': token};

Map<String, Object?> leaveMessage() => {'t': 'leave'};

Map<String, Object?> startMessage() => {'t': 'start'};

Map<String, Object?> seedMessage(int hand, String seed) =>
    {'t': 'seed', 'hand': hand, 'seed': seed};

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
      case 'seated':
        return Seated(
          room: json['room'] as String,
          seat: json['seat'] as int,
          token: json['token'] as String,
          lastSeq: json['lastSeq'] as int,
        );
      case 'state':
        return TableSnapshot.fromJson(json);
      case 'ack':
        return Ack(json['seq'] as int, duplicate: json['duplicate'] == true);
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

/// Koltuğa oturuldu. [token] kopunca aynı koltuğa dönmek için saklanır.
final class Seated extends ServerMessage {
  const Seated({
    required this.room,
    required this.seat,
    required this.token,
    required this.lastSeq,
  });
  final String room;
  final int seat;
  final String token;
  final int lastSeq;
}

/// Masanın oyuncuya özel görüntüsü. Oyun ekranı (Faz 5) [json] içindeki el bilgisini kullanacak.
final class TableSnapshot extends ServerMessage {
  const TableSnapshot({
    required this.room,
    required this.phase,
    required this.players,
    required this.seedingHand,
    required this.json,
  });

  factory TableSnapshot.fromJson(Map<String, Object?> json) {
    final seats = (json['seats'] as List).cast<Map<String, Object?>?>();
    final seeding = json['seeding'] as Map<String, Object?>?;
    return TableSnapshot(
      room: json['room'] as String,
      phase: json['phase'] as String,
      players: [
        for (final seat in seats)
          if (seat != null) seat['name'] as String,
      ],
      seedingHand: seeding?['hand'] as int?,
      json: json,
    );
  }

  final String room;

  /// waiting, seeding, playing, handOver, finished
  final String phase;
  final List<String> players;

  /// Adil Oyun tohumu beklenen el; tohum beklenmiyorsa null.
  final int? seedingHand;
  final Map<String, Object?> json;
}

final class Ack extends ServerMessage {
  const Ack(this.seq, {this.duplicate = false});
  final int seq;
  final bool duplicate;
}

final class ServerError extends ServerMessage {
  const ServerError(this.code, this.message);
  final String code;
  final String message;
}
