# Specification

This document describes the functional and non-functional requirements for
Headplane. It is the reference for what the product must do, its constraints,
and the acceptance criteria used to evaluate changes.

> For how the system is structured internally, see
> [Architecture](./development/architecture.md). For contribution rules, see
> [Contributing](./CONTRIBUTING.md).

## Product Overview

Headplane is a self-hosted web UI for [Headscale](https://headscale.net), the
open-source implementation of the Tailscale control server. Headscale ships
without a web interface; Headplane fills that gap and aims to replicate the
functionality of the official Tailscale admin console.

## Functional Requirements

### FR-1: Authentication and Identity

- **FR-1.1**: Users authenticate via API keys (Headscale-compatible) or
  OpenID Connect (OIDC) single sign-on. API-key login can be disabled with
  `oidc.disable_api_key_login`.
- **FR-1.2**: OIDC must support popular providers (Google Workspace,
  Azure/Entra, Okta, Keycloak, Auth0, etc.) via discovery, with optional PKCE
  and configurable token endpoint auth methods.
- **FR-1.3**: Proxy authentication (`server.proxy_auth`) trusts identity
  headers from CIDR-restricted trusted reverse proxies only.
- **FR-1.4**: New OIDC users receive a configurable default role, optionally
  mapped from an IdP claim (`oidc.role_claim`). The `owner` role is only ever
  granted to the first bootstrapped user.

### FR-2: Machine Management

- **FR-2.1**: Machines (nodes) can be listed, inspected, renamed, expired,
  disabled/re-enabled for expiry, deleted, and re-owned between users.
- **FR-2.2**: Tags can be applied to machines for ACL enforcement, with
  suggestions of existing tags in the tag dialog.
- **FR-2.3**: Subnet routes per machine are visible and manageable.
- **FR-2.4**: Machine names must be validated before submission to Headscale.

### FR-3: Users

- **FR-3.1**: Users can be created, renamed, and deleted. Users that still
  own machines cannot be deleted.
- **FR-3.2**: Usernames are validated before creation/rename so that
  Headplane does not accept names Headscale allows but ACL policy can never
  match.

### FR-4: Access Control Lists

- **FR-4.1**: ACL policies (HuJSON/YAML) can be viewed and edited, including
  a structured editor for rules, tags, and groups, with a raw-text fallback.
- **FR-4.2**: ACL edits must validate before applying and clearly surface
  errors from Headscale.

### FR-5: DNS Management

- **FR-5.1**: DNS settings (MagicDNS, base domain, nameservers, search
  domains) can be viewed and edited from the UI.
- **FR-5.2**: `dns.extra_records_path` from the Headscale configuration must
  be handled correctly.

### FR-6: Headscale Configuration

- **FR-6.1**: Parts of the Headscale configuration that are hidden behind
  config files (DNS, networking, auth controls) can be managed from the UI,
  with changes provisioned back into Headscale.

### FR-7: Browser SSH

- **FR-7.1**: An ephemeral WASM-based SSH client (built on Tailscale's
  `tsconnect`) runs in the browser and connects directly to the Tailnet,
  SSHing into a target node without a server-side relay.
- **FR-7.2**: Temporary pre-auth keys are provisioned for the SSH flow;
  creation errors must surface in the UI.

### FR-8: Headplane Agent

- **FR-8.1**: A lightweight agent runs on the same server as Headscale,
  joins the Tailnet, and reports node details that the Headscale API does
  not expose (such as client versions).
- **FR-8.2**: The agent must start with a pre-auth key, preserve state
  across restarts, and auto-approve itself when Headscale requires manual
  approval.

### FR-9: Keys

- **FR-9.1**: Pre-auth keys can be created and listed, with validated expiry
  values (the raw, unformatted number is submitted and malformed values are
  rejected with a 400).

### FR-10: Update Checking

- **FR-10.1**: The UI checks for updates on every page load (and on demand via
  a "Check for Updates" button) by comparing the Docker build commit hash
  (`__COMMIT_HASH__`) against the latest commit on the remote `main` branch of
  both [headplane](https://github.com/arsydoni4326-alt/headplane) and
  [headscale](https://github.com/arsydoni4326-alt/headscale) repositories.
- **FR-10.2**: If an update is available, a modal is shown with details
  (current vs. remote commit, links to compare changes and releases).
- **FR-10.3**: The feature lives in a self-contained `app/update-check/`
  domain that is isolated from the rest of the codebase to survive upstream
  merges. It must not be removed or modified by upstream patches.
- **FR-10.4**: Headscale update checks are proxied through Headplane's backend
  at `/admin/api/update-check`, which forwards all query parameters to
  Headscale's `/api/v1/update-check` endpoint. The browser never talks to
  Headscale directly, keeping the internal Headscale URL private.

### NFR-1: Compatibility

- Headscale API version compatibility must be tracked and surfaced; unknown
  versions are treated as unknown, not ancient.
- No breaking changes to configuration, behavior, or API without an explicit
  migration path and prior discussion.

### NFR-2: Configuration

- All configuration lives in a single YAML file (default
  `/etc/headplane/config.yaml`; `config.example.yaml` is the authoritative
  sample). Sensitive values may be read from disk via `*_path` variants.
  Path-like values must never be case-mangled.
- Environment variables prefixed with `HEADPLANE_` override file values
  (`HEADPLANE_SERVER__PORT=8080` maps to `server.port`); `__` separates
  nesting levels.
- Validation is powered by an arktype schema; a partial schema is applied to
  file and env layers independently, then a strict schema validates the
  merged result. Validation errors surface as typed `ConfigError`s at
  startup with the full list of invalid fields.
- `HEADPLANE_LOAD_ENV_OVERRIDES` is deprecated (env variables are always
  loaded), and `headscale.config_strict` is deprecated with no effect
  (Headplane no longer validates the complete Headscale configuration).

### NFR-3: Security

- Session cookies are signed with a 32-character secret, are `Secure` when
  HTTPS is in use, and support domain restriction and max-age.
- Secrets are never hardcoded and never logged; sensitive values are
  protected as described in the configuration docs.
- Debug/info endpoints (e.g. `/api/info`) are gated behind a separate
  secret.
- Untrusted input (usernames, machine names, key expiries, ACL text) is
  validated server-side before it reaches Headscale.

### NFR-4: Observability

- Logging is structured JSON (pino), with error codes that map to log
  messages, UI states, and troubleshooting documentation.

### NFR-5: Deployment

- Ships as a Docker image, a native binary, and a NixOS module.
- The web app and optional agent run as separate components; the agent is
  strictly optional.

### NFR-6: Testing

- Unit tests (vitest, `unit` project) cover service logic in isolation
  using closure-factory services with explicit dependencies.
- Integration tests (`integration:*` projects) use `testcontainers` with
  real providers (Dex, Keycloak) and a real Headscale instance where
  practical.

## Constraints

- **Versioning**: semantic versioning since v0.6.0; pre-release builds are
  published under the `next` tag.
- **Stack**: React Router 7 (framework mode) + Vite + TypeScript on the
  frontend/server; Go for the agent and WASM SSH modules; PNPM >= 10.4 and
  Node >= 24.2.
- **Tooling**: oxlint/oxfmt for TypeScript, Go's standard tooling for Go
  code, lefthook for pre-commit checks.

## Acceptance Criteria

A change is considered complete when:

1. It implements the smallest correct change for the requirement and does
   not alter unrelated behavior.
2. Tests exist and pass (`pnpm run test:unit`, plus integration tests when
   relevant), and `pnpm run typecheck` is clean.
3. The documentation (docs site, `config.example.yaml` comments, README,
   CHANGELOG `# Next` section) reflects the new behavior.
4. No breaking change to configuration or API exists without a documented
   migration path.
