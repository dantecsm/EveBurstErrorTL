#!/usr/bin/env bun
/**
 * Eve Burst Error 翻译工具
 * 用于解压和压缩游戏脚本文件
 */

import { decompressDirectory } from "./decompress.ts";
import { compressDirectory } from "./compress.ts";
import { extractDirectory } from "./extract.ts";
import { injectDirectory } from "./inject.ts";
import { loadConfig, getDirectories } from "./config.ts";

const COMMANDS = {
  DECOMPRESS: "decompress",
  COMPRESS: "compress",
  EXTRACT: "extract",
  INJECT: "inject",
  HELP: "help",
};

// 命令快捷键映射
const COMMAND_ALIASES: Record<string, string> = {
  "d": "decompress",
  "c": "compress",
  "e": "extract",
  "i": "inject",
  "h": "help",
};

function printHelp() {
  const dirs = getDirectories();
  console.log(`
Eve Burst Error 翻译工具

用法:
  bun start <命令>

命令:
  d/decompress    解压日语 CC 文件（${dirs.jpCC} ==> ${dirs.decompressJPCC}）
  c/compress      压缩英语 CC 文件（${dirs.decompressENCC} ==> ${dirs.enCC}）
  e/extract       提取日语文本    （${dirs.decompressJPCC} ==> ${dirs.jpTXT}）
  i/inject        注入英语文本TODO（${dirs.enTXT} ==> ${dirs.decompressENCC}）
  h/help          显示此帮助信息

配置目录 (从 config.json 读取):
  日语脚本: ${dirs.jpCC}
  英语脚本: ${dirs.enCC}
  解压日语脚本: ${dirs.decompressJPCC}
  解压英语脚本: ${dirs.decompressENCC}
  日语文本: ${dirs.jpTXT}
  英语文本: ${dirs.enTXT}

示例:
  # 解压日语脚本
  bun start d (or decompress)

  # 压缩英语脚本
  bun start c (or compress)

  # 提取日语文本
  bun start e (or extract)

  # 注入英语文本
  bun start i (or inject)
`);
}

async function main() {
  // 加载配置
  try {
    loadConfig();
  } catch (error: any) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return; // 正常退出，不返回错误码
  }

  const dirs = getDirectories();

  // 解析命令（支持快捷键）
  let command = args[0];
  if (command && COMMAND_ALIASES[command]) {
    command = COMMAND_ALIASES[command];
  }

  switch (command) {
    case COMMANDS.DECOMPRESS: {
      try {
        await decompressDirectory(dirs.jpCC, dirs.decompressJPCC);
        console.log("\n✓ 批量解压完成");
      } catch (error: any) {
        console.error(`\n✗ 批量解压失败: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.COMPRESS: {
      try {
        await compressDirectory(dirs.decompressENCC, dirs.enCC);
        console.log("\n✓ 批量压缩完成");
      } catch (error: any) {
        console.error(`\n✗ 批量压缩失败: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.EXTRACT: {
      try {
        extractDirectory(dirs.decompressJPCC, dirs.jpTXT);
        console.log("\n✓ 文本提取完成");
      } catch (error: any) {
        console.error(`\n✗ 文本提取失败: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.INJECT: {
      try {
        injectDirectory(dirs.decompressJPCC, dirs.enTXT, dirs.decompressENCC);
        console.log("\n✓ 文本注入完成");
      } catch (error: any) {
        console.error(`\n✗ 文本注入失败: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.HELP:
    case "-h":
    case "--help": {
      printHelp();
      break;
    }

    default: {
      console.error(`错误: 未知命令 "${command}"`);
      console.error('运行 "bun index help" 查看帮助信息');
      process.exit(1);
    }
  }
}

// 运行主程序
main().catch((error) => {
  console.error(`发生错误: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
