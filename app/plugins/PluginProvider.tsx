/**
 * Plugin Provider
 *
 * React context provider for the plugin system.
 * Makes plugin data available throughout the application.
 */

import React from "react";

import type { RegisteredPlugin } from "./types";
import { pluginRegistry } from "./registry";

interface PluginContextValue {
  /** All registered plugins */
  plugins: RegisteredPlugin[];
  /** Whether the plugin system is initialized */
  initialized: boolean;
}

const PluginContext = React.createContext<PluginContextValue | null>(null);

interface PluginProviderProps {
  readonly children: React.ReactNode;
}

/**
 * Plugin provider component.
 * Wraps the application to provide plugin context.
 */
export function PluginProvider({ children }: PluginProviderProps) {
  const [plugins, setPlugins] = React.useState<RegisteredPlugin[]>([]);
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    // Initialize plugins on mount
    const initializePlugins = async () => {
      try {
        await pluginRegistry.initialize();
        setPlugins(pluginRegistry.getAll());
        setInitialized(true);
      } catch (error) {
        console.error("Failed to initialize plugins:", error);
        setInitialized(true); // Still mark as initialized to prevent loading state
      }
    };

    initializePlugins();
  }, []);

  const value = React.useMemo(
    () => ({
      plugins,
      initialized,
    }),
    [plugins, initialized]
  );

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

/**
 * Hook to access the plugin context.
 *
 * @throws Error if used outside of PluginProvider
 */
export function usePlugins(): PluginContextValue {
  const context = React.useContext(PluginContext);
  if (!context) {
    throw new Error("usePlugins must be used within a PluginProvider");
  }
  return context;
}

/**
 * Hook to get active plugins.
 */
export function useActivePlugins(): RegisteredPlugin[] {
  const { plugins } = usePlugins();
  return React.useMemo(() => plugins.filter((p) => p.status === "active"), [plugins]);
}
