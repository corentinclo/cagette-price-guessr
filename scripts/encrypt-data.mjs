#!/usr/bin/env node
/**
 * Encrypts all public/data/products_XX.json files using AES-GCM-256.
 * Reads the key from the VITE_DATA_KEY variable in .env.local (or DATA_KEY env var).
 * Output: public/data/products_XX.enc  (base64-encoded  IV[12] || ciphertext)
 * Deletes the original .json files after encryption.
 *
 * Usage:
 *   npm run encrypt-data
 */

import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  readdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Key loading ───────────────────────────────────────────────────────────────

function getKeyHex() {
  let key = process.env.DATA_KEY ?? process.env.VITE_DATA_KEY;
  if (!key) {
    const envPath = join(ROOT, ".env.local");
    if (existsSync(envPath)) {
      const match = readFileSync(envPath, "utf8").match(
        /^VITE_DATA_KEY=(.+)$/m
      );
      if (match) key = match[1].trim();
    }
  }
  if (!key) {
    throw new Error(
      "No VITE_DATA_KEY found.\n" +
        "  • Locally: add VITE_DATA_KEY=<hex> to .env.local\n" +
        "  • CI: set the DATA_KEY or VITE_DATA_KEY environment variable"
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error(
      "VITE_DATA_KEY must be a 64-character hex string (256-bit key)."
    );
  }
  return key;
}

function hexToBytes(hex) {
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++)
    buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return buf;
}

// ── Encryption ────────────────────────────────────────────────────────────────

async function encryptBytes(plaintext, keyBytes) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    plaintext
  );

  // Output: IV (12 bytes) || ciphertext, base64-encoded
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return Buffer.from(result).toString("base64");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const keyHex = getKeyHex();
  const keyBytes = hexToBytes(keyHex);

  const dataDir = join(ROOT, "public", "data");
  const files = readdirSync(dataDir)
    .filter((f) => /^products_\d+\.json$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log(
      "No products_XX.json files found in public/data/. Run npm run split-data first."
    );
    return;
  }

  let count = 0;
  for (const file of files) {
    const jsonPath = join(dataDir, file);
    const encPath = join(dataDir, file.replace(".json", ".enc"));
    const plaintext = readFileSync(jsonPath);
    const encrypted = await encryptBytes(plaintext, keyBytes);
    writeFileSync(encPath, encrypted, "utf8");
    unlinkSync(jsonPath);
    console.log(`  ✓  ${file}  →  ${file.replace(".json", ".enc")}`);
    count++;
  }

  console.log(`\nEncrypted ${count} file(s).`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
