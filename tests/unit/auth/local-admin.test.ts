import { describe, expect, it } from "vitest";

import { hashPassword } from "~/server/auth/bcrypt-utils";
import { createLocalAdminService } from "~/server/auth/local-admin";

describe("local-admin", () => {
  describe("createLocalAdminService", () => {
    it("authenticates valid credentials", async () => {
      const hash = await hashPassword("admin-password");
      const service = createLocalAdminService({
        username: "admin",
        passwordHash: hash,
      });

      const result = await service.authenticate("admin", "admin-password");
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects incorrect username", async () => {
      const hash = await hashPassword("admin-password");
      const service = createLocalAdminService({
        username: "admin",
        passwordHash: hash,
      });

      const result = await service.authenticate("wrong-user", "admin-password");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid username or password");
    });

    it("rejects incorrect password", async () => {
      const hash = await hashPassword("admin-password");
      const service = createLocalAdminService({
        username: "admin",
        passwordHash: hash,
      });

      const result = await service.authenticate("admin", "wrong-password");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid username or password");
    });

    it("rate-limits failed attempts", async () => {
      const hash = await hashPassword("admin-password");
      const service = createLocalAdminService({
        username: "admin",
        passwordHash: hash,
      });

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await service.authenticate("admin", "wrong-password");
      }

      // 6th attempt should be rate-limited
      const result = await service.authenticate("admin", "wrong-password");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many failed attempts");
    });

    it("resets rate limit after successful authentication", async () => {
      const hash = await hashPassword("admin-password");
      const service = createLocalAdminService({
        username: "admin",
        passwordHash: hash,
      });

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await service.authenticate("admin", "wrong-password");
      }

      // Successful login should reset
      const success = await service.authenticate("admin", "admin-password");
      expect(success.success).toBe(true);

      // Should be able to authenticate again
      const result = await service.authenticate("admin", "admin-password");
      expect(result.success).toBe(true);
    });

    it("returns username via getUsername", async () => {
      const hash = await hashPassword("admin-password");
      const service = createLocalAdminService({
        username: "test-admin",
        passwordHash: hash,
      });

      expect(service.getUsername()).toBe("test-admin");
    });

    it("uses updated credentials without recreating the service", async () => {
      const oldHash = await hashPassword("old-password");
      const newHash = await hashPassword("new-password");
      const service = createLocalAdminService({
        username: "admin",
        passwordHash: oldHash,
      });

      service.updateCredentials({ username: "operator", passwordHash: newHash });

      expect(service.getUsername()).toBe("operator");
      await expect(service.authenticate("admin", "old-password")).resolves.toMatchObject({
        success: false,
      });
      await expect(service.authenticate("operator", "new-password")).resolves.toEqual({
        success: true,
      });
    });
  });
});
