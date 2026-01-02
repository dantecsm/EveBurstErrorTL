/**
 * 将翻译文本注入到解压的 CC 文件中
 * 参考 retract_s.cpp 的实现
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import path from "path";
import iconv from "iconv-lite";
import { extractTextBlocks } from "./utils/extractTextBlocks.js";
import type { TextBlock } from "./utils/extractTextBlocks.js";

/**
 * 注入单个文件
 */
function injectFile(
    ccPath: string,
    txtPath: string,
    outputPath: string
): { success?: boolean, halfSuccess?: boolean, fail?: boolean, warnings?: string[]} {
    return {}
}

/**
 * 批量注入目录中的所有文件
 */
export function injectDirectory(inputDir: string, txtDir: string, outputDir: string): void {
    console.log(`注入英语: ${inputDir} + ${txtDir} -> ${outputDir}`);

    // 确保输出目录存在
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // 读取输入目录中的所有 .CC 文件
    const ccFiles = readdirSync(inputDir).filter((f) => f.endsWith(".CC"));
    while (ccFiles.length > 1) ccFiles.pop();

    if (ccFiles.length === 0) {
        console.log("  没有找到 .CC 文件");
        return;
    }

    console.log(`  找到 ${ccFiles.length} 个文件`);

    let successCount = 0;
    let halfSuccessCount = 0;
    let failCount = 0;

    for (const fileName of ccFiles) {
        const ccPath = path.join(inputDir, fileName);
        const txtPath = path.join(txtDir, fileName.replace(".CC", ".txt"));
        const outputPath = path.join(outputDir, fileName);

        // 检查对应的文本文件是否存在
        if (!existsSync(txtPath)) {
            console.log(`  ⊙ ${fileName}: 没有对应的文本文件，跳过`);
            continue;
        }

        console.log(`注入: ${fileName}`);

        const result = injectFile(ccPath, txtPath, outputPath);

        if (result.success) {
            successCount++;
        } else if (result.halfSuccess) {
            for (const warning of (result.warnings || [])) {
                console.log(warning);
                // console.log(`    ❗  ${txtPath} 共超出 ${result.totalDiff} 个字节，有 ${result.warnings.length} 行英语未注入`);
            }
            halfSuccessCount++;
        } else {
            console.error(`  ✗ ${fileName}: 注入失败`);
            failCount++;
        }
    }

    console.log(`\n完成: ${successCount} 成功, ${halfSuccessCount} 部分成功， ${failCount} 失败`);
}
