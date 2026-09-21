# Architecture

This document describes Headplane's system architecture: the major
components, their responsibilities, how data flows between them, and the key
design decisions and trade-offs.

> For the service-level patterns used in server code (closure factories,
> lifecycle hooks, error handling, testing), see
> [Architecture patterns](./development/architecture.md), which is the
> authoritative style guide for server services. For requirements, see the
> [Specification](./SPECIFICATION.md).

## System Overview

Headplane is a single Node.js web application that talks to a Headscale
control server over its REST API. Two auxiliary Go components extend it:

```
┌────────────────────────────────────────────────────────────┐
│                        Browser                             │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │  Headplane UI    │  │  Browser SSH (WASM, tsconnect) │  │
│  │  (React Router 7)│  │  connects directly to Tailnet  │  │
│  └────────┬─────────┘  └───────────────┬────────────────┘  │
└───────────┼────────────────────────────┼───────────────────┘
            │ HTTP                       │ WireGuard/DERP
┌───────────▼────────────────────────────▼───────────────────┐
│                Headplane server (Node.js)                  │
│  ┌─────────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────┐  │
│  │ OIDC/auth   │ │ Headscale│ │  SQLite │ │ Headscale   │  │
│  │ services    │ │ API client│ │ (drizzle)│ │ config I/O  │  │
│  └─────────────┘ └──────────┘ └─────────┘ └─────────────┘  │
└───────────┬─────────────────────────────────────┬──────────┘
            │ REST API                            │ Docker/K8s exec
┌───────────▼───────────┐             ┌───────────▼────────────┐
│      Headscale        │             │    Headplane Agent (Go) │
│   control server      │◄────────────│  joins Tailnet, reports │
│  (separate process)   │  Tailnet    │  node details           │
└───────────┬───────────┘             └────────────────────────┘
            │
      ┌─────▼─────┐
      │  Tailnet  │
      └───────────┘
```

## Components

### Web application (`app/`)

React Router 7 (framework mode) application built with Vite.

- **`app/routes/`** — route modules grouped by feature (`machines`, `users`,
  `acls`, `dns`, `settings`, `auth`, `ssh`). Each route owns its loader and
  action; server-only code lives in `.server` modules.
- **`app/components/`** — shared UI components (including the structured ACL
  editor and tag dialogs).
- **`app/server/`** — server-side services, wired together in a runtime:
  - `app/server/config/` — configuration schema (arktype), validation, and
    loading (YAML file merged with `HEADPLANE_*` environment overrides,
    sensitive `*_path` values resolved from disk).
  - `app/server/oidc/` — OIDC provider service (discovery, PKCE, token
    exchange, role mapping).
  - `app/server/web/` — session handling, proxy auth, identity resolution,
    and role/capability checks.
  - `app/server/headscale/` — Headscale API client, config loader (for
    reading/writing Headscale's own configuration, e.g. DNS records), and a
    live store for cached state.
  - `app/server/db/` — SQLite persistence via Drizzle ORM.
- **`app/utils/`, `app/hooks/`, `app/types/`, `app/layout/`** — shared
  utilities, hooks, types, and layout primitives.

### Go components (`cmd/`, `internal/`)

- **`cmd/hp_agent`** — the Headplane Agent. Runs next to Headscale, joins
  the Tailnet (via Tailscale/tsnet in `internal/tsnet`), and reports node
  details that the Headscale API does not expose (client versions, etc.). It
  starts with a pre-auth key, preserves state across restarts, and
  auto-approves itself when needed.
- **`cmd/hp_ssh`** — the Go support binary for Browser SSH.
- **`cmd/fake_sh`, `cmd/hp_healthcheck`** — development/operational helpers.
- **`internal/`** — shared Go code: `tsnet` (Tailnet connectivity),
  `config` (agent configuration), `util`.

### Documentation site (`docs/`)

VitePress site published at headplane.net. Configuration lives in
`docs/.vitepress/config.ts`; feature and installation docs live in
subdirectories. Feature changes must update the relevant pages here.

## Data Flow

### Authentication

1. The user requests a protected page. The route loader resolves the
   session from the signed cookie (`server.cookie_secret`).
2. If OIDC is configured and no session exists, the login flow redirects to
   the IdP; the callback exchanges the code for tokens and derives the
   identity (`sub`, email, name) and the Headplane role (from
   `oidc.role_claim` or `oidc.default_role`).
3. Capabilities are checked per-request via the role system in
   `app/server/web/roles.ts`.
4. Headscale API access uses `headscale.api_key`; proxy-auth deployments
   instead trust identity headers from `allowed_cidrs`.

### Management operations (machines, users, ACLs, DNS)

1. Route loaders/actions call Headscale API wrappers in
   `app/server/headscale/`.
2. State that Headscale cannot serve (versions, agent data) is augmented by
   the Headplane Agent's data.
3. Mutations are validated server-side first (names, expiries, ACL text),
   then forwarded to Headscale. Headscale errors are mapped to typed error
   codes and surfaced in the UI.
4. Headscale configuration changes (e.g. DNS) are written back through the
   config loader and provisioned into the Headscale process.

### Persistence

- Headplane-specific data (users, sessions, agent metadata, caches) lives
  in SQLite under `server.data_path`, accessed with Drizzle ORM; schema
  migrations live in `drizzle/`.
- Headscale remains the source of truth for nodes, users, and policies;
  Headplane never duplicates that state durably.

## Key Design Decisions

| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Closure-factory services, no DI framework | Explicit dependencies, testable without module mocking, hot-reloadable | No automatic lifecycle; wiring is manual in `createAppRuntime()` |
| Single Node process for UI + server | Simple deployment, one config file, one port | Scaling is vertical only (acceptable for admin UI) |
| SQLite via Drizzle for Headplane state | Zero-dependency persistence, matches "simple starts" tenet | Not multi-instance; fine for a single admin dashboard |
| Browser SSH as WASM in the client | No server-side SSH relay; connections stay peer-to-peer | Large WASM payload; build complexity (Nix, certs) |
| Separate Go agent for node details | Headscale API lacks some data; agent reads it from the Tailnet | Extra component to deploy (optional) |
| Strict config validation at startup | Fail fast on misconfiguration (arktype schema, partial-then-merged validation) | Invalid but unused keys abort startup; deprecated escape hatches exist (`HEADPLANE_LOAD_ENV_OVERRIDES` deprecation notice, `headscale.config_strict` no-op) |

## Constraints and Dependencies

- Node >= 24.2, PNPM >= 10.4 (`engines` in `package.json`).
- TypeScript for app/server code; Go for agent and WASM SSH; oxlint/oxfmt
  for TS linting/formatting; Go standard tooling for Go code.
- The React Router version, Drizzle, and other library choices are pinned
  in `package.json`; do not swap tooling (see
  [Contributing](./CONTRIBUTING.md) restrictions).
