/**
 * Extract text from decompressed CC files
 * Reference implementation from retract_s.cpp
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import path from "path";
import { extractTextBlocks } from "./utils/extractTextBlocks.js";

/**
 * Batch extract all CC files in a directory
 */
export function extractDirectory(inputDir: string, outputDir: string): void {
    console.log(`Extracting Japanese: ${inputDir} -> ${outputDir}`);

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // Read all .CC files in input directory
    const files = readdirSync(inputDir).filter((f) => f.endsWith(".CC"));

    if (files.length === 0) {
        console.log("  No .CC files found");
        return;
    }

    console.log(`  Found ${files.length} files`);

    let successCount = 0;
    let failCount = 0;

    for (const fileName of files) {
        const inputPath = path.join(inputDir, fileName);
        const outputPath = path.join(outputDir, fileName.replace(".CC", ".txt"));

        try {
            console.log(`Extracting: ${inputPath} -> ${outputPath}`);

            const buffer = readFileSync(inputPath);
            const textBlocks = extractTextBlocks(buffer);
            const extractedTexts: string[] = textBlocks.map(block => block.jpText.replaceAll("\n", "\\"));

            const outputContent = extractedTexts.join("\n") + "\n";
            writeFileSync(outputPath, outputContent, "utf-8");

            console.log(`  Extracted ${extractedTexts.length} lines of text`);
            successCount++;
        } catch (error: any) {
            console.error(`  ✗ ${fileName}: ${error.message}`);
            failCount++;
        }
    }

    console.log(`\nCompleted: ${successCount} successful, ${failCount} failed`);
}
