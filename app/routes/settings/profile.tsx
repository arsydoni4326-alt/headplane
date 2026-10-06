import { Eye, EyeOff, Save } from "lucide-react";
import { useState } from "react";
import { Form, useFetcher } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Input from "~/components/input";
import Notice from "~/components/notice";
import PageError from "~/components/page-error";
import Text from "~/components/text";
import Title from "~/components/title";
import { authContext, headscaleContext } from "~/server/context";
import { isUserPrincipal } from "~/server/web/auth";
import log from "~/utils/log";

import type { Route } from "./+types/profile";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscale = context.get(headscaleContext);

  const principal = await auth.require(request);

  // Get username from session
  const username = isUserPrincipal(principal)
    ? principal.profile.username || principal.profile.name
    : principal.displayName;

  // Fetch current settings from backend
  try {
    const baseUrl = headscale.url;
    const token = await auth.getSessionToken(request);

    const response = await fetch(`${baseUrl}/api/v1/headplane/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      log.error("settings", "Failed to fetch settings: %s", response.statusText);
      return {
        username,
        settings: { username: "", name: "", avatar: "", apiKey: "", theme: "light" },
        error: "Failed to load settings",
      };
    }

    const settings = await response.json();
    return { username, settings, error: null };
  } catch (error) {
    log.error("settings", "Error fetching settings: %s", String(error));
    return {
      username,
      settings: { username: "", name: "", avatar: "", apiKey: "", theme: "light" },
      error: "Failed to connect to server",
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const headscale = context.get(headscaleContext);

  await auth.require(request);

  const formData = await request.formData();
  const actionId = formData.get("action_id");

  const baseUrl = headscale.url;
  const token = await auth.getSessionToken(request);

  if (actionId === "update_settings") {
    const username = formData.get("username")?.toString() || undefined;
    const name = formData.get("name")?.toString() || undefined;
    const avatar = formData.get("avatar")?.toString() || undefined;
    const apiKey = formData.get("api_key")?.toString() || undefined;
    const theme = formData.get("theme")?.toString() || undefined;

    try {
      const body: Record<string, string> = {};
      if (username !== undefined) body.username = username;
      if (name !== undefined) body.name = name;
      if (avatar !== undefined) body.avatar = avatar;
      if (apiKey !== undefined) body.apiKey = apiKey;
      if (theme !== undefined) body.theme = theme;

      const response = await fetch(`${baseUrl}/api/v1/headplane/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        log.error("settings", "Failed to update settings: %s", error);
        return { success: false, error: "Failed to update settings" };
      }

      return { success: true, error: null };
    } catch (error) {
      log.error("settings", "Error updating settings: %s", String(error));
      return { success: false, error: "Failed to connect to server" };
    }
  }

  if (actionId === "change_password") {
    const currentPassword = formData.get("current_password")?.toString();
    const newPassword = formData.get("new_password")?.toString();
    const confirmPassword = formData.get("confirm_password")?.toString();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: "All password fields are required" };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "New passwords do not match" };
    }

    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    try {
      const response = await fetch(`${baseUrl}/api/v1/headplane/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        log.error("settings", "Failed to change password: %s", error);
        return { success: false, error: "Failed to change password. Check your current password." };
      }

      return { success: true, error: null, message: "Password changed successfully" };
    } catch (error) {
      log.error("settings", "Error changing password: %s", String(error));
      return { success: false, error: "Failed to connect to server" };
    }
  }

  return { success: false, error: "Unknown action" };
}

export default function Page({ loaderData, actionData }: Route.ComponentProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const settingsFetcher = useFetcher<typeof action>();
  const passwordFetcher = useFetcher<typeof action>();

  const isSettingsSubmitting = settingsFetcher.state !== "idle";
  const isPasswordSubmitting = passwordFetcher.state !== "idle";

  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <div className="flex w-full flex-col sm:w-2/3">
        <Title>Profile Settings</Title>
        <Text>Manage your personal settings, API key, theme preferences, and password.</Text>
      </div>

      {loaderData.error && (
        <Notice variant="error" title="Error Loading Settings">
          {loaderData.error}
        </Notice>
      )}

      {/* User Info Section */}
      <Card variant="flat">
        <Card.Title>User Information</Card.Title>
        <Card.Text>Your account details and identity.</Card.Text>
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-mist-700 dark:text-mist-300">Username:</span>
            <span className="rounded-md bg-mist-100 px-3 py-1 font-mono text-sm dark:bg-mist-800">
              {loaderData.username}
            </span>
          </div>
        </div>
      </Card>

      {/* Settings Section */}
      <Card variant="flat">
        <Card.Title>Settings</Card.Title>
        <Card.Text>Configure your API key, theme, and display name.</Card.Text>

        {settingsFetcher.data?.success && (
          <Notice variant="success" title="Settings Saved" className="mt-4">
            Your settings have been updated successfully.
          </Notice>
        )}

        {settingsFetcher.data?.error && (
          <Notice variant="error" title="Error" className="mt-4">
            {settingsFetcher.data.error}
          </Notice>
        )}

        <settingsFetcher.Form method="POST" className="mt-6 flex flex-col gap-6">
          <input type="hidden" name="action_id" value="update_settings" />

          {/* Username */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">Username</label>
            <Text className="text-sm">Your administrator username for logging into Headplane.</Text>
            <Input
              name="username"
              type="text"
              placeholder="Enter username"
              defaultValue={loaderData.settings.username}
              required
            />
          </div>

          {/* Display Name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">
              Display Name (Optional)
            </label>
            <Text className="text-sm">
              A friendly name to display in the UI. If not set, your username is shown.
            </Text>
            <Input
              name="name"
              type="text"
              placeholder="Enter display name"
              defaultValue={loaderData.settings.name}
            />
          </div>

          {/* Avatar URL */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">
              Avatar URL (Optional)
            </label>
            <Text className="text-sm">
              A profile picture URL (HTTPS only). Leave empty to use the default avatar.
            </Text>
            <Input
              name="avatar"
              type="url"
              placeholder="https://example.com/avatar.png"
              defaultValue={loaderData.settings.avatar}
            />
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">
              Headscale API Key
            </label>
            <Text className="text-sm">
              Store your Headscale API key to avoid re-entering it at each login. The key is
              encrypted at rest.
            </Text>
            <div className="relative">
              <Input
                name="api_key"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter API key"
                defaultValue={loaderData.settings.apiKey}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">Theme</label>
            <select
              name="theme"
              defaultValue={loaderData.settings.theme}
              className="rounded-md border border-mist-300 bg-white px-3 py-2 text-sm dark:border-mist-700 dark:bg-mist-800"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <Button type="submit" variant="heavy" disabled={isSettingsSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSettingsSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </settingsFetcher.Form>
      </Card>

      {/* Password Change Section */}
      <Card variant="flat">
        <Card.Title>Change Password</Card.Title>
        <Card.Text>Update your Headplane login password.</Card.Text>

        {passwordFetcher.data?.success && (
          <Notice variant="success" title="Password Changed" className="mt-4">
            {passwordFetcher.data.message || "Your password has been changed successfully."}
          </Notice>
        )}

        {passwordFetcher.data?.error && (
          <Notice variant="error" title="Error" className="mt-4">
            {passwordFetcher.data.error}
          </Notice>
        )}

        <passwordFetcher.Form method="POST" className="mt-6 flex flex-col gap-6">
          <input type="hidden" name="action_id" value="change_password" />

          {/* Current Password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">
              Current Password
            </label>
            <div className="relative">
              <Input
                name="current_password"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter current password"
                required
                className="pr-12"
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

          {/* New Password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">
              New Password
            </label>
            <div className="relative">
              <Input
                name="new_password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter new password"
                required
                minLength={8}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-mist-700 dark:text-mist-300">
              Confirm New Password
            </label>
            <div className="relative">
              <Input
                name="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                required
                minLength={8}
                className="pr-12"
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

          <Button type="submit" variant="heavy" disabled={isPasswordSubmitting}>
            {isPasswordSubmitting ? "Changing Password..." : "Change Password"}
          </Button>
        </passwordFetcher.Form>
      </Card>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Profile Settings" />;
}
