# Example Plugin

This directory contains an example plugin that demonstrates the Headplane plugin API.

## Structure

- `index.tsx` - Main plugin file with registration function and components

## Plugin Features Demonstrated

1. **Dashboard Widget** - Injects a custom widget into the dashboard
2. **Custom Route** - Adds a new page at `/plugins/example`
3. **Navigation Item** - Adds a link to the sidebar
4. **Lifecycle Hooks** - Demonstrates `onLoad`, `onReady`, and `onUnload` hooks

## Using This Example

To enable this example plugin:

1. Import the plugin in your plugin configuration
2. Register it with the plugin registry

```typescript
import { pluginRegistry } from "~/plugins";
import { registerExamplePlugin } from "~/examples/example-plugin";

// Register the plugin
await pluginRegistry.register(registerExamplePlugin);
```

## Creating Your Own Plugin

Use this example as a template for creating your own plugins. See the plugin development guide at `docs/ref/extending.md` for complete documentation.
