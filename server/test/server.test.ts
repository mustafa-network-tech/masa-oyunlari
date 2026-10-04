import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createGameServer, type GameServer } from '../src/server.ts';
import type { ServerMessage } from '../src/protocol.ts';

/** Test istemcisi: gelen mesajları sıraya koyar, `next` ile sırayla okunur. */
async function connect(port: number) {
  const socket = new WebSocket(`ws://localhost:${port}`);
  const queue: ServerMessage[] = [];
  const waiters: ((msg: ServerMessage) => void)[] = [];
  socket.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ServerMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return {
    send: (msg: unknown) => socket.send(typeof msg === 'string' ? msg : JSON.stringify(msg)),
    next: () =>
      new Promise<ServerMessage>((resolve) => {
        const queued = queue.shift();
        if (queued) resolve(queued);
        else waiters.push(resolve);
      }),
    close: () => socket.close(),
  };
}

describe('oyun sunucusu', () => {
  let server: GameServer;

  beforeEach(async () => {
    server = await createGameServer({ port: 0 });
  });

  afterEach(async () => {
    await server.close();
  });

  it('bağlanınca karşılama mesajı gönderir', async () => {
    const client = await connect(server.port);
    const msg = await client.next();
    expect(msg).toMatchObject({ t: 'welcome', protocol: 1 });
    client.close();
  });

  it('ping mesajına pong ile cevap verir', async () => {
    const client = await connect(server.port);
    await client.next();
    client.send({ t: 'ping', n: 42 });
    expect(await client.next()).toEqual({ t: 'pong', n: 42 });
    client.close();
  });

  it('geçersiz mesajları reddeder', async () => {
    const client = await connect(server.port);
    await client.next();
    client.send('bozuk{json');
    expect(await client.next()).toMatchObject({ t: 'error', code: 'badMessage' });
    client.send({ t: 'join', room: 'Büyük Harf!', name: 'Ali' });
    expect(await client.next()).toMatchObject({ t: 'error', code: 'badMessage' });
    client.close();
  });

  it('aynı odaya katılan oyuncular birbirini görür', async () => {
    const ali = await connect(server.port);
    const veli = await connect(server.port);
    await ali.next();
    await veli.next();

    ali.send({ t: 'join', room: 'test-masa', name: 'Ali' });
    expect(await ali.next()).toEqual({ t: 'joined', room: 'test-masa', players: ['Ali'] });
    expect(await ali.next()).toEqual({ t: 'roomUpdate', room: 'test-masa', players: ['Ali'] });

    veli.send({ t: 'join', room: 'test-masa', name: 'Veli' });
    expect(await veli.next()).toEqual({ t: 'joined', room: 'test-masa', players: ['Ali', 'Veli'] });
    expect(await ali.next()).toEqual({ t: 'roomUpdate', room: 'test-masa', players: ['Ali', 'Veli'] });

    veli.close();
    expect(await ali.next()).toEqual({ t: 'roomUpdate', room: 'test-masa', players: ['Ali'] });
    ali.close();
  });
});
