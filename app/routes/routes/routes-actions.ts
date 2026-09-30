import { data } from "react-router";

import { actorFromPrincipal } from "~/server/audit";
import {
  auditContext,
  authContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/overview";

export async function routesAction({ request, context }: Route.ActionArgs) {
  const audit = context.get(auditContext);
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const { principal, api } = await getRequestApi(request);

  if (!auth.can(principal, Capabilities.write_machines)) {
    throw data("You do not have permission to manage routes", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const action = formData.get("action_id")?.toString();
  if (!action) {
    throw data("Missing `action_id` in the form data.", {
      status: 400,
    });
  }

  const nodeId = formData.get("node_id")?.toString();
  if (!nodeId) {
    throw data("Missing `node_id` in the form data.", {
      status: 400,
    });
  }

  const node = await api.nodes.get(nodeId);
  if (!node) {
    throw data(`Machine with ID ${nodeId} not found`, {
      status: 404,
    });
  }

  if (!auth.canManageNode(principal, node)) {
    throw data("You do not have permission to act on this machine", {
      status: 403,
    });
  }

  switch (action) {
    case "update_routes": {
      const newApproved = node.approvedRoutes;
      const routes = formData.get("routes")?.toString();
      if (!routes) {
        throw data("Missing `routes` in the form data.", {
          status: 400,
        });
      }

      const allRoutes = routes.split(",").map((route) => route.trim());
      if (allRoutes.length === 0) {
        throw data("No routes provided to update", {
          status: 400,
        });
      }

      const enabled = formData.get("enabled")?.toString();
      if (enabled === undefined) {
        throw data("Missing `enabled` in the form data.", {
          status: 400,
        });
      }

      if (enabled === "true") {
        for (const route of allRoutes) {
          if (!newApproved.includes(route)) {
            newApproved.push(route);
          }
        }
      } else {
        for (const route of allRoutes) {
          const index = newApproved.indexOf(route);
          if (index > -1) {
            newApproved.splice(index, 1);
          }
        }
      }

      await api.nodes.approveRoutes(nodeId, newApproved);
      await headscaleLiveStore.refresh(nodesResource, api);
      const actor = actorFromPrincipal(principal);
      await audit.record({
        ...actor,
        action: "machine.routes",
        resourceType: "machine",
        resourceId: nodeId,
        details: { name: node.givenName, routes: newApproved },
      });
      return { message: "Routes updated" };
    }

    default:
      throw data("Invalid action", {
        status: 400,
      });
  }
}