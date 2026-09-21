# Session Notes

Short-lived working context for AI-assisted sessions. Keep this concise;
permanent documentation belongs in `docs/`.

## Current Objective

Create and maintain the project-guidelines documentation set required by the
project workflow: `session.md` (this file), `docs/ROADMAP.md`,
`docs/SPECIFICATION.md`, and `docs/ARCHITECTURE.md`, and keep the docs site
navigation consistent with them.

## Progress

- [x] Audited existing documentation (README, CONTRIBUTING, CHANGELOG,
      AGENTS.md, docs site).
- [x] Started git flow feature `feature/project-guidelines` from `develop`.
- [x] Created `docs/ROADMAP.md`, `docs/SPECIFICATION.md`,
      `docs/ARCHITECTURE.md` (docs-site pages, linked from the sidebar).
- [x] Updated `docs/.vitepress/config.ts` sidebar to expose the new pages
      under Development.
- [x] Added CHANGELOG `# Next` entry.
- [x] Verified docs build (`pnpm run docs:build`), lint (`pnpm run lint`),
      and typecheck (`pnpm run typecheck`).
- [ ] Commit and finish feature, then cut a release via git flow release.

## Decisions and Assumptions

- The project already had a docs-site architecture page
  (`docs/development/architecture.md`) that documents server service
  patterns. To avoid duplication, the new root `docs/ARCHITECTURE.md`
  documents the system-level architecture and explicitly defers service
  patterns to that page.
- `docs/ROADMAP.md`, `docs/SPECIFICATION.md`, and `docs/ARCHITECTURE.md`
  live in `docs/` (not the repository root) because `docs/` is the
  authoritative documentation location for this project and the VitePress
  site builds from it.
- Roadmap content was derived from the changelog, existing branches, and
  issues; nothing speculative was added, and deferred items (e.g. the Svelte
  exploration) are recorded as intentionally out of scope.
- No code changes were required for this task; documentation only.

## Discoveries

- `docs/CHANGELOG.md` is a symlink to the root `CHANGELOG.md`; the docs site
  links to it directly. VitePress builds the CHANGELOG, so relative doc
  links inside it must resolve from `docs/` — plain prose entries avoid
  dead-link build failures.
- Git flow (AVH 1.12.3) is installed; branch prefixes were configured
  (`main`/`develop`, `feature/`, `bugfix/`, `release/`, empty version tag
  prefix since versions in this repo are plain `x.y.z` tags).
- Release cutting is scripted: `pnpm release cut <version>` renames the
  `# Next` changelog section, bumps `package.json`, commits, and tags.
- The runtime wiring function is `createAppContext()` in
  `app/server/context.ts` (not `createAppRuntime()` as the older docs-site
  architecture page states); architecture docs now reference the real name.
- Config loading reality: YAML file (default `/etc/headplane/config.yaml`)
  merged with `HEADPLANE_*` env overrides (`__` nesting), arktype schema,
  sensitive `*_path` resolution. The old `HEADSCALE_CONFIG_UNSTRICT`
  variable no longer exists; `headscale.config_strict` is deprecated/no-op.
- `pnpm` is not on PATH in this environment; use `corepack pnpm`. System
  node is v22 (engines want >=24.2), which produces an engine warning but
  everything used here works.

## Known Issues / Limitations

- Pre-existing oxlint warning in `app/utils/live-data.tsx` (unused
  parameter `_`), unrelated to this change.
- The docs-site `docs/development/architecture.md` still says
  `createAppRuntime()` in its "Adding a New Service" section; left as-is
  (scope discipline) but noted here for a future fix.

## Pending Work

- Commit, `git flow feature finish project-guidelines` back into `develop`.
- Start `git flow release` per the release workflow for this change set.