import { ChevronDown, ChevronUp, Info, QrCode, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import Code from "~/components/code";
import EmptyState from "~/components/empty-state";
import Input from "~/components/input";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import Tooltip from "~/components/tooltip";
import {
  agentsContext,
  appConfigContext,
  authContext,
  headscaleConfigContext,
  headscaleContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource, usersResource } from "~/server/headscale/live-store";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";
import { formatOS } from "~/utils/host-info";
import {
  extractTagOwnerTags,
  isNoExpiry,
  mapNodes,
  sortAssignableTags,
  type PopulatedNode,
} from "~/utils/node-info";

import type { Route } from "./+types/overview";
import BulkActions from "./components/bulk-actions";
import { MachineFilters } from "./components/machine-filters";
import MachineRow from "./components/machine-row";
import NewMachine from "./dialogs/new";
import { useMachineFilterParams } from "./hooks/use-machine-filter-params";
import { machineAction } from "./machine-actions";

export async function loader({ request, context }: Route.LoaderArgs) {
  const agentsFeature = context.get(agentsContext);
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const getRequestApi = context.get(requestApiContext);
  const headscale = context.get(headscaleContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.require(request);

  if (!auth.can(principal, Capabilities.read_machines)) {
    throw new Error(
      "You do not have permission to view this page. Please contact your administrator.",
    );
  }

  const writablePermission = auth.can(principal, Capabilities.write_machines);

  const { api } = await getRequestApi(request);
  const [nodesSnap, usersSnap] = await Promise.all([
    headscaleLiveStore.get(nodesResource, api),
    headscaleLiveStore.get(usersResource, api),
  ]);
  const nodes = nodesSnap.data;
  const users = usersSnap.data;

  const magic = headscaleConfig.getMagicDNSBaseDomain();

  const agents = agentsFeature.state === "enabled" ? agentsFeature.value : undefined;
  const [statsResult, policyResult] = await Promise.allSettled([
    agents?.lookup(nodes.map((node) => node.nodeKey)),
    api.policy.get(),
  ]);
  const stats = statsResult.status === "fulfilled" ? statsResult.value : undefined;
  const policy = policyResult.status === "fulfilled" ? policyResult.value.policy : undefined;
  const populatedNodes = mapNodes(nodes, stats);
  const supportsNodeOwnerChange = !headscale.capabilities.nodeOwnerIsImmutable;
  const supportsDisablingKeyExpiry = headscale.capabilities.keyExpiryCanBeDisabled;
  const agentSync = agents?.lastSync();

  return {
    agent: agentSync
      ? {
          syncedAt: agentSync.syncedAt?.toISOString() ?? null,
          nodeCount: agentSync.nodeCount,
          nodeKey: agents?.agentNodeKey(),
        }
      : undefined,
    headscaleUserId: isUserPrincipal(principal) ? principal.user.headscaleUserId : undefined,
    existingTags: sortAssignableTags(nodes, policy),
    // `undefined` keeps the tag dialog from flagging every tag as undeclared.
    policyTags: extractTagOwnerTags(policy),
    magic,
    nodes,
    populatedNodes,
    preAuth: auth.can(principal, Capabilities.generate_authkeys),
    publicServer: config.headscale.public_url,
    server: config.headscale.url,
    supportsNodeOwnerChange: supportsNodeOwnerChange,
    supportsDisablingKeyExpiry: supportsDisablingKeyExpiry,
    users,
    writable: writablePermission,
  };
}

export const action = machineAction;

type SortField = "name" | "ip" | "version" | "lastSeen";

const STATUS_MATCH: Record<string, (n: PopulatedNode) => boolean> = {
  online: (n) => n.online && !n.expired,
  offline: (n) => !n.online && !n.expired,
  expired: (n) => n.expired,
};

const ROUTE_MATCH: Record<string, (n: PopulatedNode) => boolean> = {
  "exit-node": (n) => n.customRouting.exitRoutes.length > 0,
  subnet: (n) =>
    n.customRouting.subnetApprovedRoutes.length > 0 ||
    n.customRouting.subnetWaitingRoutes.length > 0,
};

const EXPIRY_MATCH: Record<string, (n: PopulatedNode) => boolean> = {
  expired: (n) => n.expired,
  expiring: (n) => !n.expired && !isNoExpiry(n.expiry),
  never: (n) => isNoExpiry(n.expiry),
};

export default function Page({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const searchQuery = searchParams.get("q") ?? "";
  const {
    filterUser,
    filterTag,
    filterStatus,
    filterRoute,
    filterOS,
    filterExpiry,
    hasActiveFilters,
  } = useMachineFilterParams();

  const setSearchQuery = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const v = value.slice(0, 100);
      if (v) next.set("q", v);
      else next.delete("q");
      return next;
    });
  };

  const clearSearch = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("q");
      return next;
    });
  };

  const filteredAndSortedNodes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let nodes = loaderData.populatedNodes.filter(
      (node) =>
        (!query ||
          node.givenName.toLowerCase().includes(query) ||
          node.ipAddresses.some((ip) => ip.toLowerCase().includes(query))) &&
        (filterUser === null ||
          (filterUser === "tag-owned" ? !node.user : node.user?.name === filterUser)) &&
        (filterTag === null || (node.tags?.includes(filterTag) ?? false)) &&
        (filterStatus === null || STATUS_MATCH[filterStatus](node)) &&
        (filterRoute === null || ROUTE_MATCH[filterRoute](node)) &&
        (filterOS === null || formatOS(node.hostInfo?.OS) === filterOS) &&
        (filterExpiry === null || EXPIRY_MATCH[filterExpiry](node)),
    );

    nodes = [...nodes].toSorted((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name": {
          comparison = a.givenName.localeCompare(b.givenName);
          break;
        }
        case "ip": {
          const getIPv4 = (addresses: string[]) =>
            addresses.find((ip) => !ip.includes(":")) || addresses[0] || "";
          const ipA = getIPv4(a.ipAddresses);
          const ipB = getIPv4(b.ipAddresses);

          if (!ipA.includes(":") && !ipB.includes(":")) {
            const octetsA = ipA.split(".").map(Number);
            const octetsB = ipB.split(".").map(Number);
            for (let i = 0; i < 4; i++) {
              if (octetsA[i] !== octetsB[i]) {
                comparison = octetsA[i] - octetsB[i];
                break;
              }
            }
          } else {
            comparison = ipA.localeCompare(ipB);
          }
          break;
        }
        case "version": {
          const versionA = a.hostInfo?.IPNVersion?.split("-")[0] || "0";
          const versionB = b.hostInfo?.IPNVersion?.split("-")[0] || "0";
          const partsA = versionA.split(".").map(Number);
          const partsB = versionB.split(".").map(Number);
          const maxLen = Math.max(partsA.length, partsB.length);

          for (let i = 0; i < maxLen; i++) {
            const segA = partsA[i] || 0;
            const segB = partsB[i] || 0;
            if (segA !== segB) {
              comparison = segA - segB;
              break;
            }
          }
          break;
        }
        case "lastSeen": {
          if (a.online !== b.online) {
            comparison = a.online ? 1 : -1;
            break;
          }
          comparison = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return nodes;
  }, [
    loaderData.populatedNodes,
    searchQuery,
    filterUser,
    filterTag,
    filterStatus,
    filterRoute,
    filterOS,
    filterExpiry,
    sortField,
    sortDirection,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = filteredAndSortedNodes.map((n) => n.id);
      const allSelected = visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) {
          next.delete(id);
        }
      } else {
        for (const id of visibleIds) {
          next.add(id);
        }
      }
      return next;
    });
  }, [filteredAndSortedNodes]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Drop the selection whenever the visible set changes so a bulk action can
  // never silently apply to machines the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, filterUser, filterTag, filterStatus, filterRoute, filterOS, filterExpiry]);

  const scanQRClassName = cn(
    "inline-flex w-fit items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm",
    "transition-colors duration-100 active:scale-[0.98]",
    "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1",
    "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
    "border border-mist-200 bg-white font-medium hover:bg-mist-50",
    "dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50",
    !loaderData.writable && "pointer-events-none opacity-50",
  );

  // Handle empty state: no machines at all
  if (loaderData.populatedNodes.length === 0) {
    return (
      <>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h1 className="mb-2 text-2xl font-medium">Machines</h1>
            <p>
              Manage the devices connected to your Tailnet.{" "}
              <Link external styled to="https://tailscale.com/kb/1372/manage-devices">
                Learn more
              </Link>
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/machines/scan-qr" className={scanQRClassName}>
              <QrCode className="h-4 w-4" />
              Scan QR
            </Link>
            <NewMachine
              disabledKeys={loaderData.preAuth ? [] : ["pre-auth"]}
              isDisabled={!loaderData.writable}
              server={loaderData.publicServer ?? loaderData.server}
              users={loaderData.users}
            />
          </div>
        </div>
        <EmptyState
          title="No machines yet"
          description="Connect your first device to get started. You can register a machine using a pre-authenticated key or the standard registration flow."
          secondaryAction={{
            label: "Learn More",
            onClick: () => window.open("https://tailscale.com/kb/1017/install", "_blank"),
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
          <h1 className="mb-2 text-2xl font-medium">Machines</h1>
          <p>
            Manage the devices connected to your Tailnet.{" "}
            <Link external styled to="https://tailscale.com/kb/1372/manage-devices">
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/machines/scan-qr" className={scanQRClassName}>
            <QrCode className="h-4 w-4" />
            Scan QR
          </Link>
          <NewMachine
            disabledKeys={loaderData.preAuth ? [] : ["pre-auth"]}
            isDisabled={!loaderData.writable}
            server={loaderData.publicServer ?? loaderData.server}
            users={loaderData.users}
          />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Input
            label="Search machines"
            labelHidden
            maxLength={100}
            onChange={setSearchQuery}
            placeholder="Search by name or IP address..."
            value={searchQuery}
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2",
                "p-1 rounded-full",
                "text-mist-400 hover:text-mist-600",
                "dark:text-mist-500 dark:hover:text-mist-300",
                "hover:bg-mist-100 dark:hover:bg-mist-800",
              )}
              onClick={clearSearch}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <MachineFilters users={loaderData.users} populatedNodes={loaderData.populatedNodes} />
        <span className="ml-auto text-sm whitespace-nowrap text-mist-500">
          {searchQuery || hasActiveFilters
            ? `Showing ${filteredAndSortedNodes.length} of ${loaderData.populatedNodes.length} machines`
            : `${loaderData.populatedNodes.length} machines`}
        </span>
      </div>
      <BulkActions
        existingTags={loaderData.existingTags}
        onClear={clearSelection}
        policyTags={loaderData.policyTags}
        selectedIds={Array.from(selectedIds)}
        writable={loaderData.writable}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 table-auto rounded-lg">
          <thead className="text-mist-600 dark:text-mist-300">
            <tr className="px-0.5 text-left">
              <th className="w-10 pb-2">
                <input
                  aria-label="Select all machines"
                  checked={
                    filteredAndSortedNodes.length > 0 &&
                    filteredAndSortedNodes.every((n) => selectedIds.has(n.id))
                  }
                  className="h-4 w-4 cursor-pointer rounded border-mist-300 text-indigo-600 focus:ring-indigo-500 dark:border-mist-600 dark:bg-mist-800"
                  onChange={toggleSelectAll}
                  type="checkbox"
                />
              </th>
              <th
                aria-sort={
                  sortField === "name"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="pb-2 text-xs font-bold uppercase"
              >
                <button
                  aria-label="Sort by name"
                  className={cn(
                    "flex items-center gap-x-1 cursor-pointer",
                    "hover:text-mist-900 dark:hover:text-mist-100",
                  )}
                  onClick={() => handleSort("name")}
                  type="button"
                >
                  Name
                  {sortField === "name" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </button>
              </th>
              <th
                aria-sort={
                  sortField === "ip"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="w-1/4 pb-2"
              >
                <div className="flex items-center gap-x-1">
                  <button
                    aria-label="Sort by IP address"
                    className={cn(
                      "flex items-center gap-x-1 cursor-pointer uppercase text-xs font-bold",
                      "hover:text-mist-900 dark:hover:text-mist-100",
                    )}
                    onClick={() => handleSort("ip")}
                    type="button"
                  >
                    Addresses
                    {sortField === "ip" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      ))}
                  </button>
                  {loaderData.magic ? (
                    <Tooltip
                      content={
                        <span className="font-normal">
                          Since MagicDNS is enabled, you can access devices based on their name and
                          also at{" "}
                          <Code>
                            [name].
                            {loaderData.magic}
                          </Code>
                        </span>
                      }
                    >
                      <Info className="h-4 w-4" />
                    </Tooltip>
                  ) : undefined}
                </div>
              </th>
              {/* We only want to show the version column if there are agents */}
              {loaderData.agent !== undefined ? (
                <th
                  aria-sort={
                    sortField === "version"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="pb-2 text-xs font-bold uppercase"
                >
                  <button
                    aria-label="Sort by version"
                    className={cn(
                      "flex items-center gap-x-1 cursor-pointer",
                      "hover:text-mist-900 dark:hover:text-mist-100",
                    )}
                    onClick={() => handleSort("version")}
                    type="button"
                  >
                    Version
                    {sortField === "version" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      ))}
                  </button>
                </th>
              ) : undefined}
              <th
                aria-sort={
                  sortField === "lastSeen"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className="pb-2 text-xs font-bold uppercase"
              >
                <button
                  aria-label="Sort by last seen"
                  className={cn(
                    "flex items-center gap-x-1 cursor-pointer",
                    "hover:text-mist-900 dark:hover:text-mist-100",
                  )}
                  onClick={() => handleSort("lastSeen")}
                  type="button"
                >
                  Last Seen
                  {sortField === "lastSeen" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </button>
              </th>
              <th className="w-12 pb-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-y divide-mist-100 dark:divide-mist-800 align-top",
              "border-t border-mist-100 dark:border-mist-800",
            )}
          >
            {filteredAndSortedNodes.length === 0 ? (
              <tr>
                <td colSpan={loaderData.agent !== undefined ? 7 : 6}>
                  <EmptyState
                    variant="filtered"
                    title="No machines found"
                    description="No machines match your current search or filter criteria. Try adjusting your filters or clearing the search."
                    action={{
                      label: "Clear Filters",
                      onClick: () => {
                        clearSearch();
                        setSearchParams(new URLSearchParams());
                      },
                      variant: "light",
                    }}
                  />
                </td>
              </tr>
            ) : (
              filteredAndSortedNodes.map((node) => (
                <MachineRow
                  existingTags={loaderData.existingTags}
                  isAgent={
                    loaderData.agent !== undefined
                      ? node.nodeKey === loaderData.agent.nodeKey
                      : undefined
                  }
                  isDisabled={
                    loaderData.writable
                      ? false // If the user has write permissions, they can edit all machines
                      : node.user?.id !== loaderData.headscaleUserId
                  }
                  isSelected={selectedIds.has(node.id)}
                  key={node.id}
                  magic={loaderData.magic}
                  node={node}
                  onToggleSelect={toggleSelect}
                  policyTags={loaderData.policyTags}
                  supportsNodeOwnerChange={loaderData.supportsNodeOwnerChange}
                  supportsDisablingKeyExpiry={loaderData.supportsDisablingKeyExpiry}
                  users={loaderData.users}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Machines" />;
}
