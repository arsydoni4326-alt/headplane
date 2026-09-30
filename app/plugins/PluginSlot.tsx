/**
 * Plugin Slot Component
 *
 * Renders all plugin widgets registered for a specific slot.
 */

import React from "react";

import { useActivePlugins } from "./PluginProvider";
import type { PluginSlot as PluginSlotType } from "./types";

interface PluginSlotProps {
  /** The slot identifier */
  slot: PluginSlotType;
  /** Optional context data to pass to widgets */
  context?: Record<string, unknown>;
  /** Optional wrapper component for each widget */
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * Renders all widgets registered for a specific plugin slot.
 *
 * Widgets are sorted by priority (higher priority renders first).
 */
export function PluginSlot({ slot, context, wrapper: Wrapper }: PluginSlotProps) {
  const plugins = useActivePlugins();

  // Collect all widgets for this slot
  const widgets = React.useMemo(() => {
    const collected: Array<{
      key: string;
      component: React.ComponentType<{ slot: PluginSlotType; context?: Record<string, unknown> }>;
      priority: number;
    }> = [];

    for (const registered of plugins) {
      if (registered.plugin.widgets) {
        let widgetIndex = 0;
        for (const widget of registered.plugin.widgets) {
          if (widget.slot === slot) {
            collected.push({
              key: `${registered.plugin.metadata.id}-${widgetIndex++}`,
              component: widget.component,
              priority: widget.priority ?? 0,
            });
          }
        }
      }
    }

    // Sort by priority (descending)
    collected.sort((a, b) => b.priority - a.priority);

    return collected;
  }, [plugins, slot]);

  if (widgets.length === 0) {
    return null;
  }

  return (
    <>
      {widgets.map(({ key, component: Component }) => {
        const content = <Component slot={slot} context={context} />;

        if (Wrapper) {
          return <Wrapper key={key}>{content}</Wrapper>;
        }

        return <React.Fragment key={key}>{content}</React.Fragment>;
      })}
    </>
  );
}
