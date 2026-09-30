/**
 * Plugin System
 *
 * Public API for the Headplane plugin system.
 */

export { PluginProvider, usePlugins, useActivePlugins } from "./PluginProvider";
export { PluginSlot } from "./PluginSlot";
export { pluginRegistry, PluginRegistry } from "./registry";
export type {
  Plugin,
  PluginMetadata,
  PluginNavigationItem,
  PluginRoute,
  PluginSlot as PluginSlotType,
  PluginWidget,
  PluginWidgetProps,
  PluginLifecycle,
  PluginRegistration,
  PluginStatus,
  RegisteredPlugin,
} from "./types";
