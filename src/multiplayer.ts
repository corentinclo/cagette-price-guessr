import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type {
  Difficulty,
  PlayerState,
  PeerMessage,
  Product,
  RoundResult,
} from "./types";
import { MAX_LIVES } from "./types";
import { evaluateGuess, applyResult, generateRoomCode } from "./game";
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
  renderLobbyPlayers,
  updateMultiStatus,
  showGameOver,
  showToast,
  startRoundTimer,
  stopRoundTimer,
  getGuessValue,
} from "./ui";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Prefix avoids collisions with other PeerJS apps on the default cloud broker */
const PEER_PREFIX = "cagette-guessr-";

// ── State ─────────────────────────────────────────────────────────────────────

interface MultiState {
  peer: Peer | null;
  /** host: map from client peer-id → connection; client: map with single 'host' key */
  connections: Map<string, DataConnection>;
  roomCode: string;
  players: PlayerState[];
  myId: string;
  myName: string;
  isHost: boolean;
  difficulty: Difficulty;
  currentProduct: Product | null;
  /** guesses submitted this round, keyed by player id */
  pendingGuesses: Map<string, number>;
  guessedIds: Set<string>;
  roundIndex: number;
}

const state: MultiState = {
  peer: null,
  connections: new Map(),
  roomCode: "",
  players: [],
  myId: "",
  myName: "",
  isHost: false,
  difficulty: "easy",
  currentProduct: null,
  pendingGuesses: new Map(),
  guessedIds: new Set(),
  roundIndex: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function peerId(roomCode: string): string {
  return `${PEER_PREFIX}${roomCode.toUpperCase()}`;
}

function broadcast(msg: PeerMessage): void {
  state.connections.forEach((conn) => {
    if (conn.open) conn.send(msg);
  });
}

function myPlayer(): PlayerState | undefined {
  return state.players.find((p) => p.id === state.myId);
}

// ── HOST ──────────────────────────────────────────────────────────────────────

/**
 * Creates a PeerJS host with a 5-letter room code.
 * Resolves with the room code once the peer is open.
 */
export function hostGame(difficulty: Difficulty): Promise<string> {
  return new Promise((resolve, reject) => {
    const roomCode = generateRoomCode();
    state.roomCode = roomCode;
    state.difficulty = difficulty;
    state.isHost = true;
    state.myId = "host";
    state.myName = "Hôte";
    state.connections = new Map();
    state.players = [
      {
        id: "host",
        name: "Hôte",
        score: 0,
        lives: MAX_LIVES,
        eliminated: false,
      },
    ];
    state.roundIndex = 0;

    const peer = new Peer(peerId(roomCode));
    state.peer = peer;

    peer.on("open", () => resolve(roomCode));
    peer.on("error", reject);

    peer.on("connection", (conn) => {
      conn.on("open", () => {
        state.connections.set(conn.peer, conn);

        conn.on("data", (data) => handleHostMessage(conn, data as PeerMessage));

        conn.on("close", () => {
          state.connections.delete(conn.peer);
          state.players = state.players.filter((p) => p.id !== conn.peer);
          broadcast({ type: "player-list", players: state.players });
          renderLobbyPlayers(state.players, true);
          // Re-check if round can now be resolved (player left mid-round)
          if (state.currentProduct) checkAllGuessed();
        });
      });
    });
  });
}

function handleHostMessage(conn: DataConnection, msg: PeerMessage): void {
  if (msg.type === "player-join") {
    if (!state.players.find((p) => p.id === conn.peer)) {
      state.players.push({
        id: conn.peer,
        name: msg.playerName,
        score: 0,
        lives: MAX_LIVES,
        eliminated: false,
      });
    }
    broadcast({ type: "player-list", players: state.players });
    renderLobbyPlayers(state.players, true);
    return;
  }

  if (msg.type === "submit-guess") {
    if (state.currentProduct && !state.guessedIds.has(conn.peer)) {
      state.guessedIds.add(conn.peer);
      state.pendingGuesses.set(conn.peer, msg.guess);
      updateMultiStatus(state.players, state.guessedIds);
      checkAllGuessed();
    }
  }
}

/** All active (non-eliminated) players have submitted or disconnected → resolve */
function checkAllGuessed(): void {
  const active = state.players.filter((p) => !p.eliminated);
  const allDone = active.every(
    (p) =>
      state.guessedIds.has(p.id) ||
      (p.id !== "host" && !state.connections.has(p.id))
  );
  if (allDone) resolveRound();
}

function resolveRound(): void {
  if (!state.currentProduct) return;

  const results: RoundResult[] = [];

  state.pendingGuesses.forEach((guess, playerId) => {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    const partial = evaluateGuess(
      guess,
      state.currentProduct!.price,
      state.difficulty
    );
    const result: RoundResult = {
      ...partial,
      playerId,
      playerName: player.name,
    };

    const updated = applyResult(player.score, player.lives, result);
    player.score = updated.score;
    player.lives = updated.lives;
    if (player.lives <= 0) player.eliminated = true;

    results.push(result);
  });

  // Update host's own UI
  const hostResult = results.find((r) => r.playerId === "host");
  const hostPlayer = state.players.find((p) => p.id === "host")!;
  if (hostResult) {
    renderLives(hostPlayer.lives);
    renderScore(hostPlayer.score);
    showResult(hostResult, "host", results);
  }

  broadcast({ type: "round-results", results, players: state.players });
  updateMultiStatus(state.players, state.guessedIds);

  // End game if everyone is eliminated
  const alive = state.players.filter((p) => !p.eliminated);
  if (alive.length === 0) {
    setTimeout(() => {
      broadcast({ type: "game-over", players: state.players });
      showGameOver(hostPlayer.score, state.players);
    }, 2500);
  }
}

export async function hostStartGame(): Promise<void> {
  await initProductPool();
  showScreen("game");
  const hostPlayer = myPlayer()!;
  renderLives(hostPlayer.lives);
  renderScore(hostPlayer.score);
  await hostNextRound();
}

async function hostNextRound(): Promise<void> {
  state.guessedIds = new Set();
  state.pendingGuesses = new Map();
  state.roundIndex += 1;
  state.currentProduct = null;

  setGuessEnabled(false);
  hideResult();
  clearGuessInput();

  const product = await getNextProduct();
  if (!product) {
    broadcast({ type: "game-over", players: state.players });
    showGameOver(myPlayer()?.score ?? 0, state.players);
    return;
  }

  state.currentProduct = product;
  setRoundInfo(`Manche ${state.roundIndex}`);
  renderProduct(product);
  updateMultiStatus(state.players, state.guessedIds);
  broadcast({ type: "new-round", product, roundIndex: state.roundIndex });
  setGuessEnabled(true);
  focusGuessInput();
  startRoundTimer(() => hostSubmitGuess(getGuessValue() ?? 0));
}

export function hostSubmitGuess(guess: number): void {
  if (!state.currentProduct || state.guessedIds.has("host")) return;
  state.guessedIds.add("host");
  state.pendingGuesses.set("host", guess);
  stopRoundTimer();
  setGuessEnabled(false);
  updateMultiStatus(state.players, state.guessedIds);
  checkAllGuessed();
}

export async function hostAdvanceRound(): Promise<void> {
  hideResult();
  const alive = state.players.filter((p) => !p.eliminated);
  if (alive.length === 0) {
    broadcast({ type: "game-over", players: state.players });
    showGameOver(myPlayer()?.score ?? 0, state.players);
    return;
  }
  await hostNextRound();
}

// ── CLIENT ────────────────────────────────────────────────────────────────────

export function joinGame(roomCode: string, playerName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    state.isHost = false;
    state.myName = playerName;
    state.roomCode = roomCode.toUpperCase();
    state.guessedIds = new Set();
    state.players = [];

    // Unique client peer ID
    const clientId = `${PEER_PREFIX}player-${Math.random().toString(36).slice(2, 9)}`;
    state.myId = clientId;

    const peer = new Peer(clientId);
    state.peer = peer;

    peer.on("error", reject);

    peer.on("open", () => {
      const conn = peer.connect(peerId(state.roomCode), { reliable: true });

      conn.on("open", () => {
        state.connections.set("host", conn);

        conn.send({
          type: "player-join",
          playerId: clientId,
          playerName,
        } satisfies PeerMessage);

        conn.on("data", (data) => handleClientMessage(data as PeerMessage));
        conn.on("close", () => showToast("Connexion perdue avec l'hôte"));

        resolve();
      });

      conn.on("error", reject);
    });
  });
}

function handleClientMessage(msg: PeerMessage): void {
  if (msg.type === "player-list") {
    state.players = msg.players;
    renderLobbyPlayers(state.players, false);
    return;
  }

  if (msg.type === "new-round") {
    state.currentProduct = msg.product;
    state.guessedIds = new Set();

    showScreen("game");
    hideResult();
    clearGuessInput();
    renderProduct(msg.product);
    setRoundInfo(`Manche ${msg.roundIndex}`);
    setGuessEnabled(true);
    focusGuessInput();
    startRoundTimer(() => clientSubmitGuess(getGuessValue() ?? 0));

    const me = myPlayer();
    if (me) {
      renderLives(me.lives);
      renderScore(me.score);
    }
    updateMultiStatus(state.players, state.guessedIds);
    return;
  }

  if (msg.type === "round-results") {
    state.players = msg.players;
    const myResult = msg.results.find((r) => r.playerId === state.myId);
    if (myResult) showResult(myResult, "client", msg.results);
    const me = myPlayer();
    if (me) {
      renderLives(me.lives);
      renderScore(me.score);
    }
    updateMultiStatus(
      state.players,
      new Set(msg.results.map((r) => r.playerId))
    );
    return;
  }

  if (msg.type === "game-over") {
    state.players = msg.players;
    showGameOver(myPlayer()?.score ?? 0, state.players);
  }
}

export function clientSubmitGuess(guess: number): void {
  if (!state.currentProduct || state.guessedIds.has(state.myId)) return;

  const hostConn = state.connections.get("host");
  if (!hostConn?.open) {
    showToast("Connexion perdue !");
    return;
  }

  state.guessedIds.add(state.myId);
  stopRoundTimer();
  setGuessEnabled(false);
  hostConn.send({
    type: "submit-guess",
    playerId: state.myId,
    guess,
  } satisfies PeerMessage);
  updateMultiStatus(state.players, state.guessedIds);
}

// ── Shared ────────────────────────────────────────────────────────────────────

export function cleanup(): void {
  if (state.peer) {
    state.peer.destroy();
    state.peer = null;
  }
  state.connections.clear();
  state.currentProduct = null;
}

export function getRoomCode(): string {
  return state.roomCode;
}

export function setHostName(name: string): void {
  const displayName = name || "Hôte";
  state.myName = displayName;
  const hostPlayer = state.players.find((p) => p.id === "host");
  if (hostPlayer) {
    hostPlayer.name = displayName;
    broadcast({ type: "player-list", players: state.players });
    renderLobbyPlayers(state.players, true);
  }
}
