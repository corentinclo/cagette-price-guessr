import type {
  Product,
  PlayerState,
  RoundResult,
  Difficulty,
  GameMode,
} from "./types";
import { MAX_LIVES } from "./types";
import { formatPrice, formatPercent } from "./game";
import { zipToDepartement, formatUnit } from "./departements";

// ── Screen management ─────────────────────────────────────────────────────────

type ScreenId = "home" | "join" | "lobby" | "game" | "gameover";

export function showScreen(id: ScreenId): void {
  document.querySelectorAll<HTMLElement>(".screen").forEach((s) => {
    s.classList.remove("active");
  });
  const el = document.getElementById(`screen-${id}`);
  if (el) {
    el.classList.add("active");
    window.scrollTo({ top: 0 });
  }
}

// ── Difficulty selector ───────────────────────────────────────────────────────

export function setDifficultyUI(difficulty: Difficulty): void {
  document.querySelectorAll<HTMLElement>(".btn-difficulty").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset["difficulty"] === difficulty);
  });
}

// ── Game HUD ──────────────────────────────────────────────────────────────────

export function renderLives(lives: number): void {
  const container = document.getElementById("game-lives")!;
  container.innerHTML = "";
  const total = Math.max(lives, MAX_LIVES);
  for (let i = 0; i < total; i++) {
    const span = document.createElement("span");
    span.className = "life" + (i < lives ? " active" : "");
    span.textContent = "🟢";
    container.appendChild(span);
  }
}

export function renderScore(score: number): void {
  const el = document.getElementById("game-score");
  if (el) el.textContent = String(score);
}

export function setRoundInfo(text: string): void {
  const el = document.getElementById("game-round-info");
  if (el) el.textContent = text;
}

// ── Product card ──────────────────────────────────────────────────────────────

export function renderProduct(product: Product): void {
  const img = document.getElementById("product-image") as HTMLImageElement;

  img.src = product.imageUrl;
  img.style.display = "block";
  img.onerror = () => {
    img.style.display = "none";
  };

  const name = document.getElementById("product-name")!;
  name.textContent =
    product.name.charAt(0).toUpperCase() + product.name.slice(1);

  const qty = document.getElementById("product-quantity")!;
  qty.textContent = formatUnit(product.qt, product.unitType);

  const organic = document.getElementById(
    "product-organic"
  ) as HTMLImageElement;
  if (product.organic) {
    organic.style.display = "flex";
  } else {
    organic.style.display = "none";
  }

  const vendor = document.getElementById("product-vendor")!;
  vendor.textContent = product.vendorName;

  const zip = document.getElementById("product-zip")!;
  zip.textContent = zipToDepartement(product.vendorZipCode);
}

// ── Guess input ───────────────────────────────────────────────────────────────

export function getGuessValue(): number | null {
  const input = document.getElementById("price-input") as HTMLInputElement;
  const val = parseFloat(input.value);
  return isNaN(val) || val < 0 ? null : val;
}

export function clearGuessInput(): void {
  const input = document.getElementById("price-input") as HTMLInputElement;
  input.value = "";
}

export function focusGuessInput(): void {
  const input = document.getElementById("price-input") as HTMLInputElement;
  // Small delay so the keyboard doesn't jump on mobile
  setTimeout(() => input.focus(), 80);
}

// ── Round timer ──────────────────────────────────────────────────────────────

const ROUND_TIMER_SECONDS = 30;
let _timerInterval: ReturnType<typeof setInterval> | null = null;

export function startRoundTimer(onExpire: () => void): void {
  stopRoundTimer();
  const timerEl = document.getElementById("game-timer")!;
  const valueEl = document.getElementById("timer-value")!;
  let remaining = ROUND_TIMER_SECONDS;
  valueEl.textContent = String(remaining);
  timerEl.style.display = "flex";
  timerEl.classList.remove("timer-warning");

  _timerInterval = setInterval(() => {
    remaining -= 1;
    valueEl.textContent = String(remaining);
    if (remaining <= 10) timerEl.classList.add("timer-warning");
    if (remaining <= 0) {
      stopRoundTimer();
      onExpire();
    }
  }, 1000);
}

export function stopRoundTimer(): void {
  if (_timerInterval !== null) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
  const timerEl = document.getElementById("game-timer");
  if (timerEl) {
    timerEl.style.display = "none";
    timerEl.classList.remove("timer-warning");
  }
}

export function setGuessEnabled(enabled: boolean): void {
  const input = document.getElementById("price-input") as HTMLInputElement;
  const btn = document.getElementById("btn-submit-guess") as HTMLButtonElement;
  input.disabled = !enabled;
  btn.disabled = !enabled;
}

// ── Result overlay ────────────────────────────────────────────────────────────

export function showResult(
  result: RoundResult,
  mode: GameMode,
  allResults?: RoundResult[]
): void {
  const overlay = document.getElementById("result-overlay")!;
  overlay.style.display = "flex";

  const emoji = document.getElementById("result-emoji")!;
  const message = document.getElementById("result-message")!;
  const diff = document.getElementById("result-diff")!;

  if (result.bonus) {
    emoji.textContent = "🎉";
    message.textContent = "Incroyable ! +1 vie bonus !";
    message.style.color = "var(--accent-dark)";
  } else if (result.correct) {
    emoji.textContent = "✅";
    message.textContent = "Bonne réponse !";
    message.style.color = "var(--success)";
  } else {
    emoji.textContent = "❌";
    message.textContent = "Raté !";
    message.style.color = "var(--danger)";
  }

  (document.getElementById("result-guess") as HTMLElement).textContent =
    formatPrice(result.guess);
  (document.getElementById("result-actual") as HTMLElement).textContent =
    formatPrice(result.actualPrice);

  const pct = formatPercent(result.percentOff);
  diff.textContent = `Écart : ${pct}`;
  diff.style.color = result.correct ? "var(--success)" : "var(--danger)";

  // Multi-player: show all guesses
  const multiScores = document.getElementById("result-multi-scores")!;
  if (allResults && allResults.length > 1) {
    multiScores.style.display = "block";
    multiScores.innerHTML = allResults
      .sort((a, b) => a.percentOff - b.percentOff)
      .map(
        (r) =>
          `<div class="result-multi-row">
            <span class="name">${escapeHtml(r.playerName)}</span>
            <span class="guess-val">${formatPrice(r.guess)} <small>(${formatPercent(r.percentOff)})</small></span>
          </div>`
      )
      .join("");
  } else {
    multiScores.style.display = "none";
  }

  // Clients don't control the "next round" button – host drives the pace
  const nextBtn = document.getElementById(
    "btn-next-round"
  ) as HTMLButtonElement;
  nextBtn.style.display = mode === "client" ? "none" : "block";
}

export function hideResult(): void {
  (document.getElementById("result-overlay") as HTMLElement).style.display =
    "none";
}

// ── Lobby ─────────────────────────────────────────────────────────────────────

export function renderLobbyPlayers(
  players: PlayerState[],
  isHost: boolean
): void {
  const container = document.getElementById("lobby-players")!;
  container.innerHTML = "";
  players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "player-item";
    div.innerHTML = `
      <span class="player-dot"></span>
      <span>${escapeHtml(p.name)}</span>
      ${isHost && p.id === "host" ? '<span class="player-tag">(hôte)</span>' : ""}
    `;
    container.appendChild(div);
  });

  const statusEl = document.getElementById("lobby-status");
  if (statusEl) {
    statusEl.textContent =
      players.length === 1
        ? "1 joueur connecté"
        : `${players.length} joueurs connectés`;
  }
}

// ── Multi-player status chips ─────────────────────────────────────────────────

export function updateMultiStatus(
  players: PlayerState[],
  guessedIds: Set<string>
): void {
  const container = document.getElementById("multi-players-status")!;
  container.style.display = "flex";
  container.innerHTML = "";
  players
    .filter((p) => !p.eliminated)
    .forEach((p) => {
      const div = document.createElement("div");
      div.className =
        "multi-player-chip" + (guessedIds.has(p.id) ? " guessed" : "");
      div.textContent = `${p.name}: ${p.score}pts`;
      container.appendChild(div);
    });
}

export function hideMultiStatus(): void {
  const container = document.getElementById("multi-players-status");
  if (container) container.style.display = "none";
}

// ── Game over ─────────────────────────────────────────────────────────────────

export function showGameOver(
  myScore: number,
  allPlayers?: PlayerState[]
): void {
  showScreen("gameover");
  (document.getElementById("final-score-value") as HTMLElement).textContent =
    String(myScore);

  const board = document.getElementById("gameover-leaderboard")!;
  if (allPlayers && allPlayers.length > 1) {
    board.style.display = "block";
    const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
    const medals = ["🥇", "🥈", "🥉"];
    board.innerHTML = sorted
      .map(
        (p, i) =>
          `<div class="leaderboard-item">
            <span class="leaderboard-rank">${medals[i] ?? `${i + 1}.`}</span>
            <span class="leaderboard-name">${escapeHtml(p.name)}</span>
            <span class="leaderboard-score">${p.score} pts</span>
          </div>`
      )
      .join("");
  } else {
    board.style.display = "none";
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string): void {
  const toast = document.getElementById("toast")!;
  toast.textContent = message;
  toast.style.display = "block";
  toast.style.animation = "none";
  void toast.offsetWidth; // force reflow to restart animation
  toast.style.animation = "toastFade 2.8s ease forwards";

  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = "none";
    toastTimer = null;
  }, 2800);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
