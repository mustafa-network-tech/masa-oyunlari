// Oyun kural motorları. Arayüzden ve ağdan bağımsızdır; sunucu ve testler buradan kullanır.

export const ENGINE_VERSION = '0.3.0';

export * from './fairness.ts';
export * as okey101 from './okey101/index.ts';
