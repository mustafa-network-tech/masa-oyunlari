// Oyuncuya gönderilen masa görüntüsü. Herkes yalnızca kendi taşlarını görür;
// rakiplerin eli ve deste sırası el bitene kadar sunucudan çıkmaz.

import type { okey101 } from '@masa/engine';
import type { Fairness } from './handLog.ts';
import type { TableSettings } from './protocol.ts';

export type TablePhase = 'waiting' | 'seeding' | 'playing' | 'handOver' | 'finished';

export interface SeatView {
  name: string;
  bot: boolean;
  /** offline: bağlantı koptu, yerine bot oynuyor. away: üst üste süre doldu, yerine bot oynuyor. */
  status: 'online' | 'offline' | 'away' | 'bot';
}

export interface HandView {
  number: number;
  starter: okey101.Seat;
  indicator: okey101.Tile;
  okey: okey101.Identity;
  stock: number;
  /** İzleyicinin kendi taşları. */
  tiles: okey101.Tile[];
  /** Koltuk başına eldeki taş sayısı. */
  counts: number[];
  discards: okey101.Tile[][];
  melds: okey101.TableMeld[];
  opened: (okey101.OpenKind | null)[];
  penalties: number[];
  /** Yükselen masada açmak için gereken en düşük değer ve çift sayısı. */
  requirement: { points: number; pairs: number };
  turn: okey101.HandState['turn'];
  clock: ClockView | null;
}

export interface ClockView {
  seat: okey101.Seat;
  /** Hamle süresi + zaman bankası dahil, sıranın bitmesine kalan süre (ms). Bot oynuyorsa null. */
  endsIn: number | null;
  /** Hamle süresinin bitmesine kalan süre (ms); bittiyse 0 ve bankadan yeniyor. */
  moveLeft: number | null;
  banks: number[];
}

export interface HandResultView extends okey101.HandResult {
  /** El sonunda bütün eller açılır. */
  hands: okey101.Tile[][];
  fairness: Fairness;
}

export interface TableView {
  t: 'state';
  room: string;
  phase: TablePhase;
  settings: TableSettings;
  host: okey101.Seat | null;
  you: okey101.Seat | null;
  seats: (SeatView | null)[];
  match: { hand: number; hands: number; totals: number[]; history: number[][] } | null;
  /** Adil Oyun: el dağıtılmadan önce sunucu tohumunun özeti. Oyuncu bunu görünce tohumunu gönderir. */
  seeding: { hand: number; commit: string } | null;
  hand: HandView | null;
  result: HandResultView | null;
  /** Son görüntüden bu yana olanlar (animasyonlar için). */
  events: okey101.GameEvent[];
}
