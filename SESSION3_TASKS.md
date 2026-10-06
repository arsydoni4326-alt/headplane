# Phase 13c Session 3 - Remaining Tasks

**Date:** 2026-10-06  
**Last Commit:** Headplane `649e326`, Parent `ffbb4443`  
**Status:** UI Complete, Testing Pending

## Completed (Sessions 1 & 2)

- ✅ Backend: Local admin auth, session invalidation, CLI tools, OIDC/proxy disablement
- ✅ UI: Admin route, password reset, API-key management, legacy code removal
- ✅ Build: TypeScript, lint, build all passing

## Critical Remaining Work

### 1. E2E Tests (HIGH PRIORITY - 3-4 hours)

**Create:**

```
tests/e2e/admin-password-reset.spec.ts
tests/e2e/admin-api-keys.spec.ts
```

**Test Scenarios:**

- Password reset flow (verify session invalidation)
- Current password validation
- Password confirmation matching
- API key create/delete
- Service key protection
- Self-revocation logout
- Immutable config handling

**Update:**

```
tests/e2e/login.spec.ts  (verify password-only mode works)
```

### 2. Integration Tests (MEDIUM PRIORITY - 2-3 hours)

**Create:**

```
tests/integration/cli/migrate-local-admin.test.ts
tests/integration/cli/reset-password.test.ts
```

**Test Scenarios:**

- Migration from legacy DB
- Password reset atomic writes
- Idempotency
- Error handling (multiple admins, invalid config, etc.)

### 3. Unit Tests (LOW PRIORITY - 1 hour)

**Create:**

```
tests/unit/auth/session-invalidation.test.ts
```

Test that `invalidatePasswordSessions()` deletes only password sessions.

### 4. CLI Tool Packaging (MEDIUM PRIORITY - 1-2 hours)

**Verify:**

- CLI tools executable in Docker
- CLI tools executable in Nix
- Add to package.json bin if needed

**Test:**

```bash
docker build -t headplane . && docker run headplane headplane hash-password --help
nix build && ./result/bin/headplane hash-password --help
```

### 5. Documentation (LOW PRIORITY - 1 hour)

**Update:**

- `IMPLEMENTATION_STATUS.md` - Mark UI complete
- `CHANGELOG.md` - Add Session 2 changes
- `PHASE13C_INCOMPLETE.md` - Update or rename

## Validation Checklist

```bash
cd headplane
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run docs:build
```

All must pass with 0 errors.

## Success Criteria

- [ ] All E2E tests pass
- [ ] All integration tests pass
- [ ] CLI tools work in Docker/Nix
- [ ] Documentation updated
- [ ] All validation passes
- [ ] No test regressions

## Estimated Time: 7-10 hours

---

**Next Session Priority:** E2E tests first (most critical).
