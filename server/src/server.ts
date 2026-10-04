import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type { HandLog } from './handLog.ts';
import {
  DEFAULT_SETTINGS,
  ERROR_MESSAGES,
  PROTOCOL_VERSION,
  parseClientMessage,
  type ErrorCode,
  type ServerMessage,
} from './protocol.ts';
import { DEFAULT_TIMING, Table, type Player, type Timing } from './table.ts';

interface Client extends Player {
  socket: WebSocket;
  alive: boolean;
  table?: Table;
  /** Hız sınırı: saniyede `perSecond` jeton dolan kova. */
  tokens: number;
  refilledAt: number;
  dropped: number;
}

export interface GameServer {
  port: number;
  stats(): { clients: number; tables: number };
  close(): Promise<void>;
}

export interface GameServerOptions {
  port: number;
  /** Ölü bağlantıları tespit etme aralığı (ms). */
  heartbeatMs?: number;
  timing?: Partial<Timing>;
  rateLimit?: { perSecond: number; burst: number };
  onHandLog?: (log: HandLog) => void;
}

/** Bu kadar mesaj üst üste reddedilen bağlantı kapatılır. */
const MAX_DROPPED = 200;

export function createGameServer(options: GameServerOptions): Promise<GameServer> {
  const wss = new WebSocketServer({ port: options.port, maxPayload: 16 * 1024 });
  const timing: Timing = { ...DEFAULT_TIMING, ...options.timing };
  const rateLimit = options.rateLimit ?? { perSecond: 20, burst: 40 };
  const clients = new Set<Client>();
  const tables = new Map<string, Table>();

  const fail = (client: Client, code: ErrorCode) =>
    client.send({ t: 'error', code, message: ERROR_MESSAGES[code] });

  const allow = (client: Client): boolean => {
    const now = Date.now();
    client.tokens = Math.min(rateLimit.burst, client.tokens + ((now - client.refilledAt) / 1000) * rateLimit.perSecond);
    client.refilledAt = now;
    if (client.tokens >= 1) {
      client.tokens--;
      client.dropped = 0;
      return true;
    }
    if (client.dropped++ === 0) fail(client, 'rateLimited');
    if (client.dropped > MAX_DROPPED) client.socket.terminate();
    return false;
  };

  const openTable = (room: string, settings = DEFAULT_SETTINGS): Table => {
    const table: Table = new Table({
      room,
      settings,
      timing,
      onHandLog: options.onHandLog,
      onEmpty: () => {
        if (tables.get(room) === table) tables.delete(room);
      },
    });
    tables.set(room, table);
    return table;
  };

  const leaveTable = (client: Client) => {
    client.table?.leave(client);
    client.table = undefined;
  };

  wss.on('connection', (socket) => {
    const client: Client = {
      id: randomUUID(),
      socket,
      alive: true,
      tokens: rateLimit.burst,
      refilledAt: Date.now(),
      dropped: 0,
      send(msg: ServerMessage) {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
      },
    };
    clients.add(client);
    client.send({ t: 'welcome', protocol: PROTOCOL_VERSION, clientId: client.id });

    socket.on('pong', () => {
      client.alive = true;
    });

    socket.on('message', (data, isBinary) => {
      if (!allow(client)) return;
      const msg = isBinary ? null : parseClientMessage(data.toString());
      if (!msg) return fail(client, 'badMessage');

      switch (msg.t) {
        case 'ping':
          return client.send({ t: 'pong', n: msg.n });

        case 'join': {
          leaveTable(client);
          const table = tables.get(msg.room) ?? openTable(msg.room, { ...DEFAULT_SETTINGS, ...msg.settings });
          if (table.join(client, msg.name)) client.table = table;
          return;
        }

        case 'resume': {
          const table = tables.get(msg.room);
          if (!table) return fail(client, 'badToken');
          if (client.table !== table) leaveTable(client);
          if (table.resume(client, msg.token)) client.table = table;
          return;
        }

        case 'leave':
          if (!client.table) return fail(client, 'notInRoom');
          return leaveTable(client);
      }

      const table = client.table;
      if (!table) return fail(client, 'notInRoom');
      switch (msg.t) {
        case 'start':
          return table.start(client);
        case 'seed':
          return table.seed(client, msg.hand, msg.seed);
        case 'act':
          return table.act(client, msg);
        case 'back':
          return table.back(client);
        case 'arrange':
          return table.arrange(client, msg.mode);
        case 'react':
          return table.react(client, msg.id);
      }
    });

    socket.on('close', () => {
      client.table?.disconnect(client);
      client.table = undefined;
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
        stats: () => ({ clients: clients.size, tables: tables.size }),
        close: () =>
          new Promise<void>((done) => {
            clearInterval(heartbeat);
            for (const table of tables.values()) table.close();
            tables.clear();
            for (const client of clients) client.socket.terminate();
            wss.close(() => done());
          }),
      });
    });
  });
}
