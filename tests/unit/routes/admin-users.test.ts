import { beforeEach, describe, expect, test, vi } from "vitest";

import { action, loader } from "~/routes/admin/users/route";
import { appConfigContext, authContext } from "~/server/context";
import type { Principal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";

// Mock context utilities
const mockAuth = {
  require: vi.fn(),
  can: vi.fn(),
  getHeadscaleApiKey: vi.fn(),
};

const mockConfig = {
  headscale: {
    url: "http://localhost:8080",
  },
};

// Create mock context following the pattern from other tests
function createMockContext() {
  return {
    get: (context: typeof authContext | typeof appConfigContext) => {
      if (context === authContext) return mockAuth;
      if (context === appConfigContext) return mockConfig;
      return null;
    },
  };
}

// Mock fetch globally
global.fetch = vi.fn();

describe("Admin Users Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    test("allows password-authenticated admin to access user management", async () => {
      const passwordPrincipal: Principal = {
        kind: "password",
        sessionId: "test-session",
        token: "session-token-123",
        username: "admin-user",
      };

      mockAuth.require.mockResolvedValue(passwordPrincipal);
      mockAuth.can.mockReturnValue(true);
      mockAuth.getHeadscaleApiKey.mockReturnValue("session-token-123");

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          users: [{ id: "u1", username: "user1", role: "admin", createdAt: "2024-01-01" }],
        }),
      });

      const request = new Request("http://localhost/admin/users");
      const context = createMockContext();
      const result = await loader({ request, context, params: {} } as any);

      expect(mockAuth.can).toHaveBeenCalledWith(passwordPrincipal, Capabilities.configure_iam);
      expect(mockAuth.getHeadscaleApiKey).toHaveBeenCalledWith(passwordPrincipal);
      expect(result).toHaveProperty("users");
      expect(result).toHaveProperty("authToken", "session-token-123");
    });

    test("allows API key-authenticated admin to access user management", async () => {
      const apiKeyPrincipal: Principal = {
        kind: "api_key",
        sessionId: "test-session",
        displayName: "API Key Admin",
        apiKey: "api-key-456",
      };

      mockAuth.require.mockResolvedValue(apiKeyPrincipal);
      mockAuth.can.mockReturnValue(true);
      mockAuth.getHeadscaleApiKey.mockReturnValue("api-key-456");

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          users: [{ id: "u1", username: "user1", role: "admin", createdAt: "2024-01-01" }],
        }),
      });

      const request = new Request("http://localhost/admin/users");
      const context = createMockContext();
      const result = await loader({ request, context, params: {} } as any);

      expect(mockAuth.can).toHaveBeenCalledWith(apiKeyPrincipal, Capabilities.configure_iam);
      expect(mockAuth.getHeadscaleApiKey).toHaveBeenCalledWith(apiKeyPrincipal);
      expect(result).toHaveProperty("users");
      expect(result).toHaveProperty("authToken", "api-key-456");
    });

    test("returns an empty user list with an error when the backend rejects the request", async () => {
      const apiKeyPrincipal: Principal = {
        kind: "api_key",
        sessionId: "test-session",
        displayName: "API Key Admin",
        apiKey: "api-key-456",
      };

      mockAuth.require.mockResolvedValue(apiKeyPrincipal);
      mockAuth.can.mockReturnValue(true);
      mockAuth.getHeadscaleApiKey.mockReturnValue("api-key-456");

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "Failed to load users: Internal Server Error" }),
      });

      const request = new Request("http://localhost/admin/users");
      const context = createMockContext();
      const result = await loader({ request, context, params: {} } as any);

      expect(result).toMatchObject({
        users: [],
        error: {
          message: "Failed to load users: Internal Server Error",
          status: 500,
        },
      });
    });

    test("blocks non-admin users from accessing user management", async () => {
      const nonAdminPrincipal: Principal = {
        kind: "password",
        sessionId: "test-session",
        token: "session-token-789",
        username: "regular-user",
      };

      mockAuth.require.mockResolvedValue(nonAdminPrincipal);
      mockAuth.can.mockReturnValue(false);

      const request = new Request("http://localhost/admin/users");
      const context = createMockContext();

      // Expect the loader to throw a Response
      await expect(loader({ request, context, params: {} } as any)).rejects.toBeInstanceOf(
        Response,
      );

      try {
        await loader({ request, context, params: {} } as any);
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(403);
        const text = await (response as Response).text();
        expect(text).toContain("Only administrators");
      }

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("action", () => {
    test("allows password-authenticated admin to create users", async () => {
      const passwordPrincipal: Principal = {
        kind: "password",
        sessionId: "test-session",
        token: "session-token-123",
        username: "admin-user",
      };

      mockAuth.require.mockResolvedValue(passwordPrincipal);
      mockAuth.can.mockReturnValue(true);
      mockAuth.getHeadscaleApiKey.mockReturnValue("session-token-123");

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const formData = new FormData();
      formData.set("_action", "create");
      formData.set("username", "newuser");
      formData.set("password", "password123");
      formData.set("role", "user");

      const request = new Request("http://localhost/admin/users", {
        method: "POST",
        body: formData,
      });

      const context = createMockContext();
      const result = await action({ request, context, params: {} } as any);

      expect(mockAuth.getHeadscaleApiKey).toHaveBeenCalledWith(passwordPrincipal);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/headplane/users",
        expect.objectContaining({
          body: JSON.stringify({ username: "newuser", password: "password123", role: "user" }),
        }),
      );
      expect(result).toMatchObject({ success: true });
    });

    test("allows API key-authenticated admin to create users", async () => {
      const apiKeyPrincipal: Principal = {
        kind: "api_key",
        sessionId: "test-session",
        displayName: "API Key Admin",
        apiKey: "api-key-456",
      };

      mockAuth.require.mockResolvedValue(apiKeyPrincipal);
      mockAuth.can.mockReturnValue(true);
      mockAuth.getHeadscaleApiKey.mockReturnValue("api-key-456");

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const formData = new FormData();
      formData.set("_action", "create");
      formData.set("username", "newuser");
      formData.set("password", "password123");
      formData.set("role", "user");

      const request = new Request("http://localhost/admin/users", {
        method: "POST",
        body: formData,
      });

      const context = createMockContext();
      const result = await action({ request, context, params: {} } as any);

      expect(mockAuth.getHeadscaleApiKey).toHaveBeenCalledWith(apiKeyPrincipal);
      expect(result).toMatchObject({ success: true });
    });

    test("sends an accepted role when updating a user", async () => {
      const passwordPrincipal: Principal = {
        kind: "password",
        sessionId: "test-session",
        token: "session-token-123",
        username: "admin-user",
      };

      mockAuth.require.mockResolvedValue(passwordPrincipal);
      mockAuth.can.mockReturnValue(true);
      mockAuth.getHeadscaleApiKey.mockReturnValue("session-token-123");
      (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      const formData = new FormData();
      formData.set("_action", "update");
      formData.set("userId", "42");
      formData.set("username", "operator");
      formData.set("role", "admin");

      const request = new Request("http://localhost/admin/users", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, context: createMockContext(), params: {} } as any);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8080/api/v1/headplane/users/42",
        expect.objectContaining({ body: JSON.stringify({ username: "operator", role: "admin" }) }),
      );
      expect(result).toMatchObject({ success: true });
    });

    test("blocks non-admin users from performing actions", async () => {
      const nonAdminPrincipal: Principal = {
        kind: "password",
        sessionId: "test-session",
        token: "session-token-789",
        username: "regular-user",
      };

      mockAuth.require.mockResolvedValue(nonAdminPrincipal);
      mockAuth.can.mockReturnValue(false);

      const formData = new FormData();
      formData.set("_action", "create");
      formData.set("username", "newuser");
      formData.set("password", "password123");
      formData.set("role", "user");

      const request = new Request("http://localhost/admin/users", {
        method: "POST",
        body: formData,
      });

      const context = createMockContext();

      // Expect the action to throw a Response
      await expect(action({ request, context, params: {} } as any)).rejects.toBeInstanceOf(
        Response,
      );

      try {
        await action({ request, context, params: {} } as any);
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(403);
        const text = await (response as Response).text();
        expect(text).toContain("Insufficient permissions");
      }

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
