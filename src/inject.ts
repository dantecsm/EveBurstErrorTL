/**
 * 将翻译文本注入到解压的 CC 文件中
 * 参考 retract_s.cpp 的实现
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";
import { validateTextStructure } from "./utils/validateTextStructure.js";

const HEADER_SIZE = 0x14;
const TEXT_MARKER = 0xFD;
const ENCODING = "Shift_JIS";

/**
 * 从 CC 文件中提取所有文本块的位置和内容
 * 用于计算空间占用
 */
interface TextBlock {
    position: number;      // 0xFD 标记的位置
    length: number;        // 文本长度（不包括 0xFD 和长度字节和终止符）
    text: string;          // 解码后的文本
    textBytes: Buffer;     // 原始字节（Shift_JIS 编码）
}

function extractTextBlocks(buffer: Buffer): TextBlock[] {
    const blocks: TextBlock[] = [];
    const ccLen = buffer.length;
    let ccPos = HEADER_SIZE;

    while (ccPos < ccLen) {
        const cmd = buffer[ccPos];
        const curCmdPos = ccPos;
        ccPos++;

        if (cmd === TEXT_MARKER) {
            if (ccPos >= ccLen) break;

            // 验证文本结构
            const isValid = validateTextStructure(buffer, curCmdPos);

            if (!isValid) {
                ccPos = curCmdPos + 1;
                continue;
            }

            // 提取文本块信息
            const lineLen = buffer[ccPos] as any;
            ccPos++;
            const textStart = ccPos;
            const textEnd = textStart + lineLen;

            if (textEnd > buffer.length) {
                ccPos = curCmdPos + 1;
                continue;
            }

            const textBytes = buffer.subarray(textStart, textEnd);
            let decodedText: string;
            try {
                decodedText = iconv.decode(textBytes, ENCODING);
            } catch (error) {
                ccPos = curCmdPos + 1;
                continue;
            }

            blocks.push({
                position: curCmdPos,
                length: lineLen,
                text: decodedText,
                textBytes: textBytes,
            });

            ccPos = textEnd + 1; // 跳过文本和终止符
        }
    }

    return blocks;
}

/**
 * 注入单个文件
 */
function injectFile(
    ccPath: string,
    txtPath: string,
    outputPath: string
): { success: boolean; replaced: number; skipped: number; warnings: string[], totalDiff: number } {
    const result = {
        success: false,
        replaced: 0,
        skipped: 0,
        warnings: [] as string[],
        totalDiff: 0
    };

    try {
        // 读取 CC 文件和文本文件
        const ccBuffer = readFileSync(ccPath);
        const txtContent = readFileSync(txtPath, "utf-8");

        // 提取英语文本行（过滤空行）
        const enLines = txtContent.split("\n").filter(line => line.trim() !== "");

        // 提取 CC 文件中的所有文本块
        const jpBlocks = extractTextBlocks(ccBuffer);

        if (jpBlocks.length !== enLines.length) {
            result.warnings.push(
                `文本行数不匹配: CC 有 ${jpBlocks.length} 行, TXT 有 ${enLines.length} 行`
            );
        }

        // 计算总空间限制
        const ccLen = ccBuffer.length;
        const maxFileSize = 65535;
        let ccFree = maxFileSize - ccLen;

        // 创建输出缓冲区（复制原始 CC 文件）
        const outputBuffer = Buffer.from(ccBuffer);

        // 逐个处理文本块
        const minLines = Math.min(jpBlocks.length, enLines.length);

        for (let i = 0; i < minLines; i++) {
            const jpBlock = jpBlocks[i];
            const enText = enLines[i];

            // 将反斜杠转回换行符
            const enTextProcessed = enText.replace(/\\/g, "\n");

            // 将英语文本编码为 Shift_JIS
            let enBytes: Buffer;
            try {
                enBytes = iconv.encode(enTextProcessed, ENCODING);
            } catch (error) {
                result.warnings.push(`第 ${i + 1} 行: 英语文本编码失败`);
                result.skipped++;
                continue;
            }

            const enLen = enBytes.length;
            const jpLen = jpBlock.length;

            // 计算空间变化
            const spaceDiff = enLen - jpLen;

            if (spaceDiff > ccFree) {
                // 空间不足，保留日语
                result.warnings.push(
                    `第 ${i + 1} 行: 空间不足 (需要 ${spaceDiff} 字节, 剩余 ${ccFree} 字节)，保留日语`
                );
                result.totalDiff += spaceDiff;
                result.skipped++;
                continue;
            }

            // 空间足够，替换为英语
            // 写入新的长度字节
            outputBuffer[jpBlock.position + 1] = enLen;

            // 写入新的文本内容
            const textStart = jpBlock.position + 2;
            enBytes.copy(outputBuffer, textStart);

            // 更新剩余空间
            ccFree -= spaceDiff;
            result.replaced++;
        }

        // 处理多余的英语文本行
        if (enLines.length > jpBlocks.length) {
            result.warnings.push(
                `警告: TXT 文件有 ${enLines.length - jpBlocks.length} 行额外文本无法注入`
            );
        }

        // 写入输出文件
        writeFileSync(outputPath, outputBuffer);

        result.success = true;
    } catch (error: any) {
        result.warnings.push(`处理失败: ${error.message}`);
    }

    return result;
}

/**
 * 批量注入目录中的所有文件
 */
export function injectDirectory(inputDir: string, txtDir: string, outputDir: string): void {
    console.log(`注入英语: ${txtDir} -> ${outputDir}`);

    // 确保输出目录存在
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // 读取输入目录中的所有 .CC 文件
    const ccFiles = readdirSync(inputDir).filter((f) => f.endsWith(".CC"));

    if (ccFiles.length === 0) {
        console.log("  没有找到 .CC 文件");
        return;
    }

    console.log(`  找到 ${ccFiles.length} 个文件`);

    let successCount = 0;
    let failCount = 0;
    let totalReplaced = 0;
    let totalSkipped = 0;

    for (const fileName of ccFiles) {
        const ccPath = join(inputDir, fileName);
        const txtPath = join(txtDir, fileName.replace(".CC", ".txt"));
        const outputPath = join(outputDir, fileName);

        // 检查对应的文本文件是否存在
        if (!existsSync(txtPath)) {
            console.log(`  ⊙ ${fileName}: 没有对应的文本文件，跳过`);
            continue;
        }

        console.log(`注入: ${fileName}`);

        const result = injectFile(ccPath, txtPath, outputPath);

        if (result.success) {
            if (result.warnings.length > 0) {
                for (const warning of result.warnings) {
                    console.log(`    ⚠️  ${warning}`);
                }
            }

            if (result.totalDiff > 0) {
                console.log(`    ❗  ${txtPath} 共超出 ${result.totalDiff} 个字节，有 ${result.warnings.length} 行英语未注入`);
            }

            successCount++;
            totalReplaced += result.replaced;
            totalSkipped += result.skipped;
        } else {
            console.error(`  ✗ ${fileName}: 注入失败`);
            failCount++;
        }
    }

    console.log(`\n完成: ${successCount} 成功, ${failCount} 失败`);
}
