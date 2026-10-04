import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { HandLog } from '../src/handLog.ts';
import { createGameServer, type GameServer, type GameServerOptions } from '../src/server.ts';
import type { ServerMessage } from '../src/protocol.ts';
import type { Timing } from '../src/table.ts';
import type { TableView } from '../src/view.ts';

type Msg = ServerMessage;

/** Test istemcisi: gelen mesajları saklar; `waitFor` aranan mesaj gelene kadar bekler. */
async function connect(port: number) {
  const socket = new WebSocket(`ws://localhost:${port}`);
  const messages: Msg[] = [];
  let cursor = 0;
  let notify = () => {};
  socket.on('message', (data) => {
    messages.push(JSON.parse(data.toString()) as Msg);
    notify();
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  const client = {
    messages,
    send: (msg: unknown) => socket.send(typeof msg === 'string' ? msg : JSON.stringify(msg)),
    /** Okunmamış mesajlardan koşula uyan ilkini döner; yoksa gelmesini bekler. */
    waitFor<T extends Msg>(match: (m: Msg) => m is T, timeoutMs = 3_000): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const last = messages.slice(-3).map((m) => JSON.stringify(m).slice(0, 160));
          reject(new Error(`mesaj beklenirken süre doldu; son mesajlar: ${last.join(' | ')}`));
        }, timeoutMs);
        const check = () => {
          while (cursor < messages.length) {
            const msg = messages[cursor++]!;
            if (match(msg)) {
              clearTimeout(timer);
              notify = () => {};
              resolve(msg);
              return;
            }
          }
          notify = check;
        };
        check();
      });
    },
    state(match: (s: TableView) => boolean = () => true) {
      return client.waitFor((m): m is TableView => m.t === 'state' && match(m));
    },
    /** Sunucuya söylemeden bağlantıyı keser (telefonun interneti gitti). */
    drop: () => socket.terminate(),
    close: () => socket.close(),
  };
  await client.waitFor((m) => m.t === 'welcome');
  return client;
}

const is =
  <T extends Msg['t']>(t: T) =>
  (m: Msg): m is Extract<Msg, { t: T }> =>
    m.t === t;

const FAST: Partial<Timing> = {
  speeds: {
    fast: { moveMs: 300, bankMs: 0 },
    normal: { moveMs: 300, bankMs: 0 },
    relaxed: { moveMs: 300, bankMs: 0 },
  },
  botDelayMs: 0,
  seedTimeoutMs: 200,
  handBreakMs: 0,
  reconnectGraceMs: 2_000,
};

describe('oyun sunucusu', () => {
  let server: GameServer;
  const start = async (options: Partial<GameServerOptions> = {}) => {
    server = await createGameServer({ port: 0, timing: FAST, ...options });
    return server;
  };

  afterEach(async () => {
    await server?.close();
  });

  it('karşılar, ping mesajına cevap verir', async () => {
    await start();
    const client = await connect(server.port);
    expect(client.messages[0]).toMatchObject({ t: 'welcome', protocol: 2 });
    client.send({ t: 'ping', n: 42 });
    expect(await client.waitFor(is('pong'))).toEqual({ t: 'pong', n: 42 });
    client.close();
  });

  it('geçersiz mesajları reddeder', async () => {
    await start();
    const client = await connect(server.port);
    for (const bad of [
      'bozuk{json',
      { t: 'join', room: 'Büyük Harf!', name: 'Ali' },
      { t: 'join', room: 'masa', name: 'Ali', settings: { hands: 6 } },
      { t: 'act', seq: 1, hand: 1, turn: 1, action: { type: 'discard', tileId: 999 } },
      { t: 'act', seq: -1, hand: 1, turn: 1, action: { type: 'draw' } },
      { t: 'seed', hand: 1, seed: 'kısa' },
      { t: 'resume', room: 'masa', token: 'x' },
    ]) {
      client.send(bad);
      expect(await client.waitFor(is('error'))).toMatchObject({ code: 'badMessage' });
    }
    client.send({ t: 'start' });
    expect(await client.waitFor(is('error'))).toMatchObject({ code: 'notInRoom' });
    client.close();
  });

  it('masaya oturur, masa ayarlarını kurar, oyunu başlatır', async () => {
    await start();
    const ali = await connect(server.port);
    ali.send({ t: 'join', room: 'test-masa', name: 'Ali', settings: { hands: 5, openingMode: 'rising' } });
    expect(await ali.waitFor(is('seated'))).toMatchObject({ room: 'test-masa', seat: 0, lastSeq: 0 });
    const waiting = await ali.state();
    expect(waiting).toMatchObject({ phase: 'waiting', host: 0, you: 0 });
    expect(waiting.settings).toMatchObject({ hands: 5, openingMode: 'rising' });

    const veli = await connect(server.port);
    veli.send({ t: 'join', room: 'test-masa', name: 'Veli' });
    expect(await veli.waitFor(is('seated'))).toMatchObject({ seat: 1 });
    expect((await ali.state((s) => s.seats[1] !== null)).seats[1]).toMatchObject({ name: 'Veli', status: 'online' });

    ali.send({ t: 'start' });
    const seeding = await ali.state((s) => s.phase === 'seeding');
    ali.send({ t: 'seed', hand: 1, seed: 'a'.repeat(64) });
    veli.send({ t: 'seed', hand: 1, seed: 'b'.repeat(64) });
    const playing = await ali.state((s) => s.phase === 'playing');
    expect(playing.seats.map((s) => s!.bot)).toEqual([false, false, true, true]);
    expect(playing.hand!.tiles.length).toBeGreaterThanOrEqual(21);
    expect(seeding.seeding!.commit).toMatch(/^[0-9a-f]{64}$/);
    ali.close();
    veli.close();
  });

  it('interneti kesilen oyuncu yeni bağlantıyla aynı koltuğa döner ve oyun kaldığı yerden sürer', async () => {
    await start();
    const players = await Promise.all([0, 1, 2, 3].map(() => connect(server.port)));
    const tokens: string[] = [];
    for (const [i, p] of players.entries()) {
      p.send({ t: 'join', room: 'dort-telefon', name: `Oyuncu ${i + 1}` });
      tokens.push((await p.waitFor(is('seated'))).token);
    }
    for (const p of players) {
      const { seeding } = await p.state((s) => s.phase === 'seeding');
      p.send({ t: 'seed', hand: seeding!.hand, seed: 'c'.repeat(64) });
    }
    const before = await players[0]!.state((s) => s.phase === 'playing');
    const seat = 2;
    const handBefore = (await players[seat]!.state((s) => s.phase === 'playing')).hand!;

    // 3 numaralı koltuğun interneti gider; diğerleri koptuğunu görür.
    players[seat]!.drop();
    await players[0]!.state((s) => s.seats[seat]!.status === 'offline');

    // Yeniden bağlanır, jetonla koltuğuna döner.
    const back = await connect(server.port);
    back.send({ t: 'resume', room: 'dort-telefon', token: tokens[seat] });
    expect(await back.waitFor(is('seated'))).toMatchObject({ seat, room: 'dort-telefon' });
    const resumed = await back.state();
    expect(resumed).toMatchObject({ phase: 'playing', you: seat });
    expect(resumed.hand!.number).toBe(before.hand!.number);
    // Kopukken yerine bot oynamış olabilir; oyuncu aynı eldeki güncel taşlarını alır.
    expect(resumed.hand!.tiles).toHaveLength(resumed.hand!.counts[seat]!);
    expect(handBefore.number).toBe(resumed.hand!.number);
    await players[0]!.state((s) => s.seats[seat]!.status === 'online');

    for (const p of [...players, back]) p.close();
  });

  it('dönüş süresi dolan koltuk bota geçer', async () => {
    await start({ timing: { ...FAST, reconnectGraceMs: 100 } });
    const ali = await connect(server.port);
    const veli = await connect(server.port);
    ali.send({ t: 'join', room: 'masa', name: 'Ali' });
    veli.send({ t: 'join', room: 'masa', name: 'Veli' });
    const { token } = await veli.waitFor(is('seated'));
    await ali.state((s) => s.seats[1] !== null);
    ali.send({ t: 'start' });
    await ali.state((s) => s.phase === 'playing');

    veli.drop();
    await ali.state((s) => s.seats[1]!.status === 'bot');

    const late = await connect(server.port);
    late.send({ t: 'resume', room: 'masa', token });
    expect(await late.waitFor(is('error'))).toMatchObject({ code: 'seatLost' });
    ali.close();
    late.close();
  });

  it('aynı hamle iki kez gelirse bir kez işlenir', async () => {
    await start({ timing: { ...FAST, speeds: { fast: { moveMs: 5_000, bankMs: 0 }, normal: { moveMs: 5_000, bankMs: 0 }, relaxed: { moveMs: 5_000, bankMs: 0 } } } });
    const players = await Promise.all([0, 1, 2, 3].map(() => connect(server.port)));
    for (const [i, p] of players.entries()) {
      p.send({ t: 'join', room: 'cift', name: `O${i}` });
      await p.waitFor(is('seated'));
    }
    // Her oyuncunun ilk oyun görüntüsü; hamle sırası gelen oyuncununki kullanılır.
    const views = await Promise.all(players.map((p) => p.state((s) => s.phase === 'playing')));
    const seat = views[0]!.hand!.turn.seat;
    const mover = players[seat]!;
    const own = views[seat]!;
    const msg = {
      t: 'act',
      seq: 1,
      hand: own.hand!.number,
      turn: own.hand!.turn.number,
      action: { type: 'discard', tileId: own.hand!.tiles[0]!.id },
    };
    mover.send(msg);
    mover.send(msg);
    expect(await mover.waitFor(is('ack'))).toEqual({ t: 'ack', seq: 1 });
    expect(await mover.waitFor(is('ack'))).toEqual({ t: 'ack', seq: 1, duplicate: true });
    // Hamle yapanın mesaj sırası onaylarla karıştığı için masayı başka bir oyuncunun gözünden kontrol et.
    const after = await players[(seat + 1) % 4]!.state((s) => s.hand!.turn.seat !== seat);
    expect(after.hand!.discards[seat]).toHaveLength(1);
    for (const p of players) p.close();
  });

  it('çok hızlı mesaj gönderen bağlantıyı yavaşlatır', async () => {
    await start({ rateLimit: { perSecond: 5, burst: 5 } });
    const client = await connect(server.port);
    for (let n = 0; n < 20; n++) client.send({ t: 'ping', n });
    expect(await client.waitFor(is('error'))).toMatchObject({ code: 'rateLimited' });
    const pongs = client.messages.filter((m) => m.t === 'pong');
    expect(pongs.length).toBeLessThanOrEqual(6);
    client.close();
  });

  it('biten her elin kaydını verir; son oyuncu ayrılınca masa silinir', async () => {
    const logs: HandLog[] = [];
    await start({ onHandLog: (log) => logs.push(log) });
    const ali = await connect(server.port);
    ali.send({ t: 'join', room: 'kayit', name: 'Ali', settings: { hands: 5 } });
    await ali.state();
    ali.send({ t: 'start' });
    // Ali hiç oynamaz: süre dolar, sonra yerine bot oynar.
    const final = await ali.waitFor((m): m is TableView => m.t === 'state' && m.phase === 'finished', 20_000);
    expect(final.match!.history).toHaveLength(5);
    expect(logs).toHaveLength(5);
    expect(server.stats().tables).toBe(1);

    ali.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(server.stats().tables).toBe(0);
  }, 30_000);
});
