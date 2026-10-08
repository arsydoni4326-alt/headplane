import { data } from "react-router";

import { auditContext, authContext, headscaleContext } from "~/server/context";
import { isAdmin, createUnauthorizedResponse } from "~/utils/auth";
import log from "~/utils/log";

import type { Route } from "./+types/apikeys";

interface ApiKey {
  id: string;
  prefix: string;
  expiration: string | null;
  createdAt: string;
}

interface CreateApiKeyRequest {
  expiration: string; // ISO 8601 date string
}

/**
 * GET /api/admin/apikeys
 * Lists all API keys via Headscale proxy
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscale = context.get(headscaleContext);
  const audit = context.get(auditContext);

  // Require authentication
  const principal = await auth.require(request);

  // Require admin privileges
  if (!isAdmin(auth, principal)) {
    throw createUnauthorizedResponse(
      principal,
      "You do not have permission to manage API keys. Only administrators can access this resource.",
    );
  }

  const apiKey = auth.getHeadscaleApiKey(principal);
  if (!apiKey) {
    throw data(
      { error: "No Headscale API key available for this session" },
      { status: 500 },
    );
  }

  try {
    // Proxy request to headscale
    const apiKeys = await headscale.client(apiKey).apiKeys.list();

    // Audit log
    await audit.log({
      actor: principal.username ?? principal.userId,
      action: "apikey.list",
      resource: "apikeys",
      success: true,
      metadata: { count: apiKeys.length },
    });

    return data({ apiKeys }, { status: 200 });
  } catch (error) {
    log.error("apikeys", "Failed to list API keys: %s", String(error));

    // Audit log failure
    await audit.log({
      actor: principal.username ?? principal.userId,
      action: "apikey.list",
      resource: "apikeys",
      success: false,
      metadata: { error: String(error) },
    });

    throw data(
      { error: "Failed to retrieve API keys from Headscale" },
      { status: 502 },
    );
  }
}

/**
 * POST /api/admin/apikeys - Create API key
 * DELETE /api/admin/apikeys - Delete API key (prefix in query)
 */
export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const headscale = context.get(headscaleContext);
  const audit = context.get(auditContext);

  // Require authentication
  const principal = await auth.require(request);

  // Require admin privileges
  if (!isAdmin(auth, principal)) {
    throw createUnauthorizedResponse(
      principal,
      "You do not have permission to manage API keys.",
    );
  }

  const apiKey = auth.getHeadscaleApiKey(principal);
  if (!apiKey) {
    throw data(
      { error: "No Headscale API key available for this session" },
      { status: 500 },
    );
  }

  const method = request.method;

  if (method === "POST") {
    return await handleCreateApiKey(request, headscale, audit, principal, apiKey);
  } else if (method === "DELETE") {
    return await handleDeleteApiKey(request, headscale, audit, principal, apiKey);
  }

  throw data({ error: "Method not allowed" }, { status: 405 });
}

async function handleCreateApiKey(
  request: Request,
  headscale: any,
  audit: any,
  principal: any,
  apiKey: string,
) {
  let body: CreateApiKeyRequest;
  try {
    body = await request.json();
  } catch {
    return data({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.expiration || typeof body.expiration !== "string") {
    return data({ error: "Missing or invalid expiration field" }, { status: 400 });
  }

  // Validate ISO 8601 date
  const expiration = new Date(body.expiration);
  if (Number.isNaN(expiration.getTime())) {
    return data({ error: "Invalid expiration date format" }, { status: 400 });
  }

  try {
    // Proxy request to headscale
    const result = await headscale.client(apiKey).apiKeys.create(expiration);

    // Audit log
    await audit.log({
      actor: principal.username ?? principal.userId,
      action: "apikey.create",
      resource: "apikeys",
      success: true,
      metadata: { expiration: body.expiration },
    });

    log.info(
      "apikeys",
      "API key created by %s, expires: %s",
      principal.username ?? principal.userId,
      body.expiration,
    );

    return data({ apiKey: result.apiKey }, { status: 201 });
  } catch (error) {
    log.error("apikeys", "Failed to create API key: %s", String(error));

    await audit.log({
      actor: principal.username ?? principal.userId,
      action: "apikey.create",
      resource: "apikeys",
      success: false,
      metadata: { error: String(error) },
    });

    throw data({ error: "Failed to create API key in Headscale" }, { status: 502 });
  }
}

async function handleDeleteApiKey(
  request: Request,
  headscale: any,
  audit: any,
  principal: any,
  apiKey: string,
) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix");

  if (!prefix) {
    return data({ error: "Missing prefix query parameter" }, { status: 400 });
  }

  try {
    // Proxy request to headscale
    await headscale.client(apiKey).apiKeys.delete(prefix);

    // Audit log
    await audit.log({
      actor: principal.username ?? principal.userId,
      action: "apikey.delete",
      resource: "apikeys",
      success: true,
      metadata: { prefix },
    });

    log.info(
      "apikeys",
      "API key deleted by %s, prefix: %s",
      principal.username ?? principal.userId,
      prefix,
    );

    return data({ success: true }, { status: 200 });
  } catch (error) {
    log.error("apikeys", "Failed to delete API key: %s", String(error));

    await audit.log({
      actor: principal.username ?? principal.userId,
      action: "apikey.delete",
      resource: "apikeys",
      success: false,
      metadata: { prefix, error: String(error) },
    });

    throw data({ error: "Failed to delete API key in Headscale" }, { status: 502 });
  }
}
