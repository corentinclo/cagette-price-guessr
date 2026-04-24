import "./style.css";
import type { Difficulty } from "./types";
import {
  showScreen,
  setDifficultyUI,
  getGuessValue,
  showToast,
  renderLobbyPlayers,
} from "./ui";
import {
  startSolo,
  nextRound as soloNextRound,
  submitGuess as soloSubmit,
} from "./solo";
import {
  hostGame,
  hostStartGame,
  hostSubmitGuess,
  hostAdvanceRound,
  joinGame,
  clientSubmitGuess,
  cleanup,
  getRoomCode,
  setHostName,
} from "./multiplayer";

// ── App state ─────────────────────────────────────────────────────────────────

let currentDifficulty: Difficulty = "easy";
let currentMode: "solo" | "host" | "client" | null = null;

// ── HOME ──────────────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLElement>(".btn-difficulty").forEach((btn) => {
  btn.addEventListener("click", () => {
    const d = btn.dataset["difficulty"] as Difficulty | undefined;
    if (d) {
      currentDifficulty = d;
      setDifficultyUI(d);
    }
  });
});

document
  .getElementById("btn-play-solo")!
  .addEventListener("click", async () => {
    if (window.location.search) {
      history.replaceState(null, "", window.location.pathname);
    }
    currentMode = "solo";
    await startSolo(currentDifficulty);
  });

document
  .getElementById("btn-host-multi")!
  .addEventListener("click", async () => {
    const btn = document.getElementById("btn-host-multi") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "⏳ Connexion…";

    try {
      currentMode = "host";
      const roomCode = await hostGame(currentDifficulty);

      showScreen("lobby");
      (document.getElementById("lobby-room-code") as HTMLElement).textContent =
        roomCode;
      (document.getElementById("btn-start-game") as HTMLElement).style.display =
        "block";

      // Show host name input and wire up live update
      const hostNameSection = document.getElementById("host-name-section")!;
      hostNameSection.style.display = "block";
      const hostNameInput = document.getElementById(
        "input-host-name"
      ) as HTMLInputElement;
      hostNameInput.value = "";
      hostNameInput.oninput = () => setHostName(hostNameInput.value.trim());

      renderLobbyPlayers(
        [
          {
            id: "host",
            name: "Hôte",
            score: 0,
            lives: 3,
            eliminated: false,
          },
        ],
        true
      );
    } catch {
      showToast("Erreur de connexion. Réessayez.");
      currentMode = null;
    } finally {
      btn.disabled = false;
      btn.textContent = "👥 Créer une partie";
    }
  });

document.getElementById("btn-join-multi")!.addEventListener("click", () => {
  currentMode = "client";
  showScreen("join");
});

// ── JOIN ──────────────────────────────────────────────────────────────────────

document.getElementById("btn-back-join")!.addEventListener("click", () => {
  currentMode = null;
  showScreen("home");
});

// Pre-fill room code from URL ?room= param (shared invite link)
const urlRoom = new URLSearchParams(window.location.search).get("room");
if (urlRoom) {
  const codeInput = document.getElementById(
    "input-room-code"
  ) as HTMLInputElement;
  codeInput.value = urlRoom.toUpperCase();
  currentMode = "client";
  showScreen("join");
}

document
  .getElementById("btn-join-confirm")!
  .addEventListener("click", async () => {
    const nameInput = document.getElementById(
      "input-player-name"
    ) as HTMLInputElement;
    const codeInput = document.getElementById(
      "input-room-code"
    ) as HTMLInputElement;
    const errorEl = document.getElementById("join-error")!;

    const name = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();

    if (!name) {
      errorEl.textContent = "Entrez votre pseudo.";
      return;
    }
    if (code.length !== 5) {
      errorEl.textContent = "Le code fait 5 lettres.";
      return;
    }
    errorEl.textContent = "";

    const btn = document.getElementById(
      "btn-join-confirm"
    ) as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "⏳ Connexion…";

    try {
      await joinGame(code, name);
      showScreen("lobby");
      (document.getElementById("lobby-room-code") as HTMLElement).textContent =
        code;
      (document.getElementById("btn-start-game") as HTMLElement).style.display =
        "none";
    } catch {
      errorEl.textContent =
        "Impossible de rejoindre. Vérifiez le code et réessayez.";
      currentMode = null;
    } finally {
      btn.disabled = false;
      btn.textContent = "Rejoindre";
    }
  });

// ── LOBBY ─────────────────────────────────────────────────────────────────────

document.getElementById("btn-back-lobby")!.addEventListener("click", () => {
  cleanup();
  currentMode = null;
  document.getElementById("host-name-section")!.style.display = "none";
  showScreen("home");
});

document.getElementById("btn-copy-link")!.addEventListener("click", () => {
  const code = getRoomCode();
  const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
  navigator.clipboard
    .writeText(url)
    .then(() => showToast("Lien copié dans le presse-papier !"))
    .catch(() => showToast(`Lien : ${url}`));
});

document
  .getElementById("btn-start-game")!
  .addEventListener("click", async () => {
    const hostNameInput = document.getElementById(
      "input-host-name"
    ) as HTMLInputElement;
    setHostName(hostNameInput.value.trim());
    document.getElementById("host-name-section")!.style.display = "none";
    await hostStartGame();
  });

// ── GAME ──────────────────────────────────────────────────────────────────────

document
  .getElementById("btn-submit-guess")!
  .addEventListener("click", handleSubmit);

(document.getElementById("price-input") as HTMLInputElement).addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Enter") handleSubmit();
  }
);

function handleSubmit(): void {
  const guess = getGuessValue();
  if (guess === null) {
    showToast("Entrez un prix valide (ex : 3.50)");
    return;
  }

  if (currentMode === "solo") soloSubmit(guess);
  else if (currentMode === "host") hostSubmitGuess(guess);
  else if (currentMode === "client") clientSubmitGuess(guess);
}

document
  .getElementById("btn-next-round")!
  .addEventListener("click", async () => {
    if (currentMode === "solo") await soloNextRound();
    else if (currentMode === "host") await hostAdvanceRound();
    // clients: the host drives the pace, button is hidden anyway
  });

document.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  // Ignore if Enter came from the price input (handled separately)
  if ((e.target as HTMLElement)?.id === "price-input") return;
  const overlay = document.getElementById("result-overlay");
  if (overlay?.style.display !== "none" && overlay?.style.display !== "") {
    const btn = document.getElementById("btn-next-round") as HTMLButtonElement;
    if (btn && !btn.disabled && btn.style.display !== "none") btn.click();
  }
});

// ── GAME OVER ─────────────────────────────────────────────────────────────────

document
  .getElementById("btn-play-again")!
  .addEventListener("click", async () => {
    if (currentMode === "solo") {
      await startSolo(currentDifficulty);
    } else {
      cleanup();
      currentMode = null;
      showScreen("home");
    }
  });

document.getElementById("btn-go-home")!.addEventListener("click", () => {
  cleanup();
  currentMode = null;
  showScreen("home");
});

// ── RULES MODAL ───────────────────────────────────────────────────────────────

function openRules(): void {
  (document.getElementById("modal-rules") as HTMLElement).style.display =
    "flex";
}

function closeRules(): void {
  (document.getElementById("modal-rules") as HTMLElement).style.display =
    "none";
}

document.getElementById("btn-rules")!.addEventListener("click", openRules);
document
  .getElementById("btn-close-rules")!
  .addEventListener("click", closeRules);
document
  .getElementById("btn-close-rules-bottom")!
  .addEventListener("click", closeRules);
document.getElementById("modal-rules")!.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeRules();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeRules();
});
