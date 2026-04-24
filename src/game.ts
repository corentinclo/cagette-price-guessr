import type { Difficulty, RoundResult } from "./types";
import { DIFFICULTY_CONFIG, MAX_LIVES } from "./types";

// ── Scoring ───────────────────────────────────────────────────────────────────

export function evaluateGuess(
  guess: number,
  actualPrice: number,
  difficulty: Difficulty
): Omit<RoundResult, "playerId" | "playerName"> {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const percentOff = Math.abs(guess - actualPrice) / actualPrice;
  const correct = percentOff <= cfg.correctRange;
  const bonus = percentOff <= cfg.rewardRange;

  return {
    guess,
    actualPrice,
    percentOff,
    correct,
    bonus,
    livesLost: correct ? 0 : 1,
  };
}

export function applyResult(
  score: number,
  lives: number,
  result: Pick<RoundResult, "correct" | "bonus" | "livesLost">
): { score: number; lives: number } {
  let newScore = score;
  let newLives = lives;

  if (result.correct) {
    newScore += 1;
    if (result.bonus) {
      // Bonus life, capped at MAX_LIVES + 2 to avoid infinite lives exploit
      newLives = Math.min(newLives + 1, MAX_LIVES + 2);
    }
  } else {
    newLives -= 1;
  }

  return { score: newScore, lives: newLives };
}

// ── Formatting ─────────────────────────────────────────────────────────────────

export function formatPrice(price: number): string {
  return price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)} %`;
}

// ── Room code ─────────────────────────────────────────────────────────────────

/** Generates a random 5-letter uppercase room code (no I/O to avoid confusion). */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from(
    { length: 5 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
