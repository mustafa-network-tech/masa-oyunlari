// Sunucu ile konuşulan mesajlar. Sunucu tarafındaki karşılığı: server/src/protocol.ts

const protocolVersion = 2;

Map<String, Object?> pingMessage(int n) => {'t': 'ping', 'n': n};

Map<String, Object?> joinMessage(
  String room,
  String name, [
  Map<String, Object?>? settings,
]) => {'t': 'join', 'room': room, 'name': name, 'settings': ?settings};

Map<String, Object?> resumeMessage(String room, String token) => {
  't': 'resume',
  'room': room,
  'token': token,
};

Map<String, Object?> leaveMessage() => {'t': 'leave'};

Map<String, Object?> startMessage() => {'t': 'start'};

Map<String, Object?> seedMessage(int hand, String seed) => {
  't': 'seed',
  'hand': hand,
  'seed': seed,
};

/// Oyun hamlesi. [seq] her koltukta artar; [hand] ve [turn] oyuncunun gördüğü el ve tur.
Map<String, Object?> actMessage(
  int seq,
  int hand,
  int turn,
  Map<String, Object?> action,
) => {'t': 'act', 'seq': seq, 'hand': hand, 'turn': turn, 'action': action};

Map<String, Object?> backMessage() => {'t': 'back'};

/// Otomatik diz: [mode] sets (seri/küt) veya pairs (çift).
Map<String, Object?> arrangeMessage(String mode) => {
  't': 'arrange',
  'mode': mode,
};

Map<String, Object?> reactMessage(String id) => {'t': 'react', 'id': id};

/// Hazır tepkiler. Kimlikler sunucuyla aynı: server/src/protocol.ts REACTIONS
const reactions = {
  'selam': '👋 Selam',
  'helal': '👏 Helal olsun',
  'sans': '🍀 Şanslıydın',
  'hadi': '⏳ Hadi ama',
  'pardon': '🙏 Kusura bakma',
  'gule': '😄 Güle güle',
};

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
      case 'arrangement':
        return Arrangement(json['mode'] as String, [
          for (final m in json['melds'] as List)
            ((m as Map)['tileIds'] as List).cast<int>(),
        ]);
      case 'reaction':
        return ReactionMessage(json['seat'] as int, json['id'] as String);
      case 'error':
        return ServerError(
          json['code'] as String,
          json['message'] as String,
          reason: json['reason'] as String?,
        );
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

/// Otomatik diz cevabı: perlerin taş kimlikleri, değeri büyükten küçüğe.
final class Arrangement extends ServerMessage {
  const Arrangement(this.mode, this.melds);
  final String mode;
  final List<List<int>> melds;
}

final class ReactionMessage extends ServerMessage {
  const ReactionMessage(this.seat, this.id);
  final int seat;
  final String id;
}

final class ServerError extends ServerMessage {
  const ServerError(this.code, this.message, {this.reason});
  final String code;
  final String message;

  /// Kural dışı hamlenin sebebi (motordaki ActionError).
  final String? reason;
}
