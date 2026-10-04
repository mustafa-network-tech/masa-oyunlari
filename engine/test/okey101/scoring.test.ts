import { describe, expect, it } from 'vitest';
import { computeHandResult, handPenalty, type HandState, type OpenKind } from '../../src/okey101/index.ts';
import { act, DEFAULT_OKEY, FAKE_1, makeState, t, tiles } from './helpers.ts';

const JOKER = t('black', 13); // DEFAULT_OKEY = siyah 13

interface Setup {
  /** Biten oyuncunun (koltuk 0) elinde kalan son taş. */
  last?: ReturnType<typeof t>;
  finisherOpened?: OpenKind;
  /** Koltuk 0 bu tur mu açtı (elden bitme)? */
  elden?: boolean;
  partnership?: boolean;
  unopenedPenalty?: 101 | 202 | 303;
  penalties?: number[];
}

/**
 * Koltuk 0 son taşını atarak biter.
 * Koltuk 1: açmış, elinde r1 r2 (3 puan). Koltuk 2: açmamış. Koltuk 3: açmış, elinde okey + y4 (13 + 101 + 4 = 118).
 */
function finish(o: Setup = {}): HandState {
  const s = makeState({
    hands: [[o.last ?? t('yellow', 5)], tiles('r1 r2'), tiles('b1 b2 b3'), [JOKER, t('yellow', 4)]],
    config: { partnership: o.partnership ?? false, unopenedPenalty: o.unopenedPenalty ?? 202 },
  });
  s.turn.number = 9;
  s.opened = [o.finisherOpened ?? 'sets', 'sets', null, 'sets'];
  s.openedAtTurn = [o.elden ? 9 : 3, 4, null, 5];
  if (o.penalties) s.penalties = o.penalties;
  const done = act(s, 0, { type: 'discard', tileId: s.hands[0]![0]!.id });
  return done;
}

const totals = (s: HandState) => s.result!.rows.map((r) => r.total);

describe('el puanlaması', () => {
  it('normal bitiş: biten −101, açmış elindeki toplam, açmamış 202', () => {
    expect(totals(finish())).toEqual([-101, 3, 202, 118]);
  });

  it('okey atarak bitiş her şeyi 2 ile katlar', () => {
    const s = finish({ last: JOKER });
    expect(s.result!.finish).toMatchObject({ okey: true, multiplier: 2 });
    // Koltuk 3'ün elindeki okeyi koltuk 0 attığı için okey yalnızca bir tane: koltuk 3'te başka okey yok.
    expect(totals(s)).toEqual([-202, 6, 404, 236]);
  });

  it('elden bitiş 2 ile katlar', () => {
    const s = finish({ elden: true });
    expect(s.result!.finish).toMatchObject({ elden: true, multiplier: 2 });
    expect(totals(s)).toEqual([-202, 6, 404, 236]);
  });

  it('elden ve okeyle bitiş 4 ile katlar', () => {
    expect(totals(finish({ elden: true, last: JOKER }))).toEqual([-404, 12, 808, 472]);
  });

  it('çiftle bitiş 2 ile katlar; çiftle açıp okeyle biten −404 alır', () => {
    expect(totals(finish({ finisherOpened: 'pairs' }))[0]).toBe(-202);
    expect(totals(finish({ finisherOpened: 'pairs', last: JOKER }))[0]).toBe(-404);
  });

  it('çifte gitmiş oyuncunun cezası 2 katıdır', () => {
    const s = makeState({ hands: [[t('yellow', 5)], tiles('r1 r2'), [], []] });
    s.opened = ['sets', 'pairs', null, null];
    s.openedAtTurn = [0, 0, null, null];
    expect(totals(act(s, 0, { type: 'discard', tileId: t('yellow', 5).id }))[1]).toBe(6);
  });

  it('el içi cezalar çarpanlardan etkilenmeden eklenir', () => {
    const s = finish({ last: JOKER, penalties: [0, 0, 101, 0] });
    expect(s.result!.rows[2]).toMatchObject({ base: 404, penalties: 101, total: 505 });
  });

  it('eşli oyunda bitenin eşi 0 yazar, karşı takım cezasını yazar', () => {
    const s = finish({ partnership: true });
    expect(totals(s)).toEqual([-101, 3, 0, 118]);
  });

  it('açmamış cezası masa ayarına göre değişir', () => {
    expect(totals(finish({ unopenedPenalty: 101 }))[2]).toBe(101);
    expect(totals(finish({ unopenedPenalty: 303 }))[2]).toBe(303);
  });

  it('deste biterse çarpan yoktur, herkes kendi cezasını yazar', () => {
    const s = makeState({ hands: [tiles('r1 r2'), tiles('b5'), tiles('y1'), [JOKER]] });
    s.opened = ['sets', null, 'pairs', 'sets'];
    const result = computeHandResult(s, null);
    expect(result.finisher).toBeNull();
    expect(result.rows.map((r) => r.total)).toEqual([3, 202, 2, 114]);
  });
});

describe('eldeki taş cezası', () => {
  it('okey yüz değeri + 101, sahte okey yalnızca okeyin değeri sayılır', () => {
    expect(handPenalty([JOKER], DEFAULT_OKEY)).toBe(114);
    expect(handPenalty([FAKE_1], DEFAULT_OKEY)).toBe(13);
    expect(handPenalty(tiles('r1 b10 y7'), DEFAULT_OKEY)).toBe(18);
  });
});
