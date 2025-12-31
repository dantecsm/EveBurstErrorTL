#!/usr/bin/env bun
/**
 * 比较两个目录中的文本文件内容是否一致
 * ref/OLD_JP_TXT (SJIS 编码) vs data/JP TXT (UTF-8 编码)
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as iconv from "iconv-lite";

interface CompareResult {
  match: boolean;
  reason?: string;
}

/**
 * 比较两个文本文件的内容
 * @param file1Path 第一个文件路径（SJIS 编码）
 * @param file2Path 第二个文件路径（UTF-8 编码）
 * @returns 比较结果
 */
function compareTextFiles(file1Path: string, file2Path: string): CompareResult {
  try {
    // 读取 SJIS 编码的文件
    const sjisBuffer = readFileSync(file1Path);
    const sjisText = iconv.decode(sjisBuffer, "Shift_JIS");

    // 读取 UTF-8 编码的文件
    const utf8Text = readFileSync(file2Path, "utf-8");

    // 比较内容
    if (sjisText === utf8Text) {
      return { match: true };
    }

    // 如果内容不同，找出第一个差异的位置
    const minLength = Math.min(sjisText.length, utf8Text.length);
    let diffPos = -1;

    for (let i = 0; i < minLength; i++) {
      if (sjisText[i] !== utf8Text[i]) {
        diffPos = i;
        break;
      }
    }

    if (diffPos === -1) {
      // 长度不同但前面都相同
      diffPos = minLength;
    }

    // 获取差异位置的上下文
    const contextStart = Math.max(0, diffPos - 20);
    const contextEnd = Math.min(minLength, diffPos + 20);

    return {
      match: false,
      reason: `内容不同，首个差异位置: ${diffPos}\n` +
              `SJIS: "${sjisText.slice(contextStart, contextEnd)}"\n` +
              `UTF8: "${utf8Text.slice(contextStart, contextEnd)}"`,
    };
  } catch (error: any) {
    return {
      match: false,
      reason: `读取失败: ${error.message}`,
    };
  }
}

async function main() {
  const dir1 = "ref/OLD_JP_TXT";
  const dir2 = "data/JP TXT";

  console.log(`比较文本文件目录:`);
  console.log(`  目录1 (SJIS): ${dir1}`);
  console.log(`  目录2 (UTF-8): ${dir2}`);
  console.log("");

  // 检查目录是否存在
  if (!existsSync(dir1)) {
    console.error(`错误: 目录不存在: ${dir1}`);
    console.log(`提示: 请确保 ref/OLD_JP_TXT 目录存在`);
    process.exit(1);
  }

  if (!existsSync(dir2)) {
    console.error(`错误: 目录不存在: ${dir2}`);
    console.log(`提示: 请先运行 "bun index e" 提取文本`);
    process.exit(1);
  }

  try {
    const files1 = readdirSync(dir1).filter((f) => f.endsWith(".txt"));
    const files2 = readdirSync(dir2).filter((f) => f.endsWith(".txt"));

    console.log(`目录1 中找到 ${files1.length} 个 .txt 文件`);
    console.log(`目录2 中找到 ${files2.length} 个 .txt 文件`);
    console.log("");

    // 找出只在某个目录中存在的文件
    const onlyInDir1 = files1.filter((f) => !files2.includes(f));
    const onlyInDir2 = files2.filter((f) => !files1.includes(f));

    if (onlyInDir1.length > 0) {
      console.log(`⚠️  只在目录1中存在的文件 (${onlyInDir1.length} 个):`);
      onlyInDir1.forEach((f) => console.log(`   - ${f}`));
      console.log("");
    }

    if (onlyInDir2.length > 0) {
      console.log(`⚠️  只在目录2中存在的文件 (${onlyInDir2.length} 个):`);
      onlyInDir2.forEach((f) => console.log(`   - ${f}`));
      console.log("");
    }

    // 比较共同存在的文件
    const commonFiles = files1.filter((f) => files2.includes(f));
    console.log(`比较 ${commonFiles.length} 个共同文件...`);
    console.log("");

    let matchCount = 0;
    let mismatchCount = 0;
    const mismatches: Array<{ file: string; reason: string }> = [];

    for (const fileName of commonFiles) {
      const file1Path = join(dir1, fileName);
      const file2Path = join(dir2, fileName);

      const result = compareTextFiles(file1Path, file2Path);

      if (result.match) {
        matchCount++;
        process.stdout.write("✓");
      } else {
        mismatchCount++;
        mismatches.push({ file: fileName, reason: result.reason! });
        process.stdout.write("✗");
      }

      // 每50个文件换行
      if ((matchCount + mismatchCount) % 50 === 0) {
        console.log("");
      }
    }

    console.log("\n");
    console.log("=".repeat(60));
    console.log(`比较完成:`);
    console.log(`  ✓ 相同: ${matchCount} 个文件`);
    console.log(`  ✗ 不同: ${mismatchCount} 个文件`);

    if (mismatches.length > 0) {
      console.log("");
      console.log("不同的文件详情:");
      mismatches.forEach(({ file, reason }) => {
        console.log(`  ✗ ${file}`);
        console.log(`     原因: ${reason}`);
      });
    }

    if (onlyInDir1.length > 0 || onlyInDir2.length > 0) {
      console.log("");
      console.log("⚠️  注意: 有些文件只在其中一个目录中存在");
    }

    // 返回退出码
    if (mismatchCount > 0 || onlyInDir1.length > 0 || onlyInDir2.length > 0) {
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }
}

main();
