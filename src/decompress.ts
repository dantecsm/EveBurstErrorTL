/**
 * 解压 CC 文件
 * CC 文件格式：前0x14字节是头部，剩余部分是 LZSS 压缩数据
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";

const LZSS_TOOL = "./src/utils/lzss-tool.exe";
const HEADER_SIZE = 0x18;

/**
 * 解压单个CC文件
 * @param inputPath 输入文件路径
 * @param outputPath 输出文件路径
 */
export function decompressCC(inputPath: string, outputPath: string): void {
  console.log(`Decompressing: ${inputPath} -> ${outputPath}`);

  // 读取输入文件
  const inputBuffer = readFileSync(inputPath);

  if (inputBuffer.length < HEADER_SIZE) {
    throw new Error(`文件太小 (${inputBuffer.length} 字节)，无法解压`);
  }

  // 提取前0x18字节头部(包含4字节解压大小)
  const header = inputBuffer.subarray(0, HEADER_SIZE);

  // 提取压缩数据部分（跳过前0x14字节）
  const compressedData = inputBuffer.subarray(HEADER_SIZE - 4);

  // 创建临时文件存储压缩数据
  const tempCompressed = `${outputPath}.temp.compressed`;
  const tempDecompressed = `${outputPath}.temp.decompressed`;

  try {
    // 写入临时压缩文件
    writeFileSync(tempCompressed, compressedData);

    // 调用 lzss-tool 解压
    try {
      execSync(`"${LZSS_TOOL}" -d -a o4 -n 0x00 -R 0x01 "${tempCompressed}" "${tempDecompressed}"`, {
        stdio: "inherit",
      });
    } catch (error: any) {
      throw new Error(`lzss-tool 解压失败: ${error.message}`);
    }

    // 读取解压后的数据
    const decompressedBuffer = readFileSync(tempDecompressed);

    // 合并头部和解压后的数据
    const resultBuffer = Buffer.concat([header, decompressedBuffer]);

    // 写入最终输出文件
    writeFileSync(outputPath, resultBuffer);
  } finally {
    // 清理临时文件
    const tempFiles = [tempCompressed, tempDecompressed];
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
 * 批量解压目录中的所有 CC 文件
 * @param inputDir 输入目录
 * @param outputDir 输出目录
 */
export function decompressDirectory(inputDir: string, outputDir: string): void {
  console.log(`\n批量解压目录: ${inputDir} -> ${outputDir}`);

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
      decompressCC(inputPath, outputPath);
      successCount++;
    } catch (error: any) {
      console.error(`  ✗ ${fileName}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n完成: ${successCount} 成功, ${failCount} 失败`);
}
