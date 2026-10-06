import { data } from "react-router";

import { updateConfig } from "~/server/config/write";
import { appConfigContext, authContext } from "~/server/context";
import log from "~/utils/log";

import type { Route } from "./+types/headplane-settings";

interface SettingsResponse {
  username: string;
  name?: string;
  avatar?: string;
  theme: string;
  apiKey: string;
}

interface SettingsUpdateRequest {
  username?: string;
  name?: string;
  avatar?: string;
  theme?: string;
}

/**
 * GET /api/v1/headplane/settings
 * Returns the current user's settings from config.yaml
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);

  await auth.require(request);

  // Read settings from config.user
  const user = config.user;
  if (!user) {
    return data<SettingsResponse>(
      {
        username: "",
        name: "",
        avatar: "",
        theme: "light",
        apiKey: "",
      },
      { status: 200 },
    );
  }

  return data<SettingsResponse>(
    {
      username: user.username || "",
      name: user.name || "",
      avatar: user.avatar || "",
      theme: "light", // Theme is not yet stored in config
      apiKey: "", // API key is not stored here
    },
    { status: 200 },
  );
}

/**
 * POST /api/v1/headplane/settings
 * Updates the user's settings in config.yaml atomically
 */
export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);

  await auth.require(request);

  let body: SettingsUpdateRequest;
  try {
    body = await request.json();
  } catch {
    return data({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate username if provided
  if (body.username !== undefined) {
    if (typeof body.username !== "string" || body.username.trim().length === 0) {
      return data({ error: "Username must be a non-empty string" }, { status: 400 });
    }
  }

  // Validate avatar if provided
  if (body.avatar !== undefined && body.avatar !== "") {
    if (typeof body.avatar !== "string") {
      return data({ error: "Avatar must be a string" }, { status: 400 });
    }

    // Validate HTTPS URL
    try {
      const url = new URL(body.avatar);
      if (url.protocol !== "https:") {
        return data({ error: "Avatar must be an HTTPS URL" }, { status: 400 });
      }
    } catch {
      return data({ error: "Avatar must be a valid HTTPS URL" }, { status: 400 });
    }
  }

  // Validate name if provided
  if (body.name !== undefined && typeof body.name !== "string") {
    return data({ error: "Name must be a string" }, { status: 400 });
  }

  // Build update object for config.yaml
  const updates: {
    user?: { username?: string; password?: string; name?: string; avatar?: string };
  } = {};

  if (body.username !== undefined || body.name !== undefined || body.avatar !== undefined) {
    updates.user = {};
    if (body.username !== undefined) updates.user.username = body.username.trim();
    if (body.name !== undefined) updates.user.name = body.name.trim();
    if (body.avatar !== undefined) updates.user.avatar = body.avatar.trim();
  }

  // Get config path
  const configPath =
    process.env.HEADPLANE_CONFIG_PATH != null
      ? String(process.env.HEADPLANE_CONFIG_PATH)
      : "/etc/headplane/config.yaml";

  try {
    // Atomically update config.yaml
    await updateConfig(configPath, updates);

    log.info(
      "settings",
      "User settings updated for: %s",
      updates.user?.username || config.user?.username,
    );

    return data({ success: true }, { status: 200 });
  } catch (error) {
    log.error("settings", "Failed to update settings: %s", String(error));
    return data({ error: "Failed to update settings" }, { status: 500 });
  }
}
