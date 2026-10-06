import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestAuth } from "./create-auth";

describe("session invalidation", () => {
  describe("invalidatePasswordSessions", () => {
    it("deletes all password sessions", async () => {
      const { auth, db } = createTestAuth();

      // Create multiple password sessions
      await auth.createPasswordSession("token1", "admin", 3600);
      await auth.createPasswordSession("token2", "admin", 3600);
      await auth.createPasswordSession("token3", "admin", 3600);

      // Verify sessions were created
      const beforeCount = await db.get<{ count: number }>(
        sql`SELECT COUNT(*) as count FROM auth_sessions WHERE kind = 'password'`,
      );
      expect(beforeCount?.count).toBe(3);

      // Invalidate all password sessions
      const deletedCount = await auth.invalidatePasswordSessions();
      expect(deletedCount).toBe(3);

      // Verify all password sessions are gone
      const afterCount = await db.get<{ count: number }>(
        sql`SELECT COUNT(*) as count FROM auth_sessions WHERE kind = 'password'`,
      );
      expect(afterCount?.count).toBe(0);
    });

    it("preserves API-key sessions", async () => {
      const { auth, db } = createTestAuth();

      // Create password sessions
      await auth.createPasswordSession("token1", "admin", 3600);
      await auth.createPasswordSession("token2", "admin", 3600);

      // Create API-key sessions manually
      await db.run(sql`
        INSERT INTO auth_sessions (id, kind, user_id, expires_at, created_at)
        VALUES 
          ('api-session-1', 'api_key', 'api-user-1', unixepoch('now', '+1 hour'), unixepoch('now')),
          ('api-session-2', 'api_key', 'api-user-2', unixepoch('now', '+1 hour'), unixepoch('now'))
      `);

      // Verify we have both types
      const beforePassword = await db.get<{ count: number }>(
        sql`SELECT COUNT(*) as count FROM auth_sessions WHERE kind = 'password'`,
      );
      const beforeApiKey = await db.get<{ count: number }>(
        sql`SELECT COUNT(*) as count FROM auth_sessions WHERE kind = 'api_key'`,
      );
      expect(beforePassword?.count).toBe(2);
      expect(beforeApiKey?.count).toBe(2);

      // Invalidate password sessions
      const deletedCount = await auth.invalidatePasswordSessions();
      expect(deletedCount).toBe(2);

      // Verify password sessions are gone but API-key sessions remain
      const afterPassword = await db.get<{ count: number }>(
        sql`SELECT COUNT(*) as count FROM auth_sessions WHERE kind = 'password'`,
      );
      const afterApiKey = await db.get<{ count: number }>(
        sql`SELECT COUNT(*) as count FROM auth_sessions WHERE kind = 'api_key'`,
      );
      expect(afterPassword?.count).toBe(0);
      expect(afterApiKey?.count).toBe(2);
    });

    it("returns correct count of deleted sessions", async () => {
      const { auth } = createTestAuth();

      // No sessions - should return 0
      const count1 = await auth.invalidatePasswordSessions();
      expect(count1).toBe(0);

      // Create one session
      await auth.createPasswordSession("token1", "admin", 3600);
      const count2 = await auth.invalidatePasswordSessions();
      expect(count2).toBe(1);

      // Already deleted - should return 0
      const count3 = await auth.invalidatePasswordSessions();
      expect(count3).toBe(0);

      // Create multiple sessions
      await auth.createPasswordSession("token2", "admin", 3600);
      await auth.createPasswordSession("token3", "admin", 3600);
      await auth.createPasswordSession("token4", "admin", 3600);
      const count4 = await auth.invalidatePasswordSessions();
      expect(count4).toBe(3);
    });

    it("is idempotent", async () => {
      const { auth } = createTestAuth();

      // Create sessions
      await auth.createPasswordSession("token1", "admin", 3600);
      await auth.createPasswordSession("token2", "admin", 3600);

      // First call deletes them
      const count1 = await auth.invalidatePasswordSessions();
      expect(count1).toBe(2);

      // Second call is a no-op
      const count2 = await auth.invalidatePasswordSessions();
      expect(count2).toBe(0);

      // Third call is still a no-op
      const count3 = await auth.invalidatePasswordSessions();
      expect(count3).toBe(0);
    });
  });
});
