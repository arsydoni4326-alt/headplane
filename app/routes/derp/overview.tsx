import { Globe, Server } from "lucide-react";

import Chip from "~/components/chip";
import CompatibilityNotice from "~/components/compatibility-notice";
import PageError from "~/components/page-error";
import { authContext, headscaleContext, requestApiContext } from "~/server/context";
import { unsupportedFor } from "~/server/headscale/compatibility";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";

import type { Route } from "./+types/overview";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscale = context.get(headscaleContext);

  const principal = await auth.require(request);
  if (!auth.can(principal, Capabilities.read_feature)) {
    throw new Error(
      "You do not have permission to view this page. Please contact your administrator.",
    );
  }

  const { api } = await getRequestApi(request);

  // The /api/v1/derp endpoint is new in this fork. Older servers return 404,
  // which we surface as a compatibility notice instead of an error page.
  let derp;
  try {
    derp = await api.derp.get();
  } catch {
    derp = null;
  }

  return {
    derp,
    version: headscale.version.raw,
    unsupported: unsupportedFor(headscale.version, "general"),
  };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { derp, version, unsupported } = loaderData;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <h1 className="mb-2 text-2xl font-medium">DERP Status</h1>
          <p>
            DERP (Designated Encrypted Relay for Packets) relays traffic when direct peer-to-peer
            connections cannot be established. Each region may contain multiple relay nodes for
            redundancy.
          </p>
        </div>
      </div>

      <CompatibilityNotice serverVersion={version} statuses={unsupported} />

      {derp === null ? (
        <div className="rounded-lg border border-mist-200 p-8 text-center text-mist-500 dark:border-mist-800">
          DERP status is unavailable because this Headscale server does not expose the DERP status
          endpoint.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-mist-200 bg-white p-4 dark:border-mist-800 dark:bg-mist-900/50">
              <div className="flex items-center gap-2 text-sm text-mist-500">
                <Globe className="h-4 w-4" />
                Status
              </div>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  derp.configured ? "text-green-600 dark:text-green-400" : "text-mist-500",
                )}
              >
                {derp.configured ? "Configured" : "Not configured"}
              </p>
            </div>
            <div className="rounded-lg border border-mist-200 bg-white p-4 dark:border-mist-800 dark:bg-mist-900/50">
              <div className="flex items-center gap-2 text-sm text-mist-500">
                <Server className="h-4 w-4" />
                Regions
              </div>
              <p className="mt-1 text-lg font-semibold">{derp.totalRegions}</p>
            </div>
            <div className="rounded-lg border border-mist-200 bg-white p-4 dark:border-mist-800 dark:bg-mist-900/50">
              <div className="flex items-center gap-2 text-sm text-mist-500">
                <Server className="h-4 w-4" />
                Headscale Version
              </div>
              <p className="mt-1 text-lg font-semibold">{version}</p>
            </div>
          </div>

          {derp.regions.length === 0 ? (
            <div className="rounded-lg border border-mist-200 p-8 text-center text-mist-500 dark:border-mist-800">
              No DERP regions are configured.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {derp.regions.map((region) => (
                <div
                  className="rounded-lg border border-mist-200 bg-white dark:border-mist-800 dark:bg-mist-900/50"
                  key={region.regionId}
                >
                  <div className="border-b border-mist-200 px-4 py-3 dark:border-mist-800">
                    <h2 className="flex items-center gap-2 text-lg font-medium">
                      <Globe className="h-5 w-5 text-indigo-500" />
                      {region.regionName}
                      <span className="rounded-md bg-mist-100 px-2 py-0.5 font-mono text-xs text-mist-600 dark:bg-mist-800 dark:text-mist-400">
                        ID: {region.regionId}
                      </span>
                      <Chip text={region.regionCode} />
                    </h2>
                  </div>
                  <div className="divide-y divide-mist-100 dark:divide-mist-800">
                    {region.nodes.map((node) => (
                      <div
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        key={node.name}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{node.name}</span>
                          <span className="text-sm text-mist-500">{node.hostName}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {node.derpPort > 0 ? (
                            <span className="rounded-md bg-mist-100 px-2 py-0.5 font-mono text-xs dark:bg-mist-800">
                              DERP port: {node.derpPort}
                            </span>
                          ) : null}
                          {node.stunPort > 0 ? (
                            <span className="rounded-md bg-mist-100 px-2 py-0.5 font-mono text-xs dark:bg-mist-800">
                              STUN port: {node.stunPort}
                            </span>
                          ) : null}
                          {node.ipv4 ? (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                              {node.ipv4}
                            </span>
                          ) : null}
                          {node.ipv6 ? (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                              {node.ipv6}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="DERP Status" />;
}
