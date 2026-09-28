import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router";

import Input from "~/components/input";
import PageError from "~/components/page-error";
import Select from "~/components/select";
import { auditContext, authContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";

import type { Route } from "./+types/overview";

const PAGE_SIZE = 50;

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "machine.register", label: "Machine registered" },
  { value: "machine.rename", label: "Machine renamed" },
  { value: "machine.expire", label: "Machine expired" },
  { value: "machine.delete", label: "Machine removed" },
  { value: "machine.tags", label: "Machine tags updated" },
  { value: "machine.routes", label: "Machine routes updated" },
  { value: "machine.reassign", label: "Machine owner changed" },
  { value: "acl.update", label: "ACL policy updated" },
  { value: "dns.update", label: "DNS settings updated" },
  { value: "authkey.create", label: "Pre-auth key created" },
  { value: "authkey.expire", label: "Pre-auth key expired" },
  { value: "user.create", label: "User created" },
  { value: "user.rename", label: "User renamed" },
  { value: "user.delete", label: "User deleted" },
  { value: "user.link", label: "User linked" },
  { value: "user.reassign", label: "User role changed" },
];

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  ACTION_OPTIONS.map((option) => [option.value, option.label]),
);

export async function loader({ request, context }: Route.LoaderArgs) {
  const audit = context.get(auditContext);
  const auth = context.get(authContext);

  const principal = await auth.require(request);
  if (!auth.can(principal, Capabilities.read_feature)) {
    throw new Error(
      "You do not have permission to view this page. Please contact your administrator.",
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const actorName = url.searchParams.get("actor");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  const { records, total } = await audit.list({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    action,
    actorName,
  });

  return { records, total, page, action, actorName };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams();
  const { records, total, page, action, actorName } = loaderData;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      // Reset to the first page whenever a filter changes.
      next.delete("page");
      return next;
    });
  };

  const setPage = (nextPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(nextPage));
      return next;
    });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <h1 className="mb-2 text-2xl font-medium">Audit Log</h1>
          <p>
            A record of changes made through Headplane, including who changed what and when. Actions
            performed directly against the Headscale API or CLI are not recorded here.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by action"
          className="w-64"
          items={ACTION_OPTIONS}
          onValueChange={(value) => setParam("action", value)}
          placeholder="All actions"
          value={action}
        />
        <Input
          aria-label="Filter by actor"
          className="w-64"
          label="Actor"
          labelHidden
          onChange={(value) => setParam("actor", value)}
          placeholder="Filter by actor..."
          value={actorName ?? ""}
        />
        <span className="ml-auto text-sm whitespace-nowrap text-mist-500">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-160 table-auto rounded-lg">
          <thead className="text-mist-600 dark:text-mist-300">
            <tr className="px-0.5 text-left">
              <th className="pb-2 text-xs font-bold uppercase">Time</th>
              <th className="pb-2 text-xs font-bold uppercase">Actor</th>
              <th className="pb-2 text-xs font-bold uppercase">Action</th>
              <th className="pb-2 text-xs font-bold uppercase">Resource</th>
              <th className="pb-2 text-xs font-bold uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist-100 border-t border-mist-100 align-top dark:divide-mist-800 dark:border-mist-800">
            {records.length === 0 ? (
              <tr>
                <td className="py-8 text-center text-mist-500" colSpan={5}>
                  No audit entries match the current filters
                </td>
              </tr>
            ) : (
              records.map((entry) => (
                <tr className="hover:bg-mist-100 dark:hover:bg-mist-800" key={entry.id}>
                  <td className="py-2 text-sm whitespace-nowrap" suppressHydrationWarning>
                    {entry.createdAt.toLocaleString()}
                  </td>
                  <td className="py-2 text-sm">{entry.actorName}</td>
                  <td className="py-2 text-sm">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td className="py-2 text-sm">
                    <span className="font-mono text-xs">{entry.resourceType}</span>
                    {entry.resourceId ? (
                      <span className="ml-1 font-mono text-xs opacity-50">{entry.resourceId}</span>
                    ) : null}
                  </td>
                  <td className="py-2">
                    {entry.details ? (
                      <pre className="max-w-96 overflow-x-auto rounded-md bg-mist-100 p-2 font-mono text-xs whitespace-pre-wrap dark:bg-mist-800">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-sm opacity-50">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-mist-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              className={cn(
                "flex items-center gap-1 rounded-md border border-mist-200 px-3 py-1.5 text-sm font-medium",
                "hover:bg-mist-50 dark:border-mist-700 dark:bg-mist-800/50 dark:hover:bg-mist-700/50",
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
      ) : null}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Audit Log" />;
}
