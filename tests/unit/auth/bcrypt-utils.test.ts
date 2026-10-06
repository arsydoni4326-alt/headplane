import { describe, expect, it } from "vitest";

import { hashPassword, validateBcryptHash, verifyPassword } from "~/server/auth/bcrypt-utils";

describe("bcrypt-utils", () => {
  describe("validateBcryptHash", () => {
    it("accepts valid bcrypt cost-12 hash with $2b$", () => {
      const hash = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
      const result = validateBcryptHash(hash);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts valid bcrypt cost-12 hash with $2a$", () => {
      const hash = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
      const result = validateBcryptHash(hash);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty hash", () => {
      const result = validateBcryptHash("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("rejects plaintext password", () => {
      const result = validateBcryptHash("my-plaintext-password");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a valid bcrypt hash");
    });

    it("rejects malformed hash", () => {
      const result = validateBcryptHash("$2b$12$invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a valid bcrypt hash");
    });

    it("rejects non-cost-12 hash (cost 10)", () => {
      const hash = "$2b$10$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
      const result = validateBcryptHash(hash);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cost 10");
    });

    it("rejects non-cost-12 hash (cost 14)", () => {
      const hash = "$2b$14$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
      const result = validateBcryptHash(hash);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cost 14");
    });
  });

  describe("hashPassword and verifyPassword", () => {
    it("hashes and verifies a password correctly", async () => {
      const plaintext = "test-password-123";
      const hash = await hashPassword(plaintext);

      // Validate the generated hash
      const validation = validateBcryptHash(hash);
      expect(validation.valid).toBe(true);

      // Verify correct password
      const valid = await verifyPassword(plaintext, hash);
      expect(valid).toBe(true);
    });

    it("rejects incorrect password", async () => {
      const plaintext = "correct-password";
      const hash = await hashPassword(plaintext);

      const valid = await verifyPassword("wrong-password", hash);
      expect(valid).toBe(false);
    });

    it("returns false for malformed hash", async () => {
      const valid = await verifyPassword("test", "not-a-hash");
      expect(valid).toBe(false);
    });
  });
});
