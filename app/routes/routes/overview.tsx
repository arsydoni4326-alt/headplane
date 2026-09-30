import { GlobeLock, RouteOff } from "lucide-react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Chip from "~/components/chip";
import EmptyState from "~/components/empty-state";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import StatusCircle from "~/components/status-circle";
import TableList from "~/components/table-list";
import Text from "~/components/text";
import Title from "~/components/title";
import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { nodesResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import { mapNodes, type PopulatedNode } from "~/utils/node-info";

import type { Route } from "./+types/overview";
import { routesAction } from "./routes-actions";

export async function action(data: Route.ActionArgs) {
  return routesAction(data);
}

interface RouteEntry {
  node: PopulatedNode;
  route: string;
  approved: boolean;
  isExit: boolean;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.require(request);

  if (!auth.can(principal, Capabilities.read_machines)) {
    throw new Error(
      "You do not have permission to view this page. Please contact your administrator.",
    );
  }

  const { api } = await getRequestApi(request);
  const nodesSnap = await headscaleLiveStore.get(nodesResource, api);
  const nodes = mapNodes(nodesSnap.data);

  const writable = auth.can(principal, Capabilities.write_machines);

  // Aggregate all routes across all machines.
  const routes: RouteEntry[] = [];
  for (const node of nodes) {
    for (const route of node.customRouting.subnetApprovedRoutes) {
      routes.push({ node, route, approved: true, isExit: false });
    }
    for (const route of node.customRouting.subnetWaitingRoutes) {
      routes.push({ node, route, approved: false, isExit: false });
    }
    for (const route of node.customRouting.exitRoutes) {
      routes.push({
        node,
        route,
        approved: node.customRouting.exitApproved,
        isExit: true,
      });
    }
  }

  routes.sort((a, b) => {
    if (a.isExit !== b.isExit) return a.isExit ? 1 : -1;
    return a.route.localeCompare(b.route);
  });

  return {
    routes,
    writable,
  };
}

export default function RoutesOverview({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher();
  const { routes, writable } = loaderData;

  const approvedCount = routes.filter((r) => r.approved).length;
  const pendingCount = routes.filter((r) => !r.approved).length;

  const toggleRoute = (entry: RouteEntry, enabled: boolean) => {
    const form = new FormData();
    form.set("action_id", "update_routes");
    form.set("node_id", entry.node.id);
    form.set("routes", entry.route);
    form.set("enabled", String(enabled));
    fetcher.submit(form, { method: "POST" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Title>Routes</Title>
          <Text>
            Subnet routes and exit nodes advertised across all machines.{" "}
            <Link external styled to="https://tailscale.com/kb/1019/subnets">
              Learn more
            </Link>
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Chip text={`${approvedCount} approved`} />
          <Chip text={`${pendingCount} pending`} />
        </div>
      </div>

      {routes.length === 0 ? (
        <Card>
          <EmptyState
            variant="default"
            title="No routes advertised"
            description="No machines are advertising subnet routes or exit nodes yet. Configure a machine as a subnet router or exit node to see routes here."
          />
        </Card>
      ) : (
        <Card>
          <TableList>
            {routes.map((entry) => (
              <TableList.Item
                className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                key={`${entry.node.id}:${entry.route}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StatusCircle isOnline={entry.approved} />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold">{entry.route}</p>
                    <p className="truncate text-sm opacity-70">
                      {entry.isExit ? "Exit node · " : "Subnet route · "}
                      <Link className="hover:underline" to={`/machines/${entry.node.id}`}>
                        {entry.node.givenName}
                      </Link>
                    </p>
                  </div>
                </div>
                {writable ? (
                  <Button
                    className="shrink-0"
                    onClick={() => toggleRoute(entry, !entry.approved)}
                    variant={entry.approved ? "light" : "heavy"}
                  >
                    {entry.approved ? "Disable" : "Approve"}
                  </Button>
                ) : (
                  <Chip text={entry.approved ? "Approved" : "Pending approval"} />
                )}
              </TableList.Item>
            ))}
          </TableList>
        </Card>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Routes" />;
}
