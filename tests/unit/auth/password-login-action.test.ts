import { describe, expect, test, vi } from "vitest";

import { authContext, headscaleContext, localAdminContext } from "~/server/context";

// Helper to create a mock FormData with username and password
function mockPasswordFormData(username: string, password: string): FormData {
  const formData = new FormData();
  formData.set("username", username);
  formData.set("password", password);
  return formData;
}

// Helper to create mock request
function mockRequest(formData: FormData): Request {
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as Request;
}

// Types for test clarity
interface LoginResult {
  success: boolean;
  message: string;
}

interface MockHeadscale {
  passwordLogin: ReturnType<typeof vi.fn>;
}

interface MockAuth {
  createPasswordSession: ReturnType<typeof vi.fn>;
}

interface MockLocalAdmin {
  state: "enabled" | "disabled";
  value?: {
    authenticate: ReturnType<typeof vi.fn>;
  };
  reason?: string;
}

// React Router 7 provides context values through context.get(contextKey).
function createMockContext({
  headscale,
  auth,
  localAdmin,
}: {
  headscale: MockHeadscale;
  auth: MockAuth;
  localAdmin?: MockLocalAdmin;
}) {
  return {
    get: (context: typeof authContext | typeof headscaleContext | typeof localAdminContext) => {
      if (context === authContext) return auth;
      if (context === headscaleContext) return headscale;
      if (context === localAdminContext) {
        return localAdmin || { state: "disabled", reason: "Not configured" };
      }
      return undefined;
    },
  };
}

// Mock the log module to avoid console spam during tests
vi.mock("~/utils/log", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Password login action", () => {
  test("returns error when username is empty string", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockPasswordFormData("", "some-password");
    const request = mockRequest(formData);

    const mockContext = createMockContext({
      headscale: { passwordLogin: vi.fn() },
      auth: { createPasswordSession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("Username cannot be empty");
  });

  test("returns error when password is empty string", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockPasswordFormData("testuser", "");
    const request = mockRequest(formData);

    const mockContext = createMockContext({
      headscale: { passwordLogin: vi.fn() },
      auth: { createPasswordSession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("Password cannot be empty");
  });

  test("returns error when credentials are invalid (401)", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockPasswordFormData("testuser", "wrong-password");
    const request = mockRequest(formData);

    const mockPasswordLogin = vi.fn().mockRejectedValue({
      data: {
        requestUrl: "POST /api/v1/headplane/login",
        statusCode: 401,
        rawData: "Unauthorized",
        data: null,
      },
    });

    const mockContext = createMockContext({
      headscale: { passwordLogin: mockPasswordLogin },
      auth: { createPasswordSession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid password");
  });

  test("returns error when rate limited (429)", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockPasswordFormData("testuser", "some-password");
    const request = mockRequest(formData);

    const mockPasswordLogin = vi.fn().mockRejectedValue({
      data: {
        requestUrl: "POST /api/v1/headplane/login",
        statusCode: 429,
        rawData: "Too Many Requests",
        data: null,
      },
    });

    const mockContext = createMockContext({
      headscale: { passwordLogin: mockPasswordLogin },
      auth: { createPasswordSession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many failed attempts");
  });

  test("returns error when password auth not configured (503)", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockPasswordFormData("testuser", "some-password");
    const request = mockRequest(formData);

    const mockPasswordLogin = vi.fn().mockRejectedValue({
      data: {
        requestUrl: "POST /api/v1/headplane/login",
        statusCode: 503,
        rawData: "Service Unavailable",
        data: null,
      },
    });

    const mockContext = createMockContext({
      headscale: { passwordLogin: mockPasswordLogin },
      auth: { createPasswordSession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("not configured");
  });

  test("successfully logs in with valid username and password", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockPasswordFormData("testuser", "valid-password");
    const request = mockRequest(formData);

    const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
    const mockPasswordLogin = vi.fn().mockResolvedValue({
      token: "mock-session-token-12345",
      username: "testuser",
      expires_at: futureTimestamp,
    });

    const mockCreateSession = vi.fn().mockResolvedValue("session-cookie");

    const mockContext = createMockContext({
      headscale: { passwordLogin: mockPasswordLogin },
      auth: { createPasswordSession: mockCreateSession },
    });

    const result = await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any);

    expect(result).toBeDefined();
    expect(mockPasswordLogin).toHaveBeenCalledWith("testuser", "valid-password");
    expect(mockCreateSession).toHaveBeenCalledWith(
      "mock-session-token-12345",
      "testuser",
      expect.any(Number),
    );
  });
});
