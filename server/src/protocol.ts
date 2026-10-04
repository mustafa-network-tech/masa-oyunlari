// İstemci (Flutter) ile sunucu arasındaki mesajlar. Her mesaj JSON ve `t` alanı mesaj türünü belirtir.
// Flutter tarafındaki karşılığı: app/lib/net/protocol.dart

import { isValidSeed, okey101 } from '@masa/engine';
import type { TableView } from './view.ts';

export const PROTOCOL_VERSION = 2;

export type Speed = 'fast' | 'normal' | 'relaxed';

export interface TableSettings extends okey101.TableConfig {
  speed: Speed;
}

export const DEFAULT_SETTINGS: TableSettings = { ...okey101.DEFAULT_CONFIG, speed: 'normal' };

export type ClientMessage =
  | { t: 'ping'; n: number }
  /** Masaya otur. Masa yoksa verilen ayarlarla kurulur. */
  | { t: 'join'; room: string; name: string; settings?: Partial<TableSettings> }
  /** Kopan bağlantıdan sonra aynı koltuğa dönmek için. */
  | { t: 'resume'; room: string; token: string }
  | { t: 'leave' }
  /** Masa sahibi oyunu başlatır; boş koltuklara bot oturur. */
  | { t: 'start' }
  /** Adil Oyun: oyuncunun cihazında üretilen tohum. */
  | { t: 'seed'; hand: number; seed: string }
  /**
   * Oyun hamlesi. `seq` her koltukta artan sıra numarasıdır; aynı numara ikinci kez gelirse yok sayılır.
   * `hand` ve `turn` oyuncunun gördüğü el ve tur numarasıdır; eskimişse hamle reddedilir (hızlı çift tıklama).
   */
  | { t: 'act'; seq: number; hand: number; turn: number; action: okey101.Action }
  /** "Uzakta" durumundan dönüş. */
  | { t: 'back' };

export type ServerMessage =
  | { t: 'welcome'; protocol: number; clientId: string }
  | { t: 'pong'; n: number }
  /** Koltuğa oturuldu. `token` gizlidir; yeniden bağlanınca `resume` ile gönderilir. */
  | { t: 'seated'; room: string; seat: okey101.Seat; token: string; lastSeq: number }
  | TableView
  | { t: 'ack'; seq: number; duplicate?: true }
  | { t: 'error'; code: ErrorCode; message: string; seq?: number; reason?: okey101.ActionError };

export type ErrorCode =
  | 'badMessage'
  | 'badRoom'
  | 'notInRoom'
  | 'tableFull'
  | 'inProgress'
  | 'notHost'
  | 'badToken'
  | 'seatLost'
  | 'notPlaying'
  | 'stale'
  | 'illegalAction'
  | 'rateLimited'
  | 'replaced';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  badMessage: 'Geçersiz mesaj',
  badRoom: 'Geçersiz masa',
  notInRoom: 'Bir masada değilsin',
  tableFull: 'Masa dolu',
  inProgress: 'Bu masada oyun başladı',
  notHost: 'Oyunu yalnızca masa sahibi başlatabilir',
  badToken: 'Koltuk bulunamadı',
  seatLost: 'Dönüş süresi doldu, koltuğuna bot oturdu',
  notPlaying: 'Şu an hamle yapılamaz',
  stale: 'Masa değişti, hamle geçersiz',
  illegalAction: 'Kurallara uygun olmayan hamle',
  rateLimited: 'Çok hızlı mesaj gönderiliyor',
  replaced: 'Bu koltuğa başka bir bağlantıdan girildi',
};

const ROOM_NAME = /^[a-z0-9-]{1,32}$/;
const TOKEN = /^[0-9a-f]{32}$/;
const MAX_PLAYER_NAME = 24;
const MAX_MELDS = 14;
const MAX_TILE_ID = 105;

/** Gelen ham veriyi doğrular. Geçersizse null döner; sunucu asla güvenmediği veriyle çalışmaz. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  const msg = data;

  switch (msg.t) {
    case 'ping':
      return typeof msg.n === 'number' && Number.isFinite(msg.n) ? { t: 'ping', n: msg.n } : null;
    case 'join': {
      if (!isRoom(msg.room)) return null;
      if (typeof msg.name !== 'string') return null;
      const name = msg.name.trim().slice(0, MAX_PLAYER_NAME);
      if (!name) return null;
      if (msg.settings === undefined) return { t: 'join', room: msg.room, name };
      const settings = parseSettings(msg.settings);
      return settings ? { t: 'join', room: msg.room, name, settings } : null;
    }
    case 'resume':
      return isRoom(msg.room) && typeof msg.token === 'string' && TOKEN.test(msg.token)
        ? { t: 'resume', room: msg.room, token: msg.token }
        : null;
    case 'leave':
    case 'start':
    case 'back':
      return { t: msg.t };
    case 'seed':
      return isCount(msg.hand) && typeof msg.seed === 'string' && isValidSeed(msg.seed)
        ? { t: 'seed', hand: msg.hand, seed: msg.seed }
        : null;
    case 'act': {
      if (!isCount(msg.seq) || !isCount(msg.hand) || !isCount(msg.turn)) return null;
      const action = parseAction(msg.action);
      return action ? { t: 'act', seq: msg.seq, hand: msg.hand, turn: msg.turn, action } : null;
    }
    default:
      return null;
  }
}

function parseSettings(value: unknown): Partial<TableSettings> | null {
  if (!isObject(value)) return null;
  const settings: Partial<TableSettings> = {};
  for (const [key, v] of Object.entries(value)) {
    switch (key) {
      case 'openingMode':
        if (v !== 'fixed' && v !== 'rising') return null;
        settings.openingMode = v;
        break;
      case 'hands':
        if (v !== 5 && v !== 7 && v !== 9 && v !== 11) return null;
        settings.hands = v;
        break;
      case 'partnership':
        if (typeof v !== 'boolean') return null;
        settings.partnership = v;
        break;
      case 'unopenedPenalty':
        if (v !== 101 && v !== 202 && v !== 303) return null;
        settings.unopenedPenalty = v;
        break;
      case 'speed':
        if (v !== 'fast' && v !== 'normal' && v !== 'relaxed') return null;
        settings.speed = v;
        break;
      default:
        return null;
    }
  }
  return settings;
}

function parseAction(value: unknown): okey101.Action | null {
  if (!isObject(value)) return null;
  switch (value.type) {
    case 'draw':
    case 'takeDiscard':
    case 'returnTaken':
      return { type: value.type };
    case 'open':
    case 'addMelds': {
      if (!Array.isArray(value.melds) || value.melds.length === 0 || value.melds.length > MAX_MELDS) return null;
      const melds: okey101.MeldInput[] = [];
      for (const m of value.melds) {
        if (!isObject(m)) return null;
        if (m.kind !== 'run' && m.kind !== 'set' && m.kind !== 'pair') return null;
        if (!Array.isArray(m.tileIds) || m.tileIds.length > 13 || !m.tileIds.every(isTileId)) return null;
        melds.push({ kind: m.kind, tileIds: m.tileIds });
      }
      return { type: value.type, melds };
    }
    case 'layOff': {
      if (!isTileId(value.tileId) || !isCount(value.meldId)) return null;
      if (value.end === undefined) return { type: 'layOff', tileId: value.tileId, meldId: value.meldId };
      if (value.end !== 'start' && value.end !== 'end') return null;
      return { type: 'layOff', tileId: value.tileId, meldId: value.meldId, end: value.end };
    }
    case 'swapOkey':
      return isTileId(value.tileId) && isCount(value.meldId)
        ? { type: 'swapOkey', tileId: value.tileId, meldId: value.meldId }
        : null;
    case 'discard':
      return isTileId(value.tileId) ? { type: 'discard', tileId: value.tileId } : null;
    default:
      return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRoom(value: unknown): value is string {
  return typeof value === 'string' && ROOM_NAME.test(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isTileId(value: unknown): value is number {
  return isCount(value) && value <= MAX_TILE_ID;
}
