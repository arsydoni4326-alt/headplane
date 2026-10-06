import bcrypt from "bcryptjs";

export interface BcryptValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a bcrypt hash is well-formed and uses cost 12.
 * Does not accept plaintext, malformed input, or other cost factors.
 */
export function validateBcryptHash(hash: string): BcryptValidationResult {
  if (!hash || hash.length === 0) {
    return { valid: false, error: "Password hash is empty" };
  }

  // Bcrypt hashes have the format: $2a$12$... or $2b$12$...
  const bcryptPattern = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;
  const match = hash.match(bcryptPattern);

  if (!match) {
    return { valid: false, error: "Password is not a valid bcrypt hash (must be bcrypt cost-12)" };
  }

  const cost = parseInt(match[1], 10);
  if (cost !== 12) {
    return {
      valid: false,
      error: `Password hash uses bcrypt cost ${cost}, but only cost 12 is supported`,
    };
  }

  return { valid: true };
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 * Returns true if the password matches, false otherwise.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}

/**
 * Hashes a plaintext password with bcrypt cost 12.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}
