import { and, desc, eq, sql } from "drizzle-orm";
import { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { ulid } from "ulidx";

import { auditLog } from "../db/schema";
import type { Principal } from "../web/auth";

export type AuditAction =
  | "machine.register"
  | "machine.rename"
  | "machine.expire"
  | "machine.rotate_key"
  | "machine.delete"
  | "machine.tags"
  | "machine.routes"
  | "machine.reassign"
  | "acl.update"
  | "dns.update"
  | "settings.update"
  | "authkey.create"
  | "authkey.expire"
  | "user.create"
  | "user.rename"
  | "user.delete"
  | "user.link"
  | "user.reassign";

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditListOptions {
  limit?: number;
  offset?: number;
  action?: string | null;
  actorName?: string | null;
}

export interface AuditService {
  record(entry: {
    actorId?: string | null;
    actorName: string;
    action: AuditAction;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
    createdAt?: Date;
  }): Promise<void>;
  list(options?: AuditListOptions): Promise<{ records: AuditEntry[]; total: number }>;
}

export function createAuditService(db: NodeSQLiteDatabase): AuditService {
  return {
    async record(entry) {
      await db.insert(auditLog).values({
        id: ulid(),
        actor_id: entry.actorId ?? null,
        actor_name: entry.actorName,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ?? null,
        details: entry.details ?? null,
        created_at: entry.createdAt ?? new Date(),
      });
    },

    async list(options) {
      const { limit = 50, offset = 0, action = null, actorName = null } = options ?? {};

      const conditions = [];
      if (action) {
        conditions.push(eq(auditLog.action, action));
      }
      if (actorName) {
        conditions.push(eq(auditLog.actor_name, actorName));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLog)
        .where(where);

      const rows = await db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.created_at), desc(auditLog.id))
        .limit(limit)
        .offset(offset);

      return {
        records: rows.map((row) => ({
          id: row.id,
          actorId: row.actor_id,
          actorName: row.actor_name,
          action: row.action as AuditAction,
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          details: row.details,
          createdAt: row.created_at,
        })),
        total: count,
      };
    },
  };
}

/**
 * Derives a stable actor identity from a request principal for audit
 * logging. User principals use their profile name (falling back to email
 * or subject); API-key principals use their display name.
 */
export function actorFromPrincipal(principal: Principal): {
  actorId: string | null;
  actorName: string;
} {
  if (principal.kind === "api_key") {
    return { actorId: null, actorName: principal.displayName };
  }

  if (principal.kind === "password") {
    return { actorId: null, actorName: principal.username };
  }

  const name = principal.profile.name || principal.profile.email || principal.user.subject;
  return { actorId: principal.user.id, actorName: name };
}
