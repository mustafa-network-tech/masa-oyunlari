import { describe, expect, it } from 'vitest';
import {
  advanceMatch,
  createMatch,
  DEFAULT_CONFIG,
  isMatchOver,
  standing,
  type HandResult,
  type MatchState,
  type TableConfig,
} from '../../src/okey101/index.ts';

const seed = (n: number) => `seed-${n}`;

/** Eli verilen puanlarla bitmiş say. */
function finishHand(match: MatchState, scores: number[]): MatchState {
  const result: HandResult = {
    finisher: 0,
    finish: { okey: false, elden: false, pairs: false, multiplier: 1 },
    rows: scores.map((total, seat) => ({ seat: seat as 0 | 1 | 2 | 3, base: total, penalties: 0, total })),
  };
  return { ...match, hand: { ...match.hand, result } };
}

describe('maç', () => {
  it('her elde başlama sırası bir sonraki oyuncuya geçer ve puanlar toplanır', () => {
    let match = createMatch({ ...DEFAULT_CONFIG, hands: 5 }, 3, seed(1));
    expect(match.hand.starter).toBe(3);
    match = advanceMatch(finishHand(match, [-101, 20, 202, 40]), seed(2));
    expect(match.hand.starter).toBe(0);
    expect(match.hand.handNumber).toBe(2);
    match = advanceMatch(finishHand(match, [30, -101, 202, 10]), seed(3));
    expect(match.totals).toEqual([-71, -81, 404, 50]);
  });

  it('el sayısı dolunca maç biter ve en düşük puan kazanır', () => {
    let match = createMatch({ ...DEFAULT_CONFIG, hands: 5 }, 0, seed(1));
    for (let i = 0; i < 5; i++) {
      expect(isMatchOver(match)).toBe(false);
      match = advanceMatch(finishHand(match, [10, -101, 50, 202]), i < 4 ? seed(i + 2) : null);
    }
    expect(isMatchOver(match)).toBe(true);
    expect(standing(match)).toEqual({ scores: [50, -505, 250, 1010], leaders: [1] });
  });

  it('bitmemiş el ilerletilemez', () => {
    const match = createMatch(DEFAULT_CONFIG, 0, seed(1));
    expect(() => advanceMatch(match, seed(2))).toThrow();
  });

  it('eşli maçta takım puanları toplanır', () => {
    const config: TableConfig = { ...DEFAULT_CONFIG, hands: 5, partnership: true };
    let match = createMatch(config, 0, seed(1));
    match = advanceMatch(finishHand(match, [-101, 20, 0, 40]), seed(2));
    expect(standing(match)).toEqual({ scores: [-101, 60], leaders: [0] });
  });
});
