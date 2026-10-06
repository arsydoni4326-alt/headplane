import { mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { dump, load } from "js-yaml";
import { beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "~/server/auth/bcrypt-utils";

describe("migrate-local-admin CLI", () => {
  let tempDir: string;
  let dbPath: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "migrate-test-"));
    dbPath = join(tempDir, "db.sqlite");
    configPath = join(tempDir, "config.yaml");
  });

  async function createLegacyDb(admins: Array<{ username: string; password: string }>) {
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE headplane_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const stmt = db.prepare(
      "INSERT INTO headplane_users (username, password_hash, role) VALUES (?, ?, ?)",
    );

    for (const admin of admins) {
      const hash = await hashPassword(admin.password);
      stmt.run(admin.username, hash, "admin");
    }

    db.close();
  }

  function createConfig(content: Record<string, unknown>) {
    writeFileSync(configPath, dump(content));
  }

  async function runMigration(args: string[] = []): Promise<{ stdout: string; exitCode: number }> {
    const { execSync } = await import("node:child_process");

    try {
      const stdout = execSync(
        `node --import tsx/esm cmd/headplane-migrate-local-admin.ts --db ${dbPath} --config ${configPath} ${args.join(" ")}`,
        { encoding: "utf-8", cwd: process.cwd() },
      );
      return { stdout, exitCode: 0 };
    } catch (error: any) {
      return { stdout: error.stdout || error.message, exitCode: error.status || 1 };
    }
  }

  it("migrates single admin from legacy DB", async () => {
    await createLegacyDb([{ username: "admin", password: "admin-password" }]);
    createConfig({
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    const result = await runMigration();
    expect(result.exitCode).toBe(0);

    const configContent = await readFile(configPath, "utf-8");
    const config = load(configContent) as any;

    expect(config.user).toBeDefined();
    expect(config.user.username).toBe("admin");
    expect(config.user.password).toMatch(/^\$2[aby]\$/);
  });

  it("requires --username when multiple admins exist", async () => {
    await createLegacyDb([
      { username: "admin1", password: "password1" },
      { username: "admin2", password: "password2" },
    ]);
    createConfig({
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    const result = await runMigration();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/multiple administrators/i);
  });

  it("selects specific admin with --username", async () => {
    await createLegacyDb([
      { username: "admin1", password: "password1" },
      { username: "admin2", password: "password2" },
    ]);
    createConfig({
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    const result = await runMigration(["--username", "admin2"]);
    expect(result.exitCode).toBe(0);

    const configContent = await readFile(configPath, "utf-8");
    const config = load(configContent) as any;
    expect(config.user.username).toBe("admin2");
  });

  it("is idempotent - no-op if already migrated", async () => {
    await createLegacyDb([{ username: "admin", password: "admin-password" }]);

    const adminHash = await hashPassword("admin-password");
    createConfig({
      user: { username: "admin", password: adminHash },
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    const result = await runMigration();
    expect(result.exitCode).toBe(0);
  });

  it("shows plan in dry-run mode without changes", async () => {
    await createLegacyDb([{ username: "admin", password: "admin-password" }]);
    createConfig({
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    const result = await runMigration(["--dry-run"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/admin/);

    const configContent = await readFile(configPath, "utf-8");
    const config = load(configContent) as any;
    expect(config.user).toBeUndefined();
  });

  it("preserves other config fields", async () => {
    await createLegacyDb([{ username: "admin", password: "admin-password" }]);
    createConfig({
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
      server: { port: 3000 },
    });

    const result = await runMigration();
    expect(result.exitCode).toBe(0);

    const configContent = await readFile(configPath, "utf-8");
    const config = load(configContent) as any;
    expect(config.server.port).toBe(3000);
  });
});
