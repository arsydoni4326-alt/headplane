import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { load } from "js-yaml";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("~/server/auth/bcrypt-utils", () => ({
  validateBcryptHash: vi.fn(),
}));

import { updateConfig } from "~/server/config/write";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("configuration writer", () => {
  test("writes profile updates atomically and creates a private backup", async () => {
    const directory = await mkdtemp(join(tmpdir(), "headplane-config-write-"));
    directories.push(directory);
    const configPath = join(directory, "config.yaml");
    await writeFile(
      configPath,
      [
        "server:",
        "  cookie_secret: abcdefghijklmnopqrstuvwxyz123456",
        "headscale:",
        "  url: http://localhost:8080",
        "  api_key: service-key",
        "user:",
        "  username: admin",
        "  password: $2b$12$01234567890123456789012345678901234567890123456789012",
        "  name: Administrator",
        "  avatar: https://example.com/avatar.png",
      ].join("\n"),
    );

    const backupPath = await updateConfig(
      configPath,
      { user: { username: "operator", name: undefined, avatar: undefined } },
      { backup: true },
    );

    expect(backupPath).toBeDefined();
    expect((await stat(backupPath!)).mode & 0o777).toBe(0o600);
    expect(await readFile(backupPath!, "utf8")).toContain("username: admin");

    const config = load(await readFile(configPath, "utf8")) as {
      headscale: { api_key: string };
      user: Record<string, string>;
    };
    expect(config.headscale.api_key).toBe("service-key");
    expect(config.user).toMatchObject({
      username: "operator",
      password: "$2b$12$01234567890123456789012345678901234567890123456789012",
    });
    expect(config.user).not.toHaveProperty("name");
    expect(config.user).not.toHaveProperty("avatar");
    await expect(stat(`${configPath}.tmp`)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("replaces password_path when writing a local-admin password", async () => {
    const directory = await mkdtemp(join(tmpdir(), "headplane-config-password-"));
    directories.push(directory);
    const configPath = join(directory, "config.yaml");
    await writeFile(
      configPath,
      [
        "server:",
        "  cookie_secret: abcdefghijklmnopqrstuvwxyz123456",
        "headscale:",
        "  url: http://localhost:8080",
        "user:",
        "  username: admin",
        "  password_path: /run/secrets/headplane-admin-password",
      ].join("\n"),
    );

    await updateConfig(
      configPath,
      { user: { password: "$2b$12$01234567890123456789012345678901234567890123456789012" } },
      { backup: true },
    );

    const config = load(await readFile(configPath, "utf8")) as { user: Record<string, string> };
    expect(config.user.password).toBe(
      "$2b$12$01234567890123456789012345678901234567890123456789012",
    );
    expect(config.user).not.toHaveProperty("password_path");
  });
});
