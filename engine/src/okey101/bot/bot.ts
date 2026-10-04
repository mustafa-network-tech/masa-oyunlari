// 101 botu. Boş koltukları doldurur, bağlantısı kopan oyuncunun yerine oynar ve süre dolunca otomatik hamle yapar.
//
// `chooseAction` her çağrıda tek bir hamle döner. Sunucu hamleyi uygular ve sıra bottan çıkana kadar
// (taş atana kadar) tekrar çağırır. Bot yalnızca kendi elini ve masadaki açık bilgileri kullanır.

import { SeededRandom } from '../../fairness.ts';
import { applyAction, openingRequirement, previousSeat, type Action, type HandState, type Seat } from '../game.ts';
import { canLayOffAnywhere, layOff, swapJoker } from '../melds.ts';
import { COLORS, identityOf, isJoker, type Tile } from '../tiles.ts';
import { bestMelds, bestPairs, keyOf, trimPlan } from './analysis.ts';

export type BotLevel = 'easy' | 'medium';

export interface BotOptions {
  level: BotLevel;
  /** Kolay botun rastgeleliği için; verilmezse durumdan türetilir (belirlenimci). */
  random?: SeededRandom;
}

export function chooseAction(state: HandState, seat: Seat, options: BotOptions = { level: 'medium' }): Action {
  const hand = state.hands[seat]!;
  const opened = state.opened[seat];
  const random = options.random ?? new SeededRandom(`bot:${state.handNumber}:${state.turn.number}:${seat}:${hand.length}`);

  if (state.turn.phase === 'draw') {
    if (options.level === 'medium' && !state.turn.mustDrawFromStock && shouldTakeDiscard(state, seat)) {
      return { type: 'takeDiscard' };
    }
    return { type: 'draw' };
  }

  // Yerden alınan taş bu tur kullanılmalı.
  const takenId = state.turn.takenTileId;
  if (takenId !== null) return useTakenTile(state, seat, takenId) ?? { type: 'returnTaken' };

  if (!opened) {
    const opening = openingAction(state, seat);
    if (opening) return opening;
    return { type: 'discard', tileId: chooseDiscard(state, seat, options.level, random).id };
  }

  return meldingAction(state, seat) ?? { type: 'discard', tileId: chooseDiscard(state, seat, options.level, random).id };
}

/** Süre dolunca yapılacak otomatik hamle: çek, aldığı taşı geri koy, en işe yaramaz taşı at. Açma yapılmaz. */
export function autoAction(state: HandState, seat: Seat): Action {
  if (state.turn.phase === 'draw') return { type: 'draw' };
  if (state.turn.takenTileId !== null) return { type: 'returnTaken' };
  return { type: 'discard', tileId: chooseDiscard(state, seat, 'medium').id };
}

// ---------------------------------------------------------------------------
// Yerden alma

function shouldTakeDiscard(state: HandState, seat: Seat): boolean {
  const tile = state.discards[previousSeat(seat)]!.at(-1);
  if (!tile) return false;
  const hand = [...state.hands[seat]!, tile];
  const simulated: HandState = {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? hand : h)),
    discards: state.discards.map((d, i) => (i === previousSeat(seat) ? d.slice(0, -1) : d)),
    turn: { ...state.turn, phase: 'play', takenTileId: tile.id },
  };
  return useTakenTile(simulated, seat, tile.id) !== null;
}

/** Yerden alınan taşı kullanan hamle; kullanılamıyorsa null. */
function useTakenTile(state: HandState, seat: Seat, takenId: number): Action | null {
  const hand = state.hands[seat]!;
  const opened = state.opened[seat];

  if (!opened) {
    const action = openingAction(state, seat, takenId);
    return action && action.type === 'open' && action.melds.some((m) => m.tileIds.includes(takenId)) ? action : null;
  }

  const tile = hand.find((t) => t.id === takenId)!;
  if (hand.length > 1) {
    for (const meld of state.melds) {
      for (const end of ['end', 'start'] as const) {
        if (layOff(meld.kind, meld.tiles, tile, state.okey, end)) return { type: 'layOff', tileId: takenId, meldId: meld.id, end };
      }
    }
    const swap = state.melds.find((m) => swapJoker(m.kind, m.tiles, tile, state.okey));
    if (swap) return { type: 'swapOkey', tileId: takenId, meldId: swap.id };
  }
  const plan = trimPlan(opened === 'pairs' ? bestPairs(hand, state.okey, takenId) : bestMelds(hand, state.okey, takenId), hand.length);
  const melds = plan.melds.filter((m) => m.tileIds.includes(takenId));
  return melds.length > 0 ? { type: 'addMelds', melds } : null;
}

// ---------------------------------------------------------------------------
// Açma ve per işleme

/** Açılabiliyorsa açma hamlesi. Per tercih edilir; olmazsa çift. */
function openingAction(state: HandState, seat: Seat, preferId?: number): Action | null {
  const hand = state.hands[seat]!;
  const required = openingRequirement(state);

  const sets = trimPlan(bestMelds(hand, state.okey, preferId), hand.length);
  if (sets.value >= required.points && isValid(state, seat, { type: 'open', melds: sets.melds })) {
    return { type: 'open', melds: sets.melds };
  }
  const pairs = trimPlan(bestPairs(hand, state.okey, preferId), hand.length);
  if (pairs.melds.length >= required.pairs && isValid(state, seat, { type: 'open', melds: pairs.melds })) {
    return { type: 'open', melds: pairs.melds };
  }
  return null;
}

/** Açmış oyuncu için: okey al, yeni per aç, taş işle. Yapacak bir şey yoksa null (sıra atmaya gelir). */
function meldingAction(state: HandState, seat: Seat): Action | null {
  const hand = state.hands[seat]!;
  const okey = state.okey;
  const realTiles = hand.filter((t) => !isJoker(t, okey));

  // 1. Masadaki okeyi gerçek taşla değiştirip ele al.
  for (const tile of realTiles) {
    const meld = state.melds.find((m) => swapJoker(m.kind, m.tiles, tile, okey));
    if (meld) return { type: 'swapOkey', tileId: tile.id, meldId: meld.id };
  }

  // 2. Elde yeni per varsa aç.
  const plan = trimPlan(state.opened[seat] === 'pairs' ? bestPairs(hand, okey) : bestMelds(hand, okey), hand.length);
  if (plan.melds.length > 0) return { type: 'addMelds', melds: plan.melds };

  // 3. Gerçek taşları işle (en büyük sayılardan başlayarak, elde en az bir taş kalsın).
  if (hand.length > 1) {
    const sorted = [...realTiles].sort((a, b) => identityOf(b, okey).number - identityOf(a, okey).number);
    for (const tile of sorted) {
      for (const meld of state.melds) {
        if (layOff(meld.kind, meld.tiles, tile, okey)) return { type: 'layOff', tileId: tile.id, meldId: meld.id };
      }
    }
  }

  // 4. Okey elde kaldıysa ve başka taş varsa işle (elde okey kalması +101 ceza).
  //    Elde yalnızca okey kaldıysa işlemeyiz: okeyle bitmek ×2 kazandırır.
  const joker = hand.find((t) => isJoker(t, okey));
  if (joker && hand.length > 1) {
    for (const meld of state.melds) {
      for (const end of ['end', 'start'] as const) {
        if (layOff(meld.kind, meld.tiles, joker, okey, end)) return { type: 'layOff', tileId: joker.id, meldId: meld.id, end };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Taş atma

/** Atılacak en işe yaramaz taş. Cezalı taşlar (okey, işlek taş) mümkünse atılmaz. */
export function chooseDiscard(state: HandState, seat: Seat, level: BotLevel, random?: SeededRandom): Tile {
  const hand = state.hands[seat]!;
  const okey = state.okey;
  // Tek taş kaldıysa onu atmak eli bitirir; bitiş hamlesine ceza yazılmaz.
  if (hand.length === 1) return hand[0]!;

  const penalized = (tile: Tile) => isJoker(tile, okey) || canLayOffAnywhere(state.melds, tile, okey);
  const safe = hand.filter((t) => !penalized(t));
  const pool = safe.length > 0 ? safe : hand;

  if (level === 'easy' && random && random.int(2) === 0) return pool[random.int(pool.length)]!;

  const opened = state.opened[seat];
  const plan = opened ? null : bestMelds(hand, okey);
  const counts = new Map<number, number>();
  for (const tile of hand) {
    if (isJoker(tile, okey)) continue;
    const key = keyOf(identityOf(tile, okey));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const has = (color: number, number: number) =>
    number >= 1 && number <= 13 && (counts.get(color * 13 + number - 1) ?? 0) > 0;

  const keepScore = (tile: Tile): number => {
    if (isJoker(tile, okey)) return 1000;
    const id = identityOf(tile, okey);
    const c = COLORS.indexOf(id.color);
    let score = 0;
    // Seri ve küt olasılığı: komşu taşlar ve aynı sayının diğer renkleri.
    if (has(c, id.number - 1) || has(c, id.number + 1)) score += 10;
    if (has(c, id.number - 2) || has(c, id.number + 2)) score += 4;
    score += [0, 1, 2, 3].filter((other) => other !== c && has(other, id.number)).length * 6;
    if ((counts.get(keyOf(id)) ?? 0) >= 2) score += opened === 'pairs' ? 0 : 8;
    if (!opened) {
      if (plan!.usedTileIds.has(tile.id)) score += 50;
      // Açmak için büyük taşlar daha değerli.
      score += id.number * 0.5;
    } else {
      // Açtıktan sonra eldeki her taş ceza: büyükleri önce at.
      score -= id.number;
    }
    return score;
  };

  return pool.reduce((worst, tile) => {
    const diff = keepScore(tile) - keepScore(worst);
    return diff < 0 || (diff === 0 && tile.id < worst.id) ? tile : worst;
  });
}

function isValid(state: HandState, seat: Seat, action: Action): boolean {
  return applyAction(state, seat, action).ok;
}
