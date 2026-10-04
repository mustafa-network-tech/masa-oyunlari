// Per doğrulama: seri, küt ve çift. Bkz. docs/02-101-kurallari.md §3, §5

import { identityOf, isJoker, type Color, type Identity, type Tile } from './tiles.ts';

export type MeldKind = 'run' | 'set' | 'pair';

export interface MeldInfo {
  kind: MeldKind;
  /** Perin açma değeri (jokerler yerine geçtikleri taşın değerini alır). */
  value: number;
  /** Her pozisyondaki taşın temsil ettiği kimlik. Küt içindeki jokerin rengi belirsizdir (null). */
  slots: (Identity | null)[];
  /** Seri: renk ve başlangıç/bitiş sayısı. */
  run?: { color: Color; start: number; end: number };
  /** Küt: sayı ve gerçek taşlarda bulunan renkler. */
  set?: { number: number; colors: Color[] };
}

/** Taşlar perin sırasıyla verilir (seri için küçükten büyüğe). Geçersizse null. */
export function analyzeMeld(kind: MeldKind, tiles: readonly Tile[], okey: Identity): MeldInfo | null {
  if (new Set(tiles.map((t) => t.id)).size !== tiles.length) return null;
  switch (kind) {
    case 'run':
      return analyzeRun(tiles, okey);
    case 'set':
      return analyzeSet(tiles, okey);
    case 'pair':
      return analyzePair(tiles, okey);
  }
}

function analyzeRun(tiles: readonly Tile[], okey: Identity): MeldInfo | null {
  if (tiles.length < 3 || tiles.length > 13) return null;
  let color: Color | undefined;
  let start: number | undefined;
  for (const [index, tile] of tiles.entries()) {
    if (isJoker(tile, okey)) continue;
    const id = identityOf(tile, okey);
    color ??= id.color;
    start ??= id.number - index;
    if (id.color !== color || id.number !== start + index) return null;
  }
  if (color === undefined || start === undefined) return null;
  const end = start + tiles.length - 1;
  // Seriler 1'den başlayıp 13'te biter; 12-13-1 gibi dönen seriler geçersiz.
  if (start < 1 || end > 13) return null;
  const slots = tiles.map((_, i) => ({ color: color!, number: start! + i }));
  const value = slots.reduce((sum, s) => sum + s.number, 0);
  return { kind: 'run', value, slots, run: { color, start, end } };
}

function analyzeSet(tiles: readonly Tile[], okey: Identity): MeldInfo | null {
  if (tiles.length < 3 || tiles.length > 4) return null;
  let number: number | undefined;
  const colors: Color[] = [];
  for (const tile of tiles) {
    if (isJoker(tile, okey)) continue;
    const id = identityOf(tile, okey);
    number ??= id.number;
    if (id.number !== number || colors.includes(id.color)) return null;
    colors.push(id.color);
  }
  if (number === undefined) return null;
  const slots = tiles.map((t) => (isJoker(t, okey) ? null : identityOf(t, okey)));
  return { kind: 'set', value: number * tiles.length, slots, set: { number, colors } };
}

function analyzePair(tiles: readonly Tile[], okey: Identity): MeldInfo | null {
  if (tiles.length !== 2) return null;
  const [a, b] = tiles as [Tile, Tile];
  const ja = isJoker(a, okey);
  const jb = isJoker(b, okey);
  if (ja && jb) return { kind: 'pair', value: 0, slots: [null, null] };
  const real = ja ? b : a;
  const id = identityOf(real, okey);
  if (!ja && !jb) {
    const other = identityOf(b, okey);
    if (other.color !== id.color || other.number !== id.number) return null;
  }
  return { kind: 'pair', value: id.number * 2, slots: [id, id] };
}

export type LayOffEnd = 'start' | 'end';

/** Taşın bu pere işlenmesi sonucu oluşacak yeni taş dizisi; işlenemiyorsa null. */
export function layOff(
  kind: MeldKind,
  meldTiles: readonly Tile[],
  tile: Tile,
  okey: Identity,
  end?: LayOffEnd,
): Tile[] | null {
  if (kind === 'pair') return null;
  if (kind === 'set') {
    const next = [...meldTiles, tile];
    return analyzeMeld('set', next, okey) ? next : null;
  }
  const tryEnd = (side: LayOffEnd) => {
    const next = side === 'start' ? [tile, ...meldTiles] : [...meldTiles, tile];
    return analyzeMeld('run', next, okey) ? next : null;
  };
  if (end) return tryEnd(end);
  // Gerçek taş yalnızca bir uca uyabilir. Joker için uç belirtilmeli; belirtilmemişse önce sona eklenir.
  return tryEnd('end') ?? tryEnd('start');
}

/** Perdeki bir jokerin yerine gerçek taşı koyar. Yeni dizi ve alınan jokeri döner; uymuyorsa null. */
export function swapJoker(
  kind: MeldKind,
  meldTiles: readonly Tile[],
  tile: Tile,
  okey: Identity,
): { tiles: Tile[]; joker: Tile } | null {
  if (isJoker(tile, okey)) return null;
  for (const [index, candidate] of meldTiles.entries()) {
    if (!isJoker(candidate, okey)) continue;
    const next = meldTiles.map((t, i) => (i === index ? tile : t));
    if (analyzeMeld(kind, next, okey)) return { tiles: next, joker: candidate };
  }
  return null;
}

/** Taş masadaki perlerden birine işlenebilir mi? (Yere atılırsa ceza sebebi.) */
export function canLayOffAnywhere(
  melds: readonly { kind: MeldKind; tiles: readonly Tile[] }[],
  tile: Tile,
  okey: Identity,
): boolean {
  return melds.some((m) => layOff(m.kind, m.tiles, tile, okey, 'start') ?? layOff(m.kind, m.tiles, tile, okey, 'end'));
}
