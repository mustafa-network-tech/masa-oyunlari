import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { PROTOCOL_VERSION, parseClientMessage, type ServerMessage } from './protocol.ts';

// Faz 1: bağlantı, ping ve basit oda katılımı. Gerçek oyun odaları Faz 4'te gelecek.

interface Client {
  id: string;
  socket: WebSocket;
  name?: string;
  room?: string;
  alive: boolean;
}

export interface GameServer {
  port: number;
  close(): Promise<void>;
}

export interface GameServerOptions {
  port: number;
  /** Ölü bağlantıları tespit etme aralığı (ms). */
  heartbeatMs?: number;
}

export function createGameServer(options: GameServerOptions): Promise<GameServer> {
  const wss = new WebSocketServer({ port: options.port, maxPayload: 16 * 1024 });
  const clients = new Set<Client>();
  const rooms = new Map<string, Set<Client>>();

  const send = (client: Client, msg: ServerMessage) => {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(msg));
  };

  const playersIn = (room: string) => [...(rooms.get(room) ?? [])].map((c) => c.name ?? '?');

  const broadcastRoom = (room: string) => {
    const players = playersIn(room);
    for (const member of rooms.get(room) ?? []) send(member, { t: 'roomUpdate', room, players });
  };

  const leaveRoom = (client: Client) => {
    const room = client.room;
    if (!room) return;
    const members = rooms.get(room);
    members?.delete(client);
    if (members?.size === 0) rooms.delete(room);
    client.room = undefined;
    broadcastRoom(room);
  };

  wss.on('connection', (socket) => {
    const client: Client = { id: randomUUID(), socket, alive: true };
    clients.add(client);
    send(client, { t: 'welcome', protocol: PROTOCOL_VERSION, clientId: client.id });

    socket.on('pong', () => {
      client.alive = true;
    });

    socket.on('message', (data, isBinary) => {
      const msg = isBinary ? null : parseClientMessage(data.toString());
      if (!msg) {
        send(client, { t: 'error', code: 'badMessage', message: 'Geçersiz mesaj' });
        return;
      }
      switch (msg.t) {
        case 'ping':
          send(client, { t: 'pong', n: msg.n });
          break;
        case 'join': {
          leaveRoom(client);
          client.name = msg.name;
          client.room = msg.room;
          let members = rooms.get(msg.room);
          if (!members) rooms.set(msg.room, (members = new Set()));
          members.add(client);
          send(client, { t: 'joined', room: msg.room, players: playersIn(msg.room) });
          broadcastRoom(msg.room);
          break;
        }
        case 'leave':
          if (!client.room) {
            send(client, { t: 'error', code: 'notInRoom', message: 'Bir odada değilsin' });
            break;
          }
          leaveRoom(client);
          break;
      }
    });

    socket.on('close', () => {
      leaveRoom(client);
      clients.delete(client);
    });
  });

  // Yanıt vermeyen bağlantıları kapat (telefon uykuya geçti, ağ koptu vb.).
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate();
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }, options.heartbeatMs ?? 15_000);

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      resolve({
        port,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(heartbeat);
            for (const client of clients) client.socket.terminate();
            wss.close(() => done());
          }),
      });
    });
  });
}
