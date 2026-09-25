import { useCallback, useEffect, useRef, useState } from "react";

import { checkForUpdate } from "./git-api";
import type { UpdateCheckResult, UpdateCheckState } from "./types";

const HEADPLANE_REPO = "https://github.com/arsydoni4326-alt/headplane.git";
const HEADSCALE_REPO = "https://github.com/arsydoni4326-alt/headscale.git";

export type UpdateCheckTrigger = "manual" | "auto";

export interface UseUpdateCheckOptions {
  /** Short commit hash of the current Headplane build */
  headplaneCommit: string;
  /** Version string of the running Headscale server (used as identifier) */
  headscaleVersion: string;
  /** Whether to auto-check on mount */
  autoCheck?: boolean;
}

export interface UseUpdateCheckReturn extends UpdateCheckState {
  /** Trigger an update check immediately */
  checkNow: (trigger?: UpdateCheckTrigger) => Promise<void>;
  /** Clear the update check results */
  clearResults: () => void;
  /** The trigger source of the last check */
  lastTrigger: UpdateCheckTrigger | null;
}

export function useUpdateCheck(
  options: UseUpdateCheckOptions,
): UseUpdateCheckReturn {
  const { headplaneCommit, headscaleVersion, autoCheck = true } = options;

  const [state, setState] = useState<UpdateCheckState>({
    isChecking: false,
    headplaneUpdate: null,
    headscaleUpdate: null,
    error: null,
  });

  const [lastTrigger, setLastTrigger] = useState<UpdateCheckTrigger | null>(
    null,
  );
  const autoCheckedRef = useRef(false);

  const checkNow = useCallback(
    async (trigger: UpdateCheckTrigger = "manual") => {
      setState((prev) => ({ ...prev, isChecking: true, error: null }));
      setLastTrigger(trigger);

      try {
        const [headplaneResult, headscaleResult] = await Promise.all([
          checkForUpdate(
            headplaneCommit,
            HEADPLANE_REPO,
            "Headplane",
          ),
          checkForUpdate(
            headscaleVersion,
            HEADSCALE_REPO,
            "Headscale",
          ),
        ]);

        setState({
          isChecking: false,
          headplaneUpdate: headplaneResult,
          headscaleUpdate: headscaleResult,
          error: null,
        });
      } catch (err) {
        setState({
          isChecking: false,
          headplaneUpdate: null,
          headscaleUpdate: null,
          error:
            err instanceof Error ? err.message : "Failed to check for updates",
        });
      }
    },
    [headplaneCommit, headscaleVersion],
  );

  const clearResults = useCallback(() => {
    setState({
      isChecking: false,
      headplaneUpdate: null,
      headscaleUpdate: null,
      error: null,
    });
  }, []);

  // Auto-check on mount
  useEffect(() => {
    if (autoCheck && !autoCheckedRef.current) {
      autoCheckedRef.current = true;
      checkNow("auto");
    }
  }, [autoCheck, checkNow]);

  return {
    ...state,
    checkNow,
    clearResults,
    lastTrigger,
  };
}

/**
 * Check whether there are any updates available.
 */
export function hasUpdates(
  state: UpdateCheckState,
): boolean {
  return (
    state.headplaneUpdate !== null || state.headscaleUpdate !== null
  );
}

/**
 * Count of available updates.
 */
export function updateCount(
  state: UpdateCheckState,
): number {
  return (
    (state.headplaneUpdate !== null ? 1 : 0) +
    (state.headscaleUpdate !== null ? 1 : 0)
  );
}