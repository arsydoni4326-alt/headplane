import type { UpdateCheckResult } from "./types";

/**
 * Parse a GitHub remote URL like
 *   https://github.com/owner/repo.git
 * or
 *   git@github.com:owner/repo.git
 * into owner/repo.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const httpsMatch = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  return null;
}

/**
 * Fetch the short commit hash of the latest commit on the `main` branch
 * of the given GitHub repository.
 */
export async function fetchRemoteShortCommitHash(
  repoUrl: string,
): Promise<string | null> {
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

    // Return first 7 characters (short SHA)
    return data.sha.slice(0, 7);
  } catch {
    return null;
  }
}

/**
 * Build a remote commit compare result.
 */
export async function checkForUpdate(
  currentCommit: string,
  remoteRepoUrl: string,
  projectName: string,
): Promise<UpdateCheckResult | null> {
  const remoteCommit = await fetchRemoteShortCommitHash(remoteRepoUrl);
  if (!remoteCommit || remoteCommit === currentCommit) {
    return null;
  }

  return {
    currentCommit,
    remoteCommit,
    repoUrl: remoteRepoUrl,
    projectName,
  };
}