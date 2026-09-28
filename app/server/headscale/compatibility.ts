// MARK: Headscale Compatibility Registry
//
// A human-readable registry of Headplane features and the minimum Headscale
// version each one requires. Unlike `Capabilities` (which gates behaviour
// with booleans), this registry exists to *surface* unsupported features to
// the user: what is missing, why, and which Headscale version provides it.
//
// Add an entry here when a new Headplane feature depends on a Headscale
// endpoint or wire format that not every supported server has.

import { formatServerVersion, gte, type ServerVersion } from "./api/server-version";

export interface CompatibilityFeature {
  key: string;
  label: string;
  description: string;
  minVersion: string;
  /** Where the feature surfaces in the UI, for grouping notices. */
  surface: "machines" | "dns" | "policy" | "settings" | "general";
}

export const COMPATIBILITY_FEATURES: CompatibilityFeature[] = [
  {
    key: "flat-tags",
    label: "Flat node tags",
    description: "Node tags are returned as a flat list on the wire.",
    minVersion: "0.28.0",
    surface: "machines",
  },
  {
    key: "stable-preauthkey-ids",
    label: "Stable pre-auth key IDs",
    description: "Pre-auth keys have stable IDs and tag-only keys are supported.",
    minVersion: "0.28.0",
    surface: "settings",
  },
  {
    key: "immutable-node-owner",
    label: "Immutable node owner",
    description: "A node's owning user cannot be changed after creation.",
    minVersion: "0.28.0",
    surface: "machines",
  },
  {
    key: "authreq-prefix",
    label: "Registration key prefix",
    description: "Node registration expects the full hskey-authreq-<id> AuthID.",
    minVersion: "0.29.0",
    surface: "machines",
  },
  {
    key: "disable-key-expiry",
    label: "Disable key expiry",
    description: "Key expiry can be disabled per node.",
    minVersion: "0.29.0",
    surface: "machines",
  },
  {
    key: "derp-status",
    label: "DERP status endpoint",
    description: "The DERP status page requires the /api/v1/derp endpoint.",
    minVersion: "0.31.0",
    surface: "general",
  },
];

export interface CompatibilityStatus {
  feature: CompatibilityFeature;
  supported: boolean;
}

export interface CompatibilityReport {
  serverVersion: string;
  statuses: CompatibilityStatus[];
  unsupported: CompatibilityStatus[];
}

export function compatibilityFor(version: ServerVersion): CompatibilityReport {
  const statuses = COMPATIBILITY_FEATURES.map((feature) => ({
    feature,
    supported: gte(version, feature.minVersion),
  }));

  return {
    serverVersion: formatServerVersion(version),
    statuses,
    unsupported: statuses.filter((status) => !status.supported),
  };
}

/** Returns the unsupported features for a given UI surface (or all). */
export function unsupportedFor(
  version: ServerVersion,
  surface?: CompatibilityFeature["surface"],
): CompatibilityStatus[] {
  return compatibilityFor(version).unsupported.filter(
    (status) => surface === undefined || status.feature.surface === surface,
  );
}
