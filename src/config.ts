/**
 * Configuration management module
 * Loads and manages project configuration
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface DirectoriesConfig {
  jpCC: string;
  enCC: string;
  decompressJPCC: string;
  decompressENCC: string;
  jpTXT: string;
  enTXT: string;
}

export interface Config {
  directories: DirectoriesConfig;
  hdiFile: string;
}

let configCache: Config | null = null;

/**
 * Load configuration file
 * @param configPath Configuration file path (optional, defaults to config.json in project root)
 * @returns Configuration object
 */
export function loadConfig(configPath?: string): Config {
  if (configCache) {
    return configCache;
  }

  const defaultPath = join(process.cwd(), "config.json");
  const path = configPath || defaultPath;

  if (!existsSync(path)) {
    throw new Error(`Configuration file not found: ${path}`);
  }

  try {
    const configContent = readFileSync(path, "utf-8");
    configCache = JSON.parse(configContent) as Config;
    return configCache;
  } catch (error: any) {
    throw new Error(`Failed to load configuration file: ${error.message}`);
  }
}

/**
 * Get configuration object
 * @returns Configuration object
 */
export function getConfig(): Config {
  if (!configCache) {
    return loadConfig();
  }
  return configCache;
}

/**
 * Get directory configuration
 * @returns Directory configuration
 */
export function getDirectories(): DirectoriesConfig {
  return getConfig().directories;
}

/**
 * Reset configuration cache (for testing)
 */
export function resetConfigCache(): void {
  configCache = null;
}

/*
 * Get HDI file path
 * @returns HDI file path
 */
export function getHdiFile(): string {
  return getConfig().hdiFile;
}