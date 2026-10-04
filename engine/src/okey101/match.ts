// Maç: 5/7/9/11 el, toplam puanı en düşük olan kazanır. Bkz. docs/02-101-kurallari.md §9

import { dealHand, nextSeat, type HandState, type Seat, type TableConfig } from './game.ts';
import type { HandResult } from './scoring.ts';

export interface MatchState {
  config: TableConfig;
  hand: HandState;
  history: HandResult[];
  /** Koltuk başına toplam puan. */
  totals: number[];
}

export function createMatch(config: TableConfig, firstStarter: Seat, seed: string): MatchState {
  return {
    config,
    hand: dealHand(config, 1, firstStarter, seed),
    history: [],
    totals: [0, 0, 0, 0],
  };
}

/** Biten eli maç geçmişine işler. Sonraki el varsa başlatır; başlama sırası bir sonraki oyuncuya geçer. */
export function advanceMatch(match: MatchState, nextSeed: string | null): MatchState {
  const result = match.hand.result;
  if (!result) throw new Error('El henüz bitmedi');
  const history = [...match.history, result];
  const totals = match.totals.map((total, seat) => total + result.rows[seat]!.total);
  if (history.length >= match.config.hands) return { ...match, history, totals };
  if (nextSeed === null) throw new Error('Sonraki el için tohum gerekli');
  const hand = dealHand(match.config, history.length + 1, nextSeat(match.hand.starter), nextSeed);
  return { ...match, hand, history, totals };
}

export function isMatchOver(match: MatchState): boolean {
  return match.history.length >= match.config.hands;
}

export interface Standing {
  /** Tekli: koltuk başına; eşli: takım başına (takım 0 = koltuk 0+2, takım 1 = koltuk 1+3). */
  scores: number[];
  /** En düşük puana sahip koltuk(lar) veya takım(lar). Beraberlikte birden fazla. */
  leaders: number[];
}

export function standing(match: MatchState): Standing {
  const scores = match.config.partnership
    ? [match.totals[0]! + match.totals[2]!, match.totals[1]! + match.totals[3]!]
    : [...match.totals];
  const best = Math.min(...scores);
  return { scores, leaders: scores.flatMap((s, i) => (s === best ? [i] : [])) };
}
