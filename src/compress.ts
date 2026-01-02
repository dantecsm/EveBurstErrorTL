/**
 * Compress CC files
 * CC file format: First 0x18 bytes are header, remaining part needs LZSS compression
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const LZSS_TOOL = "./src/utils/lzss-tool.exe";
const HEADER_SIZE = 0x18;

/**
 * Compress a single CC file
 * @param inputPath Input file path (decompressed file)
 * @param outputPath Output file path (compressed file)
 */
export function compressCC(inputPath: string, outputPath: string): void {
  console.log(`Compressing: ${inputPath} -> ${outputPath}`);

  // Read input file
  const inputBuffer = readFileSync(inputPath);

  if (inputBuffer.length < HEADER_SIZE) {
    throw new Error(`File too small (${inputBuffer.length} bytes), cannot compress`);
  }

  // Extract first 0x18 bytes header
  const header = inputBuffer.subarray(0, HEADER_SIZE);

  // Extract data part that needs compression (skip first 0x18 bytes)
  const uncompressedData = inputBuffer.subarray(HEADER_SIZE);

  // Create temporary files
  const tempUncompressed = `${outputPath}.temp.uncompressed`;
  const tempCompressed = `${outputPath}.temp.compressed`;

  try {
    // Write temporary uncompressed file
    writeFileSync(tempUncompressed, uncompressedData);

    // Call lzss-tool to compress
    try {
      execSync(`"${LZSS_TOOL}" -e -n 0x00 -R 0x01 "${tempUncompressed}" "${tempCompressed}"`, {
        stdio: "inherit",
      });
    } catch (error: any) {
      throw new Error(`lzss-tool compression failed: ${error.message}`);
    }

    // Read compressed data
    const compressedBuffer = readFileSync(tempCompressed);

    // Merge header and compressed data
    const resultBuffer = Buffer.concat([header, compressedBuffer]);

    // Write final output file
    writeFileSync(outputPath, resultBuffer);
  } finally {
    // Clean up temporary files
    const tempFiles = [tempUncompressed, tempCompressed];
    for (const file of tempFiles) {
      try {
        if (process.platform === "win32") {
          execSync(`del /F /Q "${file}"`, { stdio: "ignore" });
        } else {
          execSync(`rm -f "${file}"`, { stdio: "ignore" });
        }
      } catch {
        // Ignore deletion failures
      }
    }
  }
}

/**
 * Batch compress all CC files in a directory
 * @param inputDir Input directory (decompressed files)
 * @param outputDir Output directory (compressed files)
 */
export function compressDirectory(inputDir: string, outputDir: string): void {
  console.log(`\nBatch compressing directory: ${inputDir} -> ${outputDir}`);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Read all .CC files in input directory
  const allFiles = readdirSync(inputDir);
  const files = allFiles.filter(f => f.endsWith('.CC'));

  if (files.length === 0) {
    console.log("  No .CC files found");
    return;
  }

  console.log(`  Found ${files.length} files`);

  let successCount = 0;
  let failCount = 0;

  for (const fileName of files) {
    const inputPath = join(inputDir, fileName);
    const outputPath = join(outputDir, fileName);

    try {
      compressCC(inputPath, outputPath);
      successCount++;
    } catch (error: any) {
      console.error(`  ✗ ${fileName}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} successful, ${failCount} failed`);
}
