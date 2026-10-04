// Yük testi: çok sayıda sanal masa açar, her masaya 4 sanal oyuncu oturtur ve maçları sonuna kadar oynatır.
// Sanal oyuncular basit oynar (çek, rastgele taş at) ama her hamle sunucuda motordan geçer.
//
// Önce sunucuyu başlat, sonra:
//   npm run loadtest -w @masa/server -- --tables 200 --hands 5
// Seçenekler: --url ws://localhost:2567  --tables 100  --hands 5  --think 150 (ms, oyuncu düşünme süresi)
//            --humans 4 (masa başına sanal oyuncu; 4'ten azsa masa sahibi başlatır, boş koltuklara bot oturur)

import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import WebSocket from 'ws';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'ws://localhost:2567' },
    tables: { type: 'string', default: '100' },
    hands: { type: 'string', default: '5' },
    think: { type: 'string', default: '150' },
    humans: { type: 'string', default: '4' },
  },
});
const URL = values.url;
const TABLES = Number(values.tables);
const HANDS = Number(values.hands);
const THINK_MS = Number(values.think);
const HUMANS = Math.min(4, Math.max(1, Number(values.humans)));
const RAMP_PER_SECOND = 100;

const stats = {
  connected: 0,
  finishedTables: 0,
  actions: 0,
  messages: 0,
  bytes: 0,
  latencies: [] as number[],
  errors: new Map<string, number>(),
};

interface State {
  phase: string;
  you: number;
  seeding: { hand: number } | null;
  hand: { number: number; tiles: { id: number }[]; turn: { seat: number; number: number; phase: string } } | null;
}

function virtualPlayer(room: string, index: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(URL);
    let seq = 0;
    let lastKey = '';
    let seededHand = 0;
    const sentAt = new Map<number, number>();

    const send = (msg: unknown) => socket.send(JSON.stringify(msg));
    const think = () => THINK_MS / 2 + Math.random() * THINK_MS;

    socket.on('open', () => stats.connected++);
    if (!seatedCounts.has(room)) seatedCounts.set(room, { count: 0, ready: () => {} });
    socket.on('error', reject);
    socket.on('close', () => resolve());
    socket.on('message', (data) => {
      stats.messages++;
      stats.bytes += (data as Buffer).length;
      const msg = JSON.parse(data.toString());
      switch (msg.t) {
        case 'welcome':
          send({ t: 'join', room, name: `Sanal ${index}`, settings: { hands: HANDS } });
          break;
        case 'ack': {
          const t = sentAt.get(msg.seq);
          if (t !== undefined) stats.latencies.push(performance.now() - t);
          sentAt.delete(msg.seq);
          break;
        }
        case 'error':
          stats.errors.set(msg.code, (stats.errors.get(msg.code) ?? 0) + 1);
          break;
        case 'seated': {
          const entry = seatedCounts.get(room)!;
          if (++entry.count >= HUMANS) entry.ready();
          if (index === 0 && HUMANS < 4) hostSeated(room).then(() => send({ t: 'start' }));
          break;
        }
        case 'state': {
          const state = msg as State;
          if (state.phase === 'finished') {
            if (index === 0) stats.finishedTables++;
            socket.close();
            return;
          }
          if (state.phase === 'seeding' && state.seeding && state.seeding.hand !== seededHand) {
            seededHand = state.seeding.hand;
            send({ t: 'seed', hand: seededHand, seed: randomBytes(32).toString('hex') });
          }
          const hand = state.hand;
          if (state.phase !== 'playing' || !hand || hand.turn.seat !== state.you) return;
          const key = `${hand.number}:${hand.turn.number}:${hand.turn.phase}`;
          if (key === lastKey) return;
          lastKey = key;
          const action =
            hand.turn.phase === 'draw'
              ? { type: 'draw' }
              : { type: 'discard', tileId: hand.tiles[Math.floor(Math.random() * hand.tiles.length)]!.id };
          setTimeout(() => {
            if (socket.readyState !== socket.OPEN) return;
            const n = ++seq;
            sentAt.set(n, performance.now());
            stats.actions++;
            send({ t: 'act', seq: n, hand: hand.number, turn: hand.turn.number, action });
          }, think());
          break;
        }
      }
    });
  });
}

/** Masa sahibi, diğer sanal oyuncular da oturunca oyunu başlatır. */
const seatedCounts = new Map<string, { count: number; ready: () => void }>();
function hostSeated(room: string): Promise<void> {
  return new Promise((resolve) => {
    const entry = seatedCounts.get(room)!;
    entry.ready = resolve;
    if (entry.count >= HUMANS) resolve();
  });
}

function percentile(sorted: number[], p: number): number {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))]! : 0;
}

const startedAt = performance.now();
const progress = setInterval(() => {
  const s = ((performance.now() - startedAt) / 1000).toFixed(0);
  console.log(`${s} sn: bağlantı=${stats.connected} biten masa=${stats.finishedTables}/${TABLES} hamle=${stats.actions}`);
}, 5_000);

console.log(`${TABLES} masa × ${HUMANS} oyuncu + ${4 - HUMANS} bot, ${HANDS} el, düşünme ~${THINK_MS} ms → ${URL}`);
const tables: Promise<void>[] = [];
const runId = randomBytes(3).toString('hex');
for (let t = 0; t < TABLES; t++) {
  const room = `yuk-${runId}-${t}`;
  // Masa sahibi önce oturur, sonra diğerleri.
  const host = virtualPlayer(room, 0);
  await new Promise((r) => setTimeout(r, 20));
  const others = [1, 2, 3].slice(0, HUMANS - 1).map((i) => virtualPlayer(room, i));
  tables.push(Promise.all([host, ...others]).then(() => {}));
  if ((t + 1) % RAMP_PER_SECOND === 0) await new Promise((r) => setTimeout(r, 1_000));
}
await Promise.all(tables);
clearInterval(progress);

const seconds = (performance.now() - startedAt) / 1000;
const sorted = stats.latencies.sort((a, b) => a - b);
const fmt = (n: number) => n.toFixed(1);
console.log('\n--- Yük testi sonucu ---');
console.log(`Masa: ${stats.finishedTables}/${TABLES} maçı bitirdi, süre ${seconds.toFixed(1)} sn`);
console.log(`Hamle: ${stats.actions} (${fmt(stats.actions / seconds)}/sn)`);
console.log(`Gelen mesaj: ${stats.messages} (${fmt(stats.bytes / 1024 / 1024)} MB)`);
console.log(
  `Hamle onay süresi: p50=${fmt(percentile(sorted, 50))}ms p95=${fmt(percentile(sorted, 95))}ms p99=${fmt(percentile(sorted, 99))}ms max=${fmt(sorted.at(-1) ?? 0)}ms`,
);
console.log(`Hatalar: ${stats.errors.size ? JSON.stringify(Object.fromEntries(stats.errors)) : 'yok'}`);
process.exit(stats.finishedTables === TABLES ? 0 : 1);
