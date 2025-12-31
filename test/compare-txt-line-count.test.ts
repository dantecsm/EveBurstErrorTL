import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface LineCountResult {
  file: string;
  jpLines: number;
  enLines: number;
  match: boolean;
}

interface CompareStats {
  total: number;
  same: number;
  different: number;
  missingInJP: string[];
  missingInEN: string[];
}

/**
 * 统计文本文件的行数
 */
function countLines(filePath: string): number {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  // 过滤掉空行
  return lines.filter(line => line.trim() !== "").length;
}

/**
 * 比较两个目录下同名文件的行数
 */
function compareLineCounts(dir1: string, dir2: string): {
  stats: CompareStats;
  details: LineCountResult[];
} {
  const results: LineCountResult[] = [];
  const stats: CompareStats = {
    total: 0,
    same: 0,
    different: 0,
    missingInJP: [],
    missingInEN: [],
  };

  // 读取两个目录的文件列表
  const files1 = existsSync(dir1) ? readdirSync(dir1).filter(f => f.endsWith(".txt")) : [];
  const files2 = existsSync(dir2) ? readdirSync(dir2).filter(f => f.endsWith(".txt")) : [];

  const allFiles = new Set([...files1, ...files2]);

  for (const file of allFiles) {
    const path1 = join(dir1, file);
    const path2 = join(dir2, file);

    const exists1 = files1.includes(file);
    const exists2 = files2.includes(file);

    if (!exists1) {
      stats.missingInJP.push(file);
      continue;
    }

    if (!exists2) {
      stats.missingInEN.push(file);
      continue;
    }

    const jpLines = countLines(path1);
    const enLines = countLines(path2);
    const match = jpLines === enLines;

    results.push({
      file,
      jpLines,
      enLines,
      match,
    });

    stats.total++;
    if (match) {
      stats.same++;
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
  const jpDir = "data/JP TXT";
  const enDir = "data/EN TXT";

  console.log("比较 JP TXT 和 EN TXT 文件行数...\n");

  const { stats, details } = compareLineCounts(jpDir, enDir);

  // 显示详细结果
  console.log("详细比较结果:");
  console.log("=".repeat(80));
  console.log(
    `${"文件名".padEnd(30)} ${"JP 行数".padStart(10)} ${"EN 行数".padStart(10)} ${"状态".padStart(10)}`
  );
  console.log("=".repeat(80));

  for (const detail of details) {
    const status = detail.match ? "✓ 相同" : `✗ 差异: ${Math.abs(detail.jpLines - detail.enLines)} 行`;
    console.log(
      `${detail.file.padEnd(30)} ${String(detail.jpLines).padStart(10)} ${String(detail.enLines).padStart(10)} ${status.padStart(10)}`
    );
  }

  // 显示缺失文件
  if (stats.missingInJP.length > 0) {
    console.log("\n仅在 EN TXT 中存在的文件:");
    for (const file of stats.missingInJP) {
      console.log(`  - ${file}`);
    }
  }

  if (stats.missingInEN.length > 0) {
    console.log("\n仅在 JP TXT 中存在的文件:");
    for (const file of stats.missingInEN) {
      console.log(`  - ${file}`);
    }
  }

  // 显示统计信息
  console.log("\n" + "=".repeat(80));
  console.log("统计信息:");
  console.log(`  比较文件总数: ${stats.total}`);
  console.log(`  ✓ 行数相同: ${stats.same}`);
  console.log(`  ✗ 行数不同: ${stats.different}`);
  if (stats.missingInJP.length > 0) {
    console.log(`  ⚠ 仅在 EN TXT 中: ${stats.missingInJP.length}`);
  }
  if (stats.missingInEN.length > 0) {
    console.log(`  ⚠ 仅在 JP TXT 中: ${stats.missingInEN.length}`);
  }

  // 如果有差异，显示详细信息
  if (stats.different > 0) {
    console.log("\n行数不同的文件详情:");
    console.log("-".repeat(80));
    for (const detail of details.filter(d => !d.match)) {
      const diff = detail.enLines - detail.jpLines;
      const diffStr = diff > 0 ? `+${diff}` : String(diff);
      console.log(
        `  ${detail.file}: JP=${detail.jpLines} 行, EN=${detail.enLines} 行 (差异 ${diffStr})`
      );
    }
  }

  console.log("=".repeat(80));

  // 返回退出码
  if (stats.different > 0 || stats.missingInJP.length > 0 || stats.missingInEN.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
