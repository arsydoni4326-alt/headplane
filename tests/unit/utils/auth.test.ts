import { describe, expect, test } from "vitest";

import type { Principal } from "~/server/web/auth";
import type { AuthService } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import {
  isAdmin,
  canWriteUsers,
  canWriteMachines,
  canWritePolicy,
  getPrincipalDisplayName,
  getAuthMethodName,
  getUnauthorizedMessage,
  createUnauthorizedResponse,
} from "~/utils/auth";

// Mock auth service
function createMockAuthService(
  canOverride?: (principal: Principal, cap: number) => boolean,
): AuthService {
  return {
    can:
      canOverride ??
      ((principal: Principal, cap: number) => {
        // Default mock: API key and password principals always have all capabilities
        if (principal.kind === "api_key" || principal.kind === "password") {
          return true;
        }
        // OIDC/proxy principals: check their role capabilities
        return false;
      }),
  } as AuthService;
}

describe("isAdmin", () => {
  test("returns true for API key principals", () => {
    const auth = createMockAuthService();
    const principal: Principal = {
      kind: "api_key",
      sessionId: "test-session",
      displayName: "Test API Key",
      apiKey: "test-key",
    };

    expect(isAdmin(auth, principal)).toBe(true);
  });

  test("returns true for password principals", () => {
    const auth = createMockAuthService();
    const principal: Principal = {
      kind: "password",
      sessionId: "test-session",
      token: "test-token",
      username: "testuser",
    };

    expect(isAdmin(auth, principal)).toBe(true);
  });

  test("returns true for OIDC principal with admin role", () => {
    const auth = createMockAuthService((_, cap) => cap === Capabilities.configure_iam);
    const principal: Principal = {
      kind: "oidc",
      sessionId: "test-session",
      user: {
        id: "user-1",
        subject: "oidc-subject",
        role: "admin",
        headscaleUserId: "hs-1",
      },
      profile: {
        name: "Admin User",
        email: "admin@example.com",
      },
    };

    expect(isAdmin(auth, principal)).toBe(true);
  });

  test("returns false for OIDC principal without admin role", () => {
    const auth = createMockAuthService(() => false);
    const principal: Principal = {
      kind: "oidc",
      sessionId: "test-session",
      user: {
        id: "user-1",
        subject: "oidc-subject",
        role: "viewer",
        headscaleUserId: "hs-1",
      },
      profile: {
        name: "Regular User",
        email: "user@example.com",
      },
    };

    expect(isAdmin(auth, principal)).toBe(false);
  });
});

describe("capability checks", () => {
  test("canWriteUsers returns true when principal has capability", () => {
    const auth = createMockAuthService((_, cap) => cap === Capabilities.write_users);
    const principal: Principal = {
      kind: "api_key",
      sessionId: "test",
      displayName: "Test",
      apiKey: "key",
    };

    expect(canWriteUsers(auth, principal)).toBe(true);
  });

  test("canWriteMachines returns true when principal has capability", () => {
    const auth = createMockAuthService((_, cap) => cap === Capabilities.write_machines);
    const principal: Principal = {
      kind: "password",
      sessionId: "test",
      token: "token",
      username: "admin",
    };

    expect(canWriteMachines(auth, principal)).toBe(true);
  });

  test("canWritePolicy returns true when principal has capability", () => {
    const auth = createMockAuthService((_, cap) => cap === Capabilities.write_policy);
    const principal: Principal = {
      kind: "api_key",
      sessionId: "test",
      displayName: "Admin Key",
      apiKey: "key",
    };

    expect(canWritePolicy(auth, principal)).toBe(true);
  });
});

describe("getPrincipalDisplayName", () => {
  test("returns displayName for API key principals", () => {
    const principal: Principal = {
      kind: "api_key",
      sessionId: "test",
      displayName: "Production API Key",
      apiKey: "key",
    };

    expect(getPrincipalDisplayName(principal)).toBe("Production API Key");
  });

  test("returns username for password principals", () => {
    const principal: Principal = {
      kind: "password",
      sessionId: "test",
      token: "token",
      username: "johndoe",
    };

    expect(getPrincipalDisplayName(principal)).toBe("johndoe");
  });

  test("returns name for OIDC principals", () => {
    const principal: Principal = {
      kind: "oidc",
      sessionId: "test",
      user: { id: "1", subject: "sub", role: "admin", headscaleUserId: undefined },
      profile: { name: "John Doe", email: "john@example.com" },
    };

    expect(getPrincipalDisplayName(principal)).toBe("John Doe");
  });

  test("returns 'Unknown User' when no name info available", () => {
    const principal: Principal = {
      kind: "proxy",
      sessionId: "test",
      user: { id: "1", subject: "sub", role: "admin", headscaleUserId: undefined },
      profile: { name: "" },
    };

    expect(getPrincipalDisplayName(principal)).toBe("Unknown User");
  });
});

describe("getAuthMethodName", () => {
  test("returns correct names for each auth method", () => {
    expect(
      getAuthMethodName({ kind: "api_key", sessionId: "t", displayName: "K", apiKey: "k" }),
    ).toBe("API Key");
    expect(getAuthMethodName({ kind: "password", sessionId: "t", token: "t", username: "u" })).toBe(
      "Password",
    );
    expect(
      getAuthMethodName({
        kind: "oidc",
        sessionId: "t",
        user: { id: "1", subject: "s", role: "admin", headscaleUserId: undefined },
        profile: { name: "N" },
      }),
    ).toBe("OIDC");
    expect(
      getAuthMethodName({
        kind: "proxy",
        sessionId: "t",
        user: { id: "1", subject: "s", role: "admin", headscaleUserId: undefined },
        profile: { name: "N" },
      }),
    ).toBe("Proxy Auth");
  });
});

describe("getUnauthorizedMessage", () => {
  test("returns generic message when no principal provided", () => {
    const message = getUnauthorizedMessage();
    expect(message).toContain("Authentication required");
    expect(message).toContain("Please log in");
  });

  test("includes principal details when provided", () => {
    const principal: Principal = {
      kind: "password",
      sessionId: "test",
      token: "token",
      username: "testuser",
    };

    const message = getUnauthorizedMessage(principal);
    expect(message).toContain("Access denied");
    expect(message).toContain("testuser");
    expect(message).toContain("Password");
  });
});

describe("createUnauthorizedResponse", () => {
  test("returns 403 response", () => {
    const response = createUnauthorizedResponse();
    expect(response.status).toBe(403);
    expect(response.statusText).toBe("Forbidden");
  });

  test("uses custom message when provided", async () => {
    const customMessage = "Custom error";
    const response = createUnauthorizedResponse(undefined, customMessage);
    const body = await response.text();
    expect(body).toBe(customMessage);
  });
});
