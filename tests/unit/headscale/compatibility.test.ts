import { describe, expect, test } from "vitest";

import { parseServerVersion } from "~/server/headscale/api/server-version";
import {
  COMPATIBILITY_FEATURES,
  compatibilityFor,
  unsupportedFor,
} from "~/server/headscale/compatibility";

describe("compatibilityFor", () => {
  test("reports all features supported on a recent version", () => {
    const report = compatibilityFor(parseServerVersion("v0.31.0"));
    expect(report.unsupported).toHaveLength(0);
    expect(report.statuses).toHaveLength(COMPATIBILITY_FEATURES.length);
  });

  test("reports unsupported features on an older version", () => {
    const report = compatibilityFor(parseServerVersion("v0.27.0"));
    expect(report.unsupported.length).toBeGreaterThan(0);
    expect(report.statuses.every((s) => !s.supported)).toBe(true);
  });

  test("treats unknown versions as fully supported", () => {
    const report = compatibilityFor(parseServerVersion("dev"));
    expect(report.unsupported).toHaveLength(0);
  });

  test("treats Go pseudo-versions as fully supported", () => {
    const report = compatibilityFor(parseServerVersion("v0.0.0-20260703052708-048308511c72"));
    expect(report.unsupported).toHaveLength(0);
  });

  test("formats the server version for display", () => {
    const report = compatibilityFor(parseServerVersion("v0.28.0-beta.1"));
    expect(report.serverVersion).toBe("0.28.0-beta.1");
  });
});

describe("unsupportedFor", () => {
  test("filters by surface", () => {
    const version = parseServerVersion("v0.27.0");
    const machines = unsupportedFor(version, "machines");
    expect(machines.length).toBeGreaterThan(0);
    expect(machines.every((s) => s.feature.surface === "machines")).toBe(true);
  });

  test("returns all unsupported when no surface is given", () => {
    const version = parseServerVersion("v0.27.0");
    const all = unsupportedFor(version);
    expect(all.length).toBe(compatibilityFor(version).unsupported.length);
  });

  test("returns empty for a surface with no unsupported features", () => {
    const version = parseServerVersion("v0.27.0");
    const dns = unsupportedFor(version, "dns");
    expect(dns).toHaveLength(0);
  });
});

describe("registry integrity", () => {
  test("every feature has a unique key", () => {
    const keys = COMPATIBILITY_FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("every feature has a valid minimum version", () => {
    for (const feature of COMPATIBILITY_FEATURES) {
      expect(feature.minVersion).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
