import { Eye, EyeOff, Save, User } from "lucide-react";
import { useState, useEffect } from "react";
import { data, Form, useActionData } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import PageError from "~/components/page-error";
import type { LocalAdminService } from "~/server/auth/local-admin";
import type { HeadplaneConfig } from "~/server/config/config-schema";
import { updateConfig } from "~/server/config/write";
import { appConfigContext, authContext, localAdminContext } from "~/server/context";
import type { AuthService } from "~/server/web/auth";
import { isAdmin, createUnauthorizedResponse } from "~/utils/auth";
import log from "~/utils/log";

import type { Route } from "./+types/route";

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

  if (localAdmin.state !== "enabled") {
    throw new Response("Administration is only available in single local administrator mode", {
      status: 403,
    });
  }

  return {
    profile: {
      username: config.user?.username || localAdmin.value.getUsername(),
      name: config.user?.name || "",
      avatar: config.user?.avatar || "",
    },
  };
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

  if (actionType === "update-profile") {
    return handleProfileUpdate(formData, request, config, localAdmin.value, auth);
  }

  if (actionType === "change-password") {
    return handlePasswordChange(formData, request, config, localAdmin.value, auth);
  }

  return { success: false, error: "Unknown action", actionType: null };
}

async function handleProfileUpdate(
  formData: FormData,
  request: Request,
  config: HeadplaneConfig,
  localAdmin: LocalAdminService,
  auth: AuthService,
) {
  const username = formData.get("username")?.toString()?.trim();
  const name = formData.get("name")?.toString()?.trim();
  const avatar = formData.get("avatar")?.toString()?.trim();

  if (!username) {
    return {
      success: false,
      error: "Username is required",
      actionType: "update-profile",
    };
  }

  if (avatar) {
    try {
      if (new URL(avatar).protocol !== "https:") {
        return {
          success: false,
          error: "Avatar URL must use HTTPS",
          actionType: "update-profile",
        };
      }
    } catch {
      return {
        success: false,
        error: "Avatar URL must be a valid HTTPS URL",
        actionType: "update-profile",
      };
    }
  }

  try {
    const usernameChanged = username !== localAdmin.getUsername();
    await updateConfig(
      configPath(),
      { user: { username, name: name || undefined, avatar: avatar || undefined } },
      { backup: true },
    );
    localAdmin.updateCredentials({ username });
    if (config.user) {
      config.user.username = username;
      if (name) {
        config.user.name = name;
      } else {
        delete config.user.name;
      }
      if (avatar) {
        config.user.avatar = avatar;
      } else {
        delete config.user.avatar;
      }
    }

    if (usernameChanged) {
      await auth.invalidatePasswordSessions();
      return data(
        {
          success: true,
          message: "Profile updated successfully. Please log in again.",
          actionType: "update-profile",
          requiresLogout: true,
        },
        { headers: { "Set-Cookie": await auth.destroySession(request) } },
      );
    }

    return { success: true, message: "Profile updated successfully", actionType: "update-profile" };
  } catch (error) {
    log.error("config", "Error updating profile: %s", String(error));
    return {
      success: false,
      error: configUpdateError(error),
      actionType: "update-profile",
    };
  }
}

async function handlePasswordChange(
  formData: FormData,
  request: Request,
  config: HeadplaneConfig,
  localAdmin: LocalAdminService,
  auth: AuthService,
) {
  const currentPassword = formData.get("current_password")?.toString();
  const newPassword = formData.get("new_password")?.toString();
  const confirmPassword = formData.get("confirm_password")?.toString();

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

  const result = await localAdmin.authenticate(localAdmin.getUsername(), currentPassword);

  if (!result.success) {
    return {
      success: false,
      error: "Current password is incorrect",
      actionType: "change-password",
    };
  }

  try {
    const { hashPassword } = await import("~/server/auth/bcrypt-utils");
    const newHash = await hashPassword(newPassword);
    await updateConfig(configPath(), { user: { password: newHash } }, { backup: true });
    localAdmin.updateCredentials({ passwordHash: newHash });
    if (config.user) {
      config.user.password = newHash;
    }
    await auth.invalidatePasswordSessions();

    return data(
      {
        success: true,
        message: "Password changed successfully. Please log in again.",
        actionType: "change-password",
        requiresLogout: true,
      },
      { headers: { "Set-Cookie": await auth.destroySession(request) } },
    );
  } catch (error) {
    log.error("config", "Error changing password: %s", String(error));
    return {
      success: false,
      error: configUpdateError(error),
      actionType: "change-password",
    };
  }
}

function configPath(): string {
  return process.env.HEADPLANE_CONFIG_PATH ?? "/etc/headplane/config.yaml";
}

function configUpdateError(error: unknown): string {
  const message = String(error);
  if (message.includes("EACCES") || message.includes("EPERM") || message.includes("EROFS")) {
    return "Config file is read-only. Use CLI tool: headplane reset-local-admin-password";
  }

  return "Failed to update configuration. See server logs for details.";
}

export default function AdminUsersProfileRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  const [username, setUsername] = useState(loaderData.profile.username);
  const [name, setName] = useState(loaderData.profile.name);
  const [avatar, setAvatar] = useState(loaderData.profile.avatar);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setModalMessage("message" in actionData ? actionData.message : "Operation successful");
        setShowSuccessModal(true);

        if (actionData.actionType === "change-password") {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
        if ("requiresLogout" in actionData && actionData.requiresLogout) {
          setTimeout(() => {
            window.location.href = `${__PREFIX__}/login?s=logout`;
          }, 2000);
        }
      } else if ("error" in actionData && actionData.error) {
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

      <Card className="mb-6 max-w-none">
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
            placeholder="Enter username"
            description="Your login username"
          />

          <Input
            label="Display Name"
            name="name"
            type="text"
            value={name}
            onChange={setName}
            placeholder="No name set"
            description="Optional display name"
          />

          <Input
            label="Avatar URL"
            name="avatar"
            type="url"
            value={avatar}
            onChange={setAvatar}
            placeholder="https://example.com/avatar.png"
            description="HTTPS URL to your avatar image"
          />

          <Button type="submit" variant="heavy">
            <Save className="h-4 w-4" />
            Save Profile
          </Button>
        </Form>
      </Card>

      <Card className="max-w-none">
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
