import { ExternalLink, RefreshCw } from "lucide-react";

import Button from "~/components/button";
import Link from "~/components/link";
import { Dialog, DialogPanel } from "~/components/dialog";
import type { UpdateCheckResult, UpdateCheckState } from "./types";
import { hasUpdates, useUpdateCheckContext } from "./UpdateCheckProvider";

export default function UpdateCheckModal() {
  const ctx = useUpdateCheckContext();

  const isOpen =
    !ctx.isChecking &&
    hasUpdates(ctx) &&
    ctx.lastTrigger === "auto";

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => {
      if (!open) ctx.clearResults();
    }}>
      <DialogPanel variant="unactionable">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            Updates Available
          </h2>
          <p className="text-sm text-mist-600 dark:text-mist-400">
            New commits are available for the following projects:
          </p>

          <div className="flex flex-col gap-3">
            {ctx.headplaneUpdate && (
              <UpdateCard result={ctx.headplaneUpdate} />
            )}
            {ctx.headscaleUpdate && (
              <UpdateCard result={ctx.headscaleUpdate} />
            )}
          </div>

          <p className="text-xs text-mist-500 dark:text-mist-400">
            Checked automatically on page load. You can also check manually
            from the user menu at any time.
          </p>
        </div>
      </DialogPanel>
    </Dialog>
  );
}

function UpdateCard({ result }: { result: UpdateCheckResult }) {
  const ctx = useUpdateCheckContext();

  return (
    <div className="rounded-lg border border-mist-200 bg-mist-50 p-3 dark:border-mist-700 dark:bg-mist-800/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{result.projectName}</h3>
        <span className="text-xs text-mist-500 dark:text-mist-400">
          {result.currentCommit} →{" "}
          <span className="font-mono text-indigo-600 dark:text-indigo-400">
            {result.remoteCommit}
          </span>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Link
          external
          styled
          to={`${result.repoUrl.replace(/\.git$/, "")}/compare/${result.currentCommit}...${result.remoteCommit}`}
        >
          <span className="flex items-center gap-1">
            <ExternalLink className="size-3" />
            View changes
          </span>
        </Link>
        <span className="text-xs text-mist-400 dark:text-mist-500">·</span>
        <Link
          external
          styled
          to={`${result.repoUrl.replace(/\.git$/, "")}/releases`}
        >
          <span className="flex items-center gap-1">
            <ExternalLink className="size-3" />
            Releases
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * A small pill button that shows the update status and can be
 * placed in the header or settings page.
 */
export function UpdateCheckPill() {
  const ctx = useUpdateCheckContext();
  const count =
    (ctx.headplaneUpdate !== null ? 1 : 0) +
    (ctx.headscaleUpdate !== null ? 1 : 0);

  return (
    <button
      type="button"
      onClick={() => ctx.checkNow("manual")}
      disabled={ctx.isChecking}
      className="inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-mist-100 dark:hover:bg-mist-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
    >
      <RefreshCw
        className={`size-4 ${ctx.isChecking ? "animate-spin" : ""}`}
      />
      <span className="flex-1 text-left">
        {ctx.isChecking
          ? "Checking for updates..."
          : "Check for Updates"}
      </span>
      {count > 0 && (
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}