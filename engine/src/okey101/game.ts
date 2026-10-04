// 101 elinin durum makinesi. Bkz. docs/02-101-kurallari.md
//
// Motor saftır: `applyAction` mevcut durumu değiştirmez, yeni durum ve olayları döner.
// Sunucu her hamleyi buradan geçirir; istemci hiçbir sonuca kendisi karar vermez.

import { shuffle } from '../fairness.ts';
import { analyzeMeld, canLayOffAnywhere, layOff, swapJoker, type LayOffEnd, type MeldKind } from './melds.ts';
import { computeHandResult, type HandResult } from './scoring.ts';
import { createTileSet, isJoker, okeyFromIndicator, type Identity, type Tile } from './tiles.ts';

export type Seat = 0 | 1 | 2 | 3;
export const SEATS: readonly Seat[] = [0, 1, 2, 3];

export interface TableConfig {
  /** Sabit: her açan 101 ile açar. Yükselen: her yeni açan masadaki en yüksek açmayı geçmeli. */
  openingMode: 'fixed' | 'rising';
  hands: 5 | 7 | 9 | 11;
  partnership: boolean;
  unopenedPenalty: 101 | 202 | 303;
}

export const DEFAULT_CONFIG: TableConfig = {
  openingMode: 'fixed',
  hands: 7,
  partnership: false,
  unopenedPenalty: 202,
};

export const OPENING_POINTS = 101;
export const OPENING_PAIRS = 5;
export const PENALTY = 101;

export type OpenKind = 'sets' | 'pairs';

export interface TableMeld {
  id: number;
  kind: MeldKind;
  owner: Seat;
  tiles: Tile[];
}

export interface HandState {
  config: TableConfig;
  handNumber: number;
  starter: Seat;
  indicator: Tile;
  okey: Identity;
  stock: Tile[];
  hands: Tile[][];
  /** Her oyuncunun attığı taşlar; dizinin sonu en üstteki taştır. */
  discards: Tile[][];
  melds: TableMeld[];
  nextMeldId: number;
  opened: (OpenKind | null)[];
  /** Oyuncunun açtığı turun numarası (elden bitme kontrolü için). */
  openedAtTurn: (number | null)[];
  /** Yükselen masa için şimdiye kadarki en yüksek açmalar. */
  highestSetsOpening: number;
  highestPairsOpening: number;
  turn: {
    seat: Seat;
    number: number;
    phase: 'draw' | 'play';
    /** Yerden alınıp bu tur kullanılması gereken taş. */
    takenTileId: number | null;
    /** Yerden aldığı taşı kullanamayıp geri koyan oyuncu desteden çekmek zorunda. */
    mustDrawFromStock: boolean;
  };
  /** El içinde yazılan cezalar (işlek taş atma, okey atma, yerden alıp kullanamama). */
  penalties: number[];
  lastDiscard: Tile | null;
  result: HandResult | null;
}

export interface MeldInput {
  kind: MeldKind;
  /** Seri için taşlar küçükten büyüğe sıralı verilir. */
  tileIds: number[];
}

export type Action =
  | { type: 'draw' }
  | { type: 'takeDiscard' }
  | { type: 'returnTaken' }
  | { type: 'open'; melds: MeldInput[] }
  | { type: 'addMelds'; melds: MeldInput[] }
  | { type: 'layOff'; tileId: number; meldId: number; end?: LayOffEnd }
  | { type: 'swapOkey'; tileId: number; meldId: number }
  | { type: 'discard'; tileId: number };

export type PenaltyReason = 'layOffableDiscard' | 'okeyDiscard' | 'takenNotUsed';

export type GameEvent =
  | { type: 'drew'; seat: Seat }
  | { type: 'tookDiscard'; seat: Seat; tile: Tile }
  | { type: 'returnedTaken'; seat: Seat; tile: Tile }
  | { type: 'opened'; seat: Seat; kind: OpenKind; value: number; meldIds: number[] }
  | { type: 'meldsAdded'; seat: Seat; meldIds: number[] }
  | { type: 'laidOff'; seat: Seat; tile: Tile; meldId: number }
  | { type: 'swappedOkey'; seat: Seat; tile: Tile; meldId: number }
  | { type: 'discarded'; seat: Seat; tile: Tile }
  | { type: 'penalty'; seat: Seat; reason: PenaltyReason; amount: number }
  | { type: 'turn'; seat: Seat }
  | { type: 'handOver'; result: HandResult };

export type ActionError =
  | 'handOver'
  | 'notYourTurn'
  | 'wrongPhase'
  | 'noSuchTile'
  | 'noSuchMeld'
  | 'duplicateTile'
  | 'invalidMeld'
  | 'belowThreshold'
  | 'mixedOpening'
  | 'alreadyOpened'
  | 'notOpened'
  | 'pairsOnly'
  | 'noPairsAfterSets'
  | 'cannotLayOff'
  | 'cannotSwap'
  | 'emptyDiscard'
  | 'takeBlocked'
  | 'noTakenTile'
  | 'mustUseTakenTile'
  | 'mustKeepOneTile';

export type ActionResult = { ok: true; state: HandState; events: GameEvent[] } | { ok: false; error: ActionError };

export const nextSeat = (seat: Seat): Seat => ((seat + 1) % 4) as Seat;
/** Taşını alabildiğimiz oyuncu: sıradaki önceki oyuncu. */
export const previousSeat = (seat: Seat): Seat => ((seat + 3) % 4) as Seat;
export const partnerOf = (seat: Seat): Seat => ((seat + 2) % 4) as Seat;

/** Karıştırılmış desteden eli kurar. Başlayan 22, diğerleri 21 taş alır. */
export function dealHand(config: TableConfig, handNumber: number, starter: Seat, seed: string): HandState {
  const deck = shuffle(createTileSet(), seed);
  // Gösterge: destenin sonundan ilk gerçek taş. Göstergeden sonra oyunda kullanılmaz.
  let indicatorIndex = deck.length - 1;
  while (deck[indicatorIndex]!.fake) indicatorIndex--;
  const [indicator] = deck.splice(indicatorIndex, 1) as [Tile];

  const hands: Tile[][] = [[], [], [], []];
  let seat = starter;
  for (let i = 0; i < 4; i++) {
    hands[seat] = deck.splice(0, seat === starter ? 22 : 21);
    seat = nextSeat(seat);
  }

  return {
    config,
    handNumber,
    starter,
    indicator,
    okey: okeyFromIndicator(indicator),
    stock: deck,
    hands,
    discards: [[], [], [], []],
    melds: [],
    nextMeldId: 1,
    opened: [null, null, null, null],
    openedAtTurn: [null, null, null, null],
    highestSetsOpening: 0,
    highestPairsOpening: 0,
    // Başlayan oyuncunun 22 taşı var; ilk turda çekmeden atar.
    turn: { seat: starter, number: 1, phase: 'play', takenTileId: null, mustDrawFromStock: false },
    penalties: [0, 0, 0, 0],
    lastDiscard: null,
    result: null,
  };
}

/** Açma için gereken en düşük değer (per) ve çift sayısı. */
export function openingRequirement(state: HandState): { points: number; pairs: number } {
  if (state.config.openingMode === 'fixed') return { points: OPENING_POINTS, pairs: OPENING_PAIRS };
  return {
    points: Math.max(OPENING_POINTS, state.highestSetsOpening + 1),
    pairs: Math.max(OPENING_PAIRS, state.highestPairsOpening + 1),
  };
}

export function applyAction(current: HandState, seat: Seat, action: Action): ActionResult {
  if (current.result) return fail('handOver');
  if (current.turn.seat !== seat) return fail('notYourTurn');

  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const hand = state.hands[seat]!;
  const turn = state.turn;

  const handTile = (id: number) => hand.find((t) => t.id === id);
  const removeFromHand = (ids: number[]) => {
    const remove = new Set(ids);
    for (let i = hand.length - 1; i >= 0; i--) if (remove.has(hand[i]!.id)) hand.splice(i, 1);
    if (turn.takenTileId !== null && remove.has(turn.takenTileId)) turn.takenTileId = null;
  };

  switch (action.type) {
    case 'draw': {
      if (turn.phase !== 'draw') return fail('wrongPhase');
      hand.push(state.stock.pop()!);
      turn.phase = 'play';
      events.push({ type: 'drew', seat });
      break;
    }

    case 'takeDiscard': {
      if (turn.phase !== 'draw') return fail('wrongPhase');
      if (turn.mustDrawFromStock) return fail('takeBlocked');
      const tile = state.discards[previousSeat(seat)]!.pop();
      if (!tile) return fail('emptyDiscard');
      hand.push(tile);
      turn.phase = 'play';
      turn.takenTileId = tile.id;
      events.push({ type: 'tookDiscard', seat, tile });
      break;
    }

    case 'returnTaken': {
      if (turn.phase !== 'play') return fail('wrongPhase');
      const tile = turn.takenTileId === null ? undefined : handTile(turn.takenTileId);
      if (!tile) return fail('noTakenTile');
      removeFromHand([tile.id]);
      state.discards[previousSeat(seat)]!.push(tile);
      state.penalties[seat]! += PENALTY;
      turn.phase = 'draw';
      turn.mustDrawFromStock = true;
      events.push({ type: 'returnedTaken', seat, tile });
      events.push({ type: 'penalty', seat, reason: 'takenNotUsed', amount: PENALTY });
      break;
    }

    case 'open':
    case 'addMelds': {
      if (turn.phase !== 'play') return fail('wrongPhase');
      const opening = action.type === 'open';
      const openedAs = state.opened[seat];
      if (opening && openedAs) return fail('alreadyOpened');
      if (!opening && !openedAs) return fail('notOpened');

      const parsed = parseMelds(action.melds, hand, state.okey);
      if (typeof parsed === 'string') return fail(parsed);
      if (parsed.length === 0) return fail('invalidMeld');
      const allPairs = parsed.every((m) => m.kind === 'pair');
      const anyPairs = parsed.some((m) => m.kind === 'pair');
      if (anyPairs && !allPairs) return fail('mixedOpening');
      // Çifte giden yalnızca çift ekler; per ile açan çift ekleyemez.
      if (openedAs === 'pairs' && !allPairs) return fail('pairsOnly');
      if (openedAs === 'sets' && anyPairs) return fail('noPairsAfterSets');

      const usedIds = parsed.flatMap((m) => m.tiles.map((t) => t.id));
      if (usedIds.length >= hand.length) return fail('mustKeepOneTile');

      let value = 0;
      if (opening) {
        const required = openingRequirement(state);
        // Yerden alınan taşla açan oyuncu o taşı açmada kullanmak zorunda.
        if (turn.takenTileId !== null && !usedIds.includes(turn.takenTileId)) return fail('mustUseTakenTile');
        if (allPairs) {
          if (parsed.length < required.pairs) return fail('belowThreshold');
          state.highestPairsOpening = Math.max(state.highestPairsOpening, parsed.length);
        } else {
          value = parsed.reduce((sum, m) => sum + m.value, 0);
          if (value < required.points) return fail('belowThreshold');
          state.highestSetsOpening = Math.max(state.highestSetsOpening, value);
        }
        state.opened[seat] = allPairs ? 'pairs' : 'sets';
        state.openedAtTurn[seat] = turn.number;
      }

      removeFromHand(usedIds);
      const meldIds = parsed.map((m) => {
        const id = state.nextMeldId++;
        state.melds.push({ id, kind: m.kind, owner: seat, tiles: m.tiles });
        return id;
      });
      events.push(
        opening
          ? { type: 'opened', seat, kind: state.opened[seat]!, value, meldIds }
          : { type: 'meldsAdded', seat, meldIds },
      );
      break;
    }

    case 'layOff': {
      if (turn.phase !== 'play') return fail('wrongPhase');
      if (!state.opened[seat]) return fail('notOpened');
      const tile = handTile(action.tileId);
      if (!tile) return fail('noSuchTile');
      const meld = state.melds.find((m) => m.id === action.meldId);
      if (!meld) return fail('noSuchMeld');
      if (hand.length <= 1) return fail('mustKeepOneTile');
      const next = layOff(meld.kind, meld.tiles, tile, state.okey, action.end);
      if (!next) return fail('cannotLayOff');
      meld.tiles = next;
      removeFromHand([tile.id]);
      events.push({ type: 'laidOff', seat, tile, meldId: meld.id });
      break;
    }

    case 'swapOkey': {
      if (turn.phase !== 'play') return fail('wrongPhase');
      if (!state.opened[seat]) return fail('notOpened');
      const tile = handTile(action.tileId);
      if (!tile) return fail('noSuchTile');
      const meld = state.melds.find((m) => m.id === action.meldId);
      if (!meld) return fail('noSuchMeld');
      const swapped = swapJoker(meld.kind, meld.tiles, tile, state.okey);
      if (!swapped) return fail('cannotSwap');
      meld.tiles = swapped.tiles;
      removeFromHand([tile.id]);
      hand.push(swapped.joker);
      events.push({ type: 'swappedOkey', seat, tile, meldId: meld.id });
      break;
    }

    case 'discard': {
      if (turn.phase !== 'play') return fail('wrongPhase');
      if (turn.takenTileId !== null) return fail('mustUseTakenTile');
      const tile = handTile(action.tileId);
      if (!tile) return fail('noSuchTile');
      removeFromHand([tile.id]);
      state.discards[seat]!.push(tile);
      state.lastDiscard = tile;
      events.push({ type: 'discarded', seat, tile });

      const finished = hand.length === 0;
      if (finished) {
        state.result = computeHandResult(state, seat);
        events.push({ type: 'handOver', result: state.result });
        break;
      }

      // Bitiş hamlesi dışında okey atmak ve işlek taş atmak cezalıdır.
      const reason: PenaltyReason | null = isJoker(tile, state.okey)
        ? 'okeyDiscard'
        : canLayOffAnywhere(state.melds, tile, state.okey)
          ? 'layOffableDiscard'
          : null;
      if (reason) {
        state.penalties[seat]! += PENALTY;
        events.push({ type: 'penalty', seat, reason, amount: PENALTY });
      }

      // Çekilecek taş kalmadıysa el bitensiz kapanır.
      if (state.stock.length === 0) {
        state.result = computeHandResult(state, null);
        events.push({ type: 'handOver', result: state.result });
        break;
      }

      state.turn = {
        seat: nextSeat(seat),
        number: turn.number + 1,
        phase: 'draw',
        takenTileId: null,
        mustDrawFromStock: false,
      };
      events.push({ type: 'turn', seat: state.turn.seat });
      break;
    }
  }

  return { ok: true, state, events };
}

interface ParsedMeld {
  kind: MeldKind;
  tiles: Tile[];
  value: number;
}

function parseMelds(inputs: readonly MeldInput[], hand: readonly Tile[], okey: Identity): ParsedMeld[] | ActionError {
  const seen = new Set<number>();
  const result: ParsedMeld[] = [];
  for (const input of inputs) {
    const tiles: Tile[] = [];
    for (const id of input.tileIds) {
      if (seen.has(id)) return 'duplicateTile';
      seen.add(id);
      const tile = hand.find((t) => t.id === id);
      if (!tile) return 'noSuchTile';
      tiles.push(tile);
    }
    const info = analyzeMeld(input.kind, tiles, okey);
    if (!info) return 'invalidMeld';
    result.push({ kind: input.kind, tiles, value: info.value });
  }
  return result;
}

function fail(error: ActionError): ActionResult {
  return { ok: false, error };
}
