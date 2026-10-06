import { Eye, EyeOff, Save, User } from "lucide-react";
import { useState, useEffect } from "react";
import { Form, useActionData } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import Notice from "~/components/notice";
import PageError from "~/components/page-error";
import { appConfigContext, authContext, localAdminContext } from "~/server/context";
import { isAdmin, createUnauthorizedResponse } from "~/utils/auth";
import log from "~/utils/log";

import type { Route } from "./+types/route";

interface ProfileSettings {
  username: string;
  name?: string;
  avatar?: string;
  theme?: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const localAdmin = context.get(localAdminContext);
  const principal = await auth.require(request);

  // Admin-only access
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

  // Fetch current profile settings from backend
  try {
    const baseUrl = config.headscale.url;
    const token = auth.getHeadscaleApiKey(principal);

    const response = await fetch(`${baseUrl}/api/v1/headplane/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      log.error("profile", "Failed to fetch profile settings: %s", response.statusText);
      return {
        profile: {
          username: localAdmin.value.getUsername(),
          name: "",
          avatar: "",
          theme: "light",
        },
        loadError: "Failed to load profile settings",
      };
    }

    const settings = (await response.json()) as ProfileSettings;
    return {
      profile: {
        username: settings.username || localAdmin.value.getUsername(),
        name: settings.name || "",
        avatar: settings.avatar || "",
        theme: settings.theme || "light",
      },
      loadError: null,
    };
  } catch (error) {
    log.error("profile", "Error fetching profile settings: %s", String(error));
    return {
      profile: {
        username: localAdmin.value.getUsername(),
        name: "",
        avatar: "",
        theme: "light",
      },
      loadError: "Failed to connect to server",
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const localAdmin = context.get(localAdminContext);
  const principal = await auth.require(request);

  if (!isAdmin(auth, principal)) {
    throw createUnauthorizedResponse(principal, "Insufficient permissions.");
  }

  if (localAdmin.state !== "enabled") {
    return { success: false, error: "Single-admin mode not active", actionType: null };
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  const baseUrl = config.headscale.url;
  const token = auth.getHeadscaleApiKey(principal);

  if (actionType === "update-profile") {
    return await handleProfileUpdate(formData, baseUrl, token);
  }

  if (actionType === "change-password") {
    return await handlePasswordChange(formData, localAdmin);
  }

  return { success: false, error: "Unknown action", actionType: null };
}

async function handleProfileUpdate(formData: FormData, baseUrl: string, token: string) {
  const username = formData.get("username")?.toString()?.trim();
  const name = formData.get("name")?.toString()?.trim();
  const avatar = formData.get("avatar")?.toString()?.trim();

  // Validation
  if (!username) {
    return {
      success: false,
      error: "Username is required",
      actionType: "update-profile",
    };
  }

  // Avatar must be HTTPS or empty
  if (avatar && !avatar.startsWith("https://")) {
    return {
      success: false,
      error: "Avatar URL must use HTTPS",
      actionType: "update-profile",
    };
  }

  try {
    const body: Record<string, string> = { username };
    if (name) body.name = name;
    if (avatar) body.avatar = avatar;

    const response = await fetch(`${baseUrl}/api/v1/headplane/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("profile", "Failed to update profile: %s", errorText);
      return {
        success: false,
        error: "Failed to update profile",
        actionType: "update-profile",
      };
    }

    return {
      success: true,
      message: "Profile updated successfully",
      actionType: "update-profile",
    };
  } catch (error) {
    log.error("profile", "Error updating profile: %s", String(error));
    return {
      success: false,
      error: "Failed to connect to server",
      actionType: "update-profile",
    };
  }
}

async function handlePasswordChange(formData: FormData, localAdmin: any) {
  const currentPassword = formData.get("current_password")?.toString();
  const newPassword = formData.get("new_password")?.toString();
  const confirmPassword = formData.get("confirm_password")?.toString();

  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      success: false,
      error: "All password fields are required",
      actionType: "change-password",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      success: false,
      error: "New passwords do not match",
      actionType: "change-password",
    };
  }

  if (newPassword.length < 8) {
    return {
      success: false,
      error: "New password must be at least 8 characters",
      actionType: "change-password",
    };
  }

  // Verify current password
  const result = await localAdmin.value.authenticate(
    localAdmin.value.getUsername(),
    currentPassword,
  );

  if (!result.success) {
    return {
      success: false,
      error: "Current password is incorrect",
      actionType: "change-password",
    };
  }

  // Hash new password and update config
  try {
    const { hashPassword } = await import("~/server/auth/bcrypt-utils");
    const newHash = await hashPassword(newPassword);

    const { dump, load } = await import("js-yaml");
    const { readFile, writeFile, rename, open } = await import("node:fs/promises");

    const configPath = localAdmin.value.configPath;
    const configYaml = await readFile(configPath, "utf-8");
    const config = load(configYaml) as any;

    // Update password hash
    config.headplane = config.headplane || {};
    config.headplane.password = newHash;

    // Atomic write
    const tempPath = `${configPath}.tmp`;
    await writeFile(tempPath, dump(config), "utf-8");

    const fd = await open(tempPath, "r+");
    await fd.sync();
    await fd.close();

    await rename(tempPath, configPath);

    return {
      success: true,
      message: "Password changed successfully. Please log in again.",
      actionType: "change-password",
      requiresLogout: true,
    };
  } catch (error) {
    log.error("profile", "Error changing password: %s", String(error));
    return {
      success: false,
      error: "Failed to update password",
      actionType: "change-password",
    };
  }
}

export default function AdminUsersProfileRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  // Form state
  const [username, setUsername] = useState(loaderData.profile.username);
  const [name, setName] = useState(loaderData.profile.name);
  const [avatar, setAvatar] = useState(loaderData.profile.avatar);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  // Handle action responses
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setModalMessage(actionData.message || "Operation successful");
        setShowSuccessModal(true);

        // Clear password fields after successful password change
        if (actionData.actionType === "change-password") {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");

          // Redirect to login if logout required
          if (actionData.requiresLogout) {
            setTimeout(() => {
              window.location.href = "/auth/login/logout";
            }, 2000);
          }
        }
      } else if (actionData.error) {
        setModalMessage(actionData.error);
        setShowErrorModal(true);
      }
    }
  }, [actionData]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Profile</h1>
          <p className="mt-1 text-sm text-mist-600 dark:text-mist-300">
            Manage your profile information and password
          </p>
        </div>
      </div>

      {loaderData.loadError && (
        <Notice variant="error" className="mb-6">
          {loaderData.loadError}
        </Notice>
      )}

      {/* Profile Information Card */}
      <Card className="mb-6 max-w-2xl">
        <Card.Title>Profile Information</Card.Title>
        <Card.Text>Update your username, display name, and avatar.</Card.Text>

        <Form method="post" className="mt-6 space-y-4">
          <input type="hidden" name="_action" value="update-profile" />

          <Input
            label="Username"
            name="username"
            type="text"
            value={username}
            onChange={setUsername}
            required
            description="Your login username"
          />

          <Input
            label="Display Name"
            name="name"
            type="text"
            value={name}
            onChange={setName}
            description="Optional display name"
          />

          <Input
            label="Avatar URL"
            name="avatar"
            type="url"
            value={avatar}
            onChange={setAvatar}
            description="HTTPS URL to your avatar image"
          />

          <Button type="submit" variant="heavy">
            <Save className="h-4 w-4" />
            Save Profile
          </Button>
        </Form>
      </Card>

      {/* Password Change Card */}
      <Card className="max-w-2xl">
        <Card.Title>Change Password</Card.Title>
        <Card.Text>
          Update your password. You will be logged out after changing your password.
        </Card.Text>

        <Form method="post" className="mt-6 space-y-4">
          <input type="hidden" name="_action" value="change-password" />

          <div>
            <label htmlFor="current_password" className="mb-1 block text-sm font-medium">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                id="current_password"
                name="current_password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-md border border-mist-200 bg-white px-3 py-2 pr-10 text-sm dark:border-mist-800 dark:bg-mist-900"
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
            <label htmlFor="new_password" className="mb-1 block text-sm font-medium">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                id="new_password"
                name="new_password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full rounded-md border border-mist-200 bg-white px-3 py-2 pr-10 text-sm dark:border-mist-800 dark:bg-mist-900"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-mist-600 dark:text-mist-400">Minimum 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirm_password" className="mb-1 block text-sm font-medium">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirm_password"
                name="confirm_password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full rounded-md border border-mist-200 bg-white px-3 py-2 pr-10 text-sm dark:border-mist-800 dark:bg-mist-900"
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

      {/* Success Modal */}
      <Dialog isOpen={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogPanel variant="unactionable">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <User className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Success</h3>
              <p className="mt-1 text-sm text-mist-600 dark:text-mist-300">{modalMessage}</p>
            </div>
          </div>
        </DialogPanel>
      </Dialog>

      {/* Error Modal */}
      <Dialog isOpen={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogPanel variant="unactionable">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <span className="text-lg font-bold text-red-600 dark:text-red-400">!</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Error</h3>
              <p className="mt-1 text-sm text-mist-600 dark:text-mist-300">{modalMessage}</p>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="User Profile" />;
}
