// Taşlar, gösterge ve okey. Bkz. docs/02-101-kurallari.md §1–2

export const COLORS = ['red', 'yellow', 'blue', 'black'] as const;
export type Color = (typeof COLORS)[number];

export interface Tile {
  /** 0–105 arası benzersiz kimlik. */
  id: number;
  color: Color;
  number: number;
  /** Sahte okey: okeyin rengini ve sayısını taşır, joker değildir. */
  fake: boolean;
}

export interface Identity {
  color: Color;
  number: number;
}

export const TILE_COUNT = 106;

/** Sıralı tam deste: 4 renk × 1–13 × 2 adet + 2 sahte okey. Sahte okeylerin renk/sayı alanı anlamsızdır. */
export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++) {
    for (const color of COLORS) {
      for (let number = 1; number <= 13; number++) tiles.push({ id: id++, color, number, fake: false });
    }
  }
  tiles.push({ id: id++, color: 'red', number: 0, fake: true });
  tiles.push({ id: id++, color: 'red', number: 0, fake: true });
  return tiles;
}

/** Göstergenin aynı renkteki bir üstü okeydir; 13'ten sonra 1 gelir. */
export function okeyFromIndicator(indicator: Identity): Identity {
  return { color: indicator.color, number: indicator.number === 13 ? 1 : indicator.number + 1 };
}

/** Taş joker mi (gerçek okey)? */
export function isJoker(tile: Tile, okey: Identity): boolean {
  return !tile.fake && tile.color === okey.color && tile.number === okey.number;
}

/** Jokerler dışında taşın oyundaki kimliği. Sahte okey, okeyin kimliğini alır. */
export function identityOf(tile: Tile, okey: Identity): Identity {
  return tile.fake ? { color: okey.color, number: okey.number } : { color: tile.color, number: tile.number };
}
