import { useMemo, useState } from "react";

import EmptyState from "~/components/empty-state";
import PageError from "~/components/page-error";
import Topology from "~/components/topology/topology";
import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { nodesResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";
import { mapNodes, type PopulatedNode } from "~/utils/node-info";
import { buildTopology, colorForGroup } from "~/utils/topology";

import type { Route } from "./+types/overview";

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

  return {
    nodes: mapNodes(nodesSnap.data),
  };
}

type Filter = "all" | "online" | "offline" | "expired";

export default function Page({ loaderData }: Route.ComponentProps) {
  const { nodes } = loaderData;
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const filteredNodes = useMemo(() => {
    let result: PopulatedNode[] = nodes;
    if (filter === "online") {
      result = result.filter((n) => n.online && !n.expired);
    } else if (filter === "offline") {
      result = result.filter((n) => !n.online && !n.expired);
    } else if (filter === "expired") {
      result = result.filter((n) => n.expired);
    }
    if (selectedGroup) {
      result = result.filter((n) => (n.user ? n.user.name : "Tag-owned") === selectedGroup);
    }
    return result;
  }, [nodes, filter, selectedGroup]);

  const graph = useMemo(() => buildTopology(filteredNodes), [filteredNodes]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const node of nodes) {
      set.add(node.user ? node.user.name : "Tag-owned");
    }
    return Array.from(set).sort();
  }, [nodes]);

  const filterOptions: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "online", label: "Online" },
    { value: "offline", label: "Offline" },
    { value: "expired", label: "Expired" },
  ];

  // Show empty state if no machines at all
  if (nodes.length === 0) {
    return (
      <>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h1 className="mb-2 text-2xl font-medium">Topology</h1>
            <p>
              A visual overview of your tailnet. Nodes are grouped by owner; subnet routers show their
              advertised routes below them, and exit nodes are highlighted with an amber ring. Click a
              node to open its details.
            </p>
          </div>
        </div>
        <EmptyState
          title="No machines to visualize"
          description="The topology view shows the network structure of your tailnet. Add your first machine to see it appear here."
          secondaryAction={{
            label: "View Machines",
            onClick: () => window.location.href = "/machines",
            variant: "ghost",
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <h1 className="mb-2 text-2xl font-medium">Topology</h1>
          <p>
            A visual overview of your tailnet. Nodes are grouped by owner; subnet routers show their
            advertised routes below them, and exit nodes are highlighted with an amber ring. Click a
            node to open its details.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-mist-100/80 p-1 dark:bg-mist-800/60">
          {filterOptions.map((option) => (
            <button
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                filter === option.value
                  ? "bg-white text-mist-900 shadow-surface dark:bg-mist-900 dark:text-white"
                  : "text-mist-600 hover:text-mist-900 dark:text-mist-300 dark:hover:text-white",
              )}
              key={option.value}
              onClick={() => setFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by owner"
          className="rounded-md border border-mist-200 bg-white px-3 py-1.5 text-sm dark:border-mist-800 dark:bg-mist-900"
          onChange={(e) => setSelectedGroup(e.target.value || null)}
          value={selectedGroup ?? ""}
        >
          <option value="">All owners</option>
          {groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm whitespace-nowrap text-mist-500">
          {filteredNodes.length} of {nodes.length} machines
        </span>
      </div>

      {filteredNodes.length === 0 ? (
        <EmptyState
          variant="filtered"
          title="No machines match filters"
          description="No machines match your current filter settings. Try adjusting the status or owner filter to see more results."
          action={{
            label: "Clear Filters",
            onClick: () => {
              setFilter("all");
              setSelectedGroup(null);
            },
            variant: "light",
          }}
        />
      ) : (
        <>
          <Topology graph={graph} />

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-mist-600 dark:text-mist-300">
            <span className="font-medium">Legend:</span>
            {groups.map((group) => (
              <span className="flex items-center gap-1.5" key={group}>
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: colorForGroup(group) }}
                />
                {group}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-amber-400" />
              Exit node
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-mist-300 dark:bg-mist-600" />
              Offline
            </span>
          </div>
        </>
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Topology" />;
}
