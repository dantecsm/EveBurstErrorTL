/**
 * 解压 CC 文件
 * CC 文件格式：前0x14字节是头部，剩余部分是 LZSS 压缩数据
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const LZSS_TOOL = "./src/utils/lzss-tool.exe";

const inputDir = process.argv[2];
const outputDir = process.argv[3];
if (inputDir && outputDir) {
    decompressDirectory(inputDir, outputDir);
} else {
    console.log("请输入输入目录和输出目录");
}

/**
 * 解压单个CC文件
 * @param inputPath 输入文件路径
 * @param outputPath 输出文件路径
 */
export async function decompressCC(inputPath: string, outputPath: string): Promise<void> {
  console.log(`解压: ${inputPath} -> ${outputPath}`);

  // 读取输入文件
  const inputBuffer = readFileSync(inputPath);

  if (inputBuffer.length < 0x14) {
    throw new Error(`文件太小 (${inputBuffer.length} 字节)，无法解压`);
  }

  // 提取前0x18字节头部(包含4字节解压大小)
  const header = inputBuffer.subarray(0, 0x18);
  
  // 提取压缩数据部分（跳过前0x14字节）
  const compressedData = inputBuffer.subarray(0x14);

  // 创建临时文件存储压缩数据
  const tempCompressed = `${outputPath}.temp.compressed`;
  const tempDecompressed = `${outputPath}.temp.decompressed`;

  try {
    // 写入临时压缩文件
    writeFileSync(tempCompressed, compressedData);

    // 调用 lzss-tool 解压
    const decompressProcess = Bun.spawn({
      cmd: [LZSS_TOOL, "-d", "-a", "o4", tempCompressed, tempDecompressed],
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await decompressProcess.exited;
    if (exitCode !== 0) {
      throw new Error(`lzss-tool 解压失败，退出码: ${exitCode}`);
    }

    // 读取解压后的数据
    const decompressedBuffer = readFileSync(tempDecompressed);

    // 合并头部和解压后的数据
    const resultBuffer = Buffer.concat([header, decompressedBuffer]);

    // 写入最终输出文件
    writeFileSync(outputPath, resultBuffer);

    console.log(`  原始大小: ${inputBuffer.length} 字节`);
    console.log(`  解压后大小: ${resultBuffer.length} 字节`);
    console.log(`  压缩率: ${((1 - compressedData.length / decompressedBuffer.length) * 100).toFixed(2)}%`);
  } finally {
    // 清理临时文件
    const tempFiles = [tempCompressed, tempDecompressed];
    for (const file of tempFiles) {
      try {
        const rmProcess = Bun.spawn({
          cmd: ["rm", "-f", file],
          stdout: "inherit",
          stderr: "inherit",
        });
        await rmProcess.exited;
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
export async function decompressDirectory(inputDir: string, outputDir: string): Promise<void> {
  console.log(`\n批量解压目录: ${inputDir} -> ${outputDir}`);

  // 确保输出目录存在
  await Bun.$`mkdir -p ${outputDir}`.quiet();
const mkdirProcess = Bun.spawn({
    cmd: ["mkdir", "-p", outputDir],
    stdout: "inherit",
    stderr: "inherit",
  });
  await mkdirProcess.exited
  // 读取输入目录中的所有 .CC 文件
  const encoder = new TextEncoder();
  const lsProcess = Bun.spawn({
    cmd: ["ls", "-1", inputDir],
    stdout: "pipe",
  });
  
  const lsOutput = await new Response(lsProcess.stdout).text();
  const allFiles = lsOutput.split('\n').filter(f => f.trim().length > 0);
  const files = allFiles.filter(f => f.endsWith('.CC'));
  
  if (files.length === 0) {
    console.log("  没有找到 .CC 文件");
    return;
  }

  console.log(`  找到 ${files.length} 个文件`);

  let successCount = 0;
  let failCount = 0;

  for (const fileName of files) {
    const inputPath = `${inputDir}/${fileName}`;
    const outputPath = `${outputDir}/${fileName}`;

    try {
      await decompressCC(inputPath, outputPath);
      successCount++;
    } catch (error: any) {
      console.error(`  ✗ ${fileName}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n完成: ${successCount} 成功, ${failCount} 失败`);
}
