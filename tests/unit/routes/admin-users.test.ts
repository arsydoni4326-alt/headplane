import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock("~/server/auth/bcrypt-utils", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("~/server/config/write", () => ({ updateConfig: mocks.updateConfig }));

import { action, loader } from "~/routes/admin/admin/users/route";
import { appConfigContext, authContext, localAdminContext } from "~/server/context";
import type { Principal } from "~/server/web/auth";

const principal: Principal = {
  kind: "password",
  sessionId: "password-session",
  token: "local-admin-token",
  username: "admin",
};

function createServices(overrides: { admin?: boolean; username?: string; user?: object } = {}) {
  const username = overrides.username ?? "admin";
  const auth = {
    require: vi.fn().mockResolvedValue(principal),
    can: vi.fn().mockReturnValue(overrides.admin ?? true),
    destroySession: vi.fn().mockResolvedValue("_hp_auth=; Max-Age=0"),
    invalidatePasswordSessions: vi.fn().mockResolvedValue(1),
  };
  const localAdmin = {
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    getUsername: vi.fn().mockReturnValue(username),
    updateCredentials: vi.fn(),
  };
  const config = {
    user: overrides.user ?? {
      username,
      password: "$2b$12$01234567890123456789012345678901234567890123456789012",
    },
  };

  return { auth, config, localAdmin };
}

function createContext(services: ReturnType<typeof createServices>) {
  return {
    get(context: unknown) {
      if (context === authContext) return services.auth;
      if (context === appConfigContext) return services.config;
      if (context === localAdminContext)
        return { state: "enabled" as const, value: services.localAdmin };
      return undefined;
    },
  };
}

function profileRequest(fields: Record<string, string>) {
  const form = new FormData();
  form.set("_action", "update-profile");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return new Request("http://headplane.test/admin/admin/users", { method: "POST", body: form });
}

function passwordRequest(fields: Record<string, string>) {
  const form = new FormData();
  form.set("_action", "change-password");
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return new Request("http://headplane.test/admin/admin/users", { method: "POST", body: form });
}

describe("admin profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HEADPLANE_CONFIG_PATH", "/test/headplane.yaml");
    mocks.updateConfig.mockResolvedValue("/test/headplane.yaml.backup");
    mocks.hashPassword.mockResolvedValue(
      "$2b$12$01234567890123456789012345678901234567890123456789012",
    );
  });

  test("loads editable empty optional profile fields", async () => {
    const services = createServices({ user: undefined });

    const result = await loader({
      request: new Request("http://headplane.test/admin/admin/users"),
      context: createContext(services),
      params: {},
    } as never);

    expect(result).toEqual({ profile: { username: "admin", name: "", avatar: "" } });
  });

  test("rejects an insecure avatar URL before updating the configuration", async () => {
    const services = createServices();

    const result = await action({
      request: profileRequest({ username: "admin", avatar: "http://example.com/avatar.png" }),
      context: createContext(services),
      params: {},
    } as never);

    expect(result).toMatchObject({ success: false, error: "Avatar URL must use HTTPS" });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  test("persists profile values and clears optional fields", async () => {
    const services = createServices();

    const result = await action({
      request: profileRequest({ username: "admin", name: "", avatar: "" }),
      context: createContext(services),
      params: {},
    } as never);

    expect(result).toMatchObject({ success: true, actionType: "update-profile" });
    expect(mocks.updateConfig).toHaveBeenCalledWith(
      "/test/headplane.yaml",
      { user: { username: "admin", name: undefined, avatar: undefined } },
      { backup: true },
    );
    expect(services.localAdmin.updateCredentials).toHaveBeenCalledWith({ username: "admin" });
    expect(services.auth.invalidatePasswordSessions).not.toHaveBeenCalled();
    expect(services.config.user).toMatchObject({ username: "admin" });
    expect(services.config.user).not.toHaveProperty("name");
    expect(services.config.user).not.toHaveProperty("avatar");
  });

  test("invalidates password sessions when the username changes", async () => {
    const services = createServices();

    const result = await action({
      request: profileRequest({ username: "operator", name: "Operator" }),
      context: createContext(services),
      params: {},
    } as never);

    expect(result).toMatchObject({
      type: "DataWithResponseInit",
      data: { success: true, requiresLogout: true },
      init: { headers: { "Set-Cookie": "_hp_auth=; Max-Age=0" } },
    });
    expect(services.auth.invalidatePasswordSessions).toHaveBeenCalledOnce();
    expect(services.auth.destroySession).toHaveBeenCalledOnce();
    expect(services.localAdmin.updateCredentials).toHaveBeenCalledWith({ username: "operator" });
  });

  test("updates the bcrypt password and invalidates password sessions", async () => {
    const services = createServices();

    const result = await action({
      request: passwordRequest({
        current_password: "current-password",
        new_password: "new-password",
        confirm_password: "new-password",
      }),
      context: createContext(services),
      params: {},
    } as never);

    expect(services.localAdmin.authenticate).toHaveBeenCalledWith("admin", "current-password");
    expect(mocks.hashPassword).toHaveBeenCalledWith("new-password");
    expect(mocks.updateConfig).toHaveBeenCalledWith(
      "/test/headplane.yaml",
      { user: { password: "$2b$12$01234567890123456789012345678901234567890123456789012" } },
      { backup: true },
    );
    expect(services.localAdmin.updateCredentials).toHaveBeenCalledWith({
      passwordHash: "$2b$12$01234567890123456789012345678901234567890123456789012",
    });
    expect(services.auth.invalidatePasswordSessions).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      type: "DataWithResponseInit",
      data: { success: true, actionType: "change-password", requiresLogout: true },
      init: { headers: { "Set-Cookie": "_hp_auth=; Max-Age=0" } },
    });
  });

  test("requires the current password before a password update", async () => {
    const services = createServices();
    services.localAdmin.authenticate.mockResolvedValue({ success: false });

    const result = await action({
      request: passwordRequest({
        current_password: "incorrect",
        new_password: "new-password",
        confirm_password: "new-password",
      }),
      context: createContext(services),
      params: {},
    } as never);

    expect(result).toMatchObject({ success: false, error: "Current password is incorrect" });
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  test("rejects non-administrators", async () => {
    const services = createServices({ admin: false });

    await expect(
      loader({
        request: new Request("http://headplane.test/admin/admin/users"),
        context: createContext(services),
        params: {},
      } as never),
    ).rejects.toMatchObject({ status: 403 });
  });
});
