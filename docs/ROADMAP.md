# Roadmap

This document tracks the high-level direction of Headplane: what is currently
in progress, what is planned, and what is intentionally deferred. It is
maintained alongside the implementation and kept aligned with the actual
project state.

> For a detailed list of past changes, see the
> [CHANGELOG](./CHANGELOG.md). For the service architecture patterns that
> guide ongoing development, see [Architecture](./development/architecture.md).

## Core Tenets

Every roadmap item must support these project tenets:

1. **Simple starts** — easy to set up and use, while staying powerful for
   advanced users.
2. **No breaking changes** — backward compatibility is preserved, and any
   unavoidable breaking change ships with a clear migration path.
3. **Documentation** — features are only complete when their documentation is.

## In Progress

- **Structured ACL editor** — a structured editor for ACL rules, tags, and
  groups (landed as a UI feature, iterated on with feedback from the
  [#608](https://github.com/tale/headplane/pull/608) PR).
- **Agent hardening** — improving the Headplane Agent's Tailscale integration,
  including opt-outs for problematic routing-loop socket handling and safer
  fallback behavior when the agent cannot join the Tailnet.
- **Indestructible update checker** — a self-contained, isolated domain
  (`app/update-check/`) that checks for updates on every page load for both
  Headplane and Headscale by comparing the embedded build commit hash against
  the remote `main` branch. Protected from accidental removal during upstream
  merges.

## Planned

- **Machine management parity** — close gaps between the Tailscale admin
  console and Headplane (route management, key rotation, device posture).
- **Improved OIDC workflows** — finer-grained role mapping, better sync
  behavior for groups and roles, and per-provider troubleshooting docs.
- **DNS management improvements** — better provisioning of DNS records into
  Headscale, including `extra_records_path` handling.
- **Headscale version compatibility tracking** — proactive detection of
  unsupported Headscale features based on the server's reported version.

## Deferred

These items are deliberately out of scope for now and should not be
implemented until the current tasks require them:

- Alternative frontend frameworks (a prior Svelte branch was explored and
  shelved; the current React Router 7 setup is authoritative).
- A plugin/extension system for third-party UI components.
- Multi-Headscale-instance management from a single dashboard.

## Tracking

- Day-to-day work is tracked via
  [GitHub issues](https://github.com/tale/headplane/issues) with labels such
  as "Needs Triage", "Needs Info", "Bug", and "Enhancement".
- Long-horizon items live here. When an item moves from Planned to In
  Progress, update this document in the same change as the implementation.
- Completed items are removed from this document and recorded in the
  [CHANGELOG](./CHANGELOG.md) instead.