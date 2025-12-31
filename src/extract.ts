/**
 * 从解压的 CC 文件中提取文本
 * 参考 retract_s.cpp 的实现
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";
import { validateTextStructure } from "./utils/validateTextStructure.js";

const HEADER_SIZE = 0x14;
const TEXT_MARKER = 0xFD;
const ENCODING = "Shift_JIS";
const NEWLINE_ESCAPE = "\\";

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
        const inputPath = join(inputDir, fileName);
        const outputPath = join(outputDir, fileName.replace(".CC", ".txt"));

        try {
            console.log(`提取: ${inputPath} -> ${outputPath}`);

            // 读取输入文件
            const buffer = readFileSync(inputPath);
            const ccLen = buffer.length;
            let ccPos = HEADER_SIZE;

            const extractedTexts: string[] = [];

            // 扫描文件
            while (ccPos < ccLen) {
                const cmd = buffer[ccPos];
                const curCmdPos = ccPos;
                ccPos++;

                if (cmd === TEXT_MARKER) {
                    // 读取长度
                    if (ccPos >= ccLen) break;

                    // 验证文本结构
                    const isValid = validateTextStructure(buffer, curCmdPos);

                    if (!isValid) {
                        // 检验失败，跳过当前 0xFD 字节
                        ccPos = curCmdPos + 1;
                        continue;
                    }

                    // 检验成功，进入文本提取逻辑
                    const lineLen = buffer[ccPos] as any;
                    ccPos++;
                    const textStart = ccPos;
                    const textEnd = textStart + lineLen;

                    if (textEnd > buffer.length) {
                        ccPos = curCmdPos + 1;
                        continue;
                    }

                    // 提取文本字节
                    const textBytes = buffer.subarray(textStart, textEnd);

                    let decodedText: string;
                    try {
                        decodedText = iconv.decode(textBytes, ENCODING);
                    } catch (error) {
                        console.error(`  警告: 解码失败于位置 0x${curCmdPos.toString(16)}`);
                        ccPos = curCmdPos + 1;
                        continue;
                    }

                    // 将换行符转换为反斜杠
                    const escapedText = decodedText.replace(/\n/g, NEWLINE_ESCAPE);

                    extractedTexts.push(escapedText);

                    // 跳过文本和终止符
                    ccPos = textEnd + 1;
                }
            }

            // 写入输出文件
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
