import { describe, expect, it } from 'vitest';
import { analyzeMeld, canLayOffAnywhere, layOff, swapJoker, type Identity } from '../../src/okey101/index.ts';
import { FAKE_1, FAKE_2, t, tiles } from './helpers.ts';

// Bu dosyada okey kırmızı 5: kırmızı 5'ler joker, sahte okeyler kırmızı 5 yerine geçer.
const OKEY: Identity = { color: 'red', number: 5 };
const J = t('red', 5);
const J2 = t('red', 5, 1);

describe('seri', () => {
  it('aynı renk ardışık 3+ taş geçerlidir, değeri sayıların toplamıdır', () => {
    expect(analyzeMeld('run', tiles('b4 b5 b6'), OKEY)?.value).toBe(15);
    expect(analyzeMeld('run', tiles('k10 k11 k12 k13'), OKEY)?.value).toBe(46);
  });

  it('1 ile başlayan seri geçerlidir ve 1 puan sayılır', () => {
    expect(analyzeMeld('run', tiles('b1 b2 b3'), OKEY)?.value).toBe(6);
  });

  it('12-13-1 ve 13-1-2 geçersizdir', () => {
    expect(analyzeMeld('run', tiles('b12 b13 b1'), OKEY)).toBeNull();
    expect(analyzeMeld('run', tiles('b13 b1 b2'), OKEY)).toBeNull();
  });

  it('farklı renk, boşluk, tekrar ve 2 taş geçersizdir', () => {
    expect(analyzeMeld('run', tiles('b4 y5 b6'), OKEY)).toBeNull();
    expect(analyzeMeld('run', tiles('b4 b6 b7'), OKEY)).toBeNull();
    expect(analyzeMeld('run', tiles("b4 b4' b5"), OKEY)).toBeNull();
    expect(analyzeMeld('run', tiles('b4 b5'), OKEY)).toBeNull();
    expect(analyzeMeld('run', tiles('b6 b5 b4'), OKEY)).toBeNull();
  });

  it('joker eksik taşın yerine geçer ve onun değerini alır', () => {
    expect(analyzeMeld('run', [t('blue', 4), J, t('blue', 6)], OKEY)?.value).toBe(15);
    expect(analyzeMeld('run', [J, t('blue', 5), t('blue', 6)], OKEY)?.value).toBe(15);
    expect(analyzeMeld('run', [t('blue', 12), t('blue', 13), J], OKEY)).toBeNull();
    expect(analyzeMeld('run', [J, t('blue', 1), t('blue', 2)], OKEY)).toBeNull();
    expect(analyzeMeld('run', [t('blue', 11), J, J2], OKEY)?.value).toBe(36);
  });

  it('sahte okey okeyin kimliğini taşır (kırmızı 5), joker değildir', () => {
    expect(analyzeMeld('run', [t('red', 4), FAKE_1, t('red', 6)], OKEY)?.value).toBe(15);
    expect(analyzeMeld('run', [t('blue', 4), FAKE_1, t('blue', 6)], OKEY)).toBeNull();
  });
});

describe('küt', () => {
  it('aynı sayı farklı renk 3 veya 4 taş geçerlidir', () => {
    expect(analyzeMeld('set', tiles('b7 y7 k7'), OKEY)?.value).toBe(21);
    expect(analyzeMeld('set', tiles('b7 y7 k7 r7'), OKEY)?.value).toBe(28);
  });

  it('aynı renk iki kez, farklı sayı veya 5 taş geçersizdir', () => {
    expect(analyzeMeld('set', tiles("b7 b7' k7"), OKEY)).toBeNull();
    expect(analyzeMeld('set', tiles('b7 y8 k7'), OKEY)).toBeNull();
    expect(analyzeMeld('set', tiles('b7 y7'), OKEY)).toBeNull();
  });

  it('jokerli küt geçerlidir', () => {
    expect(analyzeMeld('set', [t('blue', 9), t('yellow', 9), J], OKEY)?.value).toBe(27);
    expect(analyzeMeld('set', [t('blue', 9), J, J2], OKEY)?.value).toBe(27);
  });
});

describe('çift', () => {
  it('aynı renk aynı sayı iki taş geçerlidir', () => {
    expect(analyzeMeld('pair', tiles("b3 b3'"), OKEY)).not.toBeNull();
    expect(analyzeMeld('pair', tiles('b3 y3'), OKEY)).toBeNull();
    expect(analyzeMeld('pair', tiles('b3 b4'), OKEY)).toBeNull();
  });

  it('joker her taşla çift olur; iki sahte okey çifttir', () => {
    expect(analyzeMeld('pair', [J, t('yellow', 11)], OKEY)).not.toBeNull();
    expect(analyzeMeld('pair', [J, J2], OKEY)).not.toBeNull();
    expect(analyzeMeld('pair', [FAKE_1, FAKE_2], OKEY)).not.toBeNull();
  });

  it('aynı taş iki kez kullanılamaz', () => {
    expect(analyzeMeld('pair', [t('blue', 3), t('blue', 3)], OKEY)).toBeNull();
  });
});

describe('işleme', () => {
  it('seriye iki uçtan da taş işlenir', () => {
    const run = tiles('b4 b5 b6');
    expect(layOff('run', run, t('blue', 7), OKEY)).toEqual(tiles('b4 b5 b6 b7'));
    expect(layOff('run', run, t('blue', 3), OKEY)).toEqual(tiles('b3 b4 b5 b6'));
    expect(layOff('run', run, t('blue', 9), OKEY)).toBeNull();
    expect(layOff('run', run, t('yellow', 7), OKEY)).toBeNull();
  });

  it('13 ile biten seriye 1 işlenemez', () => {
    expect(layOff('run', tiles('b11 b12 b13'), t('blue', 1), OKEY)).toBeNull();
  });

  it('joker istenen uca işlenir', () => {
    const run = tiles('b4 b5 b6');
    expect(layOff('run', run, J, OKEY, 'start')).toEqual([J, ...run]);
    expect(layOff('run', run, J, OKEY, 'end')).toEqual([...run, J]);
    expect(layOff('run', tiles('b11 b12 b13'), J, OKEY, 'end')).toBeNull();
  });

  it('küte eksik renk işlenir, dört renk dolunca işlenmez', () => {
    expect(layOff('set', tiles('b7 y7 k7'), t('red', 7), OKEY)).toHaveLength(4);
    expect(layOff('set', tiles('b7 y7 k7'), t('blue', 7, 1), OKEY)).toBeNull();
    expect(layOff('set', tiles('b7 y7 k7 r7'), J, OKEY)).toBeNull();
  });

  it('çifte taş işlenmez', () => {
    expect(layOff('pair', tiles("b3 b3'"), J, OKEY)).toBeNull();
  });

  it('masadaki okeyin yerine gerçek taş konup okey alınır', () => {
    const swapped = swapJoker('run', [t('blue', 4), J, t('blue', 6)], t('blue', 5), OKEY);
    expect(swapped?.joker).toEqual(J);
    expect(swapped?.tiles).toEqual(tiles('b4 b5 b6'));
    expect(swapJoker('run', [t('blue', 4), J, t('blue', 6)], t('blue', 7), OKEY)).toBeNull();
    expect(swapJoker('set', [t('blue', 9), t('yellow', 9), J], t('black', 9), OKEY)?.joker).toEqual(J);
    expect(swapJoker('set', [t('blue', 9), t('yellow', 9), J], t('blue', 9, 1), OKEY)).toBeNull();
  });

  it('işlek taş kontrolü masadaki bütün perlere bakar', () => {
    const melds = [
      { kind: 'run' as const, tiles: tiles('b4 b5 b6') },
      { kind: 'set' as const, tiles: tiles('b9 y9 k9') },
    ];
    expect(canLayOffAnywhere(melds, t('blue', 7), OKEY)).toBe(true);
    expect(canLayOffAnywhere(melds, t('red', 9), OKEY)).toBe(true);
    expect(canLayOffAnywhere(melds, t('red', 10), OKEY)).toBe(false);
  });
});
