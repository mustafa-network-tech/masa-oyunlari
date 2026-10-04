// Adil Oyun: doğrulanabilir karıştırma.
//
// 1. El başlamadan sunucu gizli bir tohum üretir ve yalnızca özetini (commitment) yayınlar.
// 2. Her oyuncunun cihazı kendi rastgele tohumunu gönderir.
// 3. Karıştırma, sunucu tohumu + oyuncu tohumları + el numarasının birleşiminden üretilir.
//    Sunucu oyuncu tohumlarını önceden bilmediği için sonucu seçemez;
//    oyuncular da sunucu tohumunu bilmediği için sonucu tahmin edemez.
// 4. El bitince sunucu tohumunu açıklar; herkes özetin tuttuğunu ve dağıtımın aynı çıktığını doğrular.

import { createHash, randomBytes } from 'node:crypto';

const HEX_64 = /^[0-9a-f]{64}$/;

export function createServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function commitSeed(serverSeed: string): string {
  return sha256Hex(`commit:${serverSeed}`);
}

export function isValidSeed(seed: string): boolean {
  return HEX_64.test(seed);
}

/** Bütün tohumları tek bir karıştırma tohumunda birleştirir. Oyuncu tohumları koltuk sırasıyla verilir. */
export function combineSeeds(serverSeed: string, clientSeeds: readonly string[], handNumber: number): string {
  return sha256Hex(['shuffle', serverSeed, ...clientSeeds, String(handNumber)].join(':'));
}

/** Tohumdan belirlenimci rastgele sayı üreteci (SHA-256 sayaç modu). */
export class SeededRandom {
  private counter = 0;
  private buffer = Buffer.alloc(0);
  private offset = 0;

  constructor(private readonly seed: string) {}

  private nextUint32(): number {
    if (this.offset + 4 > this.buffer.length) {
      this.buffer = createHash('sha256').update(`${this.seed}:${this.counter++}`).digest();
      this.offset = 0;
    }
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  /** [0, n) aralığında eşit dağılımlı tam sayı (modulo sapması olmadan). */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new RangeError(`geçersiz aralık: ${n}`);
    const limit = Math.floor(2 ** 32 / n) * n;
    let x: number;
    do x = this.nextUint32();
    while (x >= limit);
    return x % n;
  }
}

/** Fisher–Yates karıştırma. Diziyi değiştirmez, yeni dizi döner. */
export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const random = new SeededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.int(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
