import { writeFile, rename, unlink } from "node:fs/promises";

import { dump } from "js-yaml";

import log from "~/utils/log";

import type { HeadplaneConfig, PartialHeadplaneConfig } from "./config-schema";
import { ConfigError } from "./error";

/**
 * Atomically writes configuration to a YAML file.
 * Writes to a temporary file first, then atomically renames it.
 *
 * @param configPath The path to the config file
 * @param config The configuration object to write
 * @throws {ConfigError} If the write fails
 */
export async function writeConfig(
  configPath: string,
  config: HeadplaneConfig | PartialHeadplaneConfig,
): Promise<void> {
  const tempPath = `${configPath}.tmp`;

  try {
    // Convert config to YAML
    const yamlContent = dump(config, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
      sortKeys: false,
    });

    // Write to temporary file
    await writeFile(tempPath, yamlContent, { encoding: "utf8", mode: 0o600 });

    // Atomically rename to target path
    await rename(tempPath, configPath);

    log.info("config", "Configuration written to %s", configPath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    throw ConfigError.from("CONFIG_WRITE_FAILED", {
      path: configPath,
      error: String(error),
    });
  }
}

/**
 * Updates specific fields in the configuration file atomically.
 * Reads the current config, applies updates, and writes back.
 *
 * @param configPath The path to the config file
 * @param updates Partial configuration updates to apply
 * @throws {ConfigError} If the read or write fails
 */
export async function updateConfig(
  configPath: string,
  updates: PartialHeadplaneConfig,
): Promise<void> {
  const { loadConfigFile } = await import("./load");

  // Read current config
  const currentConfig = await loadConfigFile(configPath);
  if (!currentConfig) {
    throw ConfigError.from("CONFIG_READ_FAILED", {
      path: configPath,
      error: "Config file not found",
    });
  }

  // Deep merge updates into current config
  const updatedConfig = deepMerge(currentConfig, updates);

  // Write updated config atomically
  await writeConfig(configPath, updatedConfig);
}

/**
 * Deep merges two objects, with the second object taking precedence.
 * Arrays are replaced, not merged.
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue != null &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue != null &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}
