import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { eq } from "drizzle-orm";
import { ulid } from "ulidx";

import type {
  CreateInstanceRequest,
  HeadscaleInstanceConfig,
  HeadscaleInstanceListItem,
  UpdateInstanceRequest,
} from "~/types/Instance";
import log from "~/utils/log";

import type { createDbClient } from "./db/client.server";
import { instances } from "./db/schema";

type DbClient = Awaited<ReturnType<typeof createDbClient>>;

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives an encryption key from a secret.
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Encrypts a string value using AES-256-GCM.
 * Format: salt:iv:authTag:encryptedData (all base64)
 */
function encrypt(plaintext: string, secret: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return [
    salt.toString("base64"),
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted,
  ].join(":");
}

/**
 * Decrypts a string value encrypted with encrypt().
 */
function decrypt(ciphertext: string, secret: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid ciphertext format");
  }

  const [saltB64, ivB64, authTagB64, encryptedB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const key = deriveKey(secret, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedB64, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function createInstanceService(db: DbClient, encryptionSecret: string) {
  /**
   * Lists all instances (no secrets).
   */
  async function list(): Promise<HeadscaleInstanceListItem[]> {
    const records = await db.select().from(instances).all();
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      apiUrl: r.api_url,
      isDefault: r.is_default,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  /**
   * Gets a single instance by ID (no secrets).
   */
  async function get(id: string): Promise<HeadscaleInstanceListItem | null> {
    const record = await db.select().from(instances).where(eq(instances.id, id)).get();
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      name: record.name,
      apiUrl: record.api_url,
      isDefault: record.is_default,
      createdAt: record.created_at.toISOString(),
      updatedAt: record.updated_at.toISOString(),
    };
  }

  /**
   * Creates a new instance.
   */
  async function create(data: CreateInstanceRequest): Promise<HeadscaleInstanceConfig> {
    const id = ulid();
    const now = new Date();

    // If this is marked as default, unset all other defaults
    if (data.isDefault) {
      await db.update(instances).set({ is_default: false }).run();
    }

    const record = {
      id,
      name: data.name,
      api_url: data.apiUrl,
      api_key_encrypted: data.apiKey ? encrypt(data.apiKey, encryptionSecret) : null,
      oidc_client_id: data.oidcClientId ?? null,
      oidc_client_secret_encrypted: data.oidcClientSecret
        ? encrypt(data.oidcClientSecret, encryptionSecret)
        : null,
      is_default: data.isDefault ?? false,
      created_at: now,
      updated_at: now,
    };

    await db.insert(instances).values(record).run();

    log.info("instances", "Created instance: %s (%s)", data.name, id);

    return {
      id,
      name: data.name,
      apiUrl: data.apiUrl,
      isDefault: data.isDefault ?? false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /**
   * Updates an existing instance.
   */
  async function update(id: string, data: UpdateInstanceRequest): Promise<void> {
    const existing = await db.select().from(instances).where(eq(instances.id, id)).get();
    if (!existing) {
      throw new Error("Instance not found");
    }

    // If this is being marked as default, unset all other defaults
    if (data.isDefault) {
      await db.update(instances).set({ is_default: false }).run();
    }

    const updated: Partial<typeof existing> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) {
      updated.name = data.name;
    }
    if (data.apiUrl !== undefined) {
      updated.api_url = data.apiUrl;
    }
    if (data.apiKey !== undefined) {
      updated.api_key_encrypted = encrypt(data.apiKey, encryptionSecret);
    }
    if (data.oidcClientId !== undefined) {
      updated.oidc_client_id = data.oidcClientId;
    }
    if (data.oidcClientSecret !== undefined) {
      updated.oidc_client_secret_encrypted = encrypt(data.oidcClientSecret, encryptionSecret);
    }
    if (data.isDefault !== undefined) {
      updated.is_default = data.isDefault;
    }

    await db.update(instances).set(updated).where(eq(instances.id, id)).run();

    log.info("instances", "Updated instance: %s", id);
  }

  /**
   * Deletes an instance.
   */
  async function remove(id: string): Promise<void> {
    await db.delete(instances).where(eq(instances.id, id)).run();
    log.info("instances", "Deleted instance: %s", id);
  }

  /**
   * Gets decrypted credentials for an instance (internal use only).
   */
  async function getCredentials(
    id: string,
  ): Promise<{ apiKey?: string; oidcClientSecret?: string } | null> {
    const record = await db.select().from(instances).where(eq(instances.id, id)).get();
    if (!record) {
      return null;
    }

    return {
      apiKey: record.api_key_encrypted
        ? decrypt(record.api_key_encrypted, encryptionSecret)
        : undefined,
      oidcClientSecret: record.oidc_client_secret_encrypted
        ? decrypt(record.oidc_client_secret_encrypted, encryptionSecret)
        : undefined,
    };
  }

  return {
    list,
    get,
    create,
    update,
    remove,
    getCredentials,
  };
}

export type InstanceService = ReturnType<typeof createInstanceService>;
