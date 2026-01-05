/**
 * Process text files in EN TXT directory to add line breaks
 * Every 52 characters, if no \n symbol, add \\ after the last space position
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "path";

/**
 * Process a single text line to add line breaks
 * Uses \\ as the line break marker instead of \n
 */
function processTextLine(text: string): string {
    const maxWidth = 52;
    let width = 0;
    let lastSpacePos = -1;
    const chars = Array.from(text);

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];

        if (char === ' ') {
            lastSpacePos = i;
        }

        if (char === '\\') {
            width = 0;
            lastSpacePos = -1;
        } else {
            width++;
        }

        if (width >= maxWidth) {
            width = 0;
            if (lastSpacePos !== -1) {
                chars[lastSpacePos] = '\\';
                // Reset width to the number of characters already in the current line since the break point
                width = i - lastSpacePos;
                lastSpacePos = -1;
            }
        }
    }

    return chars.join('');
}

/**
 * Process a single text file (in-place modification)
 */
function processFile(filePath: string): void {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    
    const processedLines = lines.map(line => processTextLine(line));
    const processedContent = processedLines.join("\n");
    
    writeFileSync(filePath, processedContent, "utf-8");
}

/**
 * Process all text files in a directory (in-place)
 */
function processDirectory(dir: string): void {
    console.log(`Processing text files in: ${dir}`);

    // Read all .txt files in input directory
    const txtFiles = readdirSync(dir).filter((f) => f.endsWith(".txt"));

    if (txtFiles.length === 0) {
        console.log("  No .txt files found");
        return;
    }

    console.log(`  Found ${txtFiles.length} files`);

    let processedCount = 0;

    for (const fileName of txtFiles) {
        const filePath = path.join(dir, fileName);

        console.log(`  Processing: ${fileName}`);
        
        try {
            processFile(filePath);
            processedCount++;
        } catch (error) {
            console.error(`  ✗ ${fileName}: Processing failed`);
            console.error(error);
        }
    }

    console.log(`\nCompleted: ${processedCount} files processed`);
}

// Main execution
const inputDir = "data/EN TXT";

processDirectory(inputDir);