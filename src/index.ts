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
import { patchC01_3, PATCH_TARGET } from "./patch.ts";
import path from "path";

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
  i/inject        Inject English text (${dirs.enTXT} ==> ${dirs.decompressENCC}, then auto-fix ${PATCH_TARGET} length bytes)
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

        // Post-inject fix: as soon as the uncompressed English CC file is
        // generated, correct the C01_3.CC length bytes (before compress).
        try {
          const patchResult = patchC01_3(path.join(dirs.decompressENCC, PATCH_TARGET));
          if (!patchResult.exists) {
            console.log(`\n⚠ ${PATCH_TARGET} not found in ${dirs.decompressENCC}, length fix skipped`);
          } else if (patchResult.matches === 0) {
            console.log(`\n⚠ ${PATCH_TARGET} length fix: no pattern matches (nothing to fix)`);
          } else {
            console.log(`\n✓ ${PATCH_TARGET} length fix applied: ${patchResult.matches} match(es), ${patchResult.changed} byte(s) changed`);
            const skipped = patchResult.details.filter((d) => d.skipped).length;
            if (skipped > 0) {
              console.log(`  ⚠ ${skipped} match(es) skipped (needle not found)`);
            }
          }
        } catch (error: any) {
          console.warn(`\n⚠ ${PATCH_TARGET} length fix failed: ${error.message}`);
        }
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
