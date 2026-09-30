#!/usr/bin/env node
// Bundle-size analysis for the Headplane client build.
//
// Reads the Vite build output in build/client/assets and reports the total
// JavaScript payload and the largest chunks. Fails (exit 1) when any chunk
// exceeds the budget, so CI can gate on bundle growth.
//
// Budgets (gzipped, in bytes):
//   - per-chunk: 1 MB — the lazy SSH route chunk includes the restty terminal
//     emulator and is only fetched when the SSH page is opened, so it is
//     expected to be large. Tighten after capturing a baseline.
//   - total:      2.5 MB
//
// Override with HEADPLANE_BUNDLE_CHUNK_BUDGET / HEADPLANE_BUNDLE_TOTAL_BUDGET.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ASSETS_DIR = join(process.cwd(), "build", "client", "assets");

const CHUNK_BUDGET = Number(process.env.HEADPLANE_BUNDLE_CHUNK_BUDGET ?? 1024 * 1024);
const TOTAL_BUDGET = Number(process.env.HEADPLANE_BUNDLE_TOTAL_BUDGET ?? 2.5 * 1024 * 1024);

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  let files;
  try {
    files = await readdir(ASSETS_DIR);
  } catch {
    console.error(`❌ Build output not found at ${ASSETS_DIR}. Run \`pnpm build\` first.`);
    process.exit(1);
  }

  const jsFiles = files.filter((f) => f.endsWith(".js"));
  const chunks = [];

  for (const file of jsFiles) {
    const raw = await readFile(join(ASSETS_DIR, file));
    const gzipped = gzipSync(raw).length;
    chunks.push({ file, size: gzipped });
  }

  chunks.sort((a, b) => b.size - a.size);

  const total = chunks.reduce((sum, c) => sum + c.size, 0);

  console.log("Bundle size report (gzipped):");
  console.log(`  Total JS: ${format(total)} (budget ${format(TOTAL_BUDGET)})`);
  console.log("  Largest chunks:");
  for (const chunk of chunks.slice(0, 10)) {
    const flag = chunk.size > CHUNK_BUDGET ? " ⚠️ OVER BUDGET" : "";
    console.log(`    ${format(chunk.size).padStart(10)}  ${chunk.file}${flag}`);
  }

  const overBudget = chunks.filter((c) => c.size > CHUNK_BUDGET);
  let failed = false;

  if (total > TOTAL_BUDGET) {
    console.error(`❌ Total JS ${format(total)} exceeds budget ${format(TOTAL_BUDGET)}`);
    failed = true;
  }

  if (overBudget.length > 0) {
    console.error(
      `❌ ${overBudget.length} chunk(s) exceed the ${format(CHUNK_BUDGET)} per-chunk budget:`,
    );
    for (const chunk of overBudget) {
      console.error(`    ${format(chunk.size)}  ${chunk.file}`);
    }
    failed = true;
  }

  if (failed) {
    process.exit(1);
  }

  console.log("✅ Bundle sizes are within budget.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
