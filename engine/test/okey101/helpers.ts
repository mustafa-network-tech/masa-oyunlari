import { expect } from 'vitest';
import {
  applyAction,
  COLORS,
  DEFAULT_CONFIG,
  type Action,
  type ActionError,
  type Color,
  type GameEvent,
  type HandState,
  type Identity,
  type Seat,
  type TableConfig,
  type Tile,
} from '../../src/okey101/index.ts';

/** Gerçek desteyle aynı kimlikleri üreten taş: copy 0 veya 1. */
export function t(color: Color, number: number, copy: 0 | 1 = 0): Tile {
  return { id: copy * 52 + COLORS.indexOf(color) * 13 + number - 1, color, number, fake: false };
}

export const FAKE_1: Tile = { id: 104, color: 'red', number: 0, fake: true };
export const FAKE_2: Tile = { id: 105, color: 'red', number: 0, fake: true };

/** Kısa yazım: 'r5' = kırmızı 5, 'b12' = mavi 12, 'y1' = sarı 1, 'k13' = siyah 13. Sonuna "'" eklenirse ikinci kopya. */
export function tiles(spec: string): Tile[] {
  const map: Record<string, Color> = { r: 'red', y: 'yellow', b: 'blue', k: 'black' };
  return spec
    .trim()
    .split(/\s+/)
    .map((token) => {
      const match = /^([rybk])(\d{1,2})(')?$/.exec(token);
      if (!match) throw new Error(`bad tile: ${token}`);
      return t(map[match[1]!]!, Number(match[2]), match[3] ? 1 : 0);
    });
}

export const ids = (list: Tile[]) => list.map((x) => x.id);

/** Testlerde varsayılan okey siyah 13: araya karışmaması için. */
export const DEFAULT_OKEY: Identity = { color: 'black', number: 13 };

/** Testlerde perlere karışmayan dolgu taşları (ikinci kopya, birbirinden kopuk küçük sayılar). */
const FILLER_POOL = tiles("y1' k3' y5' k7' b1' r3' b5' r7' y3' k1' y7' k5' b3' r1' b7' r5'");
export function fillers(count: number): Tile[] {
  if (count > FILLER_POOL.length) throw new Error('yetersiz dolgu taşı');
  return FILLER_POOL.slice(0, count);
}

export interface StateOptions {
  hands: Tile[][];
  stock?: Tile[];
  discards?: Tile[][];
  okey?: Identity;
  config?: Partial<TableConfig>;
  seat?: Seat;
  phase?: 'draw' | 'play';
}

export function makeState(o: StateOptions): HandState {
  const okey = o.okey ?? DEFAULT_OKEY;
  const indicatorNumber = okey.number === 1 ? 13 : okey.number - 1;
  return {
    config: { ...DEFAULT_CONFIG, ...o.config },
    handNumber: 1,
    starter: 0,
    indicator: { id: -1, color: okey.color, number: indicatorNumber, fake: false },
    okey,
    stock: o.stock ?? tiles('k1 k2 k3 k4 k5'),
    hands: o.hands.map((h) => [...h]),
    discards: o.discards ?? [[], [], [], []],
    melds: [],
    nextMeldId: 1,
    opened: [null, null, null, null],
    openedAtTurn: [null, null, null, null],
    highestSetsOpening: 0,
    highestPairsOpening: 0,
    turn: { seat: o.seat ?? 0, number: 1, phase: o.phase ?? 'play', takenTileId: null, mustDrawFromStock: false },
    penalties: [0, 0, 0, 0],
    lastDiscard: null,
    result: null,
  };
}

export function act(state: HandState, seat: Seat, action: Action): HandState {
  return actWithEvents(state, seat, action).state;
}

export function actWithEvents(state: HandState, seat: Seat, action: Action): { state: HandState; events: GameEvent[] } {
  const result = applyAction(state, seat, action);
  if (!result.ok) throw new Error(`beklenmeyen hata: ${result.error} (${JSON.stringify(action)})`);
  return result;
}

export function err(state: HandState, seat: Seat, action: Action): ActionError {
  const result = applyAction(state, seat, action);
  expect(result.ok).toBe(false);
  return (result as { error: ActionError }).error;
}

/** Sıradaki oyunculara desteden çekip ilk taşlarını attırarak sırayı belirli koltuğa getirir. */
export function passTurnsUntil(state: HandState, seat: Seat): HandState {
  let s = state;
  while (s.turn.seat !== seat) {
    const current = s.turn.seat;
    if (s.turn.phase === 'draw') s = act(s, current, { type: 'draw' });
    s = act(s, current, { type: 'discard', tileId: s.hands[current]!.at(-1)!.id });
  }
  return s;
}
