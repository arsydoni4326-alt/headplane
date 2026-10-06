# Phase 13c Session 3 - Testing and Validation

## Context

You are continuing Phase 13c (Single Local Administrator Migration) implementation.
Sessions 1 and 2 completed backend infrastructure and UI, but **testing is critically missing**.

**Branch:** `feature/phase13c-single-admin` (Headplane)  
**Parent Branch:** `feature/phase13c-headplane-single-admin`  
**Last Commit:** Headplane `66b0be9`, Parent `55a2250e`  
**Baseline:** Read `SESSION2_COMPLETE.md` and `SESSION3_TASKS.md`

## Your Task

Add **comprehensive test coverage** for the completed UI and backend functionality.

### Priority 1: E2E Tests (CRITICAL - START HERE)

Create end-to-end tests for the user-facing flows:

**File:** `tests/e2e/admin-password-reset.spec.ts`

Test scenarios:

1. Complete password reset flow (login → /admin → reset → logout → login with new password)
2. Current password validation (reject incorrect current password)
3. Password confirmation matching (reject mismatched passwords)
4. Minimum password length validation
5. Session invalidation (verify old session no longer works)
6. Immutable config handling (show CLI guidance when config read-only)

**File:** `tests/e2e/admin-api-keys.spec.ts`

Test scenarios:

1. List API keys (display prefix, expiry, created date)
2. Create API key flow (select expiration → create → copy secret)
3. Service key identification (badge displayed for configured key)
4. Service key protection (delete button disabled for service key)
5. Delete non-service key (confirmation dialog → delete → removed from list)
6. Self-revocation (delete own session key → immediate logout)

**File:** `tests/e2e/login.spec.ts` (UPDATE EXISTING)

Add test:

- Password-only mode works when local admin configured (no OIDC/proxy options shown)

### Priority 2: Integration Tests (IMPORTANT)

Create integration tests for CLI tools:

**File:** `tests/integration/cli/migrate-local-admin.test.ts`

Test scenarios:

1. Migrate single admin from legacy DB
2. Require --username when multiple admins exist
3. Idempotency (no-op if already migrated)
4. Dry-run mode (show plan without making changes)
5. Target conflict detection (fail if different credentials already exist)
6. Database immutability (DB unchanged after migration)

**File:** `tests/integration/cli/reset-password.test.ts`

Test scenarios:

1. Reset password successfully (atomic write, fsync, rename)
2. Validate config path exists
3. Handle read-only config (graceful error)
4. Preserve other config fields (don't overwrite unrelated settings)
5. Re-validate config after write

### Priority 3: Unit Tests (GOOD TO HAVE)

**File:** `tests/unit/auth/session-invalidation.test.ts`

Test that `invalidatePasswordSessions()` correctly:

1. Deletes all password sessions
2. Preserves API-key sessions
3. Returns correct count of deleted sessions

### Priority 4: CLI Packaging Verification

Verify CLI tools work in all environments:

1. **Check package.json:** Add bin entries if missing
2. **Test Docker build:**
   ```bash
   docker build -t headplane .
   docker run headplane headplane hash-password --help
   docker run headplane headplane migrate-local-admin --help
   docker run headplane headplane reset-local-admin-password --help
   ```
3. **Test Nix build:**
   ```bash
   nix build
   ./result/bin/headplane hash-password --help
   ./result/bin/headplane migrate-local-admin --help
   ./result/bin/headplane reset-local-admin-password --help
   ```

### Priority 5: Documentation Updates

Update status documents:

1. **`IMPLEMENTATION_STATUS.md`** - Mark all UI sections as complete
2. **`CHANGELOG.md`** - Add Session 2 UI implementation entry
3. **`PHASE13C_INCOMPLETE.md`** - Remove UI from incomplete list or mark as complete

## Implementation Guidelines

### E2E Test Pattern (Playwright)

Follow existing patterns in `tests/e2e/` directory:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Admin Password Reset", () => {
  test("resets password and invalidates sessions", async ({ page, context }) => {
    // Setup: Login with initial password
    await page.goto("/login");
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "initial-password");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/machines");

    // Navigate to admin page
    await page.goto("/admin");

    // Fill password reset form
    await page.fill("#current_password", "initial-password");
    await page.fill("#new_password", "new-password-123");
    await page.fill("#confirm_password", "new-password-123");
    await page.click('button[type="submit"]');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Old password should fail
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "initial-password");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/invalid/i")).toBeVisible();

    // New password should work
    await page.fill('input[name="password"]', "new-password-123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/machines");
  });
});
```

### Integration Test Pattern (Vitest)

Follow existing patterns in `tests/integration/` directory:

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("migrate-local-admin CLI", () => {
  it("migrates single admin from legacy DB", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "migrate-test-"));
    const dbPath = join(tempDir, "db.sqlite");
    const configPath = join(tempDir, "config.yaml");

    // Create test DB and config
    // Run migration
    // Verify results
  });
});
```

## Validation Before Commit

```bash
cd headplane
pnpm run test:unit          # Must pass
pnpm run test:integration   # Must pass
pnpm run test:e2e          # Must pass
pnpm run typecheck         # Must pass
pnpm run lint              # Must pass
pnpm run build             # Must pass
```

## Commit Strategy

Commit tests in logical groups:

```bash
# Commit 1: E2E tests
cd headplane
git add tests/e2e/admin-*.spec.ts
git commit -m "test(e2e): add admin password reset and API key tests"

# Commit 2: Integration tests
git add tests/integration/cli/
git commit -m "test(integration): add CLI tool tests"

# Commit 3: CLI packaging (if changes needed)
git add package.json Dockerfile flake.nix
git commit -m "build: ensure CLI tools packaged in Docker and Nix"

# Commit 4: Documentation
git add IMPLEMENTATION_STATUS.md CHANGELOG.md PHASE13C_INCOMPLETE.md
git commit -m "docs: update Phase 13c status to complete"

# Update parent gitlink
cd ..
git add headplane
git commit -m "headplane: add comprehensive test coverage for Phase 13c"
```

## Success Criteria

- [ ] All E2E tests pass (admin password reset, API keys, login)
- [ ] All integration tests pass (CLI tools)
- [ ] All unit tests pass (session invalidation)
- [ ] CLI tools work in Docker
- [ ] CLI tools work in Nix
- [ ] Documentation updated
- [ ] All validation steps pass
- [ ] No test regressions

## Reference Documentation

Before starting, read:

- `SESSION2_COMPLETE.md` (what was implemented)
- `SESSION3_TASKS.md` (detailed task breakdown)
- `docs/phase13c-single-admin-migration-plan.md` (original spec)
- `headplane/docs/development/testing.md` (testing patterns)

## Estimated Time

- E2E tests: 3-4 hours
- Integration tests: 2-3 hours
- CLI packaging: 1-2 hours
- Documentation: 1 hour
- **Total: 7-10 hours**

## Questions?

If anything is unclear:

1. Read the reference documentation above
2. Check existing test patterns in `tests/e2e/` and `tests/integration/`
3. Examine the implemented UI in `app/routes/admin/`
4. Ask specific questions before proceeding

**Do not skip the testing steps.** This is production code that needs test coverage.
