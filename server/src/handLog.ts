// Her elin olay kaydı. Dağıtım tohumu ve sıralı hamlelerden el baştan oynatılabilir:
// şikâyet incelemesi, hata ayıklama ve "Adil Oyun" doğrulaması için.

import { combineSeeds, commitSeed, okey101 } from '@masa/engine';

export type ActionSource = 'player' | 'bot' | 'auto';

export interface LoggedAction {
  seat: okey101.Seat;
  action: okey101.Action;
  /** player: oyuncunun kendisi; bot: bot koltuğu veya kopan/uzaktaki oyuncunun yerine bot; auto: süre doldu. */
  by: ActionSource;
  /** El başından bu yana geçen süre (ms). */
  at: number;
}

export interface Fairness {
  commit: string;
  serverSeed: string;
  /** Koltuk sırasıyla oyuncu tohumları; tohum göndermeyen koltuk için boş. */
  clientSeeds: string[];
  seed: string;
}

export interface HandLog {
  room: string;
  handNumber: number;
  config: okey101.TableConfig;
  starter: okey101.Seat;
  players: string[];
  fairness: Fairness;
  startedAt: string;
  actions: LoggedAction[];
  result: okey101.HandResult | null;
}

/** Kaydı baştan oynatır ve son durumu döner. Kayıt tutarsızsa hata fırlatır. */
export function replayHand(log: HandLog): okey101.HandState {
  const { commit, serverSeed, clientSeeds, seed } = log.fairness;
  if (commitSeed(serverSeed) !== commit) throw new Error('Sunucu tohumu özetle uyuşmuyor');
  if (combineSeeds(serverSeed, clientSeeds, log.handNumber) !== seed) throw new Error('Karıştırma tohumu uyuşmuyor');

  let state = okey101.dealHand(log.config, log.handNumber, log.starter, seed);
  for (const [i, { seat, action }] of log.actions.entries()) {
    const result = okey101.applyAction(state, seat, action);
    if (!result.ok) throw new Error(`Hamle ${i} uygulanamadı: ${result.error}`);
    state = result.state;
  }
  return state;
}
