import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { ENGINE_VERSION } from '@masa/engine';
import type { HandLog } from './handLog.ts';
import { createGameServer } from './server.ts';

const port = Number(process.env.PORT ?? 2567);
// El kayıtları günlük JSONL dosyalarına yazılır. Veritabanı gelince (Faz 6) oraya taşınacak.
const logDir = process.env.HAND_LOG_DIR ?? 'logs';
await mkdir(logDir, { recursive: true });

const writeHandLog = (log: HandLog) => {
  const file = join(logDir, `hands-${new Date().toISOString().slice(0, 10)}.jsonl`);
  appendFile(file, JSON.stringify(log) + '\n').catch((e: unknown) => console.error('El kaydı yazılamadı', e));
};

// Yük testinde botların hızını ayarlamak için (varsayılan 900 ms).
const botDelayMs = process.env.BOT_DELAY_MS ? Number(process.env.BOT_DELAY_MS) : undefined;
const server = await createGameServer({ port, onHandLog: writeHandLog, timing: botDelayMs === undefined ? {} : { botDelayMs } });
console.log(`Masa sunucusu ws://localhost:${server.port} adresinde (motor v${ENGINE_VERSION})`);

// İzleme: STATS_INTERVAL_MS verilirse bağlantı, masa, bellek ve olay döngüsü gecikmesini düzenli yazar.
const statsInterval = Number(process.env.STATS_INTERVAL_MS ?? 0);
if (statsInterval > 0) {
  const lag = monitorEventLoopDelay({ resolution: 10 });
  lag.enable();
  setInterval(() => {
    const { clients, tables } = server.stats();
    const ms = (ns: number) => (ns / 1e6).toFixed(1);
    const mb = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);
    console.log(
      `[istatistik] bağlantı=${clients} masa=${tables} bellek=${mb}MB gecikme p50=${ms(lag.percentile(50))}ms p99=${ms(lag.percentile(99))}ms max=${ms(lag.max)}ms`,
    );
    lag.reset();
  }, statsInterval).unref();
}

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
