// Bot-bot simülasyonu: testlerde ve bot gücünü ölçmede kullanılır.

import { combineSeeds } from '../../src/fairness.ts';
import {
  advanceMatch,
  applyAction,
  chooseAction,
  createMatch,
  isMatchOver,
  type BotLevel,
  type HandState,
  type MatchState,
  type Seat,
  type TableConfig,
} from '../../src/okey101/index.ts';

export interface HandStats {
  finished: boolean;
  opened: number;
  pairsOpened: number;
  penalties: number;
  okeyFinish: boolean;
  elden: boolean;
  turns: number;
}

const MAX_ACTIONS_PER_TURN = 60;

/** Bir eli botlarla sonuna kadar oynatır. Kural dışı hamle olursa hata fırlatır. */
export function playHand(start: HandState, levels: readonly BotLevel[]): { state: HandState; stats: HandStats } {
  let state = start;
  let actionsThisTurn = 0;
  let lastTurn = state.turn.number;
  while (!state.result) {
    const seat = state.turn.seat;
    const action = chooseAction(state, seat, { level: levels[seat]! });
    const result = applyAction(state, seat, action);
    if (!result.ok) {
      throw new Error(`Bot kural dışı hamle yaptı: ${result.error} ${JSON.stringify(action)} el=${JSON.stringify(state.hands[seat])}`);
    }
    state = result.state;
    actionsThisTurn = state.turn.number === lastTurn ? actionsThisTurn + 1 : 0;
    lastTurn = state.turn.number;
    if (actionsThisTurn > MAX_ACTIONS_PER_TURN) throw new Error('Bot sırasını bitiremedi (sonsuz döngü)');
    checkConservation(state);
  }
  const r = state.result;
  return {
    state,
    stats: {
      finished: r.finisher !== null,
      opened: state.opened.filter(Boolean).length,
      pairsOpened: state.opened.filter((o) => o === 'pairs').length,
      penalties: r.rows.reduce((sum, row) => sum + row.penalties, 0) / 101,
      okeyFinish: r.finish.okey,
      elden: r.finish.elden,
      turns: state.turn.number,
    },
  };
}

function checkConservation(state: HandState) {
  const all = [
    ...state.hands.flat(),
    ...state.stock,
    ...state.discards.flat(),
    ...state.melds.flatMap((m) => m.tiles),
    state.indicator,
  ];
  const unique = new Set(all.map((t) => t.id));
  if (all.length !== 106 || unique.size !== 106) throw new Error(`taş sayısı bozuldu: ${all.length}/${unique.size}`);
}

export function playMatch(config: TableConfig, levels: readonly BotLevel[], seedBase: string): { match: MatchState; hands: HandStats[] } {
  const seed = (n: number) => combineSeeds(seedBase.padEnd(64, '0').slice(0, 64), ['bot'], n);
  let match = createMatch(config, 0 as Seat, seed(1));
  const hands: HandStats[] = [];
  while (!isMatchOver(match)) {
    const { state, stats } = playHand(match.hand, levels);
    hands.push(stats);
    match = advanceMatch({ ...match, hand: state }, seed(match.history.length + 2));
  }
  return { match, hands };
}
