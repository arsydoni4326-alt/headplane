import { Eye, EyeOff, Save } from "lucide-react";
import { useState } from "react";
import { Form, useActionData } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Input from "~/components/input";
import Notice from "~/components/notice";
import PageError from "~/components/page-error";
import Select from "~/components/select";
import { appConfigContext, authContext } from "~/server/context";

import type { Route } from "./+types/profile";

interface HeadplaneSettings {
  apiKey?: string;
  theme: "light" | "dark" | "system";
  profileName?: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const principal = await auth.require(request);

  // Only password-authenticated users can access settings
  if (principal.kind !== "password") {
    throw new Response("Settings are only available for password-authenticated users", {
      status: 403,
    });
  }

  // Fetch settings from backend
  const sessionToken = principal.token;
  const headscaleUrl = config.headscale.url;

  try {
    const response = await fetch(`${headscaleUrl}/api/v1/headplane/settings`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (response.ok) {
      const settings = (await response.json()) as HeadplaneSettings;
      return { settings, sessionToken };
    }

    // Settings not found - return defaults
    if (response.status === 404) {
      return {
        settings: { theme: "system" as const },
        sessionToken,
      };
    }

    throw new Error(`Failed to load settings: ${response.statusText}`);
  } catch (error) {
    console.error("Error loading settings:", error);
    return {
      settings: { theme: "system" as const },
      sessionToken,
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const principal = await auth.require(request);

  if (principal.kind !== "password") {
    return {
      success: false,
      message: "Settings are only available for password-authenticated users",
    };
  }

  const formData = await request.formData();
  const actionType = formData.get("_action");
  const sessionToken = principal.token;
  const headscaleUrl = config.headscale.url;

  if (actionType === "update_settings") {
    const apiKey = formData.get("apiKey") as string | null;
    const theme = formData.get("theme") as string;
    const profileName = formData.get("profileName") as string | null;

    try {
      const response = await fetch(`${headscaleUrl}/api/v1/headplane/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          theme,
          profileName: profileName || undefined,
        }),
      });

      if (response.ok) {
        return { success: true, message: "Settings saved successfully", type: "settings" };
      }

      const error = await response.text();
      return { success: false, message: `Failed to save settings: ${error}`, type: "settings" };
    } catch (error) {
      return {
        success: false,
        message: `Error saving settings: ${String(error)}`,
        type: "settings",
      };
    }
  }

  if (actionType === "change_password") {
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      return {
        success: false,
        message: "New passwords do not match",
        type: "password",
      };
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        message: "New password must be at least 8 characters long",
        type: "password",
      };
    }

    try {
      const response = await fetch(`${headscaleUrl}/api/v1/headplane/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: "Password changed successfully. Please log in again.",
          type: "password",
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          message: "Current password is incorrect",
          type: "password",
        };
      }

      const error = await response.text();
      return { success: false, message: `Failed to change password: ${error}`, type: "password" };
    } catch (error) {
      return {
        success: false,
        message: `Error changing password: ${String(error)}`,
        type: "password",
      };
    }
  }

  return { success: false, message: "Invalid action", type: "unknown" };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { settings } = loaderData;
  const actionData = useActionData<typeof action>();

  const [showApiKey, setShowApiKey] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Profile & Settings</h1>
        <p>
          Manage your Headplane preferences, API key storage, and account security. Your API key is
          encrypted at rest and used to authenticate with Headscale.
        </p>
      </div>

      {/* Settings Form */}
      <Card className="w-full sm:w-2/3" variant="flat">
        <Card.Title>User Preferences</Card.Title>
        <Card.Text>
          Save your Headscale API key and customize your profile. The API key will be stored
          securely and reused across sessions.
        </Card.Text>

        {actionData?.type === "settings" && (
          <Notice
            className="mt-4"
            variant={actionData.success ? "success" : "error"}
            title={actionData.success ? "Success" : "Error"}
          >
            {actionData.message}
          </Notice>
        )}

        <Form method="POST" className="mt-6 space-y-6">
          <input type="hidden" name="_action" value="update_settings" />

          <div>
            <label htmlFor="profileName" className="mb-2 block text-sm font-medium">
              Profile Name
            </label>
            <Input
              id="profileName"
              name="profileName"
              placeholder="Your name"
              defaultValue={settings.profileName || ""}
            />
            <p className="mt-1 text-sm text-mist-600 dark:text-mist-400">
              Optional display name for your profile
            </p>
          </div>

          <div>
            <label htmlFor="apiKey" className="mb-2 block text-sm font-medium">
              Headscale API Key
            </label>
            <div className="relative">
              <Input
                id="apiKey"
                name="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="hskey-..."
                defaultValue={settings.apiKey || ""}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-sm text-mist-600 dark:text-mist-400">
              Generate an API key with: <code className="text-xs">headscale apikeys create</code>
            </p>
          </div>

          <div>
            <label htmlFor="theme" className="mb-2 block text-sm font-medium">
              Theme
            </label>
            <Select id="theme" name="theme" defaultValue={settings.theme || "system"}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
            <p className="mt-1 text-sm text-mist-600 dark:text-mist-400">
              Choose your preferred color scheme
            </p>
          </div>

          <Button type="submit" variant="heavy" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </Form>
      </Card>

      {/* Password Change Form */}
      <Card className="w-full sm:w-2/3" variant="flat">
        <Card.Title>Change Password</Card.Title>
        <Card.Text>
          Update your Headplane login password. You will need to log in again after changing your
          password.
        </Card.Text>

        {actionData?.type === "password" && (
          <Notice
            className="mt-4"
            variant={actionData.success ? "success" : "error"}
            title={actionData.success ? "Success" : "Error"}
          >
            {actionData.message}
          </Notice>
        )}

        <Form method="POST" className="mt-6 space-y-6">
          <input type="hidden" name="_action" value="change_password" />

          <div>
            <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium">
              Current Password
            </label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                required
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="mb-2 block text-sm font-medium">
              New Password
            </label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-sm text-mist-600 dark:text-mist-400">
              Must be at least 8 characters long
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
              Confirm New Password
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="heavy">
            Change Password
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Profile & Settings" />;
}
