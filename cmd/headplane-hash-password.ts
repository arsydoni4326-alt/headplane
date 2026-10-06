#!/usr/bin/env node
/**
 * headplane hash-password --password-stdin
 *
 * Reads a plaintext password from stdin and outputs a bcrypt cost-12 hash.
 * The hash can be used in user.password configuration.
 *
 * Usage:
 *   echo "my-password" | headplane hash-password --password-stdin
 *   headplane hash-password --password-stdin < password.txt
 */

import { createInterface } from "node:readline";

import { hashPassword } from "../app/server/auth/bcrypt-utils";

async function main() {
  const args = process.argv.slice(2);

  if (!args.includes("--password-stdin")) {
    console.error("Usage: headplane hash-password --password-stdin");
    console.error("");
    console.error("Reads a plaintext password from stdin and outputs a bcrypt cost-12 hash.");
    console.error("");
    console.error("Example:");
    console.error('  echo "my-password" | headplane hash-password --password-stdin');
    process.exit(1);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let password = "";

  for await (const line of rl) {
    password += line;
  }

  password = password.trim();

  if (!password || password.length === 0) {
    console.error("Error: Password cannot be empty");
    process.exit(1);
  }

  try {
    const hash = await hashPassword(password);
    console.log(hash);
  } catch (error) {
    console.error("Error generating password hash:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
