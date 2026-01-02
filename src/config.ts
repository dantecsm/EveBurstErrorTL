/**
 * 配置管理模块
 * 加载和管理项目配置
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
 * 加载配置文件
 * @param configPath 配置文件路径（可选，默认为项目根目录的 config.json）
 * @returns 配置对象
 */
export function loadConfig(configPath?: string): Config {
  if (configCache) {
    return configCache;
  }

  const defaultPath = join(process.cwd(), "config.json");
  const path = configPath || defaultPath;

  if (!existsSync(path)) {
    throw new Error(`配置文件不存在: ${path}`);
  }

  try {
    const configContent = readFileSync(path, "utf-8");
    configCache = JSON.parse(configContent) as Config;
    return configCache;
  } catch (error: any) {
    throw new Error(`加载配置文件失败: ${error.message}`);
  }
}

/**
 * 获取配置对象
 * @returns 配置对象
 */
export function getConfig(): Config {
  if (!configCache) {
    return loadConfig();
  }
  return configCache;
}

/**
 * 获取目录配置
 * @returns 目录配置
 */
export function getDirectories(): DirectoriesConfig {
  return getConfig().directories;
}

/**
 * 重置配置缓存（用于测试）
 */
export function resetConfigCache(): void {
  configCache = null;
}

/*
 * 获取 hdi 文件
 * @returns hdi 文件路径
 */
export function getHdiFile(): string {
  return getConfig().hdiFile;
}