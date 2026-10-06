#!/usr/bin/env node
/**
 * headplane migrate-local-admin
 *
 * Migrates one legacy Headscale local administrator to Headplane single-admin config.
 *
 * Reads the legacy SQLite `headplane_users` table (read-only), selects exactly one
 * `role = 'admin'` record, and writes the username and bcrypt hash to Headplane config.
 *
 * Usage:
 *   headplane migrate-local-admin --db /var/lib/headscale/db.sqlite --config /etc/headplane/config.yaml
 *   headplane migrate-local-admin --db ./db.sqlite --config ./config.yaml --username admin --dry-run
 *   headplane migrate-local-admin --db ./db.sqlite --config ./config.yaml --username admin
 */

import { access, constants, copyFile, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import Database from "better-sqlite3";
import { dump, load } from "js-yaml";

import { validateBcryptHash } from "../app/server/auth/bcrypt-utils";

interface LegacyAdmin {
  username: string;
  password_hash: string;
}

interface Args {
  dbPath: string;
  configPath: string;
  username?: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dbPath: string | undefined;
  let configPath: string | undefined;
  let username: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--db" && i + 1 < args.length) {
      dbPath = args[++i];
    } else if (args[i] === "--config" && i + 1 < args.length) {
      configPath = args[++i];
    } else if (args[i] === "--username" && i + 1 < args.length) {
      username = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!dbPath || !configPath) {
    console.error(
      "Usage: headplane migrate-local-admin --db <db-path> --config <config-path> [--username <username>] [--dry-run]",
    );
    console.error("");
    console.error("Migrates one legacy local administrator to single-admin mode.");
    console.error("");
    console.error("Options:");
    console.error("  --db <path>         Path to legacy Headscale SQLite database (read-only)");
    console.error("  --config <path>     Path to Headplane config.yaml");
    console.error("  --username <name>   Required when multiple admins exist");
    console.error("  --dry-run           Show selected username and planned action only");
    process.exit(1);
  }

  return { dbPath, configPath, username, dryRun };
}

async function selectLegacyAdmin(dbPath: string, username?: string): Promise<LegacyAdmin> {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });

  try {
    const admins = db
      .prepare("SELECT username, password_hash FROM headplane_users WHERE role = 'admin'")
      .all() as LegacyAdmin[];

    if (admins.length === 0) {
      throw new Error("No legacy administrator found in headplane_users table");
    }

    if (admins.length > 1 && !username) {
      const usernames = admins.map((a) => a.username).join(", ");
      throw new Error(`Multiple administrators found (${usernames}). Specify one with --username`);
    }

    let selected: LegacyAdmin | undefined;
    if (username) {
      selected = admins.find((a) => a.username === username);
      if (!selected) {
        throw new Error(`Administrator '${username}' not found in headplane_users table`);
      }
    } else {
      selected = admins[0];
    }

    const validation = validateBcryptHash(selected.password_hash);
    if (!validation.valid) {
      throw new Error(`Invalid password hash for user '${selected.username}': ${validation.error}`);
    }

    return selected;
  } finally {
    db.close();
  }
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

async function checkConfigConflict(
  config: Record<string, unknown>,
  admin: LegacyAdmin,
): Promise<void> {
  const user = config.user as Record<string, unknown> | undefined;
  if (!user) {
    return;
  }

  const existingUsername = user.username as string | undefined;
  const existingPassword = user.password as string | undefined;

  if (existingUsername === admin.username && existingPassword === admin.password_hash) {
    throw new Error("Target config already contains matching credentials (no-op)");
  }

  if (existingUsername || existingPassword) {
    throw new Error("Target config already contains different user credentials. Cannot overwrite.");
  }
}

async function backupConfig(configPath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = `${configPath}.${timestamp}.backup`;

  await copyFile(configPath, backupPath);

  const fs = await import("node:fs/promises");
  await fs.chmod(backupPath, 0o600);

  return backupPath;
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

async function validateWrittenConfig(configPath: string, admin: LegacyAdmin): Promise<void> {
  const reloaded = await loadConfig(configPath);
  const user = reloaded.user as Record<string, unknown> | undefined;

  if (!user || user.username !== admin.username || user.password !== admin.password_hash) {
    throw new Error("Config validation failed after write");
  }
}

async function main() {
  const args = parseArgs();

  console.log("Headplane Local Admin Migration");
  console.log("================================");
  console.log("");

  console.log(`Reading legacy database: ${args.dbPath}`);
  const admin = await selectLegacyAdmin(args.dbPath, args.username);
  console.log(`Selected administrator: ${admin.username}`);

  if (args.dryRun) {
    console.log("");
    console.log("DRY RUN: Would write to config:");
    console.log(`  user.username: ${admin.username}`);
    console.log(`  user.password: <bcrypt hash omitted>`);
    console.log("");
    console.log("Re-run without --dry-run to apply changes.");
    return;
  }

  console.log(`Loading target config: ${args.configPath}`);
  const config = await loadConfig(args.configPath);

  try {
    await checkConfigConflict(config, admin);
  } catch (error) {
    if (error instanceof Error && error.message.includes("no-op")) {
      console.log("");
      console.log("✓ Target config already contains matching credentials (no-op).");
      return;
    }
    throw error;
  }

  console.log("Creating backup...");
  const backupPath = await backupConfig(args.configPath);
  console.log(`Backup created: ${basename(backupPath)}`);

  console.log("Writing config...");
  config.user = {
    username: admin.username,
    password: admin.password_hash,
  };
  await writeConfig(args.configPath, config);

  console.log("Validating written config...");
  await validateWrittenConfig(args.configPath, admin);

  console.log("");
  console.log("✓ Migration completed successfully.");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Restart Headplane");
  console.log(`  2. Sign in with username: ${admin.username}`);
  console.log("  3. Verify dashboard access");
  console.log("");
  console.log(`Backup retained: ${backupPath}`);
}

main().catch((error) => {
  console.error("");
  console.error("Migration failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
