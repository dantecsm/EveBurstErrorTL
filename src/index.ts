#!/usr/bin/env bun
/**
 * Eve Burst Error Translation Tool
 * For decompressing and compressing game script files
 */

import { decompressDirectory } from "./decompress.ts";
import { compressDirectory } from "./compress.ts";
import { extractDirectory } from "./extract.ts";
import { injectDirectory } from "./inject.ts";
import { importDirectoryToHdi } from "./hdi.ts";
import { loadConfig, getDirectories, getHdiFile } from "./config.ts";

const COMMANDS = {
  DECOMPRESS: "decompress",
  COMPRESS: "compress",
  EXTRACT: "extract",
  INJECT: "inject",
  HDI: "hdi",
  HELP: "help",
};

// Command shortcut mapping
const COMMAND_ALIASES: Record<string, string> = {
  "d": "decompress",
  "c": "compress",
  "e": "extract",
  "i": "inject",
  "h": "hdi",
  "help": "help",
};

function printHelp() {
  const dirs = getDirectories();
  const hdiFile = getHdiFile();
  console.log(`
Eve Burst Error Translation Tool

Usage:
  bun start <command>

Commands:
  d/decompress    Decompress Japanese CC files (${dirs.jpCC} ==> ${dirs.decompressJPCC})
  c/compress      Compress English CC files (${dirs.decompressENCC} ==> ${dirs.enCC})
  e/extract       Extract Japanese text (${dirs.decompressJPCC} ==> ${dirs.jpTXT})
  i/inject        Inject English text (${dirs.enTXT} ==> ${dirs.decompressENCC})
  h/hdi           Import CC files to HDI image (${dirs.enCC} ==> ${hdiFile}:/EVE/)
  help            Show this help message

Configuration directories (from config.json):
  Japanese scripts: ${dirs.jpCC}
  English scripts: ${dirs.enCC}
  Decompressed Japanese scripts: ${dirs.decompressJPCC}
  Decompressed English scripts: ${dirs.decompressENCC}
  Japanese text: ${dirs.jpTXT}
  English text: ${dirs.enTXT}
  HDI image: ${hdiFile}

Examples:
  # Decompress Japanese scripts
  bun start d (or decompress)

  # Compress English scripts
  bun start c (or compress)

  # Extract Japanese text
  bun start e (or extract)

  # Inject English text
  bun start i (or inject)

  # Import CC files to HDI image
  bun start h (or hdi)
`);
}

async function main() {
  // Load configuration
  try {
    loadConfig();
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return; // Normal exit, no error code
  }

  const dirs = getDirectories();

  // Parse command (support shortcuts)
  let command = args[0];
  if (command && COMMAND_ALIASES[command]) {
    command = COMMAND_ALIASES[command];
  }

  switch (command) {
    case COMMANDS.DECOMPRESS: {
      try {
        decompressDirectory(dirs.jpCC, dirs.decompressJPCC);
        console.log("\n✓ Batch decompression completed");
      } catch (error: any) {
        console.error(`\n✗ Batch decompression failed: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.COMPRESS: {
      try {
        compressDirectory(dirs.decompressENCC, dirs.enCC);
        console.log("\n✓ Batch compression completed");
      } catch (error: any) {
        console.error(`\n✗ Batch compression failed: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.EXTRACT: {
      try {
        extractDirectory(dirs.decompressJPCC, dirs.jpTXT);
        console.log("\n✓ Text extraction completed");
      } catch (error: any) {
        console.error(`\n✗ Text extraction failed: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.INJECT: {
      try {
        injectDirectory(dirs.decompressJPCC, dirs.enTXT, dirs.decompressENCC);
        console.log("\n✓ Text injection completed");
      } catch (error: any) {
        console.error(`\n✗ Text injection failed: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case COMMANDS.HDI: {
      try {
        await importDirectoryToHdi(dirs.enCC);
        console.log("\n✓ HDI image import completed");
      } catch (error: any) {
        console.error(`\n✗ HDI image import failed: ${error.message}`);
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
      console.error(`Error: Unknown command "${command}"`);
      console.error('Run "bun index help" to see help information');
      process.exit(1);
    }
  }
}

// Run main program
main().catch((error) => {
  console.error(`An error occurred: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
