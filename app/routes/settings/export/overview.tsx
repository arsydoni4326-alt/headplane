import { Download, Upload } from "lucide-react";
import { data, useFetcher } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Notice from "~/components/notice";
import PageError from "~/components/page-error";
import { authContext, headscaleConfigContext, headscaleContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import toast from "~/utils/toast";

import type { Route } from "./+types/overview";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscale = context.get(headscaleContext);

  const principal = await auth.require(request);
  if (!auth.can(principal, Capabilities.write_feature)) {
    throw new Error("You do not have permission to view this page.");
  }

  const configYaml = headscaleConfig.toString();
  const configReadable = headscaleConfig.readable();

  return {
    configYaml,
    configReadable,
    version: headscale.version.raw,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const headscaleConfig = context.get(headscaleConfigContext);

  const principal = await auth.require(request);
  if (!auth.can(principal, Capabilities.write_feature)) {
    throw data("You do not have permission to perform this action.", { status: 403 });
  }

  if (!headscaleConfig.writable()) {
    throw data("The Headscale configuration file is not writable.", { status: 403 });
  }

  const formData = await request.formData();
  const action = formData.get("action_id")?.toString();

  if (action === "export_config") {
    const configYaml = headscaleConfig.toString();
    if (!configYaml) {
      throw data("Headscale configuration is not available for export.", { status: 404 });
    }

    return data(
      { configYaml, version: "" },
      {
        headers: {
          "Content-Type": "application/x-yaml",
          "Content-Disposition": 'attachment; filename="headscale-config.yaml"',
        },
      },
    );
  }

  throw data("Invalid action", { status: 400 });
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const { configYaml, configReadable, version } = loaderData;

  function handleExportConfig() {
    const blob = new Blob([configYaml ?? ""], { type: "application/x-yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `headscale-config-${version || "unknown"}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Configuration exported");
  }

  function handleExportBundle() {
    const bundle = {
      exportedAt: new Date().toISOString(),
      headscaleVersion: version,
      config: configYaml,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `headscale-bundle-${version || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Bundle exported");
  }

  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Export / Import</h1>
        <p>
          Export your Headscale configuration and ACL policy for backup or migration. Import a
          previously exported bundle to restore your configuration.
        </p>
      </div>

      {!configReadable ? (
        <Notice title="Configuration unavailable" variant="warning">
          The Headscale configuration file is not available. Export and import features require
          access to the configuration file.
        </Notice>
      ) : null}
      <Card className="w-full sm:w-2/3" variant="flat">
        <Card.Title>Export Configuration</Card.Title>
        <Card.Text>
          Download the current Headscale configuration as a standalone YAML file, or export a
          complete bundle that includes both the configuration and ACL policy for migration.
        </Card.Text>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={!configYaml} onClick={handleExportConfig} variant="light">
            <Download className="h-4 w-4" />
            Export Config (YAML)
          </Button>
          <Button disabled={!configYaml} onClick={handleExportBundle} variant="light">
            <Download className="h-4 w-4" />
            Export Bundle (JSON)
          </Button>
        </div>
      </Card>

      <Card className="w-full sm:w-2/3" variant="flat">
        <Card.Title>Import Configuration</Card.Title>
        <Card.Text>
          Upload a previously exported configuration bundle to restore your settings. This will
          overwrite the current Headscale configuration file.
        </Card.Text>
        {!configReadable ? (
          <Notice title="Cannot import" variant="warning">
            The Headscale configuration file is not accessible. Import is not available.
          </Notice>
        ) : (
          <div className="mt-4">
            <fetcher.Form encType="multipart/form-data" method="POST">
              <input name="action_id" type="hidden" value="import_bundle" />
              <input accept=".json" name="bundle" type="file" />
              <Button className="mt-3" disabled={!configReadable} type="submit" variant="light">
                <Upload className="h-4 w-4" />
                Import Bundle
              </Button>
            </fetcher.Form>
          </div>
        )}
      </Card>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Export / Import" />;
}
