import { describe, expect, test } from "vitest";

import { validateRecordValue } from "~/utils/dns-record";

describe("validateRecordValue", () => {
  test("accepts valid A records", () => {
    expect(validateRecordValue("A", "101.101.101.101")).toBeUndefined();
    expect(validateRecordValue("A", "0.0.0.0")).toBeUndefined();
    expect(validateRecordValue("A", "255.255.255.255")).toBeUndefined();
  });

  test("rejects invalid A records", () => {
    expect(validateRecordValue("A", "not-an-ip")).toContain("IPv4");
    expect(validateRecordValue("A", "256.1.1.1")).toContain("between 0 and 255");
    expect(validateRecordValue("A", "1.2.3")).toContain("IPv4");
    expect(validateRecordValue("A", "")).toContain("IPv4");
  });

  test("accepts valid AAAA records", () => {
    expect(validateRecordValue("AAAA", "2001:db8::ff00:42:8329")).toBeUndefined();
    expect(validateRecordValue("AAAA", "::1")).toBeUndefined();
    expect(validateRecordValue("AAAA", "fe80::1")).toBeUndefined();
  });

  test("rejects invalid AAAA records", () => {
    expect(validateRecordValue("AAAA", "not-an-ip")).toContain("IPv6");
    expect(validateRecordValue("AAAA", "101.101.101.101")).toContain("IPv6");
  });

  test("accepts valid CNAME records", () => {
    expect(validateRecordValue("CNAME", "target.example.com")).toBeUndefined();
    expect(validateRecordValue("CNAME", "foo.bar.baz.example.com")).toBeUndefined();
  });

  test("rejects invalid CNAME records", () => {
    expect(validateRecordValue("CNAME", "notadomain")).toContain("target domain");
    expect(validateRecordValue("CNAME", "")).toContain("target domain");
  });

  test("accepts unknown record types without validation", () => {
    expect(validateRecordValue("TXT", "anything")).toBeUndefined();
  });
});
