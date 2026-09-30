import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import type { UpdateCheckResult, UpdateCheckState } from "./types";

export type UpdateCheckTrigger = "manual" | "auto";

interface UpdateCheckContextValue extends UpdateCheckState {
  checkNow: (trigger?: UpdateCheckTrigger) => void;
  clearResults: () => void;
  lastTrigger: UpdateCheckTrigger | null;
  /**
   * Set the version info needed for update checks.
   * Must be called before checkNow is first invoked.
   */
  setVersionInfo: (info: { headplaneCommit: string; headscaleVersion: string }) => void;
}

const UpdateCheckContext = createContext<UpdateCheckContextValue | null>(null);

const HEADPLANE_REPO = "https://github.com/arsydoni4326-alt/headplane.git";
const HEADSCALE_REPO = "https://github.com/arsydoni4326-alt/headscale.git";

// --- sessionStorage caching ---

const CACHE_KEY = "headplane-update-check";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CachedData {
  timestamp: number;
  headplaneUpdate: UpdateCheckResult | null;
  headscaleUpdate: UpdateCheckResult | null;
}

function readCache(): CachedData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedData;
    if (Date.now() - data.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: Omit<CachedData, "timestamp">): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

// --- Dismiss/remind sessionStorage keys ---

const DISMISS_SESSION_KEY = "headplane-update-dismiss-session";
const REMIND_LATER_KEY = "headplane-update-remind-later";
const REMIND_LATER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isDismissedForSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissForSession(): void {
  try {
    sessionStorage.setItem(DISMISS_SESSION_KEY, "true");
  } catch {
    // ignore
  }
}

export function isRemindLaterActive(): boolean {
  try {
    const raw = sessionStorage.getItem(REMIND_LATER_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    if (Number.isNaN(timestamp)) return false;
    return Date.now() - timestamp < REMIND_LATER_TTL_MS;
  } catch {
    return false;
  }
}

export function remindLater(): void {
  try {
    sessionStorage.setItem(REMIND_LATER_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

// --- GitHub API helpers ---

async function performCheck(
  headplaneCommit: string,
  headscaleVersion: string,
): Promise<{
  headplaneUpdate: UpdateCheckResult | null;
  headscaleUpdate: UpdateCheckResult | null;
}> {
  const [headplaneResult, headscaleResult] = await Promise.all([
    // Headplane: check via GitHub API directly (browser-side)
    fetchRemoteCommit(headplaneCommit, HEADPLANE_REPO, "Headplane"),
    // Headscale: check via Headplane's backend /api/update-check endpoint
    fetchHeadscaleUpdate(),
  ]);

  return {
    headplaneUpdate: headplaneResult,
    headscaleUpdate: headscaleResult,
  };
}

/**
 * Fetch headscale update info through Headplane's backend proxy at
 * /api/update-check. The browser never talks to Headscale directly;
 * Headplane forwards the request server-side, keeping the internal
 * Headscale URL private.
 */
async function fetchHeadscaleUpdate(): Promise<UpdateCheckResult | null> {
  const url = `${__PREFIX__}/api/update-check?check=true`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      current?: { commit?: string };
      updateAvailable?: boolean;
      remote?: { commit?: string; version?: string; url?: string };
      error?: string;
    };

    // If the server returned an error during its remote check, log it
    // but still try to show what we know
    if (data.error) {
      console.warn("Headscale update check server-side error:", data.error);
    }

    // updateAvailable is explicitly set by the server when ?check=true
    if (data.updateAvailable !== true) {
      return null;
    }

    const currentCommit = data.current?.commit ? data.current.commit.slice(0, 7) : "unknown";
    const remoteCommit = data.remote?.commit ?? "unknown";
    const repoUrl = data.remote?.url ? `${data.remote.url}.git` : HEADSCALE_REPO;

    // If the remote has a version field (release comparison), construct a
    // release notes URL. Otherwise fall back to the generic releases page.
    let releaseUrl: string | undefined;
    if (data.remote?.version) {
      const base = repoUrl.replace(/\.git$/, "");
      releaseUrl = `${base}/releases/tag/v${data.remote.version}`;
    }

    return {
      currentCommit,
      remoteCommit,
      repoUrl,
      projectName: "Headscale",
      releaseUrl,
    };
  } catch {
    return null;
  }
}

async function fetchRemoteCommit(
  currentCommit: string,
  repoUrl: string,
  projectName: string,
): Promise<UpdateCheckResult | null> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return null;
  }

  const { owner, repo } = parsed;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/main`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "headplane-update-check",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { sha?: string };
    if (typeof data.sha !== "string") {
      return null;
    }

    const remoteShort = data.sha.slice(0, 7);
    if (remoteShort === currentCommit) {
      return null;
    }

    return {
      currentCommit,
      remoteCommit: remoteShort,
      repoUrl,
      projectName,
    };
  } catch {
    return null;
  }
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const httpsMatch = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  return null;
}

export function UpdateCheckProvider({ children }: { children: React.ReactNode }) {
  const versionInfoRef = useRef<{
    headplaneCommit: string;
    headscaleVersion: string;
  } | null>(null);

  const [state, setState] = useState<UpdateCheckState>({
    isChecking: false,
    headplaneUpdate: null,
    headscaleUpdate: null,
    error: null,
  });

  const [lastTrigger, setLastTrigger] = useState<UpdateCheckTrigger | null>(null);
  const autoCheckedRef = useRef(false);

  const setVersionInfo = useCallback(
    (info: { headplaneCommit: string; headscaleVersion: string }) => {
      versionInfoRef.current = info;
    },
    [],
  );

  const checkNow = useCallback(async (trigger: UpdateCheckTrigger = "manual") => {
    const info = versionInfoRef.current;
    if (!info) {
      setState((prev) => ({
        ...prev,
        error: "Version info not yet available",
      }));
      return;
    }

    // Auto-checks use cached results if available
    if (trigger === "auto") {
      const cached = readCache();
      if (cached) {
        setState({
          isChecking: false,
          headplaneUpdate: cached.headplaneUpdate,
          headscaleUpdate: cached.headscaleUpdate,
          error: null,
        });
        setLastTrigger(trigger);
        return;
      }
    }

    setState((prev) => ({ ...prev, isChecking: true, error: null }));
    setLastTrigger(trigger);

    try {
      const results = await performCheck(info.headplaneCommit, info.headscaleVersion);

      // Cache successful results (only for auto-triggered checks)
      if (trigger === "auto") {
        writeCache(results);
      }

      setState({
        isChecking: false,
        ...results,
        error: null,
      });
    } catch (err) {
      setState({
        isChecking: false,
        headplaneUpdate: null,
        headscaleUpdate: null,
        error: err instanceof Error ? err.message : "Failed to check for updates",
      });
    }
  }, []);

  const clearResults = useCallback(() => {
    setState({
      isChecking: false,
      headplaneUpdate: null,
      headscaleUpdate: null,
      error: null,
    });
  }, []);

  const value = useMemo<UpdateCheckContextValue>(
    () => ({
      ...state,
      checkNow,
      clearResults,
      lastTrigger,
      setVersionInfo,
    }),
    [state, checkNow, clearResults, lastTrigger, setVersionInfo],
  );

  return <UpdateCheckContext.Provider value={value}>{children}</UpdateCheckContext.Provider>;
}

export function useUpdateCheckContext(): UpdateCheckContextValue {
  const ctx = useContext(UpdateCheckContext);
  if (!ctx) {
    throw new Error("useUpdateCheckContext must be used within an <UpdateCheckProvider>");
  }
  return ctx;
}

/**
 * Check whether there are any updates available.
 */
export function hasUpdates(state: UpdateCheckState): boolean {
  return state.headplaneUpdate !== null || state.headscaleUpdate !== null;
}

/**
 * Count of available updates.
 */
export function updateCount(state: UpdateCheckState): number {
  return (state.headplaneUpdate !== null ? 1 : 0) + (state.headscaleUpdate !== null ? 1 : 0);
}
