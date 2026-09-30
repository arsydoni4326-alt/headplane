/**
 * Plugin Registry
 *
 * Central registry for managing plugin lifecycle, registration, and access.
 */

import type { Plugin, PluginRegistration, RegisteredPlugin, PluginStatus } from "./types";

export class PluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();
  private initialized = false;

  /**
   * Register a plugin with the system.
   *
   * @param registration - Plugin registration function
   * @returns Promise that resolves when the plugin is registered
   */
  async register(registration: PluginRegistration): Promise<void> {
    try {
      const plugin = await registration();

      // Validate plugin ID
      if (!plugin.metadata.id) {
        throw new Error("Plugin must have an id");
      }

      // Check for duplicate IDs
      if (this.plugins.has(plugin.metadata.id)) {
        throw new Error(`Plugin with id "${plugin.metadata.id}" is already registered`);
      }

      // Validate route paths
      if (plugin.routes) {
        for (const route of plugin.routes) {
          if (!route.path.startsWith("/plugins/")) {
            throw new Error(`Plugin route paths must start with "/plugins/", got: ${route.path}`);
          }
        }
      }

      // Validate navigation paths
      if (plugin.navigation) {
        for (const nav of plugin.navigation) {
          if (!nav.path.startsWith("/plugins/")) {
            throw new Error(`Plugin navigation paths must start with "/plugins/", got: ${nav.path}`);
          }
        }
      }

      // Register the plugin
      this.plugins.set(plugin.metadata.id, {
        plugin,
        status: "loading",
      });

      // Call onLoad hook
      if (plugin.lifecycle?.onLoad) {
        await plugin.lifecycle.onLoad();
      }

      // Mark as active
      this.updateStatus(plugin.metadata.id, "active");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to register plugin:`, errorMessage);

      // Store error state if we have an ID
      if (typeof error === "object" && error !== null && "metadata" in error) {
        const plugin = error as Plugin;
        if (plugin.metadata?.id) {
          this.plugins.set(plugin.metadata.id, {
            plugin,
            status: "error",
            error: errorMessage,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Initialize all registered plugins.
   * Calls the onReady lifecycle hook for each plugin.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const readyPromises: Promise<void>[] = [];

    for (const registered of this.plugins.values()) {
      if (registered.status === "active" && registered.plugin.lifecycle?.onReady) {
        const promise = registered.plugin.lifecycle.onReady();
        if (promise) {
          readyPromises.push(
            promise.catch((error: unknown) => {
              console.error(`Plugin ${registered.plugin.metadata.id} onReady failed:`, error);
              this.updateStatus(registered.plugin.metadata.id, "error", String(error));
            })
          );
        }
      }
    }

    await Promise.all(readyPromises);
    this.initialized = true;
  }

  /**
   * Unregister a plugin.
   *
   * @param pluginId - ID of the plugin to unregister
   */
  async unregister(pluginId: string): Promise<void> {
    const registered = this.plugins.get(pluginId);
    if (!registered) {
      return;
    }

    // Call onUnload hook
    if (registered.plugin.lifecycle?.onUnload) {
      try {
        await registered.plugin.lifecycle.onUnload();
      } catch (error) {
        console.error(`Plugin ${pluginId} onUnload failed:`, error);
      }
    }

    this.plugins.delete(pluginId);
  }

  /**
   * Get all registered plugins.
   */
  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all active plugins.
   */
  getActive(): RegisteredPlugin[] {
    return this.getAll().filter((p) => p.status === "active");
  }

  /**
   * Get a specific plugin by ID.
   */
  get(pluginId: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is registered and active.
   */
  isActive(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    return plugin?.status === "active";
  }

  /**
   * Update plugin status.
   */
  private updateStatus(pluginId: string, status: PluginStatus, error?: string): void {
    const registered = this.plugins.get(pluginId);
    if (registered) {
      this.plugins.set(pluginId, {
        ...registered,
        status,
        error,
      });
    }
  }

  /**
   * Clear all plugins (primarily for testing).
   */
  clear(): void {
    this.plugins.clear();
    this.initialized = false;
  }
}

/**
 * Global plugin registry instance.
 */
export const pluginRegistry = new PluginRegistry();
