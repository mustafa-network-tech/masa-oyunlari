// El sonu puanlaması. Bkz. docs/02-101-kurallari.md §8. Düşük puan iyidir.

import type { HandState, Seat } from './game.ts';
import { identityOf, isJoker, type Identity, type Tile } from './tiles.ts';

export const FINISH_SCORE = -101;
/** Açmış oyuncunun elinde kalan her okey için ek ceza. */
export const OKEY_IN_HAND_PENALTY = 101;

export interface HandResult {
  /** Biten oyuncu; deste bittiyse null. */
  finisher: Seat | null;
  /** Bitiş türüne göre çarpanlar. */
  finish: { okey: boolean; elden: boolean; pairs: boolean; multiplier: number };
  rows: HandScoreRow[];
}

export interface HandScoreRow {
  seat: Seat;
  /** Eldeki taşlardan veya bitişten gelen puan (çarpanlar uygulanmış). */
  base: number;
  /** El içinde yazılan cezalar (çarpanlardan etkilenmez). */
  penalties: number;
  total: number;
}

/** Açmış oyuncunun elindeki taşların cezası: taş değerleri toplamı + her okey için 101. */
export function handPenalty(hand: readonly Tile[], okey: Identity): number {
  return hand.reduce(
    (sum, tile) => sum + identityOf(tile, okey).number + (isJoker(tile, okey) ? OKEY_IN_HAND_PENALTY : 0),
    0,
  );
}

export function computeHandResult(state: HandState, finisher: Seat | null): HandResult {
  const finish = { okey: false, elden: false, pairs: false, multiplier: 1 };
  if (finisher !== null) {
    finish.okey = state.lastDiscard !== null && isJoker(state.lastDiscard, state.okey);
    finish.elden = state.openedAtTurn[finisher] === state.turn.number;
    finish.pairs = state.opened[finisher] === 'pairs';
    finish.multiplier = (finish.okey ? 2 : 1) * (finish.elden ? 2 : 1) * (finish.pairs ? 2 : 1);
  }

  const rows = ([0, 1, 2, 3] as const).map((seat): HandScoreRow => {
    let base: number;
    const opened = state.opened[seat];
    if (seat === finisher) {
      base = FINISH_SCORE * finish.multiplier;
    } else if (finisher !== null && state.config.partnership && seat === (finisher + 2) % 4) {
      // Eşli oyunda biten oyuncunun eşi ceza yazmaz.
      base = 0;
    } else if (opened) {
      base = handPenalty(state.hands[seat]!, state.okey) * finish.multiplier * (opened === 'pairs' ? 2 : 1);
    } else {
      base = state.config.unopenedPenalty * finish.multiplier;
    }
    const penalties = state.penalties[seat]!;
    return { seat, base, penalties, total: base + penalties };
  });

  return { finisher, finish, rows };
}
