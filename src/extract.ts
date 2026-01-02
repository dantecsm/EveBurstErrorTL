/**
 * 从解压的 CC 文件中提取文本
 * 参考 retract_s.cpp 的实现
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import path from "path";
import { extractTextBlocks } from "./utils/extractTextBlocks.js";

/**
 * 批量提取目录中的所有 CC 文件
 */
export function extractDirectory(inputDir: string, outputDir: string): void {
    console.log(`提取日语: ${inputDir} -> ${outputDir}`);

    // 确保输出目录存在
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // 读取输入目录中的所有 .CC 文件
    const files = readdirSync(inputDir).filter((f) => f.endsWith(".CC"));

    if (files.length === 0) {
        console.log("  没有找到 .CC 文件");
        return;
    }

    console.log(`  找到 ${files.length} 个文件`);

    let successCount = 0;
    let failCount = 0;

    for (const fileName of files) {
        const inputPath = path.join(inputDir, fileName);
        const outputPath = path.join(outputDir, fileName.replace(".CC", ".txt"));

        try {
            console.log(`提取: ${inputPath} -> ${outputPath}`);

            const buffer = readFileSync(inputPath);
            const textBlocks = extractTextBlocks(buffer);
            const extractedTexts: string[] = textBlocks.map(block => block.jpText.replaceAll("\n", "\\"));

            const outputContent = extractedTexts.join("\n") + "\n";
            writeFileSync(outputPath, outputContent, "utf-8");

            console.log(`  提取了 ${extractedTexts.length} 行文本`);
            successCount++;
        } catch (error: any) {
            console.error(`  ✗ ${fileName}: ${error.message}`);
            failCount++;
        }
    }

    console.log(`\n完成: ${successCount} 成功, ${failCount} 失败`);
}
