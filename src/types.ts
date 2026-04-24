// ── Product ──────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  qt: number;
  unitType: number;
  organic: boolean;
  price: number;
  vendorName: string;
  vendorZipCode: string;
  imageUrl: string;
}

// ── Difficulty ───────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  /** Max % off to still be counted as correct, e.g. 0.20 = ±20% */
  correctRange: number;
  /** Max % off to earn a bonus life, e.g. 0.10 = ±10% */
  rewardRange: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { correctRange: 0.2, rewardRange: 0.1 },
  medium: { correctRange: 0.1, rewardRange: 0.05 },
  hard: { correctRange: 0.05, rewardRange: 0.01 },
};

export const MAX_LIVES = 3;

// ── Game mode ─────────────────────────────────────────────────────────────────

export type GameMode = "solo" | "host" | "client";

// ── Round result ─────────────────────────────────────────────────────────────

export interface RoundResult {
  playerId: string;
  playerName: string;
  guess: number;
  actualPrice: number;
  /** Absolute ratio: |guess - price| / price */
  percentOff: number;
  correct: boolean;
  bonus: boolean;
  livesLost: number;
}

// ── Multiplayer player state ──────────────────────────────────────────────────

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  lives: number;
  eliminated: boolean;
}

// ── PeerJS messages ───────────────────────────────────────────────────────────

export type PeerMessage =
  | { type: "player-join"; playerId: string; playerName: string }
  | { type: "player-list"; players: PlayerState[] }
  | { type: "new-round"; product: Product; roundIndex: number }
  | { type: "submit-guess"; playerId: string; guess: number }
  | { type: "round-results"; results: RoundResult[]; players: PlayerState[] }
  | { type: "game-over"; players: PlayerState[] };
