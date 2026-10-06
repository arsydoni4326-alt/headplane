# Phase 13c Implementation Progress

## Completed ✅

### 1. Config Schema & Validation

- ✅ `user.username` and `user.password` in config schema
- ✅ Bcrypt hash validation at startup (cost-12 enforcement)
- ✅ Empty/plaintext/malformed hash rejection
- ✅ `user.password_path` support for file-based secrets

### 2. Local Admin Authentication

- ✅ `createLocalAdminService()` closure factory with rate limiting
- ✅ bcrypt password verification
- ✅ No secret logging
- ✅ Rate limiting (5 attempts per 15 minutes per username)

### 3. Login Flow

- ✅ Local admin auth integrated into login action
- ✅ Password session creation with configured service API key
- ✅ API-key login preserved as secondary method
- ✅ Login UI with password/API-key toggle

### 4. Session Management

- ✅ `auth_sessions` table with `kind: 'password'`
- ✅ Password sessions use configured `headscale.api_key`
- ✅ `invalidatePasswordSessions()` method added to AuthService

### 5. OIDC & Proxy Auth Disablement

- ✅ OIDC disabled when `localAdmin.state === 'enabled'`
- ✅ Proxy auth disabled when `localAdmin.state === 'enabled'`
- ✅ `buildProxyAuthConfig()` returns `undefined` in single-admin mode
- ✅ Code retained, just not instantiated

### 6. CLI Tools

- ✅ `cmd/headplane-hash-password.ts` - hash password with cost-12 bcrypt
- ✅ `cmd/headplane-migrate-local-admin.ts` - migrate legacy admin from SQLite
- ✅ `cmd/headplane-reset-local-admin-password.ts` - reset password atomically

## In Progress / Remaining 🚧

### 7. Admin UI Replacement

- ❌ Replace `/admin/users` route with single-admin administration page
- ❌ Single-admin notice UI
- ❌ Password reset form (current password + new password + confirmation)
- ❌ Session invalidation on password reset
- ❌ Immutable config handling (when config is not writable)

### 8. API-Key Lifecycle UI

- ❌ List API keys with metadata
- ❌ Create API key with one-time secret display
- ❌ Expire/delete with confirmation
- ❌ Service-key protection (prevent deletion of configured key)
- ❌ Self-revocation logout handling
- ❌ External `api_key_path` guidance in UI

### 9. Testing

- ❌ Unit tests for local admin auth, rate limiting, session invalidation
- ❌ Integration tests for migration tool
- ❌ E2E tests for login, password reset, API-key UI
- ❌ Update existing tests broken by changes

### 10. Documentation & Build

- ❌ CLI tools need to be built and packaged (executable in Docker/Nix)
- ❌ Update package.json bin entries if needed
- ❌ Build system changes for CLI tools

### 11. Remove Legacy Code

- ❌ Remove `headscale.passwordLogin()` calls from login action
- ❌ Remove passwordLogin from Headscale API client

## Files Modified So Far

### Core Implementation

- `app/server/config/config-schema.ts` (already had user.username/password)
- `app/server/config/load.ts` (already had bcrypt validation)
- `app/server/auth/bcrypt-utils.ts` (already existed)
- `app/server/auth/local-admin.ts` (already existed)
- `app/server/context.ts` (proxy auth disablement added)
- `app/server/web/auth.ts` (invalidatePasswordSessions added)
- `app/routes/auth/login/action.ts` (already used local admin)
- `app/routes/auth/login/page.tsx` (already had password/API-key toggle)

### New CLI Tools

- `cmd/headplane-migrate-local-admin.ts` (NEW)
- `cmd/headplane-reset-local-admin-password.ts` (NEW)
- `cmd/headplane-hash-password.ts` (already existed)

## Next Critical Tasks

1. **Admin UI** - Create new administration page with password reset and API-key management
2. **Legacy Code Removal** - Remove `headscale.passwordLogin`
3. **Testing** - Add comprehensive tests
4. **Build System** - Ensure CLI tools are executable

## Known Gaps

- Need to verify CLI tools are built correctly in Docker/Nix
- Need to add `better-sqlite3` and `js-yaml` dependencies for CLI tools
- Need session invalidation trigger on password reset
- Need API-key protection logic (identify and protect configured service key)
