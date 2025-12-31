/**
 * 从解压的 CC 文件中提取文本
 * 参考 retract_s.cpp 的实现
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";
import { getDirectories } from "./config.ts";

const HEADER_SIZE = 0x14;
const TEXT_MARKER = 0xFD;
const ENCODING = "Shift_JIS";
const NEWLINE_ESCAPE = "\\";

/**
 * 验证 0xFD 块是否是有效的文本结构
 * @param buffer 文件缓冲区
 * @param startPos 0xFD 字节的位置
 * @returns 是否是有效文本
 */
function validateTextStructure(buffer: Buffer, startPos: number): boolean {
  // 读取长度字节（0xFD 后的第一个字节）
  const lineLen = buffer[startPos + 1] || 0;

  // 检查 1: 长度字节不为 0
  if (lineLen === 0) {
    return false;
  }

  // 检查 2: 验证 lineLen 字节后是 0x00
  const terminatorPos = startPos + 2 + lineLen;
  if (terminatorPos >= buffer.length) {
    return false;
  }
  if (buffer[terminatorPos] !== 0x00) {
    return false;
  }

  // 检查 3: 验证 lineLen 字节中不包含 0x00
  const textStart = startPos + 2;
  const textEnd = textStart + lineLen;
  for (let i = textStart; i < textEnd; i++) {
    if (buffer[i] === 0x00) {
      return false;
    }
  }

  // 检查 4: 验证添加 0x0A 不会被解释为双字节字符的一部分
  // 根据 CP932，0x81-0x9F 和 0xE0-0xFC 是前导字节
  let i = 0;
  while (i < lineLen) {
    const byte = buffer[textStart + i] as any;
    const unsignedByte = byte & 0xFF;

    if ((unsignedByte >= 0x81 && unsignedByte <= 0x9F) ||
        (unsignedByte >= 0xE0 && unsignedByte <= 0xFC)) {
      // 双字节字符，跳过两个字节
      i += 2;
    } else {
      // 单字节字符
      i += 1;
    }
  }

  // 如果 i == lineLen，说明完全消耗了所有字节
  // 如果 i == lineLen + 1，说明最后一个字节是前导字节，会吸收 0x0A
  const is0AAbsorbed = i === lineLen + 1;
  if (is0AAbsorbed) {
    return false;
  }

  return true;
}

/**
 * 批量提取目录中的所有 CC 文件
 */
export function extractDirectory(): void {
  const directories = getDirectories();
  const INPUT_DIR = directories.decompressJPCC;
  const OUTPUT_DIR = directories.jpTXT;

  console.log(`\n批量提取目录: ${INPUT_DIR} -> ${OUTPUT_DIR}`);

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 读取输入目录中的所有 .CC 文件
  const files = readdirSync(INPUT_DIR).filter((f) => f.endsWith(".CC"));

  if (files.length === 0) {
    console.log("  没有找到 .CC 文件");
    return;
  }

  console.log(`  找到 ${files.length} 个文件`);

  let successCount = 0;
  let failCount = 0;

  for (const fileName of files) {
    const inputPath = join(INPUT_DIR, fileName);
    const outputPath = join(OUTPUT_DIR, fileName.replace(".CC", ".txt"));

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

// 如果直接运行此文件
if (import.meta.main) {
  extractDirectory();
}
