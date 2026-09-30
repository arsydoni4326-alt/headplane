import { TriangleAlert } from "lucide-react";

import Notice from "~/components/notice";
import type { CompatibilityStatus } from "~/server/headscale/compatibility";

interface CompatibilityNoticeProps {
  statuses: CompatibilityStatus[];
  serverVersion: string;
}

/**
 * Renders a warning listing features that are unavailable because the
 * connected Headscale server is older than the version that introduced
 * them. Returns null when everything is supported.
 */
export default function CompatibilityNotice({ statuses, serverVersion }: CompatibilityNoticeProps) {
  if (statuses.length === 0) {
    return null;
  }

  return (
    <Notice title="Some features are unavailable" variant="warning">
      <p>
        Your Headscale server is running <span className="font-mono">{serverVersion}</span>. The
        following features require a newer version:
      </p>
      <ul className="mt-2 ml-4 list-outside list-disc space-y-1">
        {statuses.map((status) => (
          <li key={status.feature.key}>
            <span className="font-medium">{status.feature.label}</span> —{" "}
            {status.feature.description} Requires Headscale{" "}
            <span className="font-mono">{status.feature.minVersion}</span> or newer.
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-xs opacity-70">
        <TriangleAlert className="h-3.5 w-3.5" />
        Upgrade Headscale to enable these features.
      </p>
    </Notice>
  );
}
