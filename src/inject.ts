/**
 * Inject translated text into decompressed CC files
 * Reference implementation from retract_s.cpp
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import path from "path";
import iconv from "iconv-lite";
import { extractTextBlocks } from "./utils/extractTextBlocks.js";

interface Result {
    success?: boolean,
    halfSuccess?: boolean,
    fail?: boolean,
    warnings?: string[],
    errors?: string[]
}

/**
 * Inject a single file
 */
function injectFile(
    ccPath: string,
    txtPath: string,
    outputPath: string
): Result {
    const result: Result = {};
    const buffer = readFileSync(ccPath);
    const textBlocks = extractTextBlocks(buffer);
    const enTxtContent = readFileSync(txtPath, "utf-8");
    const enLines = enTxtContent.split("\n").filter(line => line !== "").map(line => line.replaceAll('\\', '\n'));
    if (textBlocks.length !== enLines.length) {
        const error = `${txtPath} line count does not match extracted text count in ${ccPath}, ${enLines.length} !== ${textBlocks.length}`;
        if (!result.errors) result.errors = [];
        result.errors.push(error);
        result.fail = true;
        return result;
    }
    textBlocks.forEach((block, i) => block.enText = enLines[i] || "");

    let lostLines = 0;
    textBlocks.forEach((block, i) => {
        const enText = processEnText(block.enText);
        const enBytes = iconv.encode(enText, "sjis");
        const enLen = enBytes.length;
        if (enLen > 0xFF) {
            if (!result.warnings) result.warnings = [];
            result.warnings.push(`    ❗ ${txtPath} line ${i + 1} English exceeds 255 bytes (length: ${enLen}), cannot insert`);
            result.halfSuccess = true;
            lostLines++;
            return;
        }
        // Generate enBuffer as byte stream: 0xFD enLen enBytes 00
        const enBuffer = Buffer.from([0xFD, enLen, ...enBytes, 0x00]);
        block.enBuffer = enBuffer;
    });

    // if text is a goto command, add 0x07 to the beginning of the buffer
    textBlocks.forEach((block) => {
        const isGoto = block.enText.startsWith('GOTO ');
        const enText = block.enText.slice(5);
        const enBytes = iconv.encode(enText, "sjis");
        const enLen = enBytes.length;
        if (isGoto) {
            const enBuffer = Buffer.from([0x07, 0xFD, enLen, ...enBytes, 0x00]);
            block.enBuffer = enBuffer;
        }
    })

    // Modify buffer file header length
    const oldLen = buffer.readUInt16LE(0x14);
    let newLen = oldLen;
    let totalOverLen = 0;
    textBlocks.forEach((block, i) => {
        const { jpBuffer, enBuffer } = block;
        const diffLen = enBuffer.length - jpBuffer.length;
        if (newLen + diffLen <= 0xFFFF) {
            newLen += diffLen;
        } else {
            block.enText = block.jpText;
            block.enBuffer = Buffer.from(block.jpBuffer);
            result.halfSuccess = true;
            if (!result.warnings) result.warnings = [];
            result.warnings.push(`    ❗ Line ${i} English not inserted due to file size limit`);
            const overLen = newLen + diffLen - 0xFFFF;
            totalOverLen += overLen;
            lostLines++;
        }
    });
    if (lostLines > 0) {
        result.halfSuccess = true;
        if (!result.warnings) result.warnings = [];
        result.warnings?.push(`    ❗ ${txtPath} Total exceeded ${totalOverLen} bytes, ${lostLines} lines of English not injected`);
    }

    let newBuffer = Buffer.from(buffer) as Buffer;
    let basePos = 0x18;
    newBuffer.writeUInt16LE(newLen, 0x14);
    for (const block of textBlocks) {
        const { jpBuffer, enBuffer } = block;
        try {
            const replaceResult = replaceBuffer(newBuffer, jpBuffer, enBuffer, basePos);
            newBuffer = replaceResult.buffer;
            basePos = replaceResult.pos;
        } catch (e) {
            result.fail = true;
            if (!result.errors) result.errors = [];
            result.errors.push(e as any);
        }
    }
    writeFileSync(outputPath, newBuffer);

    if (!result.halfSuccess && !result.fail) {
        result.success = true;
    }
    if (result.fail) {
        result.halfSuccess = false;
    }
    return result;
}

/**
 * Batch inject all files in a directory
 */
export function injectDirectory(inputDir: string, txtDir: string, outputDir: string): void {
    console.log(`Injecting English: ${inputDir} + ${txtDir} -> ${outputDir}`);

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // Read all .CC files in input directory
    const ccFiles = readdirSync(inputDir).filter((f) => f.endsWith(".CC"));
    // while (ccFiles.length > 1) ccFiles.pop();

    if (ccFiles.length === 0) {
        console.log("  No .CC files found");
        return;
    }

    console.log(`  Found ${ccFiles.length} files`);

    let successCount = 0;
    let halfSuccessCount = 0;
    let failCount = 0;

    for (const fileName of ccFiles) {
        const ccPath = path.join(inputDir, fileName);
        const txtFileName = fileName.replace(".CC", ".txt");
        const txtPath = path.join(txtDir, txtFileName);
        const outputPath = path.join(outputDir, fileName);

        // Check if corresponding text file exists
        if (!existsSync(txtPath)) {
            console.log(`    ❗  ${fileName}: No corresponding text file, skipping`);
            continue;
        }

        console.log(`Injecting: ${txtFileName} -> ${fileName}`);

        const result = injectFile(ccPath, txtPath, outputPath);

        if (result.success) {
            successCount++;
        } else if (result.halfSuccess) {
            for (const warning of (result.warnings || [])) {
                console.log(warning);
            }
            halfSuccessCount++;
        } else if (result.fail) {
            for (const errors of result.errors || []) {
                console.error(errors);
            }
            console.error(`  ✗ ${fileName}: Injection failed`);
            failCount++;
        } else {
            throw new Error("Unknown injection result");
        }
    }

    console.log(`\nCompleted: ${successCount} successful, ${halfSuccessCount} partially successful, ${failCount} failed`);
}

function processEnText(enText: string): string {
    // Every 53 characters, if no \n symbol, add \n after the last space position within these 53 characters
    const maxWidth = 53;
    let width = 0;
    let lastSpacePos = -1;
    const chars = Array.from(enText);

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];

        if (char === ' ') {
            lastSpacePos = i;
        }

        if (char === '\n') {
            width = 0;
            lastSpacePos = -1;
        } else {
            width++;
        }

        if (width >= maxWidth) {
            width = 0;
            if (lastSpacePos !== -1) {
                chars[lastSpacePos] = '\n';
                // Reset width to the number of characters already in the current line since the break point
                width = i - lastSpacePos;
                lastSpacePos = -1;
            }
        }
    }

    return chars.join('');
}

function replaceBuffer(buffer: Buffer, subArrayToReplace: Buffer, replacementSubArray: Buffer, basePos: number = 0): { buffer: Buffer, pos: number } {
    const startPos = buffer.indexOf(subArrayToReplace, basePos);
    if (startPos === -1) {
        throw `Cannot find replacement area in original file: ${Array.from(subArrayToReplace).map(n => n.toString(16).padStart(2, '0').toUpperCase())}`;
    }

    const endPos = startPos + subArrayToReplace.length;
    const replacedBuffer = Buffer.concat([buffer.subarray(0, startPos), replacementSubArray, buffer.subarray(endPos)]);
    const result = {
        buffer: replacedBuffer,
        pos: startPos
    };
    return result;
}