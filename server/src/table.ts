// 101 masası. Bütün hamleler burada motordan geçer; istemci hiçbir sonuca kendisi karar vermez.
//
// Akış: waiting (koltuklar doluyor) → seeding (Adil Oyun tohumları) → playing → handOver → seeding … → finished
//
// Sırası gelen koltuğu kim oynar?
// - Oyuncu bağlı ve "uzakta" değilse oyuncu. Hamle süresi + zaman bankası dolarsa otomatik hamle yapılır;
//   üst üste 2 otomatik hamlede oyuncu "uzakta" sayılır.
// - Bağlantısı kopmuş veya uzaktaki oyuncunun yerine bot oynar. Kopan oyuncu süre (60 sn) içinde dönerse
//   aynı koltuğa oturur; dönmezse koltuk kalıcı olarak bota geçer.

import { randomBytes, randomInt } from 'node:crypto';
import { combineSeeds, commitSeed, createServerSeed, SeededRandom, okey101 } from '@masa/engine';
import type { ActionSource, HandLog } from './handLog.ts';
import {
  ERROR_MESSAGES,
  type ArrangeMode,
  type ClientMessage,
  type ErrorCode,
  type Reaction,
  type ServerMessage,
  type TableSettings,
} from './protocol.ts';
import type { ClockView, HandView, SeatView, TablePhase, TableView } from './view.ts';

type Seat = okey101.Seat;
const SEATS = okey101.SEATS;

export interface Timing {
  speeds: Record<TableSettings['speed'], { moveMs: number; bankMs: number }>;
  /** Botun her adımı arasındaki bekleme (taş çekme, açma, atma ayrı adımlardır). */
  botDelayMs: number;
  /** Oyuncu tohumlarının beklenme süresi; gelmeyen tohum boş sayılır. */
  seedTimeoutMs: number;
  /** El sonu puan tablosunun gösterilme süresi. */
  handBreakMs: number;
  /** Kopan oyuncunun koltuğunun tutulma süresi. */
  reconnectGraceMs: number;
}

/** Bkz. docs/02-101-kurallari.md §11 */
export const DEFAULT_TIMING: Timing = {
  speeds: {
    fast: { moveMs: 12_000, bankMs: 20_000 },
    normal: { moveMs: 20_000, bankMs: 40_000 },
    relaxed: { moveMs: 35_000, bankMs: 60_000 },
  },
  botDelayMs: 900,
  seedTimeoutMs: 3_000,
  handBreakMs: 8_000,
  reconnectGraceMs: 60_000,
};

/** Masadaki bir bağlantı. Sunucu her WebSocket bağlantısı için bir tane verir. */
export interface Player {
  readonly id: string;
  send(msg: ServerMessage): void;
}

export interface TableOptions {
  room: string;
  settings: TableSettings;
  timing: Timing;
  onHandLog?: (log: HandLog) => void;
  /** Masada gerçek oyuncu kalmayınca çağrılır; sunucu masayı siler. */
  onEmpty: () => void;
}

interface SeatState {
  name: string;
  bot: boolean;
  player: Player | null;
  token: string | null;
  /** Bu koltuktan işlenen son hamle sıra numarası. */
  lastSeq: number;
  away: boolean;
  /** Üst üste yapılan otomatik hamle sayısı. */
  autoMoves: number;
  /** Bu elde kalan zaman bankası (ms). */
  bank: number;
  graceTimer: NodeJS.Timeout | null;
  /** Bu elin Adil Oyun tohumu. */
  seed: string;
  lastReactionAt: number;
}

interface Clock {
  seat: Seat;
  mode: 'player' | 'bot';
  startedAt: number;
}

const AWAY_AFTER_AUTO_MOVES = 2;
const MAX_BOT_ACTIONS_PER_TURN = 60;
const BOT_LEVEL: okey101.BotLevel = 'medium';
const REACTION_COOLDOWN_MS = 2_000;

/** Bot isimleri. Botlar arayüzde her zaman "BOT" etiketiyle görünür. */
export const BOT_NAMES = [
  'Mustafa', 'Ayşe', 'Arda', 'Ferdane', 'Filiz', 'Oktay', 'Necla', 'Hasan', 'Zeynep', 'Emre',
  'Elif', 'Murat', 'Selin', 'Kemal', 'Derya', 'Burak', 'Gül', 'Hakan', 'Sevgi', 'Cem',
  'Leyla', 'Orhan', 'Nur', 'Tuncay', 'Hülya', 'Serkan', 'Aysel', 'Yusuf', 'Melek', 'Kadir',
];

export class Table {
  readonly room: string;
  readonly settings: TableSettings;
  private readonly config: okey101.TableConfig;
  private readonly timing: Timing;
  private readonly options: TableOptions;

  private readonly seats: (SeatState | null)[] = [null, null, null, null];
  private readonly retiredTokens = new Set<string>();
  private host: Seat | null = null;
  private phase: TablePhase = 'waiting';
  private match: okey101.MatchState | null = null;
  private seeding: { hand: number; serverSeed: string; commit: string } | null = null;
  private log: HandLog | null = null;
  private handStartedAt = 0;
  private clock: Clock | null = null;
  private botActionsThisTurn = 0;
  private turnTimer: NodeJS.Timeout | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(options: TableOptions) {
    this.options = options;
    this.room = options.room;
    this.settings = options.settings;
    this.timing = options.timing;
    const { speed: _, ...config } = options.settings;
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Oyuncu mesajları

  join(player: Player, name: string): boolean {
    if (this.phase !== 'waiting') return this.fail(player, 'inProgress');
    const seat = SEATS.find((s) => !this.seats[s]);
    if (seat === undefined) return this.fail(player, 'tableFull');
    const token = randomBytes(16).toString('hex');
    this.seats[seat] = {
      name,
      bot: false,
      player,
      token,
      lastSeq: 0,
      away: false,
      autoMoves: 0,
      bank: 0,
      graceTimer: null,
      seed: '',
      lastReactionAt: 0,
    };
    this.host ??= seat;
    player.send({ t: 'seated', room: this.room, seat, token, lastSeq: 0 });
    if (SEATS.every((s) => this.seats[s])) this.beginSeeding(1);
    else this.broadcast();
    return true;
  }

  resume(player: Player, token: string): boolean {
    const seat = SEATS.find((s) => this.seats[s]?.token === token);
    if (seat === undefined) return this.fail(player, this.retiredTokens.has(token) ? 'seatLost' : 'badToken');
    const state = this.seats[seat]!;
    if (state.player && state.player.id !== player.id) this.fail(state.player, 'replaced');
    this.clearGrace(state);
    state.player = player;
    state.away = false;
    state.autoMoves = 0;
    player.send({ t: 'seated', room: this.room, seat, token, lastSeq: state.lastSeq });
    this.refreshControl();
    this.broadcast();
    return true;
  }

  leave(player: Player): void {
    const seat = this.seatOf(player);
    if (seat === undefined) return;
    if (this.phase === 'waiting') {
      this.seats[seat] = null;
      if (this.host === seat) this.host = SEATS.find((s) => this.seats[s] && !this.seats[s].bot) ?? null;
    } else {
      this.retire(seat);
    }
    if (!this.checkEmpty()) {
      this.refreshControl();
      this.broadcast();
    }
  }

  /** Bağlantı koptu. Oyun sürüyorsa koltuk bir süre tutulur, o arada yerine bot oynar. */
  disconnect(player: Player): void {
    const seat = this.seatOf(player);
    if (seat === undefined) return;
    if (this.phase === 'waiting' || this.phase === 'finished') {
      this.leave(player);
      return;
    }
    const state = this.seats[seat]!;
    state.player = null;
    state.graceTimer = setTimeout(() => {
      state.graceTimer = null;
      this.retire(seat);
      if (!this.checkEmpty()) this.broadcast();
    }, this.timing.reconnectGraceMs);
    this.refreshControl();
    this.broadcast();
  }

  /** Masa sahibi oyunu başlatır; boş koltuklara bot oturur. */
  start(player: Player): void {
    const seat = this.seatOf(player);
    if (seat === undefined) return void this.fail(player, 'notInRoom');
    if (this.phase !== 'waiting') return void this.fail(player, 'inProgress');
    if (seat !== this.host) return void this.fail(player, 'notHost');
    // Masadakilerle aynı olmayan, birbirinden farklı isimler.
    const taken = new Set(this.seats.map((st) => st?.name.toLocaleLowerCase('tr')));
    const names = BOT_NAMES.filter((n) => !taken.has(n.toLocaleLowerCase('tr')));
    for (const s of SEATS) {
      if (this.seats[s]) continue;
      this.seats[s] = {
        name: names.splice(randomInt(names.length), 1)[0]!,
        bot: true,
        player: null,
        token: null,
        lastSeq: 0,
        away: false,
        autoMoves: 0,
        bank: 0,
        graceTimer: null,
        seed: '',
        lastReactionAt: 0,
      };
    }
    this.beginSeeding(1);
  }

  seed(player: Player, hand: number, seed: string): void {
    const seat = this.seatOf(player);
    if (seat === undefined || this.phase !== 'seeding' || this.seeding?.hand !== hand) return;
    const state = this.seats[seat]!;
    if (state.seed) return;
    state.seed = seed;
    if (this.seedsComplete()) this.deal();
  }

  act(player: Player, msg: Extract<ClientMessage, { t: 'act' }>): void {
    const seat = this.seatOf(player);
    if (seat === undefined) return void this.fail(player, 'notInRoom');
    const state = this.seats[seat]!;
    // Aynı mesaj ikinci kez geldiyse (yeniden gönderme, çift tıklama) bir şey yapmadan onayla.
    if (msg.seq <= state.lastSeq) return player.send({ t: 'ack', seq: msg.seq, duplicate: true });
    state.lastSeq = msg.seq;

    if (this.phase !== 'playing') return void this.fail(player, 'notPlaying', { seq: msg.seq });
    const hand = this.match!.hand;
    if (msg.hand !== hand.handNumber || msg.turn !== hand.turn.number) {
      return void this.fail(player, 'stale', { seq: msg.seq });
    }

    // Dokunan oyuncu kontrolü bottan geri alır.
    const wasAway = state.away;
    if (wasAway) this.markBack(state);

    const turn = hand.turn.number;
    const result = this.perform(seat, msg.action, 'player');
    if (!result.ok) {
      this.fail(player, 'illegalAction', { seq: msg.seq, reason: result.error });
      if (wasAway) this.broadcast();
      return;
    }
    state.autoMoves = 0;
    player.send({ t: 'ack', seq: msg.seq });
    this.settle(turn, result.events);
  }

  back(player: Player): void {
    const seat = this.seatOf(player);
    if (seat === undefined) return void this.fail(player, 'notInRoom');
    const state = this.seats[seat]!;
    if (!state.away) return;
    this.markBack(state);
    this.broadcast();
  }

  /** Otomatik diz: oyuncunun elindeki en iyi perleri veya çiftleri önerir. Masayı değiştirmez. */
  arrange(player: Player, mode: ArrangeMode): void {
    const seat = this.seatOf(player);
    if (seat === undefined) return void this.fail(player, 'notInRoom');
    if (!this.match || this.phase === 'seeding') return void this.fail(player, 'notPlaying');
    const hand = this.match.hand;
    const tiles = hand.hands[seat]!;
    const plan = mode === 'pairs' ? okey101.bestPairs(tiles, hand.okey) : okey101.bestMelds(tiles, hand.okey);
    player.send({ t: 'arrangement', mode, melds: plan.melds });
  }

  /** Hazır tepki. Masayı rahatsız etmemek için koltuk başına 2 sn'de bir. */
  react(player: Player, id: Reaction): void {
    const seat = this.seatOf(player);
    if (seat === undefined) return void this.fail(player, 'notInRoom');
    const state = this.seats[seat]!;
    const now = Date.now();
    if (now - state.lastReactionAt < REACTION_COOLDOWN_MS) return;
    state.lastReactionAt = now;
    for (const s of this.seats) s?.player?.send({ t: 'reaction', seat, id });
  }

  close(): void {
    this.closed = true;
    this.clearTurnTimer();
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    for (const state of this.seats) if (state) this.clearGrace(state);
  }

  get humanCount(): number {
    return this.seats.filter((s) => s && !s.bot).length;
  }

  // -------------------------------------------------------------------------
  // El akışı

  private beginSeeding(hand: number): void {
    const serverSeed = createServerSeed();
    this.seeding = { hand, serverSeed, commit: commitSeed(serverSeed) };
    for (const state of this.seats) state!.seed = '';
    this.phase = 'seeding';
    this.broadcast();
    if (this.seedsComplete()) this.deal();
    else this.phaseTimer = setTimeout(() => this.deal(), this.timing.seedTimeoutMs);
  }

  /** Bağlı bütün oyuncuların tohumu geldi mi? */
  private seedsComplete(): boolean {
    return this.seats.every((s) => !s || s.bot || !s.player || s.seed);
  }

  private deal(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
    const { hand, serverSeed, commit } = this.seeding!;
    this.seeding = null;
    const clientSeeds = this.seats.map((s) => s!.seed);
    const seed = combineSeeds(serverSeed, clientSeeds, hand);

    if (hand === 1) {
      const starter = new SeededRandom(`starter:${seed}`).int(4) as Seat;
      this.match = okey101.createMatch(this.config, starter, seed);
    } else {
      this.match = okey101.advanceMatch(this.match!, seed);
    }

    const { bankMs } = this.timing.speeds[this.settings.speed];
    for (const state of this.seats) state!.bank = bankMs;
    this.log = {
      room: this.room,
      handNumber: hand,
      config: this.config,
      starter: this.match.hand.starter,
      players: this.seats.map((s) => s!.name),
      fairness: { commit, serverSeed, clientSeeds, seed },
      startedAt: new Date().toISOString(),
      actions: [],
      result: null,
    };
    this.handStartedAt = Date.now();
    this.phase = 'playing';
    this.startTurn();
    this.broadcast();
  }

  private finishHand(events: okey101.GameEvent[]): void {
    this.clearTurnTimer();
    this.clock = null;
    const log = this.log!;
    log.result = this.match!.hand.result;
    this.options.onHandLog?.(log);

    if (this.match!.history.length + 1 >= this.config.hands) {
      this.match = okey101.advanceMatch(this.match!, null);
      this.phase = 'finished';
    } else {
      this.phase = 'handOver';
      const next = this.match!.history.length + 2;
      this.phaseTimer = setTimeout(() => this.beginSeeding(next), this.timing.handBreakMs);
    }
    this.broadcast(events);
  }

  // -------------------------------------------------------------------------
  // Sıra, süre ve bot

  private controlledByBot(seat: Seat): boolean {
    const state = this.seats[seat]!;
    return state.bot || !state.player || state.away;
  }

  private startTurn(): void {
    this.clearTurnTimer();
    const seat = this.match!.hand.turn.seat;
    this.botActionsThisTurn = 0;
    if (this.controlledByBot(seat)) {
      this.clock = { seat, mode: 'bot', startedAt: Date.now() };
      this.scheduleBot();
    } else {
      this.clock = { seat, mode: 'player', startedAt: Date.now() };
      const { moveMs } = this.timing.speeds[this.settings.speed];
      this.turnTimer = setTimeout(() => this.onTimeout(), moveMs + this.seats[seat]!.bank);
    }
  }

  /** Sıradaki koltuğun kontrolü değiştiyse (koptu, döndü, uzakta) sırayı yeni sahibiyle yeniden başlatır. */
  private refreshControl(): void {
    if (this.phase !== 'playing' || !this.clock) return;
    const bot = this.controlledByBot(this.clock.seat);
    if (bot === (this.clock.mode === 'bot')) return;
    this.chargeBank();
    this.startTurn();
  }

  /** Oyuncunun sırası bitti: hamle süresini aşan kısım zaman bankasından düşülür. */
  private chargeBank(): void {
    if (this.clock?.mode !== 'player') return;
    const state = this.seats[this.clock.seat]!;
    const { moveMs } = this.timing.speeds[this.settings.speed];
    const overflow = Date.now() - this.clock.startedAt - moveMs;
    if (overflow > 0) state.bank = Math.max(0, state.bank - overflow);
  }

  /** Hamle süresi ve zaman bankası doldu: çek, en işe yaramaz taşı at. */
  private onTimeout(): void {
    this.turnTimer = null;
    const hand = this.match!.hand;
    const seat = hand.turn.seat;
    const state = this.seats[seat]!;
    state.bank = 0;
    state.autoMoves++;
    if (state.autoMoves >= AWAY_AFTER_AUTO_MOVES) state.away = true;

    const turn = hand.turn.number;
    const events: okey101.GameEvent[] = [];
    for (let i = 0; i < MAX_BOT_ACTIONS_PER_TURN; i++) {
      const current = this.match!.hand;
      if (current.result || current.turn.number !== turn) break;
      const result = this.perform(seat, okey101.autoAction(current, seat), 'auto');
      if (!result.ok) {
        console.error(`[${this.room}] otomatik hamle başarısız: ${result.error}`);
        break;
      }
      events.push(...result.events);
    }
    this.settle(turn, events);
  }

  private scheduleBot(): void {
    this.turnTimer = setTimeout(() => this.botStep(), this.timing.botDelayMs);
  }

  private botStep(): void {
    this.turnTimer = null;
    const hand = this.match!.hand;
    const seat = hand.turn.seat;
    const turn = hand.turn.number;
    // Bot bir turda bitiremezse (olmaması gerekir) otomatik hamleyle sırayı kapat.
    const action =
      this.botActionsThisTurn++ < MAX_BOT_ACTIONS_PER_TURN
        ? okey101.chooseAction(hand, seat, { level: BOT_LEVEL })
        : okey101.autoAction(hand, seat);
    let result = this.perform(seat, action, 'bot');
    if (!result.ok) {
      console.error(`[${this.room}] bot hamlesi reddedildi: ${result.error} ${JSON.stringify(action)}`);
      result = this.perform(seat, okey101.autoAction(hand, seat), 'bot');
      if (!result.ok) return void console.error(`[${this.room}] bot otomatik hamlesi de reddedildi: ${result.error}`);
    }
    this.settle(turn, result.events);
    const sameTurn = this.phase === 'playing' && this.match!.hand.turn.number === turn;
    if (sameTurn && this.clock?.mode === 'bot' && !this.turnTimer) this.scheduleBot();
  }

  /** Hamleyi motora uygular ve kayda geçer. */
  private perform(seat: Seat, action: okey101.Action, by: ActionSource): okey101.ActionResult {
    const result = okey101.applyAction(this.match!.hand, seat, action);
    if (!result.ok) return result;
    this.match = { ...this.match!, hand: result.state };
    this.log!.actions.push({ seat, action, by, at: Date.now() - this.handStartedAt });
    return result;
  }

  /** Hamlelerden sonra: el bittiyse sonucu işler, sıra geçtiyse yeni sırayı başlatır ve herkese gönderir. */
  private settle(turnBefore: number, events: okey101.GameEvent[]): void {
    const hand = this.match!.hand;
    if (hand.result) return this.finishHand(events);
    if (hand.turn.number !== turnBefore) {
      this.chargeBank();
      this.startTurn();
    }
    this.broadcast(events);
  }

  // -------------------------------------------------------------------------
  // Koltuklar

  private seatOf(player: Player): Seat | undefined {
    return SEATS.find((s) => this.seats[s]?.player?.id === player.id);
  }

  private markBack(state: SeatState): void {
    state.away = false;
    state.autoMoves = 0;
    this.refreshControl();
  }

  /** Koltuk kalıcı olarak bota geçer. */
  private retire(seat: Seat): void {
    const state = this.seats[seat]!;
    this.clearGrace(state);
    if (state.token) this.retiredTokens.add(state.token);
    state.bot = true;
    state.player = null;
    state.token = null;
    state.away = false;
    if (this.host === seat) this.host = SEATS.find((s) => this.seats[s] && !this.seats[s].bot) ?? null;
    this.refreshControl();
  }

  /** Gerçek oyuncu kalmadıysa masayı kapatır. */
  private checkEmpty(): boolean {
    if (this.closed) return true;
    if (this.humanCount > 0) return false;
    this.close();
    this.options.onEmpty();
    return true;
  }

  private clearGrace(state: SeatState): void {
    if (state.graceTimer) clearTimeout(state.graceTimer);
    state.graceTimer = null;
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  private fail(player: Player, code: ErrorCode, extra: { seq?: number; reason?: okey101.ActionError } = {}): false {
    player.send({ t: 'error', code, message: ERROR_MESSAGES[code], ...extra });
    return false;
  }

  // -------------------------------------------------------------------------
  // Görüntü

  private broadcast(events: okey101.GameEvent[] = []): void {
    if (this.closed) return;
    for (const seat of SEATS) {
      const player = this.seats[seat]?.player;
      if (player) player.send(this.view(seat, events));
    }
  }

  /** Koltuktaki oyuncunun görmesi gereken her şey. Yeniden bağlanan oyuncu da bununla kaldığı yerden devam eder. */
  view(you: Seat | null, events: okey101.GameEvent[] = []): TableView {
    const match = this.match;
    const finishedHand = this.phase === 'handOver' || this.phase === 'finished';
    // El bitti ama sonraki el dağıtılmadı: biten elin puanı henüz maç toplamına işlenmedi.
    const pending = match && this.phase !== 'finished' ? match.hand.result : null;

    return {
      t: 'state',
      room: this.room,
      phase: this.phase,
      settings: this.settings,
      host: this.host,
      you,
      seats: this.seats.map((s): SeatView | null =>
        s
          ? { name: s.name, bot: s.bot, status: s.bot ? 'bot' : !s.player ? 'offline' : s.away ? 'away' : 'online' }
          : null,
      ),
      match: match && {
        hand: match.hand.handNumber,
        hands: match.config.hands,
        totals: pending ? match.totals.map((t, i) => t + pending.rows[i]!.total) : match.totals,
        history: [...match.history, ...(pending ? [pending] : [])].map((r) => r.rows.map((row) => row.total)),
      },
      seeding: this.seeding && { hand: this.seeding.hand, commit: this.seeding.commit },
      hand: match && this.phase !== 'seeding' ? this.handView(match.hand, you) : null,
      result:
        finishedHand && match!.hand.result
          ? { ...match!.hand.result, hands: match!.hand.hands, fairness: this.log!.fairness }
          : null,
      events,
    };
  }

  private handView(hand: okey101.HandState, you: Seat | null): HandView {
    return {
      number: hand.handNumber,
      starter: hand.starter,
      indicator: hand.indicator,
      okey: hand.okey,
      stock: hand.stock.length,
      tiles: you === null ? [] : hand.hands[you]!,
      counts: hand.hands.map((h) => h.length),
      discards: hand.discards,
      melds: hand.melds,
      opened: hand.opened,
      penalties: hand.penalties,
      requirement: okey101.openingRequirement(hand),
      turn: hand.turn,
      clock: this.clockView(),
    };
  }

  private clockView(): ClockView | null {
    if (this.phase !== 'playing' || !this.clock) return null;
    const banks = this.seats.map((s) => s!.bank);
    if (this.clock.mode === 'bot') return { seat: this.clock.seat, endsIn: null, moveLeft: null, banks };
    const { moveMs } = this.timing.speeds[this.settings.speed];
    const elapsed = Date.now() - this.clock.startedAt;
    const bank = this.seats[this.clock.seat]!.bank;
    return {
      seat: this.clock.seat,
      endsIn: Math.max(0, moveMs + bank - elapsed),
      moveLeft: Math.max(0, moveMs - elapsed),
      banks,
    };
  }
}
