# Plugin Development Guide

This guide covers developing plugins for Headplane. Plugins allow third-party developers to extend Headplane's UI with custom components, pages, and functionality.

## Quick Start

The fastest way to get started is to examine the example plugin:

```bash
cd headplane/examples/example-plugin
cat index.tsx
```

The example demonstrates all plugin capabilities: widgets, routes, navigation items, and lifecycle hooks.

## Plugin Structure

A plugin is a TypeScript module that exports a registration function:

```typescript
import type { Plugin } from "~/plugins";

export function registerMyPlugin(): Plugin {
  return {
    metadata: {
      id: "com.example.my-plugin",
      name: "My Plugin",
      version: "1.0.0",
      author: "Your Name",
      description: "Brief description",
    },
    // Plugin configuration
  };
}
```

### Metadata Requirements

- `id` (required): Unique identifier in reverse-DNS format
- `name` (required): Display name
- `version` (required): Semver version string
- `author` (optional): Author or organization
- `description` (optional): Brief description
- `minHeadplaneVersion` (optional): Minimum Headplane version required

## Adding Routes

Plugins can register custom pages. All plugin routes must use the `/plugins/` prefix:

```typescript
{
  routes: [
    {
      path: "/plugins/my-plugin/dashboard",
      component: MyDashboardPage,
      requireAuth: true, // default: true
    },
  ],
}
```

Route components are standard React components:

```typescript
function MyDashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold">My Plugin Dashboard</h1>
      {/* Your content */}
    </div>
  );
}
```

## Adding Navigation Items

Add items to the sidebar:

```typescript
import { Icon } from "lucide-react";

{
  navigation: [
    {
      label: "My Plugin",
      path: "/plugins/my-plugin/dashboard",
      icon: Icon, // optional
      order: 100, // optional, higher = lower in list
    },
  ],
}
```

## Adding Widgets

Widgets inject UI components into predefined slots:

```typescript
{
  widgets: [
    {
      slot: "dashboard",
      component: MyWidgetComponent,
      priority: 10, // optional, higher = renders first
    },
  ],
}
```

### Available Slots

- `dashboard` - Main dashboard page
- `machine-detail` - Machine detail page  
- `settings` - Settings page
- `header` - Application header
- `footer` - Application footer

### Widget Components

Widget components receive props with slot-specific context:

```typescript
import type { PluginWidgetProps } from "~/plugins";

function MyWidget({ slot, context }: PluginWidgetProps) {
  // Context contains slot-specific data
  // For example, machine-detail slot includes the machine ID
  
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">My Widget</h3>
      <p>Slot: {slot}</p>
    </div>
  );
}
```

### Styling Widgets

Use Headplane's Tailwind classes for consistent styling:

```typescript
function StyledWidget() {
  return (
    <div className="rounded-lg border border-mist-200 bg-white p-4 shadow-sm dark:border-mist-700 dark:bg-mist-800">
      <h3 className="mb-2 text-lg font-semibold text-mist-900 dark:text-mist-50">
        Widget Title
      </h3>
      <p className="text-sm text-mist-600 dark:text-mist-400">
        Widget content
      </p>
    </div>
  );
}
```

## Lifecycle Hooks

Plugins can define lifecycle hooks:

```typescript
{
  lifecycle: {
    onLoad: () => {
      console.log("Plugin loaded");
    },
    onReady: async () => {
      await fetchPluginData();
    },
    onUnload: () => {
      cleanup();
    },
  },
}
```

## Testing Plugins

### Unit Tests

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { PluginRegistry } from "~/plugins/registry";
import { registerMyPlugin } from "./index";

describe("MyPlugin", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  test("registers successfully", async () => {
    await registry.register(registerMyPlugin);
    expect(registry.isActive("com.example.my-plugin")).toBe(true);
  });
});
```

## API Reference

### Plugin Registry

```typescript
import { pluginRegistry } from "~/plugins";

await pluginRegistry.register(registerMyPlugin);
await pluginRegistry.initialize();
const plugins = pluginRegistry.getAll();
const active = pluginRegistry.getActive();
```

### React Hooks

```typescript
import { usePlugins, useActivePlugins } from "~/plugins";

function MyComponent() {
  const { plugins, initialized } = usePlugins();
  const activePlugins = useActivePlugins();
  return <div>Found {activePlugins.length} active plugins</div>;
}
```

## Best Practices

- Use reverse-DNS format for plugin IDs: `com.example.my-plugin`
- Always prefix routes with `/plugins/`
- Handle errors gracefully in lifecycle hooks
- Keep widgets lightweight
- Use semantic HTML and ARIA labels

## Examples

See `headplane/examples/example-plugin/` for a complete working example.

## Security Considerations

- Plugins run with full application permissions
- Only install plugins from trusted sources
- Review plugin code before installation

