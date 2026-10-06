#!/usr/bin/env node
/**
 * headplane reset-local-admin-password --password-stdin
 *
 * Resets the local administrator's password by reading a new password from stdin,
 * hashing it with bcrypt cost 12, and atomically updating the config.
 *
 * Usage:
 *   echo "new-password" | headplane reset-local-admin-password --password-stdin --config /etc/headplane/config.yaml
 *   headplane reset-local-admin-password --password-stdin < password.txt
 */

import { access, constants, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

import { dump, load } from "js-yaml";

import { hashPassword, validateBcryptHash } from "../app/server/auth/bcrypt-utils";

interface Args {
  configPath: string;
  passwordStdin: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let configPath = "/etc/headplane/config.yaml";
  let passwordStdin = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" && i + 1 < args.length) {
      configPath = args[++i];
    } else if (args[i] === "--password-stdin") {
      passwordStdin = true;
    }
  }

  if (!passwordStdin) {
    console.error("Usage: headplane reset-local-admin-password --password-stdin [--config <path>]");
    console.error("");
    console.error("Reads a new password from stdin and updates the local admin config.");
    console.error("");
    console.error("Example:");
    console.error('  echo "new-password" | headplane reset-local-admin-password --password-stdin');
    process.exit(1);
  }

  return { configPath, passwordStdin };
}

async function readPasswordFromStdin(): Promise<string> {
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
    throw new Error("Password cannot be empty");
  }

  return password;
}

async function loadConfig(configPath: string): Promise<Record<string, unknown>> {
  try {
    await access(configPath, constants.R_OK | constants.W_OK);
  } catch {
    throw new Error(`Cannot access config file: ${configPath}`);
  }

  const content = await readFile(configPath, "utf8");
  const config = load(content) as Record<string, unknown>;
  return config;
}

async function writeConfig(configPath: string, config: Record<string, unknown>): Promise<void> {
  const yaml = dump(config, { lineWidth: -1, noRefs: true });
  const tmpPath = `${configPath}.tmp`;

  await writeFile(tmpPath, yaml, { mode: 0o600 });

  const fs = await import("node:fs/promises");
  const fd = await fs.open(tmpPath, "r+");
  await fd.datasync();
  await fd.close();

  await fs.rename(tmpPath, configPath);
}

async function main() {
  const args = parseArgs();

  const password = await readPasswordFromStdin();
  const hash = await hashPassword(password);

  const validation = validateBcryptHash(hash);
  if (!validation.valid) {
    throw new Error(`Generated hash validation failed: ${validation.error}`);
  }

  const config = await loadConfig(args.configPath);
  const user = config.user as Record<string, unknown> | undefined;

  if (!user || !user.username) {
    throw new Error("Config does not contain a local administrator (user.username missing)");
  }

  user.password = hash;
  await writeConfig(args.configPath, config);

  const reloaded = await loadConfig(args.configPath);
  const reloadedUser = reloaded.user as Record<string, unknown> | undefined;

  if (!reloadedUser || reloadedUser.password !== hash) {
    throw new Error("Config validation failed after write");
  }

  console.log("✓ Password updated successfully.");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Restart Headplane to invalidate existing sessions");
  console.log(`  2. Sign in with username: ${user.username}`);
}

main().catch((error) => {
  console.error("");
  console.error("Password reset failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
