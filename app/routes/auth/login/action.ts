import { redirect } from "react-router";

import { authContext, headscaleContext, localAdminContext } from "~/server/context";
import { isDataWithApiError } from "~/server/headscale/api/error-client";
import log from "~/utils/log";

import type { Route } from "./+types/page";

export async function loginAction({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscale = context.get(headscaleContext);
  const localAdmin = context.get(localAdminContext);

  const formData = await request.formData();
  const apiKey = formData.has("api_key") ? String(formData.get("api_key")) : undefined;
  const username = formData.has("username") ? String(formData.get("username")) : undefined;
  const password = formData.has("password") ? String(formData.get("password")) : undefined;

  // Password login flow - use local admin service if available
  if (password !== undefined) {
    if (!username || username.length === 0) {
      log.warn("auth", "Request made with empty username");
      return {
        success: false,
        message: "Username cannot be empty. Please enter a valid username.",
      };
    }

    if (password.length === 0) {
      log.warn("auth", "Request made with empty password");
      return {
        success: false,
        message: "Password cannot be empty. Please enter a valid password.",
      };
    }

    // Use local admin authentication if configured
    if (localAdmin.state === "enabled") {
      const result = await localAdmin.value.authenticate(username, password);
      if (!result.success) {
        log.warn("auth", "Local admin authentication failed for user: %s", username);
        return {
          success: false,
          message: result.error || "Invalid username or password",
        };
      }

      // Create a password session with configured service API key
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      return redirect("/machines", {
        headers: {
          "Set-Cookie": await auth.createPasswordSession("local-admin-token", username, maxAge),
        },
      });
    }

    // Fall back to legacy Headscale password login (will be removed)
    try {
      const response = await headscale.passwordLogin(username, password);
      const maxAge = (response.expires_at - Math.floor(Date.now() / 1000)) * 1000;

      return redirect("/machines", {
        headers: {
          "Set-Cookie": await auth.createPasswordSession(response.token, response.username, maxAge),
        },
      });
    } catch (error) {
      if (isDataWithApiError(error)) {
        const apiError = error.data;
        if (apiError.statusCode === 401) {
          return {
            success: false,
            message: "Invalid password",
          };
        }
        if (apiError.statusCode === 429) {
          return {
            success: false,
            message: "Too many failed attempts. Please try again later.",
          };
        }
        if (apiError.statusCode === 503) {
          return {
            success: false,
            message: "Password authentication is not configured on the server",
          };
        }
      }

      log.error("auth", "Error while validating password: %s", error);
      log.debug("auth", "Error details: %o", error);
      return {
        success: false,
        message: "Error while validating password (see logs for details)",
      };
    }
  }

  // API key login flow (existing logic)
  if (apiKey === undefined) {
    log.warn("auth", "Request made without API key or password");
    log.warn(
      "auth",
      "If this is unexpected, ensure your reverse proxy (if applicable) is configured correctly",
    );
    return {
      success: false,
      message: "Missing API key or password. Please enter your credentials.",
    };
  }

  if (apiKey.length === 0) {
    log.warn("auth", "Request made with empty API key");
    log.warn(
      "auth",
      "If this is unexpected, ensure your reverse proxy (if applicable) is configured correctly",
    );
    return {
      success: false,
      message: "API key cannot be empty. Please enter a valid API key.",
    };
  }

  // Build a client with the candidate API key the user just submitted, so the
  // GET /api/v1/apikey call below validates the key against Headscale itself.
  const api = headscale.client(apiKey);
  try {
    const apiKeys = await api.apiKeys.list();

    // We don't need to check for 0 API keys because this request cannot
    // be authenticated correctly without an API key
    //
    // 0.28.0 pointlessly added asterisks to the prefixes of API keys, which is
    // the dumbest thing I've ever seen.
    const lookup = apiKeys.find((key) => apiKey.startsWith(key.prefix.replaceAll("*", "")));
    if (!lookup) {
      return {
        success: false,
        message: "API key was not found in the Headscale database",
      };
    }

    if (lookup.expiration === null || lookup.expiration === undefined) {
      log.error("auth", "Got an API key without an expiration");
      return {
        success: false,
        message: "API key is malformed (missing expiration). Please generate a new API key.",
      };
    }

    const expiry = new Date(lookup.expiration);
    if (expiry.getTime() < Date.now()) {
      return {
        success: false,
        message: "API key has expired",
      };
    }

    return redirect("/machines", {
      headers: {
        "Set-Cookie": await auth.createApiKeySession(
          apiKey,
          `${lookup.prefix}...`,
          expiry.getTime() - Date.now(),
        ),
      },
    });
  } catch (error) {
    // Check if this is a React Router DataWithResponseInit wrapping a Headscale API error
    if (isDataWithApiError(error)) {
      const apiError = error.data;
      // TODO: What in gods name is wrong with the headscale API?
      if (
        apiError.statusCode === 401 ||
        apiError.statusCode === 403 ||
        (apiError.statusCode === 500 && apiError.rawData.trim() === "Unauthorized")
      ) {
        return {
          success: false,
          message: "API key is invalid (it may be incorrect or expired)",
        };
      }
    }

    log.error("auth", "Error while validating API key: %s", error);
    log.debug("auth", "Error details: %o", error);
    return {
      success: false,
      message: "Error while validating API key (see logs for details)",
    };
  }
}
