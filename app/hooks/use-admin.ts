import { unstable_useRoute as useRoute } from "react-router";

/**
 * Hook to check if the current user has admin capabilities.
 *
 * This hook reads from the app layout loader data which already
 * computes admin access via `auth.can(principal, Capabilities.configure_iam)`.
 *
 * @returns true if the current user has admin capabilities
 */
export function useIsAdmin(): boolean {
  const route = useRoute("routes/layout");

  // The app layout loader provides access.admin
  if (!route?.loaderData) {
    return false;
  }

  return route.loaderData.access?.admin ?? false;
}

/**
 * Hook to get all access capabilities for the current user.
 *
 * @returns An object with all access flags (admin, machines, users, etc.)
 */
export function useAccess() {
  const route = useRoute("routes/layout");

  if (!route?.loaderData) {
    return {
      admin: false,
      audit: false,
      dns: false,
      machines: false,
      policy: false,
      settings: false,
      ui: false,
      users: false,
    };
  }

  return (
    route.loaderData.access ?? {
      admin: false,
      audit: false,
      dns: false,
      machines: false,
      policy: false,
      settings: false,
      ui: false,
      users: false,
    }
  );
}

/**
 * Hook to get the current user information.
 *
 * @returns User information (name, email, etc.) or null if not available
 */
export function useCurrentUser() {
  const route = useRoute("routes/layout");

  if (!route?.loaderData) {
    return null;
  }

  return route.loaderData.user ?? null;
}
