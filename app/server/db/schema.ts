import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { HostInfo } from "~/types";

export const hostInfo = sqliteTable("host_info", {
  host_id: text("host_id").primaryKey(),
  payload: text("payload", { mode: "json" }).$type<HostInfo>(),
  updated_at: integer("updated_at", { mode: "timestamp" }).$default(() => new Date()),
});

export type HostInfoRecord = typeof hostInfo.$inferSelect;
export type HostInfoInsert = typeof hostInfo.$inferInsert;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  sub: text("sub").notNull().unique(),
  name: text("name"),
  email: text("email"),
  picture: text("picture"),
  role: text("role").notNull().default("member"),
  headscale_user_id: text("headscale_user_id").unique(),
  created_at: integer("created_at", { mode: "timestamp" }).$default(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" }).$default(() => new Date()),
  last_login_at: integer("last_login_at", { mode: "timestamp" }),

  // Deprecated: kept for migration compatibility, will be removed in 1.0
  caps: integer("caps").notNull().default(0),
});

export type HeadplaneUser = typeof users.$inferSelect;
export type HeadplaneUserInsert = typeof users.$inferInsert;

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // 'oidc' | 'api_key' (proxy auth is request-scoped)
  user_id: text("user_id"),
  api_key_hash: text("api_key_hash"),
  api_key_display: text("api_key_display"),
  oidc_id_token: text("oidc_id_token"),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).$default(() => new Date()),
});

export type AuthSessionRecord = typeof authSessions.$inferSelect;
export type AuthSessionInsert = typeof authSessions.$inferInsert;

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actor_id: text("actor_id"),
  actor_name: text("actor_name").notNull(),
  action: text("action").notNull(),
  resource_type: text("resource_type").notNull(),
  resource_id: text("resource_id"),
  details: text("details", { mode: "json" }).$type<Record<string, unknown> | null>(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$default(() => new Date()),
});

export type AuditLogRecord = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;

export const instances = sqliteTable("instances", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  api_url: text("api_url").notNull(),
  api_key_encrypted: text("api_key_encrypted"),
  oidc_client_id: text("oidc_client_id"),
  oidc_client_secret_encrypted: text("oidc_client_secret_encrypted"),
  is_default: integer("is_default", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$default(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$default(() => new Date()),
});

export type InstanceRecord = typeof instances.$inferSelect;
export type InstanceInsert = typeof instances.$inferInsert;
