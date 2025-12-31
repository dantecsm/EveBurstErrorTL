import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";

/**
 * 将单个文件从 SJIS 转换为 UTF-8
 */
function convertFile(filePath: string): void {
  try {
    // 读取 SJIS 编码的文件
    const sjisBuffer = readFileSync(filePath);
    
    // 检测是否已经是 UTF-8（通过 BOM 或内容特征）
    const isUtf8 = detectUtf8(sjisBuffer);
    
    if (isUtf8) {
      console.log(`  ✓ ${filePath} 已经是 UTF-8 编码，跳过`);
      return;
    }
    
    // 尝试从 SJIS 解码
    let utf8Text: string;
    try {
      utf8Text = iconv.decode(sjisBuffer, "Shift_JIS");
    } catch (error) {
      console.error(`  ✗ ${filePath} SJIS 解码失败: ${error}`);
      return;
    }
    
    // 写回 UTF-8 编码
    writeFileSync(filePath, utf8Text, "utf-8");
    console.log(`  ✓ ${filePath} 转换成功`);
  } catch (error) {
    console.error(`  ✗ ${filePath} 处理失败: ${error}`);
  }
}

/**
 * 检测缓冲区是否已经是 UTF-8 编码
 */
function detectUtf8(buffer: Buffer): boolean {
  // 检查 UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return true;
  }
  
  // 简单的 UTF-8 有效性检查
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];
    
    if (byte < 0x80) {
      // ASCII (1 byte)
      i++;
    } else if (byte >= 0xC2 && byte <= 0xDF) {
      // 2-byte sequence
      if (i + 1 >= buffer.length) return false;
      i += 2;
    } else if (byte >= 0xE0 && byte <= 0xEF) {
      // 3-byte sequence
      if (i + 2 >= buffer.length) return false;
      i += 3;
    } else if (byte >= 0xF0 && byte <= 0xF4) {
      // 4-byte sequence
      if (i + 3 >= buffer.length) return false;
      i += 4;
    } else {
      // 无效的 UTF-8 起始字节
      return false;
    }
  }
  
  return true;
}

/**
 * 转换目录下所有 txt 文件
 */
function convertDirectory(dir: string): void {
  if (!readdirSync(dir)) {
    console.error(`目录不存在: ${dir}`);
    process.exit(1);
  }
  
  const files = readdirSync(dir).filter(f => f.endsWith(".txt"));
  
  if (files.length === 0) {
    console.log(`目录中没有 txt 文件: ${dir}`);
    return;
  }
  
  console.log(`开始转换 ${files.length} 个文件...\n`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const file of files) {
    const filePath = join(dir, file);
    
    // 读取文件内容检测编码
    const buffer = readFileSync(filePath);
    const isUtf8 = detectUtf8(buffer);
    
    if (isUtf8) {
      console.log(`  ⊙ ${file} 已经是 UTF-8 编码，跳过`);
      skipped++;
    } else {
      try {
        const utf8Text = iconv.decode(buffer, "Shift_JIS");
        writeFileSync(filePath, utf8Text, "utf-8");
        console.log(`  ✓ ${file} 转换成功`);
        success++;
      } catch (error) {
        console.error(`  ✗ ${file} 转换失败: ${error}`);
        failed++;
      }
    }
  }
  
  console.log(`\n转换完成:`);
  console.log(`  ✓ 成功: ${success} 个文件`);
  console.log(`  ⊙ 跳过: ${skipped} 个文件`);
  console.log(`  ✗ 失败: ${failed} 个文件`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * 主函数
 */
function main() {
  const enTxtDir = "data/EN TXT";
  
  console.log("EN TXT 目录 SJIS → UTF-8 编码转换工具");
  console.log("=".repeat(60));
  console.log(`目标目录: ${enTxtDir}`);
  console.log("=".repeat(60) + "\n");
  
  convertDirectory(enTxtDir);
  
  console.log("\n" + "=".repeat(60));
  console.log("所有文件处理完成！");
}

main();
