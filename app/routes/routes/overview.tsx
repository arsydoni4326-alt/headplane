import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, GlobeLock, RouteOff } from "lucide-react";
import { useFetcher, useSearchParams } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Chip from "~/components/chip";
import EmptyState from "~/components/empty-state";
import Input from "~/components/input";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import StatusCircle from "~/components/status-circle";
import Text from "~/components/text";
import Title from "~/components/title";
import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { nodesResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";
import { mapNodes, type PopulatedNode } from "~/utils/node-info";

import type { Route } from "./+types/overview";
import { routesAction } from "./routes-actions";

export async function action(data: Route.ActionArgs) {
  return routesAction(data);
}

const PAGE_SIZE = 10;

type SortField = "route" | "type" | "machine" | "status";
type SortDirection = "asc" | "desc";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { routes, writable } = loaderData;

  // Extract query params
  const searchQuery = searchParams.get("search") || "";
  const sortField = (searchParams.get("sort") as SortField) || "route";
  const sortDirection = (searchParams.get("dir") as SortDirection) || "asc";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));

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

  // Filter routes based on search query
  const filteredRoutes = routes.filter((entry) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.route.toLowerCase().includes(query) ||
      entry.node.givenName.toLowerCase().includes(query) ||
      (entry.isExit ? "exit node" : "subnet route").includes(query)
    );
  });

  // Sort routes
  const sortedRoutes = [...filteredRoutes].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "route":
        comparison = a.route.localeCompare(b.route);
        break;
      case "type":
        comparison = (a.isExit ? "Exit node" : "Subnet route").localeCompare(
          b.isExit ? "Exit node" : "Subnet route",
        );
        break;
      case "machine":
        comparison = a.node.givenName.localeCompare(b.node.givenName);
        break;
      case "status":
        comparison = Number(a.approved) - Number(b.approved);
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Paginate routes
  const totalPages = Math.max(1, Math.ceil(sortedRoutes.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const paginatedRoutes = sortedRoutes.slice(startIndex, startIndex + PAGE_SIZE);

  // Helper to update search params
  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      // Reset to first page when filters/sort change
      if (key !== "page") {
        next.delete("page");
      }
      return next;
    });
  };

  const setSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === "asc" ? "desc" : "asc";
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("sort", field);
      next.set("dir", newDirection);
      next.delete("page");
      return next;
    });
  };

  const setPage = (nextPage: number) => {
    setParam("page", String(nextPage));
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
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
        <>
          {/* Search input */}
          <div className="flex items-center gap-2">
            <Input
              className="max-w-md"
              label="Search routes"
              labelHidden
              placeholder="Search routes, machines, or type..."
              type="text"
              value={searchQuery}
              onChange={(value) => setParam("search", value)}
            />
            {searchQuery && (
              <Button onClick={clearFilters} variant="light">
                Clear
              </Button>
            )}
          </div>

          {filteredRoutes.length === 0 ? (
            <Card>
              <EmptyState
                variant="filtered"
                title="No routes found"
                description="No routes match your search criteria."
                action={{
                  label: "Clear Filters",
                  onClick: clearFilters,
                  variant: "light",
                }}
              />
            </Card>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-auto rounded-lg">
                  <thead className="text-mist-600 dark:text-mist-300">
                    <tr className="px-0.5 text-left">
                      <th className="pb-2 text-xs font-bold uppercase">
                        <button
                          className="flex items-center gap-1 hover:text-mist-800 dark:hover:text-mist-100"
                          onClick={() => setSort("status")}
                          type="button"
                        >
                          Status
                          <SortIcon field="status" />
                        </button>
                      </th>
                      <th className="pb-2 text-xs font-bold uppercase">
                        <button
                          className="flex items-center gap-1 hover:text-mist-800 dark:hover:text-mist-100"
                          onClick={() => setSort("route")}
                          type="button"
                        >
                          Route
                          <SortIcon field="route" />
                        </button>
                      </th>
                      <th className="pb-2 text-xs font-bold uppercase">
                        <button
                          className="flex items-center gap-1 hover:text-mist-800 dark:hover:text-mist-100"
                          onClick={() => setSort("type")}
                          type="button"
                        >
                          Type
                          <SortIcon field="type" />
                        </button>
                      </th>
                      <th className="pb-2 text-xs font-bold uppercase">
                        <button
                          className="flex items-center gap-1 hover:text-mist-800 dark:hover:text-mist-100"
                          onClick={() => setSort("machine")}
                          type="button"
                        >
                          Machine
                          <SortIcon field="machine" />
                        </button>
                      </th>
                      <th className="w-32 pb-2 text-xs font-bold uppercase">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={cn(
                      "divide-y divide-mist-100 dark:divide-mist-800",
                      "border-t border-mist-100 dark:border-mist-800",
                    )}
                  >
                    {paginatedRoutes.map((entry) => (
                      <tr
                        className="transition-colors hover:bg-mist-50 dark:hover:bg-mist-900/50"
                        key={`${entry.node.id}:${entry.route}`}
                      >
                        <td className="py-3 pr-4">
                          <StatusCircle isOnline={entry.approved} />
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-mono text-sm font-semibold">{entry.route}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {entry.isExit ? (
                              <>
                                <GlobeLock className="h-4 w-4 text-mist-500" />
                                <span className="text-sm">Exit node</span>
                              </>
                            ) : (
                              <>
                                <RouteOff className="h-4 w-4 text-mist-500" />
                                <span className="text-sm">Subnet route</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Link
                            className="text-sm hover:underline"
                            to={`/machines/${entry.node.id}`}
                          >
                            {entry.node.givenName}
                          </Link>
                        </td>
                        <td className="py-3">
                          {writable ? (
                            <Button
                              className="shrink-0"
                              onClick={() => toggleRoute(entry, !entry.approved)}
                              variant={entry.approved ? "light" : "heavy"}
                            >
                              {entry.approved ? "Disable" : "Approve"}
                            </Button>
                          ) : (
                            <Chip text={entry.approved ? "Approved" : "Pending"} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-mist-500">
                    Page {page} of {totalPages} · {sortedRoutes.length} route
                    {sortedRoutes.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      className={cn(
                        "flex items-center gap-1 rounded-md border border-mist-200 px-3 py-1.5 text-sm font-medium",
                        "hover:bg-mist-50 dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50",
                        "transition-colors",
                        page <= 1 && "pointer-events-none opacity-50",
                      )}
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      type="button"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <button
                      className={cn(
                        "flex items-center gap-1 rounded-md border border-mist-200 px-3 py-1.5 text-sm font-medium",
                        "hover:bg-mist-50 dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50",
                        "transition-colors",
                        page >= totalPages && "pointer-events-none opacity-50",
                      )}
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      type="button"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Routes" />;
}
