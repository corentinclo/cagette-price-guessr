import type { Difficulty, Product } from "./types";
import { MAX_LIVES } from "./types";
import { evaluateGuess, applyResult } from "./game";
import { initProductPool, getNextProduct } from "./data";
import {
  showScreen,
  renderLives,
  renderScore,
  setRoundInfo,
  renderProduct,
  showResult,
  hideResult,
  clearGuessInput,
  focusGuessInput,
  setGuessEnabled,
  hideMultiStatus,
  showGameOver,
  showToast,
} from "./ui";

// ── State ─────────────────────────────────────────────────────────────────────

interface SoloState {
  score: number;
  lives: number;
  difficulty: Difficulty;
  currentProduct: Product | null;
  round: number;
}

const state: SoloState = {
  score: 0,
  lives: MAX_LIVES,
  difficulty: "easy",
  currentProduct: null,
  round: 0,
};

// ── Public API ────────────────────────────────────────────────────────────────

export async function startSolo(difficulty: Difficulty): Promise<void> {
  state.score = 0;
  state.lives = MAX_LIVES;
  state.difficulty = difficulty;
  state.currentProduct = null;
  state.round = 0;

  showScreen("game");
  hideMultiStatus();
  renderLives(state.lives);
  renderScore(state.score);
  hideResult();
  setGuessEnabled(false);

  await initProductPool();
  await loadNextProduct();
}

export async function nextRound(): Promise<void> {
  hideResult();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  await loadNextProduct();
}

export function submitGuess(guess: number): void {
  const product = state.currentProduct;
  if (!product) return;

  setGuessEnabled(false);

  const partial = evaluateGuess(guess, product.price, state.difficulty);
  const result = {
    ...partial,
    playerId: "solo",
    playerName: "Vous",
  };

  const updated = applyResult(state.score, state.lives, result);
  state.score = updated.score;
  state.lives = updated.lives;

  renderLives(state.lives);
  renderScore(state.score);
  showResult(result, "solo");
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function loadNextProduct(): Promise<void> {
  setGuessEnabled(false);
  clearGuessInput();

  const product = await getNextProduct();
  if (!product) {
    showToast("Plus de produits disponibles !");
    endGame();
    return;
  }

  state.currentProduct = product;
  state.round += 1;
  setRoundInfo(`Manche ${state.round}`);
  renderProduct(product);
  setGuessEnabled(true);
  focusGuessInput();
}

function endGame(): void {
  showGameOver(state.score);
}
