import { describe, expect, test, vi } from "vitest";

import { authContext, headscaleContext, localAdminContext } from "~/server/context";

function passwordRequest(username: string, password: string): Request {
  const formData = new FormData();
  formData.set("username", username);
  formData.set("password", password);
  return new Request("http://headplane.test/login", { method: "POST", body: formData });
}

function createContext({
  auth,
  localAdmin,
}: {
  auth: { createPasswordSession: ReturnType<typeof vi.fn> };
  localAdmin?: {
    state: "enabled";
    value: { authenticate: ReturnType<typeof vi.fn> };
  };
}) {
  return {
    get(context: unknown) {
      if (context === authContext) return auth;
      if (context === headscaleContext) return {};
      if (context === localAdminContext) {
        return localAdmin ?? { state: "disabled" as const, reason: "Not configured" };
      }
      return undefined;
    },
  };
}

vi.mock("~/utils/log", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("password login action", () => {
  test("rejects an empty username", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");

    const result = await loginAction({
      request: passwordRequest("", "some-password"),
      context: createContext({ auth: { createPasswordSession: vi.fn() } }),
      params: {},
    } as never);

    expect(result).toMatchObject({
      success: false,
      message: "Username cannot be empty. Please enter a valid username.",
    });
  });

  test("rejects an empty password", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");

    const result = await loginAction({
      request: passwordRequest("admin", ""),
      context: createContext({ auth: { createPasswordSession: vi.fn() } }),
      params: {},
    } as never);

    expect(result).toMatchObject({
      success: false,
      message: "Password cannot be empty. Please enter a valid password.",
    });
  });

  test("returns the local administrator authentication error", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const authenticate = vi.fn().mockResolvedValue({
      success: false,
      error: "Invalid username or password",
    });

    const result = await loginAction({
      request: passwordRequest("admin", "incorrect-password"),
      context: createContext({
        auth: { createPasswordSession: vi.fn() },
        localAdmin: { state: "enabled", value: { authenticate } },
      }),
      params: {},
    } as never);

    expect(authenticate).toHaveBeenCalledWith("admin", "incorrect-password");
    expect(result).toMatchObject({ success: false, message: "Invalid username or password" });
  });

  test("returns the local administrator rate-limit error", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const authenticate = vi.fn().mockResolvedValue({
      success: false,
      error: "Too many failed attempts. Please try again later.",
    });

    const result = await loginAction({
      request: passwordRequest("admin", "some-password"),
      context: createContext({
        auth: { createPasswordSession: vi.fn() },
        localAdmin: { state: "enabled", value: { authenticate } },
      }),
      params: {},
    } as never);

    expect(result).toMatchObject({
      success: false,
      message: "Too many failed attempts. Please try again later.",
    });
  });

  test("rejects password login when no local administrator is configured", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");

    const result = await loginAction({
      request: passwordRequest("admin", "some-password"),
      context: createContext({ auth: { createPasswordSession: vi.fn() } }),
      params: {},
    } as never);

    expect(result).toMatchObject({
      success: false,
      message: "Password authentication is not available",
    });
  });

  test("creates a password session after local administrator authentication", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const authenticate = vi.fn().mockResolvedValue({ success: true });
    const createPasswordSession = vi.fn().mockResolvedValue("password-session-cookie");

    const result = await loginAction({
      request: passwordRequest("admin", "valid-password"),
      context: createContext({
        auth: { createPasswordSession },
        localAdmin: { state: "enabled", value: { authenticate } },
      }),
      params: {},
    } as never);

    expect(authenticate).toHaveBeenCalledWith("admin", "valid-password");
    expect(createPasswordSession).toHaveBeenCalledWith("local-admin-token", "admin", 86_400_000);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/machines");
    expect((result as Response).headers.get("Set-Cookie")).toBe("password-session-cookie");
  });
});
