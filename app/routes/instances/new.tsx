import { ArrowLeft, Save } from "lucide-react";
import { data, redirect } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Input from "~/components/input";
import Link from "~/components/link";
import { dbContext } from "~/server/context";
import { createInstanceService } from "~/server/instances";

import type { Route } from "./+types/new";

export async function action({ context, request }: Route.ActionArgs) {
  const db = context.get(dbContext);
  const instanceService = createInstanceService(
    db,
    process.env.INSTANCE_ENCRYPTION_SECRET || "default-secret-change-me",
  );

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const apiUrl = formData.get("apiUrl") as string;
  const apiKey = formData.get("apiKey") as string;
  const oidcClientId = formData.get("oidcClientId") as string;
  const oidcClientSecret = formData.get("oidcClientSecret") as string;
  const isDefault = formData.get("isDefault") === "on";

  if (!name || !apiUrl) {
    return data({ error: "Name and API URL are required" }, { status: 400 });
  }

  try {
    await instanceService.create({
      name,
      apiUrl,
      apiKey: apiKey || undefined,
      oidcClientId: oidcClientId || undefined,
      oidcClientSecret: oidcClientSecret || undefined,
      isDefault,
    });

    return redirect("/instances");
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Failed to create instance" },
      { status: 500 },
    );
  }
}

export default function NewInstance({ actionData }: Route.ComponentProps) {
  return (
    <div className="flex max-w-(--breakpoint-md) flex-col gap-8">
      <div className="flex items-center gap-4">
        <Link to="/instances">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-medium">Add Instance</h1>
          <p className="text-sm text-mist-600 dark:text-mist-300">
            Configure a new Headscale instance.
          </p>
        </div>
      </div>

      {actionData?.error && (
        <Card variant="flat" className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-300">{actionData.error}</p>
        </Card>
      )}

      <form method="post">
        <Card variant="flat">
          <Card.Title>Instance Details</Card.Title>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Name *
              </label>
              <Input
                type="text"
                id="name"
                name="name"
                placeholder="Production"
                required
              />
              <p className="mt-1 text-xs text-mist-500">A friendly name for this instance.</p>
            </div>

            <div>
              <label htmlFor="apiUrl" className="mb-1 block text-sm font-medium">
                API URL *
              </label>
              <Input
                type="url"
                id="apiUrl"
                name="apiUrl"
                placeholder="https://headscale.example.com"
                required
              />
              <p className="mt-1 text-xs text-mist-500">The base URL of the Headscale API.</p>
            </div>

            <div>
              <label htmlFor="apiKey" className="mb-1 block text-sm font-medium">
                API Key
              </label>
              <Input
                type="password"
                id="apiKey"
                name="apiKey"
                placeholder="Optional"
              />
              <p className="mt-1 text-xs text-mist-500">
                API key for authentication (stored encrypted).
              </p>
            </div>

            <div>
              <label htmlFor="oidcClientId" className="mb-1 block text-sm font-medium">
                OIDC Client ID
              </label>
              <Input type="text" id="oidcClientId" name="oidcClientId" placeholder="Optional" />
              <p className="mt-1 text-xs text-mist-500">OAuth/OIDC client ID if applicable.</p>
            </div>

            <div>
              <label htmlFor="oidcClientSecret" className="mb-1 block text-sm font-medium">
                OIDC Client Secret
              </label>
              <Input
                type="password"
                id="oidcClientSecret"
                name="oidcClientSecret"
                placeholder="Optional"
              />
              <p className="mt-1 text-xs text-mist-500">
                OAuth/OIDC client secret (stored encrypted).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" name="isDefault" className="h-4 w-4" />
              <label htmlFor="isDefault" className="text-sm font-medium">
                Set as default instance
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Link to="/instances">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" variant="primary">
              <Save className="h-4 w-4" />
              Save Instance
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
