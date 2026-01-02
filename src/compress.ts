/**
 * 压缩 CC 文件
 * CC 文件格式：前0x14字节是头部，剩余部分需要用 LZSS 压缩
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const LZSS_TOOL = "./src/utils/lzss-tool.exe";
const HEADER_SIZE = 0x18;

/**
 * 压缩单个CC文件
 * @param inputPath 输入文件路径（解压后的文件）
 * @param outputPath 输出文件路径（压缩后的文件）
 */
export function compressCC(inputPath: string, outputPath: string): void {
  console.log(`Compressing: ${inputPath} -> ${outputPath}`);

  // 读取输入文件
  const inputBuffer = readFileSync(inputPath);

  if (inputBuffer.length < HEADER_SIZE) {
    throw new Error(`文件太小 (${inputBuffer.length} 字节)，无法压缩`);
  }

  // 提取前0x18字节头部
  const header = inputBuffer.subarray(0, HEADER_SIZE);

  // 提取需要压缩的数据部分（跳过前0x18字节）
  const uncompressedData = inputBuffer.subarray(HEADER_SIZE);

  // 创建临时文件
  const tempUncompressed = `${outputPath}.temp.uncompressed`;
  const tempCompressed = `${outputPath}.temp.compressed`;

  try {
    // 写入临时未压缩文件
    writeFileSync(tempUncompressed, uncompressedData);

    // 调用 lzss-tool 压缩
    try {
      execSync(`"${LZSS_TOOL}" -e -n 0x00 -R 0x01 "${tempUncompressed}" "${tempCompressed}"`, {
        stdio: "inherit",
      });
    } catch (error: any) {
      throw new Error(`lzss-tool 压缩失败: ${error.message}`);
    }

    // 读取压缩后的数据
    const compressedBuffer = readFileSync(tempCompressed);

    // 合并头部和压缩后的数据
    const resultBuffer = Buffer.concat([header, compressedBuffer]);

    // 写入最终输出文件
    writeFileSync(outputPath, resultBuffer);
  } finally {
    // 清理临时文件
    const tempFiles = [tempUncompressed, tempCompressed];
    for (const file of tempFiles) {
      try {
        if (process.platform === "win32") {
          execSync(`del /F /Q "${file}"`, { stdio: "ignore" });
        } else {
          execSync(`rm -f "${file}"`, { stdio: "ignore" });
        }
      } catch {
        // 忽略删除失败
      }
    }
  }
}

/**
 * 批量压缩目录中的所有 CC 文件
 * @param inputDir 输入目录（解压后的文件）
 * @param outputDir 输出目录（压缩后的文件）
 */
export function compressDirectory(inputDir: string, outputDir: string): void {
  console.log(`\n批量压缩目录: ${inputDir} -> ${outputDir}`);

  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 读取输入目录中的所有 .CC 文件
  const allFiles = readdirSync(inputDir);
  const files = allFiles.filter(f => f.endsWith('.CC'));

  if (files.length === 0) {
    console.log("  没有找到 .CC 文件");
    return;
  }

  console.log(`  找到 ${files.length} 个文件`);

  let successCount = 0;
  let failCount = 0;

  for (const fileName of files) {
    const inputPath = join(inputDir, fileName);
    const outputPath = join(outputDir, fileName);

    try {
      compressCC(inputPath, outputPath);
      successCount++;
    } catch (error: any) {
      console.error(`  ✗ ${fileName}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n完成: ${successCount} 成功, ${failCount} 失败`);
}
