/**
 * Plugin System Types
 *
 * This module defines the TypeScript interfaces for the Headplane plugin system.
 * Plugins can extend the UI by providing custom components, routes, and navigation items.
 */

import type React from "react";

/**
 * Plugin metadata describing the plugin's identity and requirements.
 */
export interface PluginMetadata {
  /** Unique identifier for the plugin (e.g., "com.example.my-plugin") */
  id: string;
  /** Display name of the plugin */
  name: string;
  /** Plugin version (semver format recommended) */
  version: string;
  /** Plugin author/organization */
  author?: string;
  /** Short description of the plugin's functionality */
  description?: string;
  /** Minimum required Headplane version (semver format) */
  minHeadplaneVersion?: string;
}

/**
 * Navigation item that can be added to the sidebar.
 */
export interface PluginNavigationItem {
  /** Display label for the navigation item */
  label: string;
  /** Route path (must start with "/plugins/") */
  path: string;
  /** Optional icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Position in navigation (higher = lower in list) */
  order?: number;
}

/**
 * Route definition for plugin pages.
 */
export interface PluginRoute {
  /** Route path (must start with "/plugins/") */
  path: string;
  /** Component to render for this route */
  component: React.ComponentType;
  /** Whether authentication is required (default: true) */
  requireAuth?: boolean;
}

/**
 * Widget slot where plugins can inject UI components.
 */
export type PluginSlot =
  | "dashboard" // Main dashboard page
  | "machine-detail" // Machine detail page
  | "settings" // Settings page
  | "header" // Application header
  | "footer"; // Application footer

/**
 * Widget component to be rendered in a specific slot.
 */
export interface PluginWidget {
  /** The slot where this widget should be rendered */
  slot: PluginSlot;
  /** The component to render */
  component: React.ComponentType<PluginWidgetProps>;
  /** Priority for ordering (higher = rendered first) */
  priority?: number;
}

/**
 * Props passed to plugin widget components.
 */
export interface PluginWidgetProps {
  /** The slot where the widget is being rendered */
  slot: PluginSlot;
  /** Additional context data (slot-specific) */
  context?: Record<string, unknown>;
}

/**
 * Plugin lifecycle hooks.
 */
export interface PluginLifecycle {
  /** Called when the plugin is first loaded */
  onLoad?: () => void | Promise<void>;
  /** Called when the plugin is unloaded/disabled */
  onUnload?: () => void | Promise<void>;
  /** Called when the app is ready */
  onReady?: () => void | Promise<void>;
}

/**
 * Complete plugin definition.
 */
export interface Plugin {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Navigation items to add to the sidebar */
  navigation?: PluginNavigationItem[];
  /** Routes to register */
  routes?: PluginRoute[];
  /** Widgets to inject into various slots */
  widgets?: PluginWidget[];
  /** Lifecycle hooks */
  lifecycle?: PluginLifecycle;
}

/**
 * Plugin registration function signature.
 * Plugins export a function that returns their configuration.
 */
export type PluginRegistration = () => Plugin | Promise<Plugin>;

/**
 * Status of a registered plugin.
 */
export type PluginStatus = "loading" | "active" | "error" | "disabled";

/**
 * Registered plugin with runtime state.
 */
export interface RegisteredPlugin {
  /** The plugin definition */
  plugin: Plugin;
  /** Current status of the plugin */
  status: PluginStatus;
  /** Error message if status is "error" */
  error?: string;
}
