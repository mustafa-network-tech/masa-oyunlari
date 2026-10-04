import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index.ts';

describe('motor', () => {
  it('sürüm bilgisi verir', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
