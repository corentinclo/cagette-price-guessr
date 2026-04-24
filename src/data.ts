import type { Product } from "./types";

/**
 * How many encrypted chunk files exist under public/data/.
 * Each file is named products_00.enc … products_XX.enc.
 * Update after running `npm run split-data && npm run encrypt-data`.
 */
const CHUNK_COUNT = 43;

let productPool: Product[] = [];

// ── Crypto helpers ────────────────────────────────────────────────────────────

const KEY_HEX = import.meta.env.VITE_DATA_KEY as string;

function hexToBytes(hex: string): ArrayBuffer {
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++)
    buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return buf.buffer as ArrayBuffer;
}

let _cryptoKey: CryptoKey | null = null;
async function getCryptoKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey;
  if (!KEY_HEX)
    throw new Error("VITE_DATA_KEY is not defined. Add it to .env.local.");
  _cryptoKey = await crypto.subtle.importKey(
    "raw",
    hexToBytes(KEY_HEX),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  return _cryptoKey;
}

async function decryptChunk(base64: string): Promise<Product[]> {
  const key = await getCryptoKey();
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  const raw = JSON.parse(new TextDecoder().decode(plaintext)) as unknown[];
  return (raw as Product[]).filter(
    (p) =>
      typeof p.price === "number" &&
      p.price > 0 &&
      typeof p.imageUrl === "string" &&
      p.imageUrl.length > 0
  );
}

// ── Fetch & decrypt ───────────────────────────────────────────────────────────

function chunkUrl(index: number): string {
  const padded = String(index).padStart(2, "0");
  return `${import.meta.env.BASE_URL}data/products_${padded}.enc`;
}

async function loadChunk(index: number): Promise<Product[]> {
  const res = await fetch(chunkUrl(index));
  if (!res.ok) throw new Error(`Chunk ${index}: HTTP ${res.status}`);
  const base64 = await res.text();
  return decryptChunk(base64);
}

function randomChunkIndex(): number {
  return Math.floor(Math.random() * CHUNK_COUNT);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Loads a single random chunk for this game session.
 * Call once before starting a game.
 */
export async function initProductPool(): Promise<void> {
  productPool = [];
  const idx = randomChunkIndex();
  try {
    productPool = await loadChunk(idx);
  } catch (err) {
    console.error("Failed to load product chunk:", err);
  }
}

/**
 * Returns the next random product and removes it from the pool.
 * Returns null when the pool is exhausted.
 */
export async function getNextProduct(): Promise<Product | null> {
  if (productPool.length === 0) return null;
  const index = Math.floor(Math.random() * productPool.length);
  const [product] = productPool.splice(index, 1);
  return product ?? null;
}
