import { headscaleContext } from "~/server/context";

import type { Route } from "./+types/update-check";

/**
 * Backend proxy for Headscale's `GET /api/v1/update-check` endpoint.
 *
 * The browser never talks to Headscale directly; it calls this route
 * (mounted at `/admin/api/update-check`) and Headplane forwards the
 * request server-side, keeping the internal Headscale URL private.
 * All query parameters (e.g. `?check=true`) are forwarded verbatim.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const headscale = context.get(headscaleContext);

  const query: Record<string, unknown> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    query[key] = value;
  }

  const data = await headscale.updateCheck(query);

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
