import { useState } from "react";
import { Form, redirect } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Notice from "~/components/notice";
import { appConfigContext, authContext, localAdminContext } from "~/server/context";
import { isAdmin, createUnauthorizedResponse } from "~/utils/auth";

import type { Route } from "./+types/route";
import ApiKeyManagement from "./components/api-key-management";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const localAdmin = context.get(localAdminContext);
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

  return {
    username: localAdmin.value.getUsername(),
    authToken,
    headscaleUrl: config.headscale.url,
    configuredApiKey: config.headscale.api_key,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const localAdmin = context.get(localAdminContext);
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
        authToken={loaderData.authToken}
        headscaleUrl={loaderData.headscaleUrl}
        configuredApiKey={loaderData.configuredApiKey}
      />
    </>
  );
}
