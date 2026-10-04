// El analizi: eldeki taşlardan en değerli per kombinasyonunu ve en çok çifti bulur.
// Bot kararlarının temeli; ileride arayüzdeki "otomatik diz" de bunu kullanabilir.

import type { MeldInput } from '../game.ts';
import { COLORS, identityOf, isJoker, type Identity, type Tile } from '../tiles.ts';

/** Kimlik anahtarı: renk × 13 + (sayı − 1). Aynı kimlikteki iki taş birbirinin yerine geçer. */
export const keyOf = (id: Identity) => COLORS.indexOf(id.color) * 13 + id.number - 1;
const numberOfKey = (key: number) => (key % 13) + 1;

interface Candidate {
  kind: 'run' | 'set';
  /** Perin pozisyonları; null = joker. Seri için küçükten büyüğe. */
  slots: (number | null)[];
  value: number;
  jokers: number;
}

export interface MeldPlan {
  /** Değeri büyükten küçüğe sıralı perler. */
  melds: MeldInput[];
  meldValues: number[];
  /** Seri/küt için toplam açma değeri; çift için çift sayısı. */
  value: number;
  /** Plandaki taşların kimlikleri. */
  usedTileIds: Set<number>;
}

interface HandIndex {
  counts: number[];
  jokers: Tile[];
  byKey: Map<number, Tile[]>;
}

function indexHand(hand: readonly Tile[], okey: Identity, preferId?: number): HandIndex {
  const counts = new Array<number>(52).fill(0);
  const jokers: Tile[] = [];
  const byKey = new Map<number, Tile[]>();
  for (const tile of hand) {
    if (isJoker(tile, okey)) {
      jokers.push(tile);
      continue;
    }
    const key = keyOf(identityOf(tile, okey));
    counts[key]!++;
    const list = byKey.get(key) ?? [];
    // Tercih edilen taş (örn. yerden alınan) önce kullanılsın.
    if (tile.id === preferId) list.unshift(tile);
    else list.push(tile);
    byKey.set(key, list);
  }
  if (preferId !== undefined) jokers.sort((a, b) => (a.id === preferId ? -1 : b.id === preferId ? 1 : 0));
  return { counts, jokers, byKey };
}

function candidates(counts: readonly number[], jokers: number): Candidate[] {
  const result: Candidate[] = [];
  for (let c = 0; c < 4; c++) {
    for (let start = 1; start <= 11; start++) {
      let missing = 0;
      for (let end = start; end <= 13; end++) {
        if (counts[c * 13 + end - 1] === 0) missing++;
        const length = end - start + 1;
        if (missing > jokers) break;
        if (length < 3 || missing === length) continue;
        const slots: (number | null)[] = [];
        let value = 0;
        for (let n = start; n <= end; n++) {
          const key = c * 13 + n - 1;
          slots.push(counts[key]! > 0 ? key : null);
          value += n;
        }
        result.push({ kind: 'run', slots, value, jokers: missing });
      }
    }
  }
  for (let n = 1; n <= 13; n++) {
    const present = [0, 1, 2, 3].filter((c) => counts[c * 13 + n - 1]! > 0);
    for (const size of [3, 4]) {
      // Eksik renkleri jokerle tamamla; gerçek taşlardan size kadarını kullan.
      for (const real of subsets(present, Math.min(size, present.length))) {
        const missing = size - real.length;
        if (missing > jokers || real.length === 0) continue;
        const slots = [...real.map((c) => c * 13 + n - 1), ...new Array<null>(missing).fill(null)];
        result.push({ kind: 'set', slots, value: n * size, jokers: missing });
      }
    }
  }
  return result.sort((a, b) => b.value - a.value);
}

function subsets<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items as [T, ...T[]];
  return [...subsets(rest, size - 1).map((s) => [first, ...s]), ...subsets(rest, size)];
}

const SEARCH_LIMIT = 40_000;

/** Seçilen per; o anda elde kalmayan gerçek taş pozisyonları jokerle doldurulur. */
interface Chosen {
  candidate: Candidate;
  slots: (number | null)[];
}

/**
 * Eldeki taşlarla kurulabilecek en yüksek değerli seri/küt kombinasyonu.
 * `preferTileId` verilirse o taş, kimliği plana girdiğinde öncelikle kullanılır.
 */
export function bestMelds(hand: readonly Tile[], okey: Identity, preferTileId?: number): MeldPlan {
  const index = indexHand(hand, okey, preferTileId);
  const counts = [...index.counts];
  const list = candidates(counts, index.jokers.length);

  let best: Chosen[] = [];
  let bestValue = 0;
  let nodes = 0;
  const chosen: Chosen[] = [];
  let remainingValue = counts.reduce((sum, count, key) => sum + count * numberOfKey(key), 0) + index.jokers.length * 13;

  const search = (from: number, value: number, jokersLeft: number) => {
    if (++nodes > SEARCH_LIMIT) return;
    if (value > bestValue) {
      bestValue = value;
      best = [...chosen];
    }
    if (value + remainingValue <= bestValue) return;
    for (let i = from; i < list.length; i++) {
      const c = list[i]!;
      const slots = c.slots.map((k) => (k !== null && counts[k]! > 0 ? k : null));
      const jokers = slots.filter((k) => k === null).length;
      if (jokers > jokersLeft || jokers === slots.length) continue;
      let used = 0;
      for (const k of slots) {
        if (k === null) continue;
        counts[k]!--;
        used += numberOfKey(k);
      }
      remainingValue -= used + jokers * 13;
      chosen.push({ candidate: c, slots });
      // Aynı per ikinci kopyalarla tekrar kurulabilir, bu yüzden i'den devam.
      search(i, value + c.value, jokersLeft - jokers);
      chosen.pop();
      remainingValue += used + jokers * 13;
      for (const k of slots) if (k !== null) counts[k]!++;
    }
  };
  search(0, 0, index.jokers.length);

  return toPlan(best, index);
}

function toPlan(chosen: readonly Chosen[], index: HandIndex): MeldPlan {
  const pools = new Map([...index.byKey].map(([k, tiles]) => [k, [...tiles]]));
  const jokers = [...index.jokers];
  const melds: MeldInput[] = chosen.map(({ candidate, slots }) => ({
    kind: candidate.kind,
    tileIds: slots.map((k) => (k === null ? jokers.shift()! : pools.get(k)!.shift()!).id),
  }));
  return makePlan(melds, chosen.map((c) => c.candidate.value));
}

function makePlan(melds: MeldInput[], meldValues: number[]): MeldPlan {
  return {
    melds,
    meldValues,
    value: meldValues.reduce((sum, v) => sum + v, 0),
    usedTileIds: new Set(melds.flatMap((m) => m.tileIds)),
  };
}

/** En çok çift: aynı kimlikteki iki taş, artan tekler jokerle (önce en büyük sayılar) eşlenir. */
export function bestPairs(hand: readonly Tile[], okey: Identity, preferTileId?: number): MeldPlan {
  const index = indexHand(hand, okey, preferTileId);
  const melds: MeldInput[] = [];
  const singles: Tile[] = [];
  for (const tiles of index.byKey.values()) {
    for (let i = 0; i + 1 < tiles.length; i += 2) melds.push({ kind: 'pair', tileIds: [tiles[i]!.id, tiles[i + 1]!.id] });
    if (tiles.length % 2 === 1) singles.push(tiles.at(-1)!);
  }
  const jokers = [...index.jokers];
  singles.sort((a, b) => (a.id === preferTileId ? -1 : b.id === preferTileId ? 1 : identityOf(b, okey).number - identityOf(a, okey).number));
  for (const single of singles) {
    const joker = jokers.shift();
    if (!joker) break;
    melds.push({ kind: 'pair', tileIds: [single.id, joker.id] });
  }
  if (jokers.length === 2) melds.push({ kind: 'pair', tileIds: [jokers[0]!.id, jokers[1]!.id] });
  return makePlan(melds, melds.map(() => 1));
}

/** Planı, elde en az `keep` taş kalacak şekilde küçültür (en düşük değerli perler çıkarılır). */
export function trimPlan(plan: MeldPlan, handSize: number, keep = 1): MeldPlan {
  const melds = [...plan.melds];
  const values = [...plan.meldValues];
  let used = plan.usedTileIds.size;
  while (melds.length > 0 && handSize - used < keep) {
    used -= melds.pop()!.tileIds.length;
    values.pop();
  }
  return makePlan(melds, values);
}
