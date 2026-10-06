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
  // Rate limiting: track failed attempts per IP/identifier
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

  async function authenticate(username: string, password: string): Promise<LocalAdminAuthResult> {
    // Use username as rate-limit identifier (in production, consider IP + username)
    const identifier = username;

    if (!checkRateLimit(identifier)) {
      return {
        success: false,
        error: "Too many failed attempts. Please try again later.",
      };
    }

    if (username !== config.username) {
      recordFailedAttempt(identifier);
      return { success: false, error: "Invalid username or password" };
    }

    const valid = await verifyPassword(password, config.passwordHash);
    if (!valid) {
      recordFailedAttempt(identifier);
      return { success: false, error: "Invalid username or password" };
    }

    recordSuccessfulAttempt(identifier);
    return { success: true };
  }

  function getUsername(): string {
    return config.username;
  }

  return {
    authenticate,
    getUsername,
  };
}
