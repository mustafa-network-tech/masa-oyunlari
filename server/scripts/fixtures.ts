// Flutter testleri için gerçek sunucu çıktısından örnek mesajlar üretir: app/test/fixtures/
// Sunucu mesajları değişince yeniden çalıştır: npm run fixtures -w @masa/server

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { combineSeeds, commitSeed, okey101, shuffle } from '@masa/engine';
import { DEFAULT_SETTINGS, type ServerMessage } from '../src/protocol.ts';
import { DEFAULT_TIMING, Table } from '../src/table.ts';
import type { TableView } from '../src/view.ts';

const outDir = join(import.meta.dirname, '../../app/test/fixtures');
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(join(outDir, name), JSON.stringify(data, null, 1) + '\n');

// 1. Adil Oyun doğrulama örneği: istemci aynı tohumlardan aynı desteyi üretmeli.
{
  const serverSeed = 'ab'.repeat(32);
  const clientSeeds = ['01'.repeat(32), '', 'ff'.repeat(32), '7e'.repeat(32)];
  const seed = combineSeeds(serverSeed, clientSeeds, 3);
  const starter = 2;
  const hand = okey101.dealHand(okey101.DEFAULT_CONFIG, 3, starter, seed);
  write('fairness.json', {
    serverSeed,
    commit: commitSeed(serverSeed),
    clientSeeds,
    hand: 3,
    seed,
    starter,
    deck: shuffle(okey101.createTileSet(), seed).map((t) => t.id),
    indicator: hand.indicator.id,
    hands: hand.hands.map((h) => h.map((t) => t.id)),
  });
}

// 2. Masa görüntüleri: 1 oyuncu + 3 bot, oyuncu oynamaz (yerine bot oynar).
// Örnekler her seferinde aynı türde olsun diye ilk eli oyuncu (koltuk 0) başlayana kadar yeni masa açılır.
const fast = { moveMs: 5, bankMs: 0 };
const timing = {
  ...DEFAULT_TIMING,
  speeds: { fast, normal: fast, relaxed: fast },
  botDelayMs: 0,
  seedTimeoutMs: 0,
  handBreakMs: 60_000,
};

let states: TableView[] = [];
let table: Table | undefined;
for (let attempt = 0; attempt < 100; attempt++) {
  states = [];
  const player = {
    id: 'fixture',
    send(msg: ServerMessage) {
      if (msg.t === 'state') states.push(msg);
    },
  };
  table = new Table({ room: 'ornek-masa', settings: { ...DEFAULT_SETTINGS, hands: 5 }, timing, onEmpty: () => {} });
  table.join(player, 'Mustafa');
  table.start(player);
  table.seed(player, 1, '5a'.repeat(32));
  if (states.find((s) => s.phase === 'playing')?.hand?.turn.seat === 0) break;
  table.close();
}

const waitFor = async (match: (s: TableView) => boolean) => {
  for (let i = 0; i < 20_000; i++) {
    const found = states.find(match);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw new Error('beklenen durum gelmedi');
};

write('state_waiting.json', states.find((s) => s.phase === 'waiting') ?? table!.view(0));
write('state_playing.json', await waitFor((s) => s.phase === 'playing'));
write('state_melds.json', await waitFor((s) => s.phase === 'playing' && s.hand!.melds.length >= 3 && s.hand!.opened.some((o) => o === 'sets')));
write('state_hand_over.json', await waitFor((s) => s.phase === 'handOver'));
table!.close();
console.log(`Örnekler yazıldı: ${outDir}`);
