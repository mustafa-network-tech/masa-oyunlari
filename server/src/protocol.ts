// İstemci (Flutter) ile sunucu arasındaki mesajlar. Her mesaj JSON ve `t` alanı mesaj türünü belirtir.
// Flutter tarafındaki karşılığı: app/lib/net/protocol.dart

export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | { t: 'ping'; n: number }
  | { t: 'join'; room: string; name: string }
  | { t: 'leave' };

export type ServerMessage =
  | { t: 'welcome'; protocol: number; clientId: string }
  | { t: 'pong'; n: number }
  | { t: 'joined'; room: string; players: string[] }
  | { t: 'roomUpdate'; room: string; players: string[] }
  | { t: 'error'; code: ErrorCode; message: string };

export type ErrorCode = 'badMessage' | 'badRoom' | 'notInRoom';

const ROOM_NAME = /^[a-z0-9-]{1,32}$/;
const MAX_PLAYER_NAME = 24;

/** Gelen ham veriyi doğrular. Geçersizse null döner; sunucu asla güvenmediği veriyle çalışmaz. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;

  switch (msg.t) {
    case 'ping':
      return typeof msg.n === 'number' && Number.isFinite(msg.n) ? { t: 'ping', n: msg.n } : null;
    case 'join': {
      if (typeof msg.room !== 'string' || !ROOM_NAME.test(msg.room)) return null;
      if (typeof msg.name !== 'string') return null;
      const name = msg.name.trim().slice(0, MAX_PLAYER_NAME);
      return name ? { t: 'join', room: msg.room, name } : null;
    }
    case 'leave':
      return { t: 'leave' };
    default:
      return null;
  }
}
