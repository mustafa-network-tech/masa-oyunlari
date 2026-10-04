import { describe, expect, it } from 'vitest';
import { combineSeeds } from '../../src/fairness.ts';
import {
  applyAction,
  dealHand,
  DEFAULT_CONFIG,
  openingRequirement,
  type HandState,
  type MeldInput,
  type Seat,
} from '../../src/okey101/index.ts';
import { act, actWithEvents, err, fillers, ids, makeState, t, tiles } from './helpers.ts';

const SEED = combineSeeds('a'.repeat(64), ['1', '2', '3', '4'], 1);

// 46 + 46 + 36 = 128 puanlık açma.
const OPEN_128 = { r: tiles('r10 r11 r12 r13'), b: tiles('b10 b11 b12 b13'), y: tiles('y11 y12 y13') };
const open128: MeldInput[] = [
  { kind: 'run', tileIds: ids(OPEN_128.r) },
  { kind: 'run', tileIds: ids(OPEN_128.b) },
  { kind: 'run', tileIds: ids(OPEN_128.y) },
];
const OPEN_128_TILES = [...OPEN_128.r, ...OPEN_128.b, ...OPEN_128.y];

const FIVE_PAIRS = tiles("r2 r2' b4 b4' y6 y6' k8 k8' r9 r9'");
const pairs = (list: typeof FIVE_PAIRS): MeldInput[] =>
  Array.from({ length: list.length / 2 }, (_, i) => ({ kind: 'pair', tileIds: ids(list.slice(i * 2, i * 2 + 2)) }));

function seat0Hand(extra = fillers(11)) {
  return makeState({ hands: [[...OPEN_128_TILES, ...extra], fillers(5), fillers(5), fillers(5)] });
}

describe('dağıtım', () => {
  it('başlayan 22, diğerleri 21 taş alır; 106 taşın hepsi bir yerdedir', () => {
    const hand = dealHand(DEFAULT_CONFIG, 1, 2, SEED);
    expect(hand.hands.map((h) => h.length)).toEqual([21, 21, 22, 21]);
    expect(hand.stock).toHaveLength(106 - 85 - 1);
    const all = [...hand.hands.flat(), ...hand.stock, hand.indicator].map((x) => x.id);
    expect(new Set(all).size).toBe(106);
  });

  it('gösterge gerçek taştır ve okey göstergenin bir üstüdür', () => {
    const hand = dealHand(DEFAULT_CONFIG, 1, 0, SEED);
    expect(hand.indicator.fake).toBe(false);
    expect(hand.okey.color).toBe(hand.indicator.color);
    expect(hand.okey.number).toBe(hand.indicator.number === 13 ? 1 : hand.indicator.number + 1);
  });

  it('aynı tohum aynı dağıtımı verir', () => {
    expect(dealHand(DEFAULT_CONFIG, 1, 0, SEED)).toEqual(dealHand(DEFAULT_CONFIG, 1, 0, SEED));
  });

  it('başlayan oyuncu ilk turda çekmeden atar', () => {
    const hand = dealHand(DEFAULT_CONFIG, 1, 0, SEED);
    expect(err(hand, 0, { type: 'draw' })).toBe('wrongPhase');
    const next = act(hand, 0, { type: 'discard', tileId: hand.hands[0]![0]!.id });
    expect(next.turn).toMatchObject({ seat: 1, phase: 'draw' });
    expect(err(next, 1, { type: 'discard', tileId: next.hands[1]![0]!.id })).toBe('wrongPhase');
  });

  it('sırası olmayan oyuncu hamle yapamaz', () => {
    const hand = dealHand(DEFAULT_CONFIG, 1, 0, SEED);
    expect(err(hand, 1, { type: 'draw' })).toBe('notYourTurn');
  });

  it('motor mevcut durumu değiştirmez', () => {
    const hand = dealHand(DEFAULT_CONFIG, 1, 0, SEED);
    const before = structuredClone(hand);
    act(hand, 0, { type: 'discard', tileId: hand.hands[0]![0]!.id });
    expect(hand).toEqual(before);
  });
});

describe('açma', () => {
  it('101 ve üzeri perle açılır, taşlar masaya geçer', () => {
    const { state, events } = actWithEvents(seat0Hand(), 0, { type: 'open', melds: open128 });
    expect(state.opened[0]).toBe('sets');
    expect(state.melds).toHaveLength(3);
    expect(state.hands[0]).toHaveLength(11);
    expect(events[0]).toMatchObject({ type: 'opened', seat: 0, kind: 'sets', value: 128 });
  });

  it('101 altı açma reddedilir', () => {
    expect(err(seat0Hand(), 0, { type: 'open', melds: open128.slice(0, 2) })).toBe('belowThreshold');
  });

  it('geçersiz per, elde olmayan taş ve aynı taşı iki kez kullanma reddedilir', () => {
    const s = seat0Hand();
    expect(err(s, 0, { type: 'open', melds: [{ kind: 'run', tileIds: ids(tiles('r10 r11 b12')) }] })).toBe(
      'invalidMeld',
    );
    expect(err(s, 0, { type: 'open', melds: [{ kind: 'run', tileIds: ids(tiles('r1 r2 r3')) }] })).toBe(
      'noSuchTile',
    );
    expect(err(s, 0, { type: 'open', melds: [...open128, open128[0]!] })).toBe('duplicateTile');
  });

  it('elde en az bir taş kalmalıdır', () => {
    const s = makeState({ hands: [OPEN_128_TILES, [], [], []] });
    expect(err(s, 0, { type: 'open', melds: open128 })).toBe('mustKeepOneTile');
  });

  it('5 çiftle açılır, 4 çift yetmez', () => {
    const s = makeState({ hands: [[...FIVE_PAIRS, ...fillers(3)], [], [], []] });
    expect(act(s, 0, { type: 'open', melds: pairs(FIVE_PAIRS) }).opened[0]).toBe('pairs');
    expect(err(s, 0, { type: 'open', melds: pairs(FIVE_PAIRS).slice(0, 4) })).toBe('belowThreshold');
  });

  it('çift ve per aynı açmada karıştırılamaz', () => {
    const s = makeState({ hands: [[...OPEN_128_TILES, ...FIVE_PAIRS, ...fillers(1)], [], [], []] });
    expect(err(s, 0, { type: 'open', melds: [...open128, ...pairs(FIVE_PAIRS)] })).toBe('mixedOpening');
  });

  it('açmış oyuncu tekrar açamaz, açmamış oyuncu per ekleyemez', () => {
    const s = seat0Hand();
    expect(err(s, 0, { type: 'addMelds', melds: open128 })).toBe('notOpened');
    const opened = act(s, 0, { type: 'open', melds: open128 });
    expect(err(opened, 0, { type: 'open', melds: open128 })).toBe('alreadyOpened');
  });

  it('per ile açan sonradan per ekler ama çift ekleyemez', () => {
    const extra = tiles("r6 r7 r8 b2 b2'");
    const s = act(seat0Hand([...extra, ...fillers(3)]), 0, { type: 'open', melds: open128 });
    expect(act(s, 0, { type: 'addMelds', melds: [{ kind: 'run', tileIds: ids(extra.slice(0, 3)) }] }).melds).toHaveLength(4);
    expect(err(s, 0, { type: 'addMelds', melds: [{ kind: 'pair', tileIds: ids(extra.slice(3)) }] })).toBe(
      'noPairsAfterSets',
    );
  });

  it('çifte giden seri veya küt açamaz, yalnızca çift ekler', () => {
    const extra = tiles("r6 r7 r8 b3 b3'");
    const s = makeState({ hands: [[...FIVE_PAIRS, ...extra, ...fillers(2)], [], [], []] });
    const opened = act(s, 0, { type: 'open', melds: pairs(FIVE_PAIRS) });
    expect(err(opened, 0, { type: 'addMelds', melds: [{ kind: 'run', tileIds: ids(extra.slice(0, 3)) }] })).toBe(
      'pairsOnly',
    );
    expect(act(opened, 0, { type: 'addMelds', melds: [{ kind: 'pair', tileIds: ids(extra.slice(3)) }] }).melds).toHaveLength(6);
  });
});

describe('yükselen masa', () => {
  // Koltuk 1: 46 + 46 + 27 = 119 veya + 33 = 152.
  const seat1Melds: MeldInput[] = [
    { kind: 'run', tileIds: ids(tiles("r10' r11' r12' r13'")) },
    { kind: 'run', tileIds: ids(tiles("b10' b11' b12' b13'")) },
    { kind: 'set', tileIds: ids(tiles('r9 b9 k9')) },
    { kind: 'run', tileIds: ids(tiles('k10 k11 k12')) },
  ];
  const seat1Tiles = tiles("r10' r11' r12' r13' b10' b11' b12' b13' r9 b9 k9 k10 k11 k12");

  function afterSeat0Opens(mode: 'fixed' | 'rising'): HandState {
    const s = makeState({
      hands: [[...OPEN_128_TILES, ...fillers(11)], [...seat1Tiles, ...fillers(7)], fillers(5), fillers(5)],
      config: { openingMode: mode },
    });
    const opened = act(s, 0, { type: 'open', melds: open128 });
    const discarded = act(opened, 0, { type: 'discard', tileId: opened.hands[0]![0]!.id });
    return act(discarded, 1, { type: 'draw' });
  }

  it('sonraki açan masadaki en yüksek açmadan en az 1 fazla açmalıdır', () => {
    const s = afterSeat0Opens('rising');
    expect(openingRequirement(s).points).toBe(129);
    expect(err(s, 1, { type: 'open', melds: seat1Melds.slice(0, 3) })).toBe('belowThreshold');
    const opened = act(s, 1, { type: 'open', melds: seat1Melds });
    expect(opened.highestSetsOpening).toBe(152);
    expect(openingRequirement(opened).points).toBe(153);
  });

  it('sabit masada herkes 101 ile açar', () => {
    const s = afterSeat0Opens('fixed');
    expect(openingRequirement(s).points).toBe(101);
    expect(act(s, 1, { type: 'open', melds: seat1Melds.slice(0, 3) }).opened[1]).toBe('sets');
  });

  it('çift açan sonraki oyuncu öncekinden en az 1 çift fazla açmalıdır', () => {
    const six = tiles("r2 r2' b4 b4' y6 y6' k8 k8' r9 r9' b11 b11'");
    const s = makeState({ hands: [[...six, ...fillers(2)], [], [], []], config: { openingMode: 'rising' } });
    const opened = act(s, 0, { type: 'open', melds: pairs(six) });
    expect(openingRequirement(opened).pairs).toBe(7);
  });
});

describe('işleme ve okey alma', () => {
  it('açmamış oyuncu işleyemez; açmış oyuncu başkasının perine işler', () => {
    const s = makeState({
      hands: [[...OPEN_128_TILES, ...fillers(2)], [...tiles('r9'), ...fillers(3)], [], []],
    });
    let state = act(s, 0, { type: 'open', melds: open128 });
    const redRun = state.melds[0]!.id;
    state = act(state, 0, { type: 'discard', tileId: state.hands[0]![0]!.id });
    state = act(state, 1, { type: 'draw' });
    expect(err(state, 1, { type: 'layOff', tileId: t('red', 9).id, meldId: redRun })).toBe('notOpened');

    const opened = { ...state, opened: [state.opened[0]!, 'sets' as const, null, null] };
    const laid = act(opened, 1, { type: 'layOff', tileId: t('red', 9).id, meldId: redRun });
    expect(ids(laid.melds[0]!.tiles)).toEqual(ids(tiles('r9 r10 r11 r12 r13')));
  });

  it('uymayan taş işlenemez', () => {
    const s = act(seat0Hand(tiles('y9 y1 y2')), 0, { type: 'open', melds: open128 });
    expect(err(s, 0, { type: 'layOff', tileId: t('yellow', 9).id, meldId: s.melds[2]!.id })).toBe('cannotLayOff');
  });

  it('masadaki okeyin yerine gerçek taş konup okey ele alınır', () => {
    // Okey siyah 13: k13 jokerdir. Mavi seri b10 [okey] b12 b13.
    const J = t('black', 13);
    const melds: MeldInput[] = [
      open128[0]!,
      { kind: 'run', tileIds: [t('blue', 10).id, J.id, t('blue', 12).id, t('blue', 13).id] },
      open128[2]!,
    ];
    const s = makeState({
      hands: [[...tiles('r10 r11 r12 r13 b10 b12 b13 y11 y12 y13'), J, t('blue', 11), ...fillers(2)], [], [], []],
    });
    const opened = act(s, 0, { type: 'open', melds });
    const swapped = act(opened, 0, { type: 'swapOkey', tileId: t('blue', 11).id, meldId: opened.melds[1]!.id });
    expect(swapped.hands[0]!.some((x) => x.id === J.id)).toBe(true);
    expect(ids(swapped.melds[1]!.tiles)).toEqual(ids(tiles('b10 b11 b12 b13')));
  });
});

describe('yerden taş alma', () => {
  // Koltuk 0 kırmızı 9 atar; koltuk 1 r9 ile açabilir: r9-r13 (55) + b10-b13 (46) = 101.
  const seat1Tiles = tiles("r10' r11' r12' r13' b10' b11' b12' b13'");
  const withR9: MeldInput[] = [
    { kind: 'run', tileIds: ids(tiles("r9 r10' r11' r12' r13'")) },
    { kind: 'run', tileIds: ids(tiles("b10' b11' b12' b13'")) },
  ];

  function afterTake(): HandState {
    const s = makeState({ hands: [[t('red', 9), ...fillers(3)], [...seat1Tiles, ...fillers(4)], [], []] });
    const discarded = act(s, 0, { type: 'discard', tileId: t('red', 9).id });
    return act(discarded, 1, { type: 'takeDiscard' });
  }

  it('alınan taşla açılabilir', () => {
    const opened = act(afterTake(), 1, { type: 'open', melds: withR9 });
    expect(opened.opened[1]).toBe('sets');
    expect(opened.turn.takenTileId).toBeNull();
  });

  it('alınan taş açmada kullanılmazsa açma reddedilir', () => {
    expect(err(afterTake(), 1, { type: 'open', melds: [withR9[1]!] })).toBe('mustUseTakenTile');
  });

  it('alınan taş kullanılmadan taş atılamaz', () => {
    const s = afterTake();
    expect(err(s, 1, { type: 'discard', tileId: s.hands[1]![0]!.id })).toBe('mustUseTakenTile');
  });

  it('kullanılamayan taş geri konur, 101 ceza yazılır ve desteden çekilir', () => {
    const { state, events } = actWithEvents(afterTake(), 1, { type: 'returnTaken' });
    expect(state.penalties[1]).toBe(101);
    expect(state.discards[0]!.at(-1)).toEqual(t('red', 9));
    expect(state.hands[1]!.some((x) => x.id === t('red', 9).id)).toBe(false);
    expect(events).toContainEqual({ type: 'penalty', seat: 1, reason: 'takenNotUsed', amount: 101 });
    expect(err(state, 1, { type: 'takeDiscard' })).toBe('takeBlocked');
    expect(act(state, 1, { type: 'draw' }).turn.phase).toBe('play');
  });

  it('yerde taş yoksa alınamaz', () => {
    const s = makeState({ hands: [[], fillers(3), [], []], seat: 1, phase: 'draw' });
    expect(err(s, 1, { type: 'takeDiscard' })).toBe('emptyDiscard');
  });
});

describe('cezalı hamleler', () => {
  it('okey atmak 101 cezadır', () => {
    const s = makeState({ hands: [[t('black', 13), ...fillers(3)], [], [], []] });
    const { state, events } = actWithEvents(s, 0, { type: 'discard', tileId: t('black', 13).id });
    expect(state.penalties[0]).toBe(101);
    expect(events).toContainEqual({ type: 'penalty', seat: 0, reason: 'okeyDiscard', amount: 101 });
  });

  it('işlenebilir taş atmak 101 cezadır', () => {
    const s = act(seat0Hand([t('red', 9), ...fillers(3)]), 0, { type: 'open', melds: open128 });
    const { state, events } = actWithEvents(s, 0, { type: 'discard', tileId: t('red', 9).id });
    expect(state.penalties[0]).toBe(101);
    expect(events).toContainEqual({ type: 'penalty', seat: 0, reason: 'layOffableDiscard', amount: 101 });
  });

  it('açmamış oyuncu da işlek taş atınca ceza alır', () => {
    let s = act(seat0Hand(), 0, { type: 'open', melds: open128 });
    s = act(s, 0, { type: 'discard', tileId: s.hands[0]![0]!.id });
    s = { ...s, hands: [s.hands[0]!, [t('red', 9, 1), ...fillers(3)], [], []] };
    s = act(s, 1, { type: 'draw' });
    expect(act(s, 1, { type: 'discard', tileId: t('red', 9, 1).id }).penalties[1]).toBe(101);
  });

  it('normal taş atmak cezasızdır', () => {
    const s = makeState({ hands: [fillers(4), [], [], []] });
    expect(act(s, 0, { type: 'discard', tileId: fillers(1)[0]!.id }).penalties[0]).toBe(0);
  });
});

describe('elin sonu', () => {
  it('son taşını atan oyuncu biter', () => {
    const s = makeState({ hands: [[...OPEN_128_TILES, t('yellow', 5)], fillers(3), fillers(3), fillers(3)] });
    const opened = act(s, 0, { type: 'open', melds: open128 });
    const { state, events } = actWithEvents(opened, 0, { type: 'discard', tileId: t('yellow', 5).id });
    expect(state.result?.finisher).toBe(0);
    expect(events.at(-1)?.type).toBe('handOver');
    expect(applyAction(state, 1, { type: 'draw' })).toEqual({ ok: false, error: 'handOver' });
  });

  it('çekilecek taş kalmazsa el bitensiz kapanır', () => {
    const s = makeState({ hands: [fillers(3), fillers(3), [], []], stock: [] });
    const done = act(s, 0, { type: 'discard', tileId: s.hands[0]![0]!.id });
    expect(done.result?.finisher).toBeNull();
  });
});

describe('rastgele oyun', () => {
  it('yüzlerce rastgele hamlede taş kaybolmaz veya çoğalmaz', () => {
    for (let game = 0; game < 30; game++) {
      let state = dealHand(DEFAULT_CONFIG, 1, (game % 4) as Seat, combineSeeds('b'.repeat(64), [String(game)], 1));
      let random = game + 1;
      const next = () => (random = (random * 1103515245 + 12345) % 2 ** 31);
      while (!state.result) {
        const seat = state.turn.seat;
        if (state.turn.phase === 'draw') {
          const take = next() % 3 === 0 && applyAction(state, seat, { type: 'takeDiscard' }).ok;
          state = act(state, seat, { type: take ? 'takeDiscard' : 'draw' });
          if (take) state = act(state, seat, { type: 'returnTaken' });
          if (state.turn.phase === 'draw') state = act(state, seat, { type: 'draw' });
        }
        const hand = state.hands[seat]!;
        state = act(state, seat, { type: 'discard', tileId: hand[next() % hand.length]!.id });
        const all = [...state.hands.flat(), ...state.stock, ...state.discards.flat(), state.indicator];
        expect(new Set(all.map((x) => x.id)).size).toBe(106);
        expect(all).toHaveLength(106);
      }
      expect(state.result.finisher).toBeNull();
    }
  });
});
