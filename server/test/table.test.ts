import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { combineSeeds, commitSeed, okey101 } from '@masa/engine';
import { replayHand, type HandLog } from '../src/handLog.ts';
import { DEFAULT_SETTINGS, type ServerMessage, type TableSettings } from '../src/protocol.ts';
import { BOT_NAMES, Table, type Timing } from '../src/table.ts';
import type { TableView } from '../src/view.ts';

const MOVE_MS = 1_000;
const BANK_MS = 2_000;
const TIMING: Timing = {
  speeds: {
    fast: { moveMs: MOVE_MS, bankMs: BANK_MS },
    normal: { moveMs: MOVE_MS, bankMs: BANK_MS },
    relaxed: { moveMs: MOVE_MS, bankMs: BANK_MS },
  },
  botDelayMs: 10,
  seedTimeoutMs: 100,
  handBreakMs: 50,
  reconnectGraceMs: 5_000,
};

class FakePlayer {
  inbox: ServerMessage[] = [];
  seq = 0;
  constructor(readonly id: string) {}
  send(msg: ServerMessage) {
    this.inbox.push(msg);
  }
  get state(): TableView {
    const state = this.inbox.findLast((m): m is TableView => m.t === 'state');
    if (!state) throw new Error(`${this.id} henüz masa görüntüsü almadı`);
    return state;
  }
  get last() {
    return this.inbox.at(-1);
  }
  get token() {
    const seated = this.inbox.findLast((m) => m.t === 'seated');
    return seated?.t === 'seated' ? seated.token : '';
  }
}

const SEED = (n: number) => n.toString(16).padStart(64, '0');

function setup(settings: Partial<TableSettings> = {}) {
  const logs: HandLog[] = [];
  const onEmpty = vi.fn();
  const table = new Table({
    room: 'test',
    settings: { ...DEFAULT_SETTINGS, ...settings },
    timing: TIMING,
    onHandLog: (log) => logs.push(structuredClone(log)),
    onEmpty,
  });
  return { table, logs, onEmpty };
}

/** Oyuncunun gördüğü tur numarasıyla hamle gönderir. */
function act(table: Table, player: FakePlayer, action: okey101.Action) {
  const { hand } = player.state;
  table.act(player, { t: 'act', seq: ++player.seq, hand: hand!.number, turn: hand!.turn.number, action });
}

/** Sırası gelen oyuncunun bir turunu oynar: (gerekiyorsa) çeker ve ilk taşını atar. */
function playTurn(table: Table, player: FakePlayer) {
  if (player.state.hand!.turn.phase === 'draw') act(table, player, { type: 'draw' });
  act(table, player, { type: 'discard', tileId: player.state.hand!.tiles[0]!.id });
}

/** Dört oyuncuyla eli başlatır; herkes tohumunu gönderir. */
function startFourPlayers() {
  const ctx = setup();
  const players = [0, 1, 2, 3].map((i) => new FakePlayer(`p${i}`));
  players.forEach((p, i) => ctx.table.join(p, `Oyuncu ${i + 1}`));
  players.forEach((p, i) => ctx.table.seed(p, 1, SEED(i + 1)));
  const turnPlayer = () => players[players[0]!.state.hand!.turn.seat]!;
  return { ...ctx, players, turnPlayer };
}

describe('101 masası', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('oturma ve başlatma', () => {
    it('dört oyuncu oturunca Adil Oyun tohum turu başlar, tohumlar gelince el dağıtılır', () => {
      const { table } = setup();
      const players = [0, 1, 2, 3].map((i) => new FakePlayer(`p${i}`));
      players.slice(0, 3).forEach((p) => table.join(p, p.id));
      expect(players[0]!.state.phase).toBe('waiting');

      table.join(players[3]!, 'p3');
      const seeding = players[0]!.state;
      expect(seeding.phase).toBe('seeding');
      expect(seeding.seeding).toMatchObject({ hand: 1, commit: expect.stringMatching(/^[0-9a-f]{64}$/) });

      players.slice(0, 3).forEach((p, i) => table.seed(p, 1, SEED(i + 1)));
      expect(players[0]!.state.phase).toBe('seeding');
      table.seed(players[3]!, 1, SEED(4));
      expect(players[0]!.state.phase).toBe('playing');
    });

    it('masa sahibi başlatınca boş koltuklara bot oturur; başkası başlatamaz', () => {
      const { table } = setup();
      const host = new FakePlayer('host');
      const guest = new FakePlayer('guest');
      table.join(host, 'Ev sahibi');
      table.join(guest, 'Misafir');

      table.start(guest);
      expect(guest.last).toMatchObject({ t: 'error', code: 'notHost' });

      table.start(host);
      expect(host.state.seats.map((s) => s?.bot)).toEqual([false, false, true, true]);
      expect(host.state.seats[2]).toMatchObject({ status: 'bot' });
    });

    it('botlar listeden gerçek isimler alır; isimler masadakilerle çakışmaz', () => {
      for (let i = 0; i < 50; i++) {
        const { table } = setup();
        const host = new FakePlayer('host');
        table.join(host, 'Mustafa');
        table.start(host);
        const names = host.state.seats.map((s) => s!.name);
        expect(new Set(names.map((n) => n.toLocaleLowerCase('tr'))).size).toBe(4);
        for (const name of names.slice(1)) expect(BOT_NAMES).toContain(name);
        table.close();
      }
    });

    it('oyun başladıktan sonra yeni oyuncu oturamaz', () => {
      const { table } = setup();
      const host = new FakePlayer('host');
      table.join(host, 'Ev sahibi');
      table.start(host);
      const late = new FakePlayer('late');
      expect(table.join(late, 'Geç kalan')).toBe(false);
      expect(late.last).toMatchObject({ t: 'error', code: 'inProgress' });
    });

    it('tohum göndermeyen oyuncu beklenmez, süre dolunca el dağıtılır', () => {
      const { table } = setup();
      const host = new FakePlayer('host');
      table.join(host, 'Ev sahibi');
      table.start(host);
      expect(host.state.phase).toBe('seeding');
      vi.advanceTimersByTime(TIMING.seedTimeoutMs);
      expect(host.state.phase).toBe('playing');
    });
  });

  describe('gizlilik', () => {
    it('her oyuncu yalnızca kendi taşlarını görür', () => {
      const { players } = startFourPlayers();
      const views = players.map((p) => p.state);
      for (const [seat, view] of views.entries()) {
        expect(view.you).toBe(seat);
        expect(view.hand!.tiles).toHaveLength(view.hand!.counts[seat]!);
        expect(typeof view.hand!.stock).toBe('number');
        const otherIds = views.filter((_, i) => i !== seat).flatMap((v) => v.hand!.tiles.map((t) => t.id));
        const ownIds = new Set(view.hand!.tiles.map((t) => t.id));
        expect(otherIds.some((id) => ownIds.has(id))).toBe(false);
      }
      // Rakip taşları ve deste sırası mesajda hiç yok.
      expect(views[0]!.hand).not.toHaveProperty('hands');
      expect(views[0]!.result).toBeNull();
    });
  });

  describe('hamle doğrulama', () => {
    it('sırası olmayan oyuncunun hamlesi reddedilir', () => {
      const { table, players, turnPlayer } = startFourPlayers();
      const other = players.find((p) => p !== turnPlayer())!;
      act(table, other, { type: 'draw' });
      expect(other.last).toMatchObject({ t: 'error', code: 'illegalAction', reason: 'notYourTurn' });
    });

    it('aynı sıra numaralı mesaj ikinci kez işlenmez', () => {
      const { table, turnPlayer } = startFourPlayers();
      const player = turnPlayer();
      const { hand } = player.state;
      const tile = hand!.tiles.at(-1)!;
      const msg = { t: 'act' as const, seq: 1, hand: hand!.number, turn: hand!.turn.number, action: { type: 'discard' as const, tileId: tile.id } };
      // Başlayan oyuncu çekmeden atar.
      table.act(player, msg);
      expect(player.inbox.filter((m) => m.t === 'ack')).toEqual([{ t: 'ack', seq: 1 }]);
      const statesBefore = player.inbox.filter((m) => m.t === 'state').length;

      table.act(player, msg);
      expect(player.last).toEqual({ t: 'ack', seq: 1, duplicate: true });
      expect(player.inbox.filter((m) => m.t === 'state').length).toBe(statesBefore);
    });

    it('eski tur numarasıyla gelen hamle (hızlı çift tıklama) reddedilir', () => {
      const { table, turnPlayer } = startFourPlayers();
      const player = turnPlayer();
      const { hand } = player.state;
      const [a, b] = hand!.tiles;
      table.act(player, { t: 'act', seq: 1, hand: 1, turn: hand!.turn.number, action: { type: 'discard', tileId: a!.id } });
      table.act(player, { t: 'act', seq: 2, hand: 1, turn: hand!.turn.number, action: { type: 'discard', tileId: b!.id } });
      expect(player.last).toMatchObject({ t: 'error', code: 'stale', seq: 2 });
      expect(player.state.hand!.discards[player.state.you!]).toEqual([a]);
    });

    it('elde olmayan taş atılamaz', () => {
      const { table, players, turnPlayer } = startFourPlayers();
      const player = turnPlayer();
      const foreign = players.find((p) => p !== player)!.state.hand!.tiles[0]!;
      act(table, player, { type: 'discard', tileId: foreign.id });
      expect(player.last).toMatchObject({ t: 'error', code: 'illegalAction', reason: 'noSuchTile' });
    });
  });

  describe('süre ve zaman bankası', () => {
    it('hamle süresini aşan kısım bankadan düşer', () => {
      const { table, turnPlayer } = startFourPlayers();
      const player = turnPlayer();
      const seat = player.state.you!;
      vi.advanceTimersByTime(MOVE_MS + 500);
      expect(table.view(seat).hand!.clock).toMatchObject({ seat, moveLeft: 0, endsIn: BANK_MS - 500 });
      playTurn(table, player);
      expect(player.state.hand!.clock!.banks[seat]).toBe(BANK_MS - 500);
    });

    it('süre ve banka bitince otomatik hamle yapılır, üst üste ikincisinde oyuncu uzakta sayılır', () => {
      const { table, players, turnPlayer } = startFourPlayers();
      const sleeper = turnPlayer();
      const seat = sleeper.state.you!;

      vi.advanceTimersByTime(MOVE_MS + BANK_MS);
      expect(sleeper.state.hand!.turn.seat).not.toBe(seat);
      expect(sleeper.state.hand!.clock!.banks[seat]).toBe(0);
      expect(sleeper.state.seats[seat]!.status).toBe('online');

      // Diğerleri hemen oynar; sıra tekrar uyuyan oyuncuya gelir ve yine süre dolar.
      for (let i = 0; i < 3; i++) playTurn(table, turnPlayer());
      expect(turnPlayer()).toBe(sleeper);
      vi.advanceTimersByTime(MOVE_MS);
      expect(sleeper.state.seats[seat]!.status).toBe('away');

      // Uzaktaki oyuncunun yerine bot oynar.
      for (let i = 0; i < 3; i++) playTurn(table, turnPlayer());
      expect(sleeper.state.hand!.clock).toMatchObject({ seat, endsIn: null });
      vi.advanceTimersByTime(TIMING.botDelayMs * 10);
      expect(sleeper.state.hand!.turn.seat).not.toBe(seat);

      // Oyuncu dokununca kontrol geri gelir.
      table.back(sleeper);
      expect(sleeper.state.seats[seat]!.status).toBe('online');
      expect(players[0]!.state.seats[seat]!.status).toBe('online');
    });
  });

  describe('bağlantı kopması', () => {
    it('kopan oyuncunun yerine bot oynar, süre içinde dönen aynı koltuğa oturur', () => {
      const { table, players, turnPlayer } = startFourPlayers();
      const dropped = turnPlayer();
      const seat = dropped.state.you!;
      const tilesBefore = dropped.state.hand!.tiles.length;
      table.disconnect(dropped);
      const observer = players.find((p) => p !== dropped)!;
      expect(observer.state.seats[seat]!.status).toBe('offline');

      // Bot kopan oyuncunun sırasını oynar.
      vi.advanceTimersByTime(TIMING.botDelayMs * 10);
      expect(observer.state.hand!.turn.seat).not.toBe(seat);

      // Yeni bağlantıyla dönüş.
      const back = new FakePlayer('p-yeni');
      table.resume(back, dropped.token);
      expect(back.inbox[0]).toMatchObject({ t: 'seated', seat, lastSeq: 0 });
      expect(back.state.you).toBe(seat);
      expect(back.state.phase).toBe('playing');
      expect(back.state.hand!.tiles.length).toBeLessThanOrEqual(tilesBefore);
      expect(observer.state.seats[seat]!.status).toBe('online');
    });

    it('dönüş süresi dolarsa koltuk kalıcı olarak bota geçer', () => {
      const { table, players } = startFourPlayers();
      const dropped = players[1]!;
      const token = dropped.token;
      table.disconnect(dropped);
      vi.advanceTimersByTime(TIMING.reconnectGraceMs);
      expect(players[0]!.state.seats[1]).toMatchObject({ bot: true, status: 'bot' });

      const late = new FakePlayer('late');
      expect(table.resume(late, token)).toBe(false);
      expect(late.last).toMatchObject({ t: 'error', code: 'seatLost' });
    });

    it('aynı koltuğa ikinci bağlantıdan girilince eski bağlantıya haber verilir', () => {
      const { table, players } = startFourPlayers();
      const first = players[2]!;
      const second = new FakePlayer('ikinci');
      table.resume(second, first.token);
      expect(first.last).toMatchObject({ t: 'error', code: 'replaced' });
      expect(second.state.you).toBe(2);
      // Eski bağlantının kapanması yeni bağlantıyı etkilemez.
      table.disconnect(first);
      expect(second.state.seats[2]!.status).toBe('online');
    });

    it('yanlış jetonla dönülemez', () => {
      const { table } = startFourPlayers();
      const stranger = new FakePlayer('yabanci');
      expect(table.resume(stranger, 'f'.repeat(32))).toBe(false);
      expect(stranger.last).toMatchObject({ t: 'error', code: 'badToken' });
    });

    it('son gerçek oyuncu ayrılınca masa kapanır', () => {
      const { table, onEmpty } = setup();
      const host = new FakePlayer('host');
      table.join(host, 'Ev sahibi');
      table.start(host);
      vi.advanceTimersByTime(TIMING.seedTimeoutMs);
      table.disconnect(host);
      expect(onEmpty).not.toHaveBeenCalled();
      vi.advanceTimersByTime(TIMING.reconnectGraceMs);
      expect(onEmpty).toHaveBeenCalledOnce();
    });

    it('beklerken ayrılan oyuncunun koltuğu boşalır, masa sahipliği devredilir', () => {
      const { table } = setup();
      const host = new FakePlayer('host');
      const guest = new FakePlayer('guest');
      table.join(host, 'Ev sahibi');
      table.join(guest, 'Misafir');
      table.leave(host);
      expect(guest.state.seats[0]).toBeNull();
      expect(guest.state.host).toBe(1);
    });
  });

  describe('maç ve olay kaydı', () => {
    it('botlarla bütün maç oynanır; her el kayıttan aynı sonuçla baştan oynatılabilir', () => {
      const { table, logs } = setup({ hands: 5 });
      const host = new FakePlayer('host');
      table.join(host, 'Ev sahibi');
      table.start(host);
      table.seed(host, 1, SEED(7));
      // Oyuncu hiç oynamaz: iki otomatik hamleden sonra yerine bot oynar.
      for (let i = 0; i < 1_000 && host.state.phase !== 'finished'; i++) {
        const state = host.state;
        if (state.phase === 'seeding' && state.seeding) table.seed(host, state.seeding.hand, SEED(state.seeding.hand + 7));
        vi.advanceTimersByTime(MOVE_MS + BANK_MS);
      }

      const final = host.state;
      expect(final.phase).toBe('finished');
      expect(final.match!.history).toHaveLength(5);
      expect(logs).toHaveLength(5);
      expect(final.match!.totals).toEqual(
        [0, 1, 2, 3].map((seat) => logs.reduce((sum, log) => sum + log.result!.rows[seat]!.total, 0)),
      );

      for (const log of logs) {
        const replayed = replayHand(log);
        expect(replayed.result).toEqual(log.result);
        expect(log.actions.length).toBeGreaterThan(0);
        // Başlayan oyuncu her el bir sonrakine geçer.
        expect(log.starter).toBe((logs[0]!.starter + log.handNumber - 1) % 4);
      }
      expect(logs[0]!.fairness.clientSeeds).toEqual([SEED(7), '', '', '']);
      const sources = new Set(logs.flatMap((l) => l.actions.filter((a) => a.seat === 0).map((a) => a.by)));
      expect(sources).toEqual(new Set(['auto', 'bot']));
    });

    it('el sonunda Adil Oyun bilgileri açıklanır ve doğrulanabilir', () => {
      const { table } = setup({ hands: 5 });
      const host = new FakePlayer('host');
      table.join(host, 'Ev sahibi');
      table.start(host);
      const commit = host.state.seeding!.commit;
      table.seed(host, 1, SEED(42));
      for (let i = 0; i < 100_000 && host.state.phase === 'playing'; i++) vi.advanceTimersByTime(TIMING.botDelayMs);

      const { result } = host.state;
      expect(host.state.phase).toBe('handOver');
      const { fairness } = result!;
      expect(fairness.commit).toBe(commit);
      expect(commitSeed(fairness.serverSeed)).toBe(commit);
      expect(fairness.clientSeeds[0]).toBe(SEED(42));
      expect(combineSeeds(fairness.serverSeed, fairness.clientSeeds, 1)).toBe(fairness.seed);
      // El sonunda bütün eller açılır.
      expect(result!.hands).toHaveLength(4);
      // El arasında biten elin puanı toplama işlenmiş görünür.
      expect(host.state.match!.totals).toEqual(result!.rows.map((r) => r.total));

      vi.advanceTimersByTime(TIMING.handBreakMs);
      expect(host.state.phase).toBe('seeding');
      expect(host.state.seeding!.hand).toBe(2);
      expect(host.state.match!.totals).toEqual(result!.rows.map((r) => r.total));
    });
  });
  describe('otomatik diz ve tepkiler', () => {
    it('otomatik diz oyuncunun kendi taşlarından geçerli perler önerir', () => {
      const { table, players } = startFourPlayers();
      const player = players[0]!;
      const own = new Set(player.state.hand!.tiles.map((t) => t.id));
      for (const mode of ['sets', 'pairs'] as const) {
        table.arrange(player, mode);
        const msg = player.last;
        expect(msg).toMatchObject({ t: 'arrangement', mode });
        if (msg?.t !== 'arrangement') throw new Error();
        for (const meld of msg.melds) {
          expect(meld.tileIds.every((id) => own.has(id))).toBe(true);
          if (mode === 'pairs') expect(meld.kind).toBe('pair');
        }
      }
    });

    it('tepki herkese gider, art arda gönderilen yok sayılır', () => {
      const { table, players } = startFourPlayers();
      table.react(players[1]!, 'helal');
      for (const p of players) expect(p.last).toEqual({ t: 'reaction', seat: 1, id: 'helal' });
      table.react(players[1]!, 'hadi');
      expect(players[0]!.last).toEqual({ t: 'reaction', seat: 1, id: 'helal' });
      vi.advanceTimersByTime(2_000);
      table.react(players[1]!, 'hadi');
      expect(players[0]!.last).toEqual({ t: 'reaction', seat: 1, id: 'hadi' });
    });
  });
});
