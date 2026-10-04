import type { Principal } from "~/server/web/auth";
import type { AuthService } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";

/**
 * Check if a principal has admin capabilities.
 * Admin capability is determined by the `configure_iam` capability.
 * 
 * This works for all authentication methods:
 * - API key authentication (always admin)
 * - Password authentication (always admin)
 * - OIDC authentication (based on user role)
 * - Proxy authentication (based on user role)
 * 
 * @param auth - The auth service instance
 * @param principal - The authenticated principal
 * @returns true if the principal has admin capabilities
 */
export function isAdmin(auth: AuthService, principal: Principal): boolean {
  return auth.can(principal, Capabilities.configure_iam);
}

/**
 * Check if a principal has write access to users.
 * 
 * @param auth - The auth service instance
 * @param principal - The authenticated principal
 * @returns true if the principal can write users
 */
export function canWriteUsers(auth: AuthService, principal: Principal): boolean {
  return auth.can(principal, Capabilities.write_users);
}

/**
 * Check if a principal has write access to machines.
 * 
 * @param auth - The auth service instance
 * @param principal - The authenticated principal
 * @returns true if the principal can write machines
 */
export function canWriteMachines(auth: AuthService, principal: Principal): boolean {
  return auth.can(principal, Capabilities.write_machines);
}

/**
 * Check if a principal has write access to policy.
 * 
 * @param auth - The auth service instance
 * @param principal - The authenticated principal
 * @returns true if the principal can write policy
 */
export function canWritePolicy(auth: AuthService, principal: Principal): boolean {
  return auth.can(principal, Capabilities.write_policy);
}

/**
 * Get a user-friendly display name for a principal.
 * 
 * @param principal - The authenticated principal
 * @returns A display name suitable for showing in UI
 */
export function getPrincipalDisplayName(principal: Principal): string {
  if (principal.kind === "api_key") {
    return principal.displayName;
  }
  if (principal.kind === "password") {
    return principal.username;
  }
  // oidc or proxy
  return principal.profile.name || principal.profile.username || "Unknown User";
}

/**
 * Get the authentication method name for display.
 * 
 * @param principal - The authenticated principal
 * @returns A human-readable authentication method name
 */
export function getAuthMethodName(principal: Principal): string {
  switch (principal.kind) {
    case "api_key":
      return "API Key";
    case "password":
      return "Password";
    case "oidc":
      return "OIDC";
    case "proxy":
      return "Proxy Auth";
    default:
      return "Unknown";
  }
}

/**
 * Create an error message for unauthorized access.
 * 
 * @param principal - The authenticated principal (optional)
 * @returns An error message explaining the authorization failure
 */
export function getUnauthorizedMessage(principal?: Principal): string {
  if (!principal) {
    return "Authentication required. Please log in to access this resource.";
  }

  const displayName = getPrincipalDisplayName(principal);
  const authMethod = getAuthMethodName(principal);

  return `Access denied. User "${displayName}" (authenticated via ${authMethod}) does not have permission to access this resource. Please contact your administrator if you believe this is an error.`;
}

/**
 * Create a standardized 403 Response for unauthorized access.
 * Useful for throwing from loaders/actions.
 * 
 * @param principal - The authenticated principal (optional)
 * @param customMessage - Optional custom message to override the default
 * @returns A Response object with 403 status
 */
export function createUnauthorizedResponse(
  principal?: Principal,
  customMessage?: string,
): Response {
  const message = customMessage ?? getUnauthorizedMessage(principal);
  
  return new Response(message, {
    status: 403,
    statusText: "Forbidden",
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
