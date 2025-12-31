#!/usr/bin/env bun
/**
 * 比较两个目录中的同名文件内容是否一致
 * 用于验证 JP CC 和 EN CC 目录中的文件差异
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface CompareResult {
  match: boolean;
  reason?: string;
}

function compareFiles(file1: string, file2: string): CompareResult {
  try {
    const buffer1 = readFileSync(file1);
    const buffer2 = readFileSync(file2);

    if (buffer1.length !== buffer2.length) {
      return {
        match: false,
        reason: `大小不同: ${buffer1.length} vs ${buffer2.length} 字节`,
      };
    }

    if (!buffer1.equals(buffer2)) {
      // 找到第一个不同的字节位置
      let diffPos = -1;
      for (let i = 0; i < buffer1.length; i++) {
        if (buffer1[i] !== buffer2[i]) {
          diffPos = i;
          break;
        }
      }

      return {
        match: false,
        reason: `内容不同，首个差异位置: ${diffPos} (0x${diffPos.toString(16)})`,
      };
    }

    return { match: true };
  } catch (error: any) {
    return {
      match: false,
      reason: `读取失败: ${error.message}`,
    };
  }
}

async function main() {
  const dir1 = "data/JP CC";
  const dir2 = "data/EN CC";

  console.log(`比较目录:`);
  console.log(`  目录1: ${dir1}`);
  console.log(`  目录2: ${dir2}`);
  console.log("");

  try {
    const files1 = readdirSync(dir1).filter((f) => f.endsWith(".CC"));
    const files2 = readdirSync(dir2).filter((f) => f.endsWith(".CC"));

    console.log(`目录1 中找到 ${files1.length} 个 .CC 文件`);
    console.log(`目录2 中找到 ${files2.length} 个 .CC 文件`);
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

    for (const file of commonFiles) {
      const file1Path = join(dir1, file);
      const file2Path = join(dir2, file);

      const result = compareFiles(file1Path, file2Path);

      if (result.match) {
        matchCount++;
        process.stdout.write("✓");
      } else {
        mismatchCount++;
        mismatches.push({ file, reason: result.reason! });
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
