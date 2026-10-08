import { useState } from "react";
import { Form, redirect, Link } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Notice from "~/components/notice";
import { actorFromPrincipal } from "~/server/audit";
import {
  authContext,
  localAdminContext,
  headscaleContext,
  auditContext,
  headscaleApiKeyContext,
} from "~/server/context";
import { isAdmin, createUnauthorizedResponse } from "~/utils/auth";
import log from "~/utils/log";

import type { Route } from "./+types/route";
import ApiKeyManagement from "./components/api-key-management";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const localAdmin = context.get(localAdminContext);
  const headscale = context.get(headscaleContext);
  const configuredApiKey = context.get(headscaleApiKeyContext);
  const principal = await auth.require(request);

  if (!isAdmin(auth, principal)) {
    throw createUnauthorizedResponse(
      principal,
      "You do not have permission to access administration. Only administrators can access this page.",
    );
  }

  // Only allow access in single-admin mode
  if (localAdmin.state !== "enabled") {
    throw new Response("Administration is only available in single local administrator mode", {
      status: 403,
    });
  }

  const authToken = auth.getHeadscaleApiKey(principal);

  // Fetch API keys server-side
  let apiKeys: any[] = [];
  if (authToken) {
    try {
      apiKeys = await headscale.client(authToken).apiKeys.list();
    } catch (error) {
      log.error("api", "Failed to load API keys: %s", String(error));
    }
  }

  return {
    username: localAdmin.value.getUsername(),
    configuredApiKeyPrefix: configuredApiKey?.slice(0, 8),
    apiKeys,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const localAdmin = context.get(localAdminContext);
  const headscale = context.get(headscaleContext);
  const audit = context.get(auditContext);
  const configuredApiKey = context.get(headscaleApiKeyContext);
  const principal = await auth.require(request);

  if (!isAdmin(auth, principal)) {
    throw createUnauthorizedResponse(principal, "Insufficient permissions.");
  }

  if (localAdmin.state !== "enabled") {
    return { success: false, error: "Single-admin mode not active" };
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  if (actionType === "reset-password") {
    return await handlePasswordReset(formData, localAdmin, auth);
  }

  if (actionType === "create-apikey") {
    return await handleCreateApiKey(formData, headscale, audit, auth, principal, request);
  }

  if (actionType === "delete-apikey") {
    return await handleDeleteApiKey(formData, headscale, audit, auth, principal, configuredApiKey);
  }

  return { success: false, error: "Unknown action" };
}

async function handlePasswordReset(formData: FormData, localAdmin: any, auth: any) {
  const currentPassword = formData.get("current_password") as string;
  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "New passwords do not match" };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters" };
  }

  // Verify current password
  const result = await localAdmin.value.authenticate(
    localAdmin.value.getUsername(),
    currentPassword,
  );
  if (!result.success) {
    return { success: false, error: "Current password is incorrect" };
  }

  // Hash new password
  const { hashPassword } = await import("~/server/auth/bcrypt-utils");
  const newHash = await hashPassword(newPassword);

  // Atomically update config file
  try {
    const { dump, load } = await import("js-yaml");
    const { readFile, writeFile, rename, open } = await import("node:fs/promises");

    // Check if we have a config path (not environment-only mode)
    const configPath = process.env.HEADPLANE_CONFIG_PATH;
    if (!configPath) {
      return {
        success: false,
        error: "Config is environment-only. Use CLI tool: headplane reset-local-admin-password",
      };
    }

    // Read and update config
    const configContent = await readFile(configPath, "utf8");
    const config = load(configContent) as any;

    if (!config.user) {
      config.user = {};
    }
    config.user.password = newHash;

    const yaml = dump(config);
    const tmpPath = `${configPath}.tmp`;

    // Write to temp file with restrictive permissions
    await writeFile(tmpPath, yaml, { mode: 0o600 });

    // Fsync to ensure durability
    const fd = await open(tmpPath, "r+");
    await fd.datasync();
    await fd.close();

    // Atomic rename
    await rename(tmpPath, configPath);

    // Invalidate all password sessions to force re-login
    await auth.invalidatePasswordSessions();

    // Redirect to login with success message
    return redirect("/login?message=password-reset-success");
  } catch (error: any) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      return {
        success: false,
        error: "Config file is read-only. Use CLI tool: headplane reset-local-admin-password",
      };
    }
    console.error("Error updating config:", error);
    return { success: false, error: "Failed to update password. See server logs for details." };
  }
}

async function handleCreateApiKey(
  formData: FormData,
  headscale: any,
  audit: any,
  auth: any,
  principal: any,
  _request: Request,
) {
  const expirationDays = Number(formData.get("expiration_days"));

  if (!expirationDays || expirationDays < 1) {
    return { success: false, error: "Invalid expiration days" };
  }

  const authToken = auth.getHeadscaleApiKey(principal);
  if (!authToken) {
    return { success: false, error: "No API key available" };
  }

  try {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + expirationDays);

    const result = await headscale.client(authToken).apiKeys.create(expiration);
    const actor = actorFromPrincipal(principal);

    await audit.record({
      ...actor,
      action: "apikey.create",
      resourceType: "apikey",
      details: { expiration: expiration.toISOString() },
    });

    log.info(
      "api",
      "API key created by %s, expires: %s",
      actor.actorName,
      expiration.toISOString(),
    );

    return { success: true, apiKey: result.apiKey };
  } catch (error) {
    log.error("api", "Failed to create API key: %s", String(error));
    const actor = actorFromPrincipal(principal);

    await audit.record({
      ...actor,
      action: "apikey.create",
      resourceType: "apikey",
      details: { error: String(error), success: false },
    });

    return { success: false, error: "Failed to create API key" };
  }
}

async function handleDeleteApiKey(
  formData: FormData,
  headscale: any,
  audit: any,
  auth: any,
  principal: any,
  configuredApiKey: string | undefined,
) {
  const prefix = formData.get("prefix") as string;

  if (!prefix) {
    return { success: false, error: "Missing prefix" };
  }

  if (configuredApiKey?.startsWith(prefix.replaceAll("*", ""))) {
    return { success: false, error: "Cannot delete configured service key" };
  }

  const authToken = auth.getHeadscaleApiKey(principal);
  if (!authToken) {
    return { success: false, error: "No API key available" };
  }

  try {
    await headscale.client(authToken).apiKeys.delete(prefix);
    const actor = actorFromPrincipal(principal);

    await audit.record({
      ...actor,
      action: "apikey.delete",
      resourceType: "apikey",
      resourceId: prefix,
    });

    log.info("api", "API key deleted by %s, prefix: %s", actor.actorName, prefix);

    // Check if user deleted their own session key
    if (authToken.startsWith(prefix.replace(/\*/g, ""))) {
      return redirect("/logout");
    }

    return { success: true };
  } catch (error) {
    log.error("api", "Failed to delete API key: %s", String(error));
    const actor = actorFromPrincipal(principal);

    await audit.record({
      ...actor,
      action: "apikey.delete",
      resourceType: "apikey",
      resourceId: prefix,
      details: { error: String(error), success: false },
    });

    return { success: false, error: "Failed to delete API key" };
  }
}

export default function AdminRoute({ loaderData, actionData }: Route.ComponentProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="mt-1 text-sm text-mist-600 dark:text-mist-300">
            Manage your local administrator account and API keys
          </p>
        </div>
        <Link to="/admin/admin/users">
          <Button variant="light">Edit Profile</Button>
        </Link>
      </div>

      <Notice title="Single Local Administrator Mode" variant="default">
        Headplane is configured for one local administrator. User management is not available in
        this mode.
      </Notice>

      <Card className="mt-6 w-full max-w-none">
        <Card.Title>Reset Password</Card.Title>
        <Card.Text>
          Change your administrator password. You will be logged out after resetting your password.
        </Card.Text>

        <Form method="post" className="mt-6 space-y-4">
          <input type="hidden" name="_action" value="reset-password" />

          {actionData && !actionData.success && <Notice variant="error">{actionData.error}</Notice>}

          <div>
            <label htmlFor="current_password" className="mb-1 block text-sm font-medium">
              Current Password
            </label>
            <input
              type="password"
              id="current_password"
              name="current_password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm dark:border-mist-800 dark:bg-mist-900"
            />
          </div>

          <div>
            <label htmlFor="new_password" className="mb-1 block text-sm font-medium">
              New Password
            </label>
            <input
              type="password"
              id="new_password"
              name="new_password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm dark:border-mist-800 dark:bg-mist-900"
            />
            <p className="mt-1 text-xs text-mist-600 dark:text-mist-400">Minimum 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirm_password" className="mb-1 block text-sm font-medium">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirm_password"
              name="confirm_password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm dark:border-mist-800 dark:bg-mist-900"
            />
          </div>

          <Button type="submit" variant="heavy">
            Reset Password
          </Button>
        </Form>
      </Card>

      <ApiKeyManagement
        configuredApiKeyPrefix={loaderData.configuredApiKeyPrefix}
        apiKeys={loaderData.apiKeys}
      />
    </>
  );
}
