import { describe, expect, it } from 'vitest';
import {
  autoAction,
  bestMelds,
  bestPairs,
  chooseAction,
  chooseDiscard,
  DEFAULT_CONFIG,
  trimPlan,
  type Identity,
  type TableConfig,
} from '../../src/okey101/index.ts';
import { act, DEFAULT_OKEY, fillers, ids, makeState, t, tiles } from './helpers.ts';
import { playMatch } from './simulation.ts';

const J = t('black', 13); // DEFAULT_OKEY = siyah 13

describe('el analizi', () => {
  it('en yüksek değerli per kombinasyonunu bulur', () => {
    const hand = [...tiles('r10 r11 r12 r13 b10 b11 b12 b13 y11 y12 y13'), ...fillers(6)];
    const plan = bestMelds(hand, DEFAULT_OKEY);
    expect(plan.value).toBe(128);
    expect(plan.melds).toHaveLength(3);
  });

  it('çakışan seçeneklerden toplamı büyük olanı seçer', () => {
    // r7 ya seriye (r5 r6 r7 = 18) ya küte (r7 b7 y7 = 21) girer; ikisi birden olmaz.
    const plan = bestMelds(tiles('r5 r6 r7 b7 y7'), DEFAULT_OKEY);
    expect(plan.value).toBe(21);
  });

  it('okeyle boşluk doldurur ve okeyin değerini sayar', () => {
    const plan = bestMelds([...tiles('r11 r13'), J], DEFAULT_OKEY);
    expect(plan.value).toBe(36);
    expect(plan.melds[0]!.tileIds).toEqual([t('red', 11).id, J.id, t('red', 13).id]);
  });

  it('aynı seriyi iki kopyayla iki kez kurar', () => {
    expect(bestMelds(tiles("b9 b10 b11 b9' b10' b11'"), DEFAULT_OKEY).value).toBe(60);
  });

  it('çiftleri sayar, tek kalan büyük taşı okeyle eşler', () => {
    const plan = bestPairs([...tiles("r2 r2' b4 b4' y12 k1"), J], DEFAULT_OKEY);
    expect(plan.melds).toHaveLength(3);
    expect(plan.melds[2]!.tileIds).toEqual([t('yellow', 12).id, J.id]);
  });

  it('plan elde en az bir taş bırakacak şekilde küçültülür', () => {
    const hand = tiles('r1 r2 r3 b5 b6 b7');
    const plan = trimPlan(bestMelds(hand, DEFAULT_OKEY), hand.length);
    expect(plan.melds).toHaveLength(1);
    expect(plan.value).toBe(18);
  });
});

describe('bot kararları', () => {
  it('açabiliyorsa açar', () => {
    const s = makeState({ hands: [[...tiles('r10 r11 r12 r13 b10 b11 b12 b13 y11 y12 y13'), ...fillers(4)], [], [], []] });
    expect(chooseAction(s, 0)).toMatchObject({ type: 'open' });
  });

  it('per olmazsa 5 çiftle açar', () => {
    const s = makeState({ hands: [[...tiles("r2 r2' b4 b4' y6 y6' k8 k8' r9 r9'"), ...fillers(4)], [], [], []] });
    const action = chooseAction(s, 0);
    expect(action.type).toBe('open');
    expect(action.type === 'open' && action.melds.every((m) => m.kind === 'pair')).toBe(true);
  });

  it('açamıyorsa taş atar', () => {
    const s = makeState({ hands: [fillers(8), [], [], []] });
    expect(chooseAction(s, 0).type).toBe('discard');
  });

  it('okey ve işlek taş atmaz', () => {
    let s = makeState({ hands: [[...tiles('r10 r11 r12 r13 b10 b11 b12 b13 y11 y12 y13'), ...fillers(4)], [], [], []] });
    s = act(s, 0, { type: 'open', melds: bestMelds(s.hands[0]!, DEFAULT_OKEY).melds });
    s.hands[0] = [J, t('red', 9), t('blue', 2)];
    expect(chooseDiscard(s, 0, 'medium').id).toBe(t('blue', 2).id);
  });

  it('yerdeki taşla açabiliyorsa alır ve açar', () => {
    // Koltuk 0 kırmızı 9 atar. Koltuk 1: r10-r13 + b10-b13 = 92, r9 ile 101.
    const seat1 = [...tiles("r10' r11' r12' r13' b10' b11' b12' b13'"), ...fillers(6)];
    let s = makeState({ hands: [[t('red', 9), ...fillers(3)], seat1, [], []] });
    s = act(s, 0, { type: 'discard', tileId: t('red', 9).id });
    expect(chooseAction(s, 1)).toEqual({ type: 'takeDiscard' });
    s = act(s, 1, { type: 'takeDiscard' });
    const open = chooseAction(s, 1);
    expect(open.type).toBe('open');
    s = act(s, 1, open);
    expect(s.opened[1]).toBe('sets');
  });

  it('işine yaramayan taşı yerden almaz', () => {
    let s = makeState({ hands: [[t('red', 1), ...fillers(3)], fillers(10), [], []] });
    s = act(s, 0, { type: 'discard', tileId: t('red', 1).id });
    expect(chooseAction(s, 1)).toEqual({ type: 'draw' });
  });

  it('elinde yalnızca okey kaldıysa okeyle biter', () => {
    const s = makeState({ hands: [[J], [], [], []] });
    s.opened[0] = 'sets';
    expect(chooseAction(s, 0)).toEqual({ type: 'discard', tileId: J.id });
  });

  it('açtıktan sonra masadaki okeyi alıp kullanır', () => {
    let s = makeState({
      hands: [[...tiles('r10 r11 r12 r13 b10 b12 b13 y11 y12 y13'), J, t('blue', 11), ...fillers(3)], [], [], []],
    });
    s = act(s, 0, {
      type: 'open',
      melds: [
        { kind: 'run', tileIds: ids(tiles('r10 r11 r12 r13')) },
        { kind: 'run', tileIds: [t('blue', 10).id, J.id, t('blue', 12).id, t('blue', 13).id] },
        { kind: 'run', tileIds: ids(tiles('y11 y12 y13')) },
      ],
    });
    expect(chooseAction(s, 0)).toMatchObject({ type: 'swapOkey', tileId: t('blue', 11).id });
  });

  it('otomatik hamle açma yapmaz, cezasız taş atar', () => {
    const s = makeState({ hands: [[...tiles('r10 r11 r12 r13 b10 b11 b12 b13 y11 y12 y13'), J, ...fillers(2)], [], [], []] });
    const action = autoAction(s, 0);
    expect(action.type).toBe('discard');
    expect(action.type === 'discard' && action.tileId).not.toBe(J.id);
  });
});

describe('bot simülasyonu', () => {
  const configs: [string, TableConfig][] = [
    ['sabit, tekli', { ...DEFAULT_CONFIG, hands: 11 }],
    ['yükselen', { ...DEFAULT_CONFIG, hands: 11, openingMode: 'rising' }],
    ['eşli', { ...DEFAULT_CONFIG, hands: 11, partnership: true }],
    ['eşli yükselen, açmamış 303', { ...DEFAULT_CONFIG, hands: 11, partnership: true, openingMode: 'rising', unopenedPenalty: 303 }],
  ];

  it.each(configs)('%s: yüzlerce elde hiç kural dışı hamle yok', (_, config) => {
    let hands = 0;
    for (let m = 0; m < 15; m++) {
      const levels = m % 2 === 0 ? (['medium', 'medium', 'medium', 'medium'] as const) : (['medium', 'easy', 'medium', 'easy'] as const);
      hands += playMatch(config, levels, `${config.openingMode}${config.partnership}${m}`).hands.length;
    }
    expect(hands).toBe(15 * 11);
  });

  it('orta seviye bot oyuncuların çoğu elini açar ve ceza yemez', () => {
    const all = Array.from({ length: 20 }, (_, m) => playMatch(DEFAULT_CONFIG, ['medium', 'medium', 'medium', 'medium'], `stat${m}`).hands).flat();
    const avgOpened = all.reduce((s, h) => s + h.opened, 0) / all.length;
    const finishRate = all.filter((h) => h.finished).length / all.length;
    expect(avgOpened).toBeGreaterThan(2.5);
    expect(finishRate).toBeGreaterThan(0.3);
    expect(all.reduce((s, h) => s + h.penalties, 0)).toBe(0);
  });

  it('orta seviye bot kolay botu açık farkla yener', () => {
    const totals = [0, 0, 0, 0];
    for (let m = 0; m < 20; m++) {
      playMatch(DEFAULT_CONFIG, ['medium', 'easy', 'medium', 'easy'], `vs${m}`).match.totals.forEach((v, i) => (totals[i]! += v));
    }
    expect(totals[0]! + totals[2]!).toBeLessThan((totals[1]! + totals[3]!) * 0.75);
  });
});

it('okey kırmızı 1 iken de analiz doğru çalışır', () => {
  const okey: Identity = { color: 'red', number: 1 };
  // Kırmızı 1 joker; sahte okey kırmızı 1 yerine geçer.
  const plan = bestMelds([t('red', 1), ...tiles('b5 b6 y5')], okey);
  expect(plan.value).toBe(18);
});
