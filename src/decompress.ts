/**
 * Decompress CC files
 * CC file format: First 0x18 bytes are header, remaining part is LZSS compressed data
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";

const LZSS_TOOL = "./src/utils/lzss-tool.exe";
const HEADER_SIZE = 0x18;

/**
 * Decompress a single CC file
 * @param inputPath Input file path
 * @param outputPath Output file path
 */
export function decompressCC(inputPath: string, outputPath: string): void {
  console.log(`Decompressing: ${inputPath} -> ${outputPath}`);

  // Read input file
  const inputBuffer = readFileSync(inputPath);

  if (inputBuffer.length < HEADER_SIZE) {
    throw new Error(`File too small (${inputBuffer.length} bytes), cannot decompress`);
  }

  // Extract first 0x18 bytes header (contains 4 bytes decompressed size)
  const header = inputBuffer.subarray(0, HEADER_SIZE);

  // Extract compressed data part (skip first 0x14 bytes)
  const compressedData = inputBuffer.subarray(HEADER_SIZE - 4);

  // Create temporary files to store compressed data
  const tempCompressed = `${outputPath}.temp.compressed`;
  const tempDecompressed = `${outputPath}.temp.decompressed`;

  try {
    // Write temporary compressed file
    writeFileSync(tempCompressed, compressedData);

    // Call lzss-tool to decompress
    try {
      execSync(`"${LZSS_TOOL}" -d -a o4 -n 0x00 -R 0x01 "${tempCompressed}" "${tempDecompressed}"`, {
        stdio: "inherit",
      });
    } catch (error: any) {
      throw new Error(`lzss-tool decompression failed: ${error.message}`);
    }

    // Read decompressed data
    const decompressedBuffer = readFileSync(tempDecompressed);

    // Merge header and decompressed data
    const resultBuffer = Buffer.concat([header, decompressedBuffer]);

    // Write final output file
    writeFileSync(outputPath, resultBuffer);
  } finally {
    // Clean up temporary files
    const tempFiles = [tempCompressed, tempDecompressed];
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
 * Batch decompress all CC files in a directory
 * @param inputDir Input directory
 * @param outputDir Output directory
 */
export function decompressDirectory(inputDir: string, outputDir: string): void {
  console.log(`\nBatch decompressing directory: ${inputDir} -> ${outputDir}`);

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
      decompressCC(inputPath, outputPath);
      successCount++;
    } catch (error: any) {
      console.error(`  ✗ ${fileName}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} successful, ${failCount} failed`);
}
