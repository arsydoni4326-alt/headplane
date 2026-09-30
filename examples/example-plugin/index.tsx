/**
 * Example Plugin
 *
 * This is a demonstration plugin that shows how to use the Headplane plugin API.
 * It adds a dashboard widget and a custom page.
 */

import type { Plugin } from "../../app/plugins";

/**
 * Example dashboard widget component.
 */
function ExampleDashboardWidget() {
  return (
    <div className="rounded-lg border border-mist-200 bg-white p-4 shadow-sm dark:border-mist-700 dark:bg-mist-800">
      <h3 className="mb-2 text-lg font-semibold text-mist-900 dark:text-mist-50">
        Example Plugin Widget
      </h3>
      <p className="text-sm text-mist-600 dark:text-mist-400">
        This widget is provided by the example plugin. It demonstrates how plugins can inject UI
        components into various slots throughout Headplane.
      </p>
      <div className="mt-3 text-xs text-mist-500 dark:text-mist-500">
        Plugin ID: com.example.demo-plugin
      </div>
    </div>
  );
}

/**
 * Example plugin page component.
 */
function ExamplePluginPage() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-3xl font-bold text-mist-900 dark:text-mist-50">
        Example Plugin Page
      </h1>
      <div className="rounded-lg border border-mist-200 bg-white p-6 shadow-sm dark:border-mist-700 dark:bg-mist-800">
        <h2 className="mb-3 text-xl font-semibold text-mist-900 dark:text-mist-50">
          Welcome to the Example Plugin
        </h2>
        <p className="mb-4 text-mist-700 dark:text-mist-300">
          This page demonstrates a custom route added by a plugin. Plugins can register their own
          routes under the{" "}
          <code className="rounded bg-mist-100 px-1 py-0.5 dark:bg-mist-900">/plugins/</code>{" "}
          prefix.
        </p>
        <h3 className="mb-2 text-lg font-semibold text-mist-900 dark:text-mist-50">
          Plugin Capabilities
        </h3>
        <ul className="list-inside list-disc space-y-1 text-mist-700 dark:text-mist-300">
          <li>Add custom pages and routes</li>
          <li>Inject widgets into predefined slots (dashboard, headers, footers, etc.)</li>
          <li>Add navigation items to the sidebar</li>
          <li>Define lifecycle hooks for initialization and cleanup</li>
          <li>Access slot-specific context data</li>
        </ul>
        <div className="mt-6 rounded-md bg-mist-50 p-4 dark:bg-mist-900">
          <h4 className="mb-2 font-semibold text-mist-900 dark:text-mist-50">Plugin Information</h4>
          <dl className="space-y-1 text-sm text-mist-700 dark:text-mist-300">
            <div className="flex">
              <dt className="w-24 font-medium">ID:</dt>
              <dd>com.example.demo-plugin</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium">Version:</dt>
              <dd>1.0.0</dd>
            </div>
            <div className="flex">
              <dt className="w-24 font-medium">Author:</dt>
              <dd>Example Author</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

/**
 * Example plugin registration.
 */
export function registerExamplePlugin(): Plugin {
  return {
    metadata: {
      id: "com.example.demo-plugin",
      name: "Example Plugin",
      version: "1.0.0",
      author: "Example Author",
      description: "A demonstration plugin showing the Headplane plugin API",
    },
    widgets: [
      {
        slot: "dashboard",
        component: ExampleDashboardWidget,
        priority: 10,
      },
    ],
    routes: [
      {
        path: "/plugins/example",
        component: ExamplePluginPage,
        requireAuth: true,
      },
    ],
    navigation: [
      {
        label: "Example Plugin",
        path: "/plugins/example",
        order: 100,
      },
    ],
    lifecycle: {
      onLoad: () => {
        console.log("Example plugin loaded");
      },
      onReady: () => {
        console.log("Example plugin ready");
      },
      onUnload: () => {
        console.log("Example plugin unloaded");
      },
    },
  };
}
