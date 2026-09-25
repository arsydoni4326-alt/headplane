# Update Check — DO NOT REMOVE

This domain implements the **Check for Updates** feature for Headplane.

## Purpose

This is a **fork-specific feature** that must survive upstream merges. It
provides an in-app update checker for both Headplane and Headscale, comparing
the running Docker image's embedded commit hash (`APP_COMMIT` build arg) against
the latest commit on the remote `main` branch.

## Why This Domain Exists

- Both projects are forks that regularly merge upstream changes.
- Upstream merges can delete or overwrite fork-specific features.
- By isolating all update-check logic in this single directory, the feature is
  easy to restore if removed, and easy to protect with CI checks.

## Protection

- **Do not remove this directory or its contents.**
- This feature is required for the fork. If an upstream merge removes it,
  restore it by copying the directory back into place.
- CI should verify that `app/update-check/` exists.

## How It Works

1. At build time, the Docker pipeline embeds the short git commit hash as
   `__COMMIT_HASH__` (via `HEADPLANE_COMMIT` env var in Vite's `define`).
2. On page load, the `UpdateCheckProvider` component fetches the latest commit
   hash from the remote `main` branch of both repositories via the GitHub API.
3. If the hashes differ, an `UpdateCheckModal` is shown.
4. A "Check for updates" button in the header menu triggers an immediate check.

## Repositories

- Headplane: https://github.com/arsydoni4326-alt/headplane.git
- Headscale: https://github.com/arsydoni4326-alt/headscale.git

## Files

| File                 | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `index.ts`           | Public exports                            |
| `types.ts`           | Shared types                              |
| `git-api.ts`         | GitHub API calls                          |
| `useUpdateCheck.ts`  | React hook for update state               |
| `UpdateCheckProvider.tsx` | Context provider                     |
| `UpdateCheckModal.tsx`    | Modal component                      |