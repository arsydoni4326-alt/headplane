import { Plus } from "lucide-react";
import { data } from "react-router";

import Button from "~/components/button";
import Card from "~/components/card";
import Link from "~/components/link";
import TableList from "~/components/table-list";
import { dbContext } from "~/server/context";
import { createInstanceService } from "~/server/instances";

import type { Route } from "./+types/overview";

export async function loader({ context, request }: Route.LoaderArgs) {
  const db = context.get(dbContext);
  const instanceService = createInstanceService(
    db,
    process.env.INSTANCE_ENCRYPTION_SECRET || "default-secret-change-me",
  );

  const instances = await instanceService.list();

  return data({ instances });
}

export default function InstancesOverview({ loaderData }: Route.ComponentProps) {
  const { instances } = loaderData;

  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <div className="flex w-full items-center justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-medium">Instances</h1>
          <p className="text-mist-600 dark:text-mist-300">
            Manage multiple Headscale instances from a single dashboard.
          </p>
        </div>
        <Link to="/instances/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            Add Instance
          </Button>
        </Link>
      </div>

      <Card variant="flat">
        <Card.Title>Configured Instances</Card.Title>
        {instances.length === 0 ? (
          <p className="text-sm text-mist-600 dark:text-mist-300">
            No instances configured yet. Add your first instance to get started.
          </p>
        ) : (
          <TableList>
            <TableList.Header>
              <TableList.HeaderCell>Name</TableList.HeaderCell>
              <TableList.HeaderCell>API URL</TableList.HeaderCell>
              <TableList.HeaderCell>Status</TableList.HeaderCell>
              <TableList.HeaderCell>Default</TableList.HeaderCell>
              <TableList.HeaderCell>Actions</TableList.HeaderCell>
            </TableList.Header>
            <TableList.Body>
              {instances.map((instance) => (
                <TableList.Row key={instance.id}>
                  <TableList.Cell>{instance.name}</TableList.Cell>
                  <TableList.Cell>
                    <code className="text-xs">{instance.apiUrl}</code>
                  </TableList.Cell>
                  <TableList.Cell>
                    <span className="text-xs text-mist-500">Unknown</span>
                  </TableList.Cell>
                  <TableList.Cell>
                    {instance.isDefault ? (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs text-mist-500">No</span>
                    )}
                  </TableList.Cell>
                  <TableList.Cell>
                    <div className="flex gap-2">
                      <Link to={`/instances/${instance.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <form method="post" action={`/instances/${instance.id}/delete`}>
                        <Button variant="ghost" size="sm" type="submit">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </TableList.Cell>
                </TableList.Row>
              ))}
            </TableList.Body>
          </TableList>
        )}
      </Card>
    </div>
  );
}
