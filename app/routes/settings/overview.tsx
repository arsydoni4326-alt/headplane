import { ArrowRight, Download, Server, TriangleAlert } from "lucide-react";

import Card from "~/components/card";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import { headscaleConfigContext, headscaleContext, oidcContext } from "~/server/context";
import { compatibilityFor } from "~/server/headscale/compatibility";

import type { Route } from "./+types/overview";

export async function loader({ context }: Route.LoaderArgs) {
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscale = context.get(headscaleContext);
  const oidc = context.get(oidcContext);

  return {
    config: headscaleConfig.writable(),
    isOidcEnabled: oidc.state === "enabled" && oidc.value.status().state === "ready",
    compatibility: compatibilityFor(headscale.version),
  };
}

export default function Page({
  loaderData: { config, isOidcEnabled, compatibility },
}: Route.ComponentProps) {
  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Settings</h1>
        <p>
          Manage your Headplane and Headscale configuration. Customize your preferences, manage
          authentication, and configure integrations.
        </p>
      </div>

      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Profile & Preferences</h1>
        <p>
          Manage your profile settings, save your Headscale API key for reuse across sessions, and
          customize your Headplane experience with theme preferences.
        </p>
      </div>
      <Link to="/settings/profile">
        <div className="flex items-center text-lg font-medium">
          Profile & Settings
          <ArrowRight className="ml-2 h-5 w-5" />
        </div>
      </Link>

      <Card className="w-full sm:w-2/3" variant="flat">
        <Card.Title>Server</Card.Title>
        <Card.Text>The Headscale server this Headplane instance is connected to.</Card.Text>
        <div className="mt-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-mist-500" />
          <span className="text-sm text-mist-600 dark:text-mist-300">Headscale version:</span>
          <span className="rounded-md bg-mist-100 px-2 py-0.5 font-mono text-sm dark:bg-mist-800">
            {compatibility.serverVersion}
          </span>
        </div>
        {compatibility.unsupported.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
              <TriangleAlert className="h-4 w-4" />
              Features unavailable on this server version
            </p>
            <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
              {compatibility.unsupported.map((status) => (
                <li key={status.feature.key}>
                  <span className="font-medium">{status.feature.label}</span> —{" "}
                  {status.feature.description} Requires Headscale{" "}
                  <span className="font-mono">{status.feature.minVersion}</span> or newer.
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">
            All Headplane features are supported by this server version.
          </p>
        )}
      </Card>

      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Pre-Auth Keys</h1>
        <p>
          Headscale fully supports pre-authentication keys in order to easily add devices to your
          Tailnet. To learn more about using pre-authentication keys, visit the{" "}
          <Link external styled to="https://tailscale.com/kb/1085/auth-keys/">
            Tailscale documentation
          </Link>
        </p>
      </div>
      <Link to="/settings/auth-keys">
        <div className="flex items-center text-lg font-medium">
          Manage Auth Keys
          <ArrowRight className="ml-2 h-5 w-5" />
        </div>
      </Link>
      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Headplane Agent</h1>
        <p>
          The Headplane Agent syncs node information like OS version and connectivity details from
          your Tailnet.
        </p>
      </div>
      <Link to="/settings/agent">
        <div className="flex items-center text-lg font-medium">
          Agent Settings
          <ArrowRight className="ml-2 h-5 w-5" />
        </div>
      </Link>
      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Export / Import</h1>
        <p>
          Export your Headscale configuration and ACL policy for backup or migration, or import a
          previously saved bundle to restore your settings.
        </p>
      </div>
      <Link to="/settings/export">
        <div className="flex items-center text-lg font-medium">
          <Download className="mr-2 h-5 w-5" />
          Export Configuration
          <ArrowRight className="ml-2 h-5 w-5" />
        </div>
      </Link>
      {config && isOidcEnabled ? (
        <>
          <div className="flex w-full flex-col sm:w-2/3">
            <h1 className="mb-4 text-2xl font-medium">Authentication Restrictions</h1>
            <p>
              Headscale supports restricting OIDC authentication to only allow certain email
              domains, groups, or users to authenticate. This can be used to limit access to your
              Tailnet to only certain users or groups and Headplane will also respect these settings
              when authenticating.{" "}
              <Link external styled to="https://headscale.net/stable/ref/oidc/#basic-configuration">
                Learn More
              </Link>
            </p>
          </div>
          <Link to="/settings/restrictions">
            <div className="flex items-center text-lg font-medium">
              Manage Restrictions
              <ArrowRight className="ml-2 h-5 w-5" />
            </div>
          </Link>
        </>
      ) : undefined}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Settings" />;
}
