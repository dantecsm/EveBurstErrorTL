/**
 * 将翻译文本注入到解压的 CC 文件中
 * 参考 retract_s.cpp 的实现
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
 * 注入单个文件
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
        const error = `${txtPath} 行数与 ${ccPath} 抽离的文本数不匹配, ${enLines.length} !== ${textBlocks.length}`;
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
            result.warnings.push(`    ❗ ${txtPath} 第 ${i + 1} 行英语超出 255 字节（长度: ${enLen}），无法插入`);
            result.halfSuccess = true;
            lostLines++;
            return;
        }
        // 生成 enBuffer 为 0xFD enLen enBytes 00 的字节流
        const enBuffer = Buffer.from([0xFD, enLen, ...enBytes, 0x00]);
        block.enBuffer = enBuffer;
    });

    // 修改 buffer 文件头长度
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
            // if (!result.warnings) result.warnings = [];
            // result.warnings.push(`  warning: 第 ${i} 行英语未注入，保留日语`);
            const overLen = newLen + diffLen - 0xFFFF;
            totalOverLen += overLen;
            lostLines++;
        }
    });
    if (lostLines > 0) {
        result.halfSuccess = true;
        if (!result.warnings) result.warnings = [];
        result.warnings?.push(`    ❗ ${txtPath} 共超出 ${totalOverLen} 个字节，有 ${lostLines} 行英语未注入`);
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
        } catch(e) {
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
    // while (ccFiles.length > 1) ccFiles.pop();

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
        const txtFileName = fileName.replace(".CC", ".txt");
        const txtPath = path.join(txtDir, txtFileName);
        const outputPath = path.join(outputDir, fileName);

        // 检查对应的文本文件是否存在
        if (!existsSync(txtPath)) {
            console.log(`    ❗  ${fileName}: 没有对应的文本文件，跳过`);
            continue;
        }

        console.log(`Injecting: ${txtFileName} -> ${fileName}`);

        const result = injectFile(ccPath, txtPath, outputPath);

        if (result.success) {
            successCount++;
        } else if (result.halfSuccess) {
            for (const warning of (result.warnings || [])) {
                console.log(warning);
                // console.log(`    ❗  ${txtPath} 共超出 ${result.totalDiff} 个字节，有 ${result.warnings.length} 行英语未注入`);
            }
            halfSuccessCount++;
        } else if (result.fail) {
            for (const errors of result.errors || []) {
                console.error(errors);
            }
            console.error(`  ✗ ${fileName}: 注入失败`);
            failCount++;
        } else {
            throw new Error("未知的注入结果");
        }
    }

    console.log(`\n完成: ${successCount} 成功, ${halfSuccessCount} 部分成功， ${failCount} 失败`);
}

function processEnText(enText: string): string {
    // 每 53 个字符，若未有 \n 符，则在这 53 个字符里最后一次出现空格的位置后面加一个 \n 符
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
                // 重置宽度为当前行自换行点起已有的字符数
                width = i - lastSpacePos;
                lastSpacePos = -1;
            }
        }
    }

    return chars.join('');
}

function replaceBuffer(buffer: Buffer, subArrayToReplace: Buffer, replacementSubArray: Buffer, basePos: number = 0): { buffer: Buffer, pos: number} {
    const startPos = buffer.indexOf(subArrayToReplace, basePos);
    if (startPos === -1) {
        throw `原文件找不到待替换区: ${Array.from(subArrayToReplace).map(n => n.toString(16).padStart(2, '0').toUpperCase())}`;
    }

    const endPos = startPos + subArrayToReplace.length;
    const replacedBuffer = Buffer.concat([buffer.subarray(0, startPos), replacementSubArray, buffer.subarray(endPos)]);
    const result = {
        buffer: replacedBuffer,
        pos: startPos
    };
    return result;
}