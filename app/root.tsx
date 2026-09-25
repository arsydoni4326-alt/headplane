import React from "react";
import type { MetaFunction } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  unstable_useRoute as useRoute,
} from "react-router";

import { LiveDataProvider } from "~/utils/live-data";
import ToastProvider from "~/utils/toast-provider";

import type { Route } from "./+types/root";
import { ErrorBanner } from "./components/error-banner";
import { headscaleContext } from "./server/context";
import { UpdateCheckModal, UpdateCheckProvider } from "./update-check";
import { useUpdateCheckContext } from "./update-check/UpdateCheckProvider";

import "@fontsource-variable/inter/opsz.css";
import "./tailwind.css";
import { getColorScheme } from "./utils/color-scheme";

export const meta: MetaFunction = () => [
  { title: "Headplane" },
  {
    name: "description",
    content: "A frontend for the headscale coordination server",
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const colorScheme = await getColorScheme(request);

  // Expose version info for the update-check feature
  const headscale = context.get(headscaleContext);
  const headplaneVersion = __VERSION__;
  const headplaneCommit = __COMMIT_HASH__;
  const headscaleVersion = headscale.version.raw;

  return {
    colorScheme,
    versionInfo: {
      headplaneCommit,
      headplaneVersion,
      headscaleVersion,
    },
  };
}

function VersionCheckRunner({
  versionInfo,
}: {
  versionInfo?: {
    headplaneCommit: string;
    headplaneVersion: string;
    headscaleVersion: string;
  };
}) {
  const ctx = useUpdateCheckContext();

  React.useEffect(() => {
    if (versionInfo) {
      ctx.setVersionInfo(versionInfo);
      ctx.checkNow("auto");
    }
  }, [versionInfo]);

  return <UpdateCheckModal />;
}

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const { loaderData } = useRoute("root");

  // LiveDataProvider is wrapped at the top level since dialogs and things
  // that control its state are usually open in portal containers which
  // are not a part of the normal React tree.
  return (
    <LiveDataProvider>
      <UpdateCheckProvider>
        <VersionCheckRunner versionInfo={loaderData?.versionInfo} />
        <html
          lang="en"
          className={
            loaderData?.colorScheme === "dark"
              ? "dark"
              : loaderData?.colorScheme === "light"
                ? "light"
                : ""
          }
        >
          <head>
            <meta charSet="utf-8" />
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <Meta />
            <Links />
            <link href={`${__PREFIX__}/favicon.ico`} rel="icon" />
          </head>
          <body className="w-full overflow-x-hidden overscroll-none dark:bg-mist-900 dark:text-mist-50">
            {children}
            <ToastProvider />
            <ScrollRestoration />
            <Scripts />
          </body>
        </html>
      </UpdateCheckProvider>
    </LiveDataProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <ErrorBanner className="max-w-2xl" error={error} />
    </div>
  );
}

export default function App() {
  return <Outlet />;
}
