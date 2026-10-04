import { describe, expect, it } from 'vitest';
import { combineSeeds, commitSeed, createServerSeed, isValidSeed, SeededRandom, shuffle } from '../src/fairness.ts';

const SERVER = 'a'.repeat(64);
const CLIENTS = ['1'.repeat(64), '2'.repeat(64), '3'.repeat(64), '4'.repeat(64)];

describe('adil dağıtım', () => {
  it('sunucu tohumu 64 haneli hex ve her seferinde farklı', () => {
    const a = createServerSeed();
    expect(isValidSeed(a)).toBe(true);
    expect(createServerSeed()).not.toBe(a);
  });

  it('commitment tohumu açığa vurmaz ama sonradan doğrulanabilir', () => {
    const commitment = commitSeed(SERVER);
    expect(commitment).not.toContain(SERVER);
    expect(commitSeed(SERVER)).toBe(commitment);
    expect(commitSeed('b'.repeat(64))).not.toBe(commitment);
  });

  it('herhangi bir oyuncu tohumu değişirse karıştırma tohumu değişir', () => {
    const base = combineSeeds(SERVER, CLIENTS, 1);
    for (let i = 0; i < 4; i++) {
      const changed = [...CLIENTS];
      changed[i] = 'f'.repeat(64);
      expect(combineSeeds(SERVER, changed, 1)).not.toBe(base);
    }
    expect(combineSeeds(SERVER, CLIENTS, 2)).not.toBe(base);
  });

  it('aynı tohum aynı karıştırmayı, farklı tohum farklı karıştırmayı verir', () => {
    const items = Array.from({ length: 106 }, (_, i) => i);
    const seed = combineSeeds(SERVER, CLIENTS, 1);
    const a = shuffle(items, seed);
    expect(shuffle(items, seed)).toEqual(a);
    expect(shuffle(items, combineSeeds(SERVER, CLIENTS, 2))).not.toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(items[0]).toBe(0);
  });

  it('rastgele sayılar eşit dağılır', () => {
    const random = new SeededRandom(SERVER);
    const counts = [0, 0, 0, 0, 0, 0];
    const n = 60_000;
    for (let i = 0; i < n; i++) counts[random.int(6)]!++;
    for (const count of counts) expect(Math.abs(count - n / 6)).toBeLessThan(n * 0.01);
  });

  it('her taş her pozisyona eşit olasılıkla düşer', () => {
    // 4 elemanlı dizide ilk elemanın her pozisyona düşme sıklığı.
    const counts = [0, 0, 0, 0];
    const n = 20_000;
    for (let i = 0; i < n; i++) counts[shuffle([0, 1, 2, 3], `seed-${i}`).indexOf(0)]!++;
    for (const count of counts) expect(Math.abs(count - n / 4)).toBeLessThan(n * 0.02);
  });
});
