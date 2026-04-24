#!/usr/bin/env node
/**
 * Split a large products JSON array into multiple chunk files.
 *
 * Usage:
 *   node scripts/split-products.mjs <path/to/products.json> [chunkSize]
 *
 * Output:
 *   public/data/products_00.json
 *   public/data/products_01.json
 *   …
 *
 * After running this script, update CHUNK_COUNT in src/data.ts to match
 * the number of files generated.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const inputFile = process.argv[2];
const chunkSize = parseInt(process.argv[3] ?? "1000", 10);

if (!inputFile) {
  console.error(
    "Usage: node scripts/split-products.mjs <path/to/products.json> [chunkSize]"
  );
  process.exit(1);
}

const outputDir = join(__dirname, "..", "public", "data");
mkdirSync(outputDir, { recursive: true });

console.log(`Reading ${inputFile}…`);
const raw = readFileSync(inputFile, "utf-8");
const products = JSON.parse(raw);

if (!Array.isArray(products)) {
  console.error("Error: JSON file must contain an array at the root level.");
  process.exit(1);
}

console.log(`Loaded ${products.length} products. Chunk size: ${chunkSize}`);

let chunkIndex = 0;
for (let i = 0; i < products.length; i += chunkSize) {
  const chunk = products.slice(i, i + chunkSize);
  const filename = `products_${String(chunkIndex).padStart(2, "0")}.json`;
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, JSON.stringify(chunk));
  console.log(`  ✓ ${filename}  (${chunk.length} products)`);
  chunkIndex++;
}

console.log(`\nDone! ${chunkIndex} chunk(s) written to ${outputDir}`);
console.log(`\n→ Update CHUNK_COUNT in src/data.ts to: ${chunkIndex}`);
