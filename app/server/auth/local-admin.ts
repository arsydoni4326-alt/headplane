import { verifyPassword } from "./bcrypt-utils";

export interface LocalAdminConfig {
  username: string;
  passwordHash: string;
}

export interface LocalAdminAuthResult {
  success: boolean;
  error?: string;
}

export interface LocalAdminService {
  authenticate(username: string, password: string): Promise<LocalAdminAuthResult>;
  getUsername(): string;
  updateCredentials(credentials: Partial<LocalAdminConfig>): void;
}

interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
}

/**
 * Creates a local admin authentication service with rate limiting.
 * Never logs secrets or hashes.
 */
export function createLocalAdminService(config: LocalAdminConfig): LocalAdminService {
  let currentUsername = config.username;
  let passwordHash = config.passwordHash;
  const rateLimitMap = new Map<string, RateLimitEntry>();
  const MAX_ATTEMPTS = 5;
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  function checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(identifier);

    if (!entry) {
      return true; // No previous attempts
    }

    // Reset if outside the window
    if (now - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(identifier);
      return true;
    }

    return entry.attempts < MAX_ATTEMPTS;
  }

  function recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const entry = rateLimitMap.get(identifier);

    if (!entry || now - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(identifier, { attempts: 1, lastAttempt: now });
    } else {
      entry.attempts += 1;
      entry.lastAttempt = now;
    }
  }

  function recordSuccessfulAttempt(identifier: string): void {
    rateLimitMap.delete(identifier);
  }

  async function authenticate(
    loginUsername: string,
    password: string,
  ): Promise<LocalAdminAuthResult> {
    const identifier = loginUsername;

    if (!checkRateLimit(identifier)) {
      return {
        success: false,
        error: "Too many failed attempts. Please try again later.",
      };
    }

    if (loginUsername !== currentUsername) {
      recordFailedAttempt(identifier);
      return { success: false, error: "Invalid username or password" };
    }

    const valid = await verifyPassword(password, passwordHash);
    if (!valid) {
      recordFailedAttempt(identifier);
      return { success: false, error: "Invalid username or password" };
    }

    recordSuccessfulAttempt(identifier);
    return { success: true };
  }

  function getUsername(): string {
    return currentUsername;
  }

  function updateCredentials(credentials: Partial<LocalAdminConfig>): void {
    if (credentials.username !== undefined) {
      currentUsername = credentials.username;
    }
    if (credentials.passwordHash !== undefined) {
      passwordHash = credentials.passwordHash;
    }
    rateLimitMap.clear();
  }

  return {
    authenticate,
    getUsername,
    updateCredentials,
  };
}
