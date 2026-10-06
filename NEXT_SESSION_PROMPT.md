# Phase 13c Continuation - Session 2 Prompt

## Context

You are continuing Phase 13c (Single Local Administrator Migration) implementation.
Session 1 completed backend infrastructure but **did not implement required UI**.

**Branch:** `feature/phase13c-single-admin` (Headplane)  
**Parent Branch:** `feature/phase13c-headplane-single-admin`  
**Last Commit:** `6aa37ea5fded37d9f5828cfc623c312b052ab215`  
**Baseline:** Read `PHASE13C_INCOMPLETE.md` for current state

## Your Task

Complete the **required user-facing components** that were not implemented:

### 1. Admin UI Replacement (CRITICAL - START HERE)

**Goal:** Replace `/admin/users` with single-admin administration page

**Required Features:**

- Display single-admin notice: "Headplane is configured for one local administrator. User management is not available in this mode."
- Password reset form:
  - Current password field (verify with `localAdmin.authenticate()`)
  - New password field
  - Confirm password field
  - Validation: passwords match, minimum length, etc.
- Server action (`action` function in route):
  - Verify current password
  - Hash new password with `hashPassword()` (bcrypt cost 12)
  - Atomically update config file (use same pattern as CLI tool)
  - Call `auth.invalidatePasswordSessions()` to force re-login
  - Redirect to login with success message
- Handle immutable config:
  - Detect when config file is read-only
  - Show message: "Config is read-only. Use CLI tool: headplane reset-local-admin-password"
- Remove or hide legacy user CRUD components

**Files to create/modify:**

```
app/routes/admin/route.tsx                  NEW (replaces admin/users/route.tsx)
app/routes/admin/components/                NEW directory
app/routes.ts                               UPDATE route registration
```

**Implementation hints:**

- Use `localAdminContext` to access local admin service
- Use `authContext` to call `invalidatePasswordSessions()`
- Use `appConfigContext` to get config path for atomic write
- Follow existing route patterns in `app/routes/`
- Use existing UI components from `app/components/`

### 2. API-Key Lifecycle UI (CRITICAL)

**Goal:** Add API-key management to admin page

**Required Features:**

- List API keys section:
  - Fetch via `headscale.client(apiKey).apiKeys.list()`
  - Display: prefix, expiry, created date
  - Identify configured service key (match `headscale.api_key` against list)
  - Mark service key with badge/icon
- Create API key dialog:
  - Expiry date/duration selector
  - Create via `headscale.client(apiKey).apiKeys.create()`
  - One-time secret display with copy button
  - Warning: "Save this key now. It will not be shown again."
- Delete API key:
  - Confirmation dialog
  - Block deletion if it's the configured service key
  - Show error: "Cannot delete configured service key"
  - If user deletes their own API-key session, immediately logout
- Service key rotation:
  - For writable `headscale.api_key`: show guided flow
  - For `headscale.api_key_path`: show manual instructions

**Files to create/modify:**

```
app/routes/admin/route.tsx                  ADD API-key section
app/routes/admin/components/api-keys.tsx    NEW
app/routes/admin/dialogs/                   NEW directory
```

### 3. Testing (CRITICAL)

**Goal:** Add test coverage for all new functionality

**Required Tests:**

Unit tests:

```
tests/unit/auth/local-admin-service.test.ts        NEW
tests/unit/auth/session-invalidation.test.ts       NEW
tests/unit/auth/runtime-disablement.test.ts        NEW
tests/integration/cli/migrate-local-admin.test.ts  NEW
tests/integration/cli/reset-password.test.ts       NEW
```

E2E tests:

```
tests/e2e/admin-password-reset.spec.ts             NEW
tests/e2e/admin-api-keys.spec.ts                   NEW
tests/e2e/login.spec.ts                            UPDATE
```

**Test scenarios:**

- Local admin auth: valid/invalid credentials, rate limiting
- Session invalidation: password sessions deleted, API-key sessions preserved
- OIDC/proxy disablement: features unavailable when local admin configured
- CLI migration: all success/error paths, idempotency
- CLI password reset: valid/invalid inputs, atomic writes
- Admin UI: password reset flow, API-key CRUD, service-key protection

### 4. Legacy Code Removal (REQUIRED)

**Goal:** Remove old password login implementation

**Files to modify:**

```
app/server/headscale/api/resources/auth.ts    REMOVE passwordLogin()
app/routes/auth/login/action.ts               REMOVE legacy fallback
tests/unit/auth/password-login-action.test.ts UPDATE or REMOVE
```

### 5. Build Integration (REQUIRED)

**Goal:** Ensure CLI tools are packaged correctly

**Check:**

- CLI tools executable in Docker
- CLI tools executable in Nix
- Add to package.json bin if needed
- Update Dockerfile/flake.nix if needed

## Validation Before Commit

```bash
cd headplane
pnpm run typecheck
pnpm run lint
pnpm run test:unit
pnpm run test:e2e
pnpm run build
pnpm run docs:build
```

All must pass with 0 errors.

## Commit Strategy

Commit to nested Headplane branch, then update parent gitlink:

```bash
cd headplane
git add [files]
git commit -m "admin: complete single-admin UI and testing

- Replace /admin/users with single-admin administration page
- Add password reset form with current password verification
- Add API-key lifecycle UI with service-key protection
- Add comprehensive unit, integration, and E2E tests
- Remove legacy passwordLogin() implementation
- Ensure CLI tools are packaged for Docker/Nix

Completes Phase 13c single local administrator migration."

cd ..
git add headplane
git commit -m "headplane: complete single-admin UI and testing"
```

## Success Criteria

- [ ] Admin UI fully functional (password reset works end-to-end)
- [ ] API-key UI fully functional (create/delete works, service key protected)
- [ ] All tests pass
- [ ] Legacy code removed
- [ ] CLI tools packaged correctly
- [ ] All validation steps pass
- [ ] Commits clean and descriptive

## Reference Documentation

Before starting, read:

- `AGENT_INSTRUCTIONS.md`
- `docs/phase13c-single-admin-migration-plan.md`
- `headplane/docs/development/architecture.md`
- `headplane/docs/development/testing.md`
- `PHASE13C_INCOMPLETE.md` (what was done)
- `IMPLEMENTATION_STATUS.md` (detailed status)

## Key Implementation Patterns

**Config atomic write:**

```typescript
import { dump, load } from "js-yaml";
import { writeFile, readFile, rename } from "node:fs/promises";

const config = load(await readFile(configPath, "utf8"));
config.user.password = newHash;
const yaml = dump(config);
const tmpPath = `${configPath}.tmp`;
await writeFile(tmpPath, yaml, { mode: 0o600 });
const fs = await import("node:fs/promises");
const fd = await fs.open(tmpPath, "r+");
await fd.datasync();
await fd.close();
await fs.rename(tmpPath, configPath);
```

**Session invalidation:**

```typescript
const count = await auth.invalidatePasswordSessions();
// All password sessions deleted, user must re-login
```

**Service key identification:**

```typescript
const configuredKey = config.headscale.api_key;
const apiKeys = await headscale.client(configuredKey).apiKeys.list();
const serviceKey = apiKeys.find((k) => configuredKey.startsWith(k.prefix.replaceAll("*", "")));
```

## Estimated Time

- Admin UI: 4-6 hours
- API-Key UI: 3-4 hours
- Testing: 4-6 hours
- Cleanup: 2-3 hours
- **Total: 13-19 hours**

## Questions?

If anything is unclear:

1. Read the reference documentation above
2. Check existing route implementations for patterns
3. Ask specific questions before proceeding

**Do not skip the testing or validation steps.**
