import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface CompareResult {
  file: string;
  identical: boolean;
  sizeDiff?: number;
}

interface CompareStats {
  total: number;
  identical: number;
  different: number;
  missingInDecompENCC: string[];
  missingInOldENDecomp: string[];
}

/**
 * 比较两个文件是否相同
 */
function compareFiles(file1: string, file2: string): CompareResult {
  const buffer1 = readFileSync(file1);
  const buffer2 = readFileSync(file2);

  const size1 = buffer1.length;
  const size2 = buffer2.length;

  if (size1 !== size2) {
    return {
      file: file1,
      identical: false,
      sizeDiff: size2 - size1,
    };
  }

  // 比较内容
  const identical = buffer1.equals(buffer2);

  return {
    file: file1,
    identical,
  };
}

/**
 * 比较两个目录下的文件
 */
function compareDirectories(dir1: string, dir2: string): {
  stats: CompareStats;
  details: CompareResult[];
} {
  const results: CompareResult[] = [];
  const stats: CompareStats = {
    total: 0,
    identical: 0,
    different: 0,
    missingInDecompENCC: [],
    missingInOldENDecomp: [],
  };

  // 读取两个目录的文件列表
  const files1 = existsSync(dir1) ? readdirSync(dir1).filter(f => f.endsWith(".CC")) : [];
  const files2 = existsSync(dir2) ? readdirSync(dir2).filter(f => f.endsWith(".CC")) : [];

  const allFiles = new Set([...files1, ...files2]);

  for (const file of allFiles) {
    const path1 = join(dir1, file);
    const path2 = join(dir2, file);

    const exists1 = files1.includes(file);
    const exists2 = files2.includes(file);

    if (!exists1) {
      stats.missingInDecompENCC.push(file);
      continue;
    }

    if (!exists2) {
      stats.missingInOldENDecomp.push(file);
      continue;
    }

    const result = compareFiles(path1, path2);
    results.push(result);

    stats.total++;
    if (result.identical) {
      stats.identical++;
    } else {
      stats.different++;
    }
  }

  return { stats, details: results };
}

/**
 * 主函数
 */
function main() {
  const oldENDecompDir = "ref/OLD_EN_DECOMP";
  const decompENCCDir = "data/decompress EN CC";

  console.log("比较 OLD_EN_DECOMP 和 decompress EN CC 文件...\n");

  const { stats, details } = compareDirectories(oldENDecompDir, decompENCCDir);

  // 显示详细结果
  console.log("详细比较结果:");
  console.log("=".repeat(80));
  console.log(
    `${"文件名".padEnd(30)} ${"状态".padStart(15)} ${"大小差异".padStart(15)}`
  );
  console.log("=".repeat(80));

  for (const detail of details) {
    const status = detail.identical ? "✓ 相同" : "✗ 不同";
    const sizeDiff = detail.sizeDiff !== undefined ? `${detail.sizeDiff > 0 ? "+" : ""}${detail.sizeDiff} 字节` : "-";
    console.log(
      `${detail.file.padEnd(30)} ${status.padStart(15)} ${sizeDiff.padStart(15)}`
    );
  }

  // 显示缺失文件
  if (stats.missingInDecompENCC.length > 0) {
    console.log("\n仅在 OLD_EN_DECOMP 中存在的文件:");
    for (const file of stats.missingInDecompENCC) {
      console.log(`  - ${file}`);
    }
  }

  if (stats.missingInOldENDecomp.length > 0) {
    console.log("\n仅在 decompress EN CC 中存在的文件:");
    for (const file of stats.missingInOldENDecomp) {
      console.log(`  - ${file}`);
    }
  }

  // 显示统计信息
  console.log("\n" + "=".repeat(80));
  console.log("统计信息:");
  console.log(`  比较文件总数: ${stats.total}`);
  console.log(`  ✓ 相同: ${stats.identical}`);
  console.log(`  ✗ 不同: ${stats.different}`);
  if (stats.missingInDecompENCC.length > 0) {
    console.log(`  ⚠ 仅在 OLD_EN_DECOMP 中: ${stats.missingInDecompENCC.length}`);
  }
  if (stats.missingInOldENDecomp.length > 0) {
    console.log(`  ⚠ 仅在 decompress EN CC 中: ${stats.missingInOldENDecomp.length}`);
  }

  // 如果有差异，显示详细信息
  if (stats.different > 0) {
    console.log("\n不同的文件详情:");
    console.log("-".repeat(80));
    for (const detail of details.filter(d => !d.identical)) {
      const sizeDiff = detail.sizeDiff !== undefined ? `${detail.sizeDiff > 0 ? "+" : ""}${detail.sizeDiff} 字节` : "大小相同但内容不同";
      console.log(`  ${detail.file}: ${sizeDiff}`);
    }
  }

  console.log("=".repeat(80));

  // 返回退出码
  if (stats.different > 0 || stats.missingInDecompENCC.length > 0 || stats.missingInOldENDecomp.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
