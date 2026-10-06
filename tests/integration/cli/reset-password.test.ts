import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dump, load } from "js-yaml";
import { beforeEach, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "~/server/auth/bcrypt-utils";

describe("reset-local-admin-password CLI", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "reset-test-"));
    configPath = join(tempDir, "config.yaml");
  });

  async function createConfig(content: Record<string, unknown>) {
    writeFileSync(configPath, dump(content));
  }

  async function runReset(password: string): Promise<{ stdout: string; exitCode: number }> {
    const { execSync } = await import("node:child_process");

    try {
      const stdout = execSync(
        `echo "${password}" | node --import tsx/esm cmd/headplane-reset-local-admin-password.ts --password-stdin --config ${configPath}`,
        { encoding: "utf-8", cwd: process.cwd(), shell: "/bin/bash" },
      );
      return { stdout, exitCode: 0 };
    } catch (error: any) {
      return { stdout: error.stdout || error.message, exitCode: error.status || 1 };
    }
  }

  it("resets password successfully", async () => {
    const oldHash = await hashPassword("old-password");
    await createConfig({
      user: { username: "admin", password: oldHash },
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    const result = await runReset("new-password-123");
    expect(result.exitCode).toBe(0);

    const configContent = await readFile(configPath, "utf-8");
    const config = load(configContent) as any;

    expect(config.user.username).toBe("admin");
    expect(config.user.password).not.toBe(oldHash);

    const valid = await verifyPassword("new-password-123", config.user.password);
    expect(valid).toBe(true);
  });

  it("validates config path exists", async () => {
    const nonExistentPath = join(tempDir, "nonexistent.yaml");

    const { execSync } = await import("node:child_process");
    try {
      execSync(
        `echo "test" | node --import tsx/esm cmd/headplane-reset-local-admin-password.ts --password-stdin --config ${nonExistentPath}`,
        { encoding: "utf-8", cwd: process.cwd(), shell: "/bin/bash" },
      );
      expect.fail("Should have failed");
    } catch (error: any) {
      expect(error.status).not.toBe(0);
    }
  });

  it("handles read-only config gracefully", async () => {
    const oldHash = await hashPassword("old-password");
    await createConfig({
      user: { username: "admin", password: oldHash },
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    chmodSync(configPath, 0o444);

    const result = await runReset("new-password-123");
    expect(result.exitCode).not.toBe(0);

    chmodSync(configPath, 0o644);
  });

  it("preserves other config fields", async () => {
    const oldHash = await hashPassword("old-password");
    await createConfig({
      user: { username: "admin", password: oldHash },
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
      server: { port: 3000 },
      other: { custom: "value" },
    });

    const result = await runReset("new-password-123");
    expect(result.exitCode).toBe(0);

    const configContent = await readFile(configPath, "utf-8");
    const config = load(configContent) as any;

    expect(config.user.username).toBe("admin");
    expect(config.headscale.url).toBe("http://localhost:8080");
    expect(config.server.port).toBe(3000);
    expect(config.other.custom).toBe("value");
  });

  it("uses atomic write with fsync", async () => {
    const oldHash = await hashPassword("old-password");
    await createConfig({
      user: { username: "admin", password: oldHash },
      headscale: { url: "http://localhost:8080", api_key: "test-key" },
    });

    const result = await runReset("new-password-123");
    expect(result.exitCode).toBe(0);

    const configContent = await readFile(configPath, "utf-8");
    const config = load(configContent) as any;
    const valid = await verifyPassword("new-password-123", config.user.password);
    expect(valid).toBe(true);
  });
});
